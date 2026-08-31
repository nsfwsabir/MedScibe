import { supabase } from '../../lib/supabase';

export interface CleanupRequest {
  transcript: string;
}

export interface CleanupResponse {
  note_text: string;
  low_confidence_spans: string[];
}

export async function cleanupTranscript(input: CleanupRequest): Promise<CleanupResponse> {
  const { data, error } = await supabase.functions.invoke<CleanupResponse>('structure-note', {
    body: input,
  });
  if (error) {
    // Supabase FunctionsHttpError often wraps the JSON error in `context`
    const ctx: any = (error as any).context;
    const detail =
      ctx?.error ||
      (typeof ctx === 'object' && ctx !== null ? JSON.stringify(ctx).slice(0, 500) : '') ||
      (error as any).message ||
      'Unknown edge function error';
    const msg = `Edge Function failed: ${detail}`;
    console.error('[structureApi] cleanup failed', error, detail);
    const e: any = new Error(msg);
    e.cause = error;
    // Mark as retriable if it's a 502/5xx
    e.isEdgeFunctionError = true;
    throw e;
  }
  if (!data) throw new Error('Cleanup returned an empty response.');
  return data;
}