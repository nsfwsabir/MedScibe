import * as FileSystem from 'expo-file-system/legacy';
import { LiveTranscript, LiveTranscriber } from './types';
import { vadModelPath, liveModelPath } from './whisperModel';

const LIVE_WAV_PATH = () => `${FileSystem.cacheDirectory}whisper/live-dictation.wav`;

/**
 * On-device live dictation via whisper.rn RealtimeTranscriber (dev builds only).
 * VAD auto-slices on speech pauses; slice texts accumulate into the full transcript.
 * The session WAV is written for the audio-retention upload path.
 * VAD is best-effort: when its model can't download, time-based slicing takes over.
 */
export class WhisperLiveTranscriber implements LiveTranscriber {
  readonly name = 'whisper.rn realtime';

  private realtime: import('whisper.rn/realtime-transcription/index').RealtimeTranscriber | null = null;
  private contexts: { release(): Promise<void> }[] = [];
  private audioUri: string | null = null;
  private slices = new Map<number, string>();
  private loggedSlices = new Set<number>();
  private emit: ((fullText: string) => void) | null = null;
  private pausedText = '';
  private active = false;

  private fullText(): string {
    const ordered = [...this.slices.entries()].sort((a, b) => a[0] - b[0]).map(([, t]) => t);
    return (this.pausedText + (this.pausedText && ordered.length > 0 ? ' ' : '') + ordered.join(' '))
      .replace(/\s+/g, ' ')
      .trim();
  }

  private static logStep(step: string) {
    console.log(`[live] init: ${step}`);
  }

