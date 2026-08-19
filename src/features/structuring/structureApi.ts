import { supabase } from '../../lib/supabase';

export interface StructureRequest {
  transcript: string;
  note_type: 'dictation' | 'consultation';
}

export interface StructureResponse {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  chief_complaint_suggestion: string;
  low_confidence_spans: string[];
}

export async function structureNote(input: StructureRequest): Promise<StructureResponse> {
  const { data, error } = await supabase.functions.invoke<StructureResponse>('structure-note', {
    body: input,
  });
  if (error) throw error;
  if (!data) throw new Error('Structuring returned an empty response.');
  return data;
}