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
  if (error) throw error;
  if (!data) throw new Error('Cleanup returned an empty response.');
  return data;
}