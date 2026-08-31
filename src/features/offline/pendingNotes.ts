import { getDb } from './db';
import type { NoteInsert } from '../notes/notesApi';
import { supabase } from '../../lib/supabase';
import { uploadAudio } from '../audio/audioApi';
import { useSettingsStore } from '../settings/settingsStore';
import { cleanupTranscript } from '../structuring/structureApi';
import { fetchMacros } from '../macros/macrosApi';
import { expandMacros } from '../macros/expansion';

export type PendingNote = {
  local_id: string;
  payload: string; // JSON string of NoteInsert
  audio_uri: string | null;
  duration_seconds: number | null;
  created_at: string;
};

function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function enqueuePendingNote(
  input: NoteInsert,
  audioUri: string | null,
  durationSeconds: number | null,
): Promise<string> {
  const db = await getDb();
  const localId = genId();
  await db.runAsync(
    'INSERT INTO pending_notes (local_id, payload, audio_uri, duration_seconds, created_at) VALUES (?, ?, ?, ?, ?)',
    localId,
    JSON.stringify(input),
    audioUri,
    durationSeconds,
    new Date().toISOString(),
  );
  return localId;
}

export async function fetchPendingNotes(): Promise<PendingNote[]> {
  const db = await getDb();
  return db.getAllAsync<PendingNote>('SELECT * FROM pending_notes ORDER BY created_at ASC');
}

export async function removePendingNote(localId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM pending_notes WHERE local_id = ?', localId);
}

export async function countPendingNotes(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) as c FROM pending_notes');
  return row?.c ?? 0;
}

export async function syncPendingNotes(): Promise<{ synced: number; failed: number }> {
  const pending = await fetchPendingNotes();
  let synced = 0;
  let failed = 0;
  const { retainOriginalAudio, retentionDays } = useSettingsStore.getState();
  for (const p of pending) {
    try {
      const payload = JSON.parse(p.payload) as NoteInsert;
      const { data, error } = await supabase.from('notes').insert(payload).select().single();
      if (error) throw error;
      // Try to clean transcript server-side if possible
      if (data?.id && payload.raw_transcript) {
        try {
          const cleaned = await cleanupTranscript({ transcript: payload.raw_transcript });
          const macros = await fetchMacros();
          const patch: Record<string, unknown> = {
            note_text: expandMacros(cleaned.note_text || '', macros) || null,
            low_confidence_spans: cleaned.low_confidence_spans.length ? cleaned.low_confidence_spans : null,
          };
          if (p.audio_uri && retainOriginalAudio) {
            const up = await uploadAudio({
              audioUri: p.audio_uri,
              noteId: data.id,
              retainOriginalAudio,
              retentionDays,
            });
            if (up.audio_path) {
              (patch as any).audio_path = up.audio_path;
              (patch as any).audio_retention_until = up.audio_retention_until;
            }
          }
          await supabase.from('notes').update(patch as any).eq('id', data.id);
        } catch (cleanErr) {
          console.warn('[offline] cleaning failed, falling back to raw', cleanErr);
          try {
            const macros = await fetchMacros().catch(() => [] as any[]);
            const fallbackPatch: Record<string, unknown> = {
              note_text: expandMacros(payload.raw_transcript || '', macros as any) || null,
              low_confidence_spans: null,
            };
            if (p.audio_uri && retainOriginalAudio) {
              try {
                const up = await uploadAudio({
                  audioUri: p.audio_uri,
                  noteId: data.id,
                  retainOriginalAudio,
                  retentionDays,
                });
                if (up.audio_path) {
                  (fallbackPatch as any).audio_path = up.audio_path;
                  (fallbackPatch as any).audio_retention_until = up.audio_retention_until;
                }
              } catch {}
            }
            await supabase.from('notes').update(fallbackPatch as any).eq('id', data.id);
          } catch {}
        }
      } else if (p.audio_uri && retainOriginalAudio && data?.id) {
        try {
          const up = await uploadAudio({
            audioUri: p.audio_uri,
            noteId: data.id,
            retainOriginalAudio,
            retentionDays,
          });
          if (up.audio_path) {
            await supabase
              .from('notes')
              .update({ audio_path: up.audio_path, audio_retention_until: up.audio_retention_until } as any)
              .eq('id', data.id);
          }
        } catch {}
      }
      await removePendingNote(p.local_id);
      synced += 1;
    } catch (e) {
      console.warn('[offline] sync failed for', p.local_id, e);
      failed += 1;
    }
  }
  return { synced, failed };
}
