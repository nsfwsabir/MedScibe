import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '../../lib/supabase';
import { TranscriptResult } from './types';

/**
 * Cloud transcription via the `transcribe-audio` edge function
 * (Groq whisper-large-v3-turbo). Used for the legacy file path on Android
 * and to refine live-dictation audio after Stop.
 */
export async function cloudTranscribe(
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
    console.log(`[whisper] cloud transcribe: invoking transcribe-audio (${mime}, ${Math.round(base64.length / 1024)} KB b64, uri=${audioUri.slice(0, 60)})`);

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
    // Propagate to caller — don't swallow as null, so callers can show the
    // real cause instead of silently falling back.
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
