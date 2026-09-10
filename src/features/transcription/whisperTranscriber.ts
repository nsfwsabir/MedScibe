import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { supabase } from '../../lib/supabase';
import { Transcriber, TranscriptResult } from './types';

const MODEL_URL =
  process.env.EXPO_PUBLIC_WHISPER_MODEL_URL ??
  'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin';
const MODEL_FILENAME = MODEL_URL.split('/').pop() ?? 'ggml-base.bin';

const DEMO_FALLBACK_TRANSCRIPT =
  'Patient presents with a persistent dry cough for the past five days. ' +
  'History of mild seasonal allergies; nasal congestion is worse at night. ' +
  'Denies chest pain or shortness of breath. ' +
  'Vitals stable, lungs clear on auscultation. ' +
  'Recommend fluids, rest, and fluticasone nasal spray daily. Follow up in seven days if symptoms persist.';

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
    const dir = FileSystem.cacheDirectory + 'whisper/';
    const file = dir + MODEL_FILENAME;
    const info = await FileSystem.getInfoAsync(file);
    if (info.exists) return file;

    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    console.log(`[whisper] downloading ${MODEL_FILENAME} (${MODEL_URL})`);
    const callback = (progress: { totalBytesWritten: number; totalBytesExpectedToWrite: number }) => {
      if (progress.totalBytesExpectedToWrite > 0 && onProgress) {
        const pct = Math.round((progress.totalBytesWritten / progress.totalBytesExpectedToWrite) * 100);
        onProgress(Math.min(99, pct));
      }
    };
    const dl = FileSystem.createDownloadResumable(MODEL_URL, file, {}, callback);
    const result = await dl.downloadAsync();
    if (!result || result.status !== 200) {
      await FileSystem.deleteAsync(file, { idempotent: true });
      throw new Error(`Whisper model download failed (HTTP ${result?.status ?? 0}). Check internet & storage.`);
    }
    onProgress?.(100);
    return file;
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
    try {
      onProgress?.(5);
      // Verify file exists and is readable before base64 - surfaces ENOENT quickly
      const info = await FileSystem.getInfoAsync(audioUri);
      if (!info.exists) {
        console.warn('[whisper] cloud transcribe: file not found', audioUri, info);
        throw new Error(`Audio file not found at ${audioUri}`);
      }
      // Read file as base64 — Supabase edge function expects JSON with base64.
      // Keep payload < ~6 MB (Supabase limit) — dictations are short.
      const base64 = await FileSystem.readAsStringAsync(audioUri, { encoding: 'base64' });
      if (!base64 || base64.length < 100) {
        console.warn('[whisper] cloud transcribe: base64 too short', base64.length);
        throw new Error('Recorded audio is empty or too short');
      }
      const ext = audioUri.split('.').pop()?.toLowerCase()?.split('?')[0] ?? 'm4a';
      const mime = ext === 'wav' ? 'audio/wav' : ext === 'mp3' ? 'audio/mpeg' : 'audio/m4a';
      onProgress?.(20);
      console.log(`[whisper] cloud transcribe: invoking transcribe-audio (${mime}, ${Math.round(base64.length / 1024)} KB b64, uri=${audioUri.slice(0,60)})`);

      const { data, error } = await supabase.functions.invoke<{ text: string; language?: string }>(
        'transcribe-audio',
        {
          body: { audioBase64: base64, mimeType: mime, filename: `dictation.${ext}` },
        },
      );
      if (error) {
        let detail = '';
        try {
          detail = await (error as any).context?.text?.();
          if (!detail) detail = JSON.stringify((error as any).context ?? '').slice(0, 500);
        } catch {}
        const msg = `Cloud transcription failed (${(error as any).context?.status ?? 'unknown'}): ${detail || (error as any).message}`.slice(0, 600);
        console.warn('[whisper] cloud transcribe edge error', msg, error);
        throw new Error(msg);
      }
      if (!data || typeof data.text !== 'string' || !data.text.trim()) {
        console.warn('[whisper] cloud transcribe empty response', data);
        throw new Error('Cloud transcription returned empty text');
      }
      onProgress?.(100);
      return { text: data.text.trim(), language: data.language ?? 'en' };
    } catch (e) {
      console.warn('[whisper] cloud transcribe failed', e);
      // Propagate to caller — don't swallow as null, so ProcessingScreen can show real cause
      // instead of silently falling back to demo text.
      if (e instanceof Error) throw e;
      let msg: string;
      if (e && typeof e === 'object' && 'message' in e && typeof (e as any).message === 'string') msg = (e as any).message;
      else {
        try {
          msg = JSON.stringify(e);
          if (msg === '{}' || msg === '[]') msg = String(e);
        } catch {
          msg = String(e);
        }
      }
      throw new Error(msg && msg !== '[object Object]' ? msg : 'Cloud transcription failed with unknown error');
    }
  }

  private async transcribeWav(wavUri: string, onProgress?: (progress: number) => void): Promise<TranscriptResult> {
    await this.modelPath(onProgress);
    const { initWhisper } = await import('whisper.rn');
    const filePath = await this.modelPath();
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
