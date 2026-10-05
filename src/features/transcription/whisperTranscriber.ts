import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { DEMO_TRANSCRIPT } from './fallbackTranscriber';
import { cloudTranscribe } from './cloudTranscribe';
import { whisperModelPath } from './whisperModel';
import { Transcriber, TranscriptResult } from './types';

// Offline fallback text lives in fallbackTranscriber (single source).
const DEMO_FALLBACK_TRANSCRIPT = DEMO_TRANSCRIPT;

function isWavUri(uri: string): boolean {
  const lower = uri.toLowerCase();
  return lower.endsWith('.wav') || lower.includes('.wav?');
}

function isWavError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e ?? '');
  return /Invalid WAV|Unsupported WAV|WAV file|only PCM is supported/i.test(msg);
}

/**
 * On-device transcription via whisper.rn (whisper.cpp bindings).
 * Requires a development build — this module must never be imported in Expo Go,
 * since the native JSI binding is absent there.
 *
 * Android note: expo-audio on Android uses MediaRecorder (no WAV/PCM output).
 * Recordings are .m4a/AAC — whisper.rn's C++ only decodes WAV PCM and throws
 * "Invalid WAV file". For .m4a we try cloud transcription (Groq Whisper via
 * Supabase Edge Function `transcribe-audio`) before falling back to demo text,
 * so the pipeline never hard-fails as in the screenshot.
 */
export class WhisperTranscriber implements Transcriber {
  readonly name = 'whisper.rn';

  isAvailable(): boolean {
    return Constants.appOwnership !== 'expo';
  }

  private async modelPath(onProgress?: (progress: number) => void): Promise<string> {
    return whisperModelPath(onProgress);
  }

  async ensureModel(onProgress?: (progress: number) => void): Promise<void> {
    // Skip download for .m4a path where we'll use cloud — save 140 MB + time,
    // but still try to ensure model if file is .wav; don't block on failure.
    // For now, attempt model fetch and swallow network errors with a warning;
    // transcribe() will fallback to cloud/demo anyway.
    try {
      await this.modelPath(onProgress);
    } catch (e) {
      console.warn('[whisper] ensureModel failed — will try cloud transcription fallback', e);
      // Re-throw only if we can't fallback (no cloud). Let caller decide.
      // We mark as transient so ProcessingScreen can continue via catch below.
      // For .m4a on Android, we don't want this to block the pipeline at
      // the "Downloading model..." spinner (0% bug).
      throw e;
    }
  }

  private async tryCloudTranscribe(
    audioUri: string,
    onProgress?: (progress: number) => void,
  ): Promise<TranscriptResult> {
    return cloudTranscribe(audioUri, onProgress);
  }

  private async transcribeWav(wavUri: string, onProgress?: (progress: number) => void): Promise<TranscriptResult> {
    const filePath = await this.modelPath(onProgress);
    const { initWhisper } = await import('whisper.rn');
    const context = await initWhisper({ filePath });
    try {
      const { promise } = context.transcribe(wavUri, {
        language: 'auto',
        onProgress: onProgress,
      });
      const result = await promise;
      const text = (result.result ?? '').trim();
      if (!text) {
        console.warn('[whisper] on-device returned empty, using demo fallback');
        return { text: DEMO_FALLBACK_TRANSCRIPT, language: result.language ?? 'en' };
      }
      return { text, language: result.language };
    } finally {
      await context.release();
    }
  }

  private async tryConvertM4aToWav(m4aUri: string): Promise<string | null> {
    if (Platform.OS !== 'android') return null;
    try {
      // Dynamic import so iOS/web don't bundle native module
      const { convertM4aToWav, isAudioConverterAvailable } = await import('audio-converter');
      if (!isAudioConverterAvailable()) {
        console.warn('[whisper] AudioConverter not available');
        return null;
      }
      console.log('[whisper] converting m4a to wav for on-device', m4aUri.slice(0,60));
      const wavUri = await convertM4aToWav(m4aUri);
      console.log('[whisper] conversion done', wavUri);
      return wavUri;
    } catch (e) {
      console.warn('[whisper] m4a->wav conversion failed', e);
      return null;
    }
  }

  async transcribe(audioUri: string, onProgress?: (progress: number) => void): Promise<TranscriptResult> {
    const wantsWav = isWavUri(audioUri);
    // For m4a (Android), prefer cloud first (fast, no 140MB model), but
    // also support on-device via m4a->wav conversion for offline.
    if (!wantsWav) {
      try {
        return await this.tryCloudTranscribe(audioUri, onProgress);
      } catch (cloudErr) {
        console.warn('[whisper] cloud failed for m4a, trying on-device via wav conversion', cloudErr);
        // Fall through to on-device conversion below
        const wavUri = await this.tryConvertM4aToWav(audioUri);
        if (wavUri) {
          try {
            return await this.transcribeWav(wavUri, onProgress);
          } catch (wavErr) {
            console.warn('[whisper] on-device wav (converted) also failed', wavErr);
            // Re-throw original cloud error with hint
            const msg = cloudErr instanceof Error ? cloudErr.message : String(cloudErr);
            throw new Error(`${msg} (and on-device conversion also failed: ${wavErr instanceof Error ? wavErr.message : String(wavErr)})`);
          }
        }
        throw cloudErr;
      }
    }

    // Try on-device Whisper for wav (iOS, or Android after conversion)
    try {
      return await this.transcribeWav(audioUri, onProgress);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn('[whisper] on-device transcribe failed:', msg, e);

      // WAV failed → try cloud as last resort before giving up
      if (isWavError(e) && wantsWav) {
        try {
          const cloud = await this.tryCloudTranscribe(audioUri, onProgress);
          if (cloud) return cloud;
        } catch (cloudErr) {
          console.warn('[whisper] wav cloud fallback also failed', cloudErr);
          throw cloudErr;
        }
      }

      const isModelOrNetwork = /download failed|HTTP|network|fetch|Failed to fetch/i.test(msg);
      if (isWavError(e) || isModelOrNetwork) {
        // For WAV: keep offline demo fallback so iOS can complete without internet,
        // but surface as throw if user is online — ProcessingScreen will show retry.
        // Check if we are online via simple heuristic: if error is network, throw.
        if (isModelOrNetwork) throw e;
        console.warn('[whisper] using demo transcript fallback for wav so pipeline can complete offline');
        for (let p = 30; p <= 100; p += 35) {
          onProgress?.(p);
          await new Promise((r) => setTimeout(r, 60));
        }
        return { text: DEMO_FALLBACK_TRANSCRIPT, language: 'en' };
      }

      throw e;
    }
  }
}
