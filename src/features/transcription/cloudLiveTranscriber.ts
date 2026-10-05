import * as FileSystem from 'expo-file-system/legacy';
import { Buffer } from 'buffer';
import { supabase } from '../../lib/supabase';
import { LiveTranscript, LiveTranscriber } from './types';
import type { AudioPcmStream } from './audioStream';

const SAMPLE_RATE = 16000;
// Chunk on ~500ms of sub-threshold audio, at least 2.5s and at most 5s per chunk.
// Shorter windows = lower latency; large-v3-turbo stays accurate on 3s+ clips.
const MIN_CHUNK_MS = 2500;
const MAX_CHUNK_MS = 5000;
const SILENCE_MS = 500;
const FRAME_SAMPLES = SAMPLE_RATE / 10; // 100ms RMS frames
const SILENCE_RMS = 300;
const SKIP_CHUNK_RMS = 150; // below this the chunk is room silence, not speech

const CACHE_DIR = () => `${FileSystem.cacheDirectory}whisper/`;
const LIVE_WAV_PATH = () => `${CACHE_DIR()}live-dictation.wav`;

function encodeWav(samples: Int16Array): Uint8Array {
  const dataBytes = samples.length * 2;
  const buf = new Uint8Array(44 + dataBytes);
  const v = new DataView(buf.buffer);
  const ascii = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i));
  };
  ascii(0, 'RIFF');
  v.setUint32(4, 36 + dataBytes, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, SAMPLE_RATE, true);
  v.setUint32(28, SAMPLE_RATE * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  ascii(36, 'data');
  v.setUint32(40, dataBytes, true);
  buf.set(new Uint8Array(samples.buffer, samples.byteOffset, dataBytes), 44);
  return buf;
}

function concatSamples(parts: Uint8Array[]): Int16Array {
  const total = parts.reduce((n, p) => n + Math.floor(p.length / 2), 0);
  const out = new Int16Array(total);
  let off = 0;
  for (const p of parts) {
    const s = new Int16Array(p.buffer, p.byteOffset, Math.floor(p.length / 2));
    out.set(s, off);
    off += s.length;
  }
  return out;
}

function rms(samples: Int16Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / samples.length);
}

/**
 * Cloud live dictation: mic PCM (16 kHz mono) is cut into chunks on silence
 * and each chunk goes to Groq large-v3-turbo via the transcribe-audio edge
 * function. Text streams in ~10-15s behind speech. No on-device models.
 */
export class CloudLiveTranscriber implements LiveTranscriber {
  readonly name = 'cloud large-v3-turbo';

  private adapter: AudioPcmStream | null = null;
  private emit: ((fullText: string) => void) | null = null;
  private level: ((level: number) => void) | null = null;
  private chunkParts: Uint8Array[] = [];
  private chunkSamples = 0;
  private silenceMs = 0;
  private fullParts: Uint8Array[] = [];
  private texts: string[] = [];
  private chain: Promise<void> = Promise.resolve();
  private paused = false;
  private stopped = false;
  private active = false;

  private fullText(): string {
    return this.texts.join(' ').replace(/\s+/g, ' ').trim();
  }

  private async uploadChunk(samples: Int16Array): Promise<void> {
    if (rms(samples) < SKIP_CHUNK_RMS) return;
    const wav = encodeWav(samples);
    const base64 = Buffer.from(wav).toString('base64');
    const { data, error } = await supabase.functions.invoke<{ text: string; language?: string }>(
      'transcribe-audio',
      { body: { audioBase64: base64, mimeType: 'audio/wav', filename: 'chunk.wav' } },
    );
    if (error) throw new Error((error as any).message ?? 'Chunk transcription failed');
    const text = data?.text?.trim();
    if (text) {
      this.texts.push(text);
      this.emit?.(this.fullText());
    }
  }

  private cut(): void {
    if (this.chunkSamples === 0) return;
    const samples = concatSamples(this.chunkParts);
    this.chunkParts = [];
    this.chunkSamples = 0;
    this.silenceMs = 0;
    this.chain = this.chain
      .then(() => this.uploadChunk(samples))
      .catch((e) => console.warn('[live] chunk failed, continuing', e));
  }

  private onPcm = (data: Uint8Array) => {
    if (this.paused || this.stopped) return;
    const bytes = data.length - (data.length % 2);
    if (bytes <= 0) return;
    const pcm = data.slice(0, bytes);
    this.chunkParts.push(pcm);
    this.fullParts.push(pcm);
    const samples = new Int16Array(pcm.buffer, pcm.byteOffset, bytes / 2);
    this.chunkSamples += samples.length;
    // Track trailing silence in 100ms frames; report level for the UI.
    for (let i = 0; i < samples.length; i += FRAME_SAMPLES) {
      const end = Math.min(i + FRAME_SAMPLES, samples.length);
      if (rms(samples.subarray(i, end)) < SILENCE_RMS) {
        this.silenceMs += ((end - i) / SAMPLE_RATE) * 1000;
      } else {
        this.silenceMs = 0;
      }
    }
    this.level?.(Math.min(1, rms(samples) / 3000));
    const bufferedMs = (this.chunkSamples / SAMPLE_RATE) * 1000;
    if ((bufferedMs >= MIN_CHUNK_MS && this.silenceMs >= SILENCE_MS) || bufferedMs >= MAX_CHUNK_MS) {
      this.cut();
    }
  };

  async start(onText: (fullText: string) => void, onLevel?: (level: number) => void): Promise<void> {
    const { createAudioPcmStream } = await import('./audioStream');
    this.emit = onText;
    this.level = onLevel ?? null;
    this.texts = [];
    this.chunkParts = [];
    this.fullParts = [];
    this.chunkSamples = 0;
    this.silenceMs = 0;
    this.paused = false;
    this.stopped = false;
    this.chain = Promise.resolve();
    await FileSystem.makeDirectoryAsync(CACHE_DIR(), { intermediates: true });
    await FileSystem.deleteAsync(LIVE_WAV_PATH(), { idempotent: true });
    this.adapter = createAudioPcmStream();
    this.adapter.onData(this.onPcm);
    this.adapter.onError((e) => console.warn('[live] audio stream error', e));
    await this.adapter.initialize({ sampleRate: SAMPLE_RATE, channels: 1, bitsPerSample: 16 });
    await this.adapter.start();
    this.active = true;
    console.log('[live] audio stream active: true (cloud)');
  }

  async pause(): Promise<void> {
    this.paused = true;
  }

  async resume(): Promise<void> {
    this.paused = false;
  }

  async stop(): Promise<LiveTranscript> {
    this.stopped = true;
    try {
      await this.adapter?.stop().catch(() => undefined);
      this.cut();
      await this.chain;
      let audioUri: string | null = null;
      if (this.fullParts.length > 0) {
        // Retention audio is best-effort: a failed write must not lose the transcript.
        try {
          const wav = encodeWav(concatSamples(this.fullParts));
          const path = LIVE_WAV_PATH();
          await FileSystem.writeAsStringAsync(path, Buffer.from(wav).toString('base64'), {
            encoding: 'base64',
          });
          audioUri = path;
        } catch (e) {
          console.warn('[live] session wav write failed, continuing without audio', e);
        }
      }
      return { text: this.fullText(), audioUri };
    } finally {
      this.active = false;
      this.emit = null;
      this.level = null;
      this.adapter = null;
      console.log('[live] audio stream active: false (cloud)');
    }
  }
}
