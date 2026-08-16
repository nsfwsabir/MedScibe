import { supabase } from '../../lib/supabase';
import type { Database } from '../../lib/supabase';

export type Note = Database['public']['Tables']['notes']['Row'];
export type NoteInsert = Database['public']['Tables']['notes']['Insert'];
export type NoteUpdate = Database['public']['Tables']['notes']['Update'];

export type NoteFilters = {
  query?: string;
  status?: 'draft' | 'finalized';
  dateFrom?: string;
  dateTo?: string;
};

export async function fetchNotes(filters: NoteFilters = {}) {
  let q = supabase.from('notes').select('*').is('deleted_at', null);
  if (filters.status) q = q.eq('status', filters.status);
  if (filters.dateFrom) q = q.gte('visit_date', filters.dateFrom);
  if (filters.dateTo) q = q.lte('visit_date', filters.dateTo);
  if (filters.query) {
    const pattern = `%${filters.query}%`;
    q = q.or(
      `patient_name.ilike.${pattern},raw_transcript.ilike.${pattern},chief_complaint.ilike.${pattern},subjective.ilike.${pattern},objective.ilike.${pattern},assessment.ilike.${pattern},plan.ilike.${pattern}`,
    );
  }
  const { data, error } = await q
    .order('visit_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function fetchNote(id: string) {
  const { data, error } = await supabase.from('notes').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function createNote(input: NoteInsert) {
  const { data, error } = await supabase.from('notes').insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function updateNote(id: string, patch: NoteUpdate) {
  const { data, error } = await supabase
    .from('notes')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function softDeleteNote(id: string) {
  const { error } = await supabase
    .from('notes')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}