  private async buildSession(onText: (fullText: string) => void, isResume: boolean) {
    const log = WhisperLiveTranscriber.logStep;
    log('importing whisper.rn');
    const { initWhisper, initWhisperVad } = await import('whisper.rn');
    log(`root exports (initWhisper=${typeof initWhisper}, initWhisperVad=${typeof initWhisperVad})`);
    // Explicit /index: the package exports map points the bare directory form
    // at a nonexistent file, which Metro (unlike tsc) won't fall back from.
    log('importing realtime-transcription');
    const { RealtimeTranscriber, RingBufferVad } = await import(
      'whisper.rn/realtime-transcription/index'
    );
    log('importing AudioPcmStreamAdapter');
    const { AudioPcmStreamAdapter } = await import(
      'whisper.rn/realtime-transcription/adapters/AudioPcmStreamAdapter'
    );

    const modelFile = await liveModelPath();
    let context: { release(): Promise<void> };
    try {
      context = await initWhisper({ filePath: modelFile });
    } catch (e) {
      // initWhisper reports corrupt files only as a bare JSI error — drop the
      // file, fetch it again, and retry once before surfacing the failure.
      console.warn('[live] whisper init failed, redownloading model and retrying', e);
      await FileSystem.deleteAsync(modelFile, { idempotent: true });
      context = await initWhisper({ filePath: await liveModelPath() });
    }
    this.contexts.push(context);

    let vadContext: unknown;
    try {
      // RealtimeTranscriber needs a streaming VAD (onSpeechStart/...), not the
      // raw WhisperVadContext — RingBufferVad adapts it with ring buffering.
      const whisperVad = await initWhisperVad({ filePath: await vadModelPath() });
      this.contexts.push(whisperVad);
      // Generous padding/silence so word endings survive slicing
      // (clipped audio is what turns "edema" into "e").
      vadContext = new RingBufferVad(whisperVad, {
        vadPreset: 'default',
        sampleRate: 16000,
        vadOptions: { speechPadMs: 200, minSilenceDurationMs: 300 },
      });
      log('VAD ready');
    } catch (e) {
      console.warn('[live] VAD model unavailable, falling back to time slicing', e);
    }

    this.audioUri = LIVE_WAV_PATH();
    // WavFileWriter appends per audio chunk; expo has no append API, so buffer
    // chunks in memory and flush the complete file on finalize (stop).
    let header = '';
    let chunks: string[] = [];
    // Resume continuity: seed with pre-pause PCM (strip the 44-byte WAV header).
    if (isResume) {
      try {
        const info = await FileSystem.getInfoAsync(this.audioUri);
        if (info.exists && (info.size ?? 0) > 44) {
          const prior = await FileSystem.readAsStringAsync(this.audioUri, { encoding: 'base64' });
          // 44-byte PCM header encodes to exactly 60 base64 chars.
          chunks = [prior.slice(60)];
        }
      } catch {
        chunks = [];
      }
    }
    const fs = {
      writeFile: async (path: string, data: string) => {
        if (chunks.length > 0) {
          await FileSystem.writeAsStringAsync(path, header + chunks.join(''), { encoding: 'base64' });
          chunks = [];
        } else {
          header = data;
          await FileSystem.writeAsStringAsync(path, data, { encoding: 'base64' });
        }
      },
      appendFile: async (_path: string, data: string) => {
        chunks.push(data);
      },
      readFile: async () => header + chunks.join(''),
      exists: async (path: string) => (await FileSystem.getInfoAsync(path)).exists,
      unlink: (path: string) => FileSystem.deleteAsync(path, { idempotent: true }),
    };

    this.emit = onText;
    this.slices.clear();
    this.loggedSlices.clear();
    // Without VAD there is no speech-pause slicing, so cut short time slices
    // — otherwise the first text only appears after a full 30s slice.
    const sliceSec = vadContext ? 30 : 8;
    this.realtime = new RealtimeTranscriber(
      { whisperContext: context, vadContext, audioStream: new AudioPcmStreamAdapter(), fs },
      {
        audioSliceSec: sliceSec,
        // Sub-2s fragments transcribe badly on any model — hold for 2s of speech.
        audioMinSec: 2,
        audioOutputPath: this.audioUri,
        audioStreamConfig: { sampleRate: 16000, channels: 1, bitsPerSample: 16 },
        // Fixed English (auto-detect misfires on 2s slices), greedy sampling,
        // and a clinical prompt so domain vocabulary wins over generic guesses.
        transcribeOptions: { language: 'en', translate: false, temperature: 0 },
        initialPrompt:
          'Clinical report dictated by a doctor: patient history and presenting complaints, examination findings, vitals, investigations, diagnosis, prescription with dosage and follow-up plan. Measurements in centimeters and millimeters.',
        promptPreviousSlices: true,
      },
      {
        onTranscribe: (event) => {
          const text = event.data?.result?.trim();
          if (event.type === 'transcribe' && text) {
            if (!this.loggedSlices.has(event.sliceIndex)) {
              this.loggedSlices.add(event.sliceIndex);
              console.log(`[live] slice ${event.sliceIndex} transcribed (${text.length} chars)`);
            }
            this.slices.set(event.sliceIndex, text);
            this.emit?.(this.fullText());
          }
        },
        onError: (error) => console.warn('[live] realtime error', error),
        onStatusChange: (isActive) => console.log('[live] audio stream active:', isActive),
      },
    );
    await this.realtime.start();
    this.active = true;
  }

  async start(onText: (fullText: string) => void): Promise<void> {
    this.pausedText = '';
    // Fresh session: drop any WAV left over from a previous dictation.
    await FileSystem.deleteAsync(LIVE_WAV_PATH(), { idempotent: true });
    await this.buildSession(onText, false);
  }

  async pause(): Promise<void> {
    if (!this.active) return;
    await this.realtime?.stop();
    this.active = false;
    this.pausedText = this.fullText();
    this.slices.clear();
  }

  async resume(): Promise<void> {
    if (this.active || !this.emit) return;
    await this.buildSession(this.emit, true);
  }

  async stop(): Promise<LiveTranscript> {
    try {
      // stop() drains in-flight slices (each emits onTranscribe), then clears
      // its internal results — our accumulated map is already complete.
      await this.realtime?.stop();
      return { text: this.fullText(), audioUri: this.audioUri };
    } finally {
      this.active = false;
      this.emit = null;
      this.slices.clear();
      this.pausedText = '';
      const contexts = this.contexts;
      this.contexts = [];
      this.realtime = null;
      await Promise.allSettled(contexts.map((c) => c.release()));
    }
  }
}
