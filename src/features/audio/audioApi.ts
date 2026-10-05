import * as FileSystem from 'expo-file-system/legacy';
import { Buffer } from 'buffer';
import { supabase } from '../../lib/supabase';

export type UploadResult = {
  audio_path: string | null;
  audio_retention_until: string | null;
};

function base64ToUint8Array(base64: string): Uint8Array {
  return new Uint8Array(Buffer.from(base64, 'base64'));
}

async function fileToUint8Array(uri: string): Promise<Uint8Array> {
  // Try fetch first (works for file:// on iOS/Android RN), fallback to FileSystem base64.
  try {
    const res = await fetch(uri);
    if (res.ok) {
      const ab = await res.arrayBuffer();
      if (ab.byteLength > 0) return new Uint8Array(ab);
    }
  } catch {}
  const b64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
  return base64ToUint8Array(b64);
}

export async function uploadAudio(opts: {
  audioUri: string;
  noteId: string;
  retainOriginalAudio: boolean;
  retentionDays: number;
}): Promise<UploadResult> {
  if (!opts.retainOriginalAudio) {
    return { audio_path: null, audio_retention_until: null };
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    console.warn('[audio] no user — skipping upload');
    return { audio_path: null, audio_retention_until: null };
  }
  const retentionUntil = new Date(Date.now() + opts.retentionDays * 24 * 60 * 60 * 1000).toISOString();
  const path = `${user.id}/${opts.noteId}.m4a`;

  try {
    const bytes = await fileToUint8Array(opts.audioUri);
    const { error } = await supabase.storage.from('audio').upload(path, bytes, {
      contentType: 'audio/m4a',
      upsert: true,
    });
    if (error) throw error;
    return { audio_path: path, audio_retention_until: retentionUntil };
  } catch (e) {
    console.warn('[audio] upload failed', e);
    // Don't block pipeline — note exists without audio
    return { audio_path: null, audio_retention_until: null };
  }
}
