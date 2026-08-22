import { supabase } from '../../lib/supabase';
import type { Database } from '../../lib/supabase';

export type Macro = Database['public']['Tables']['note_macros']['Row'];

export type MacroInput = {
  shortcut: string;
  expansion: string;
};

export function normalizeShortcut(raw: string): string {
  return raw.trim().toLowerCase();
}

export function validateMacro(input: MacroInput): string | null {
  const shortcut = normalizeShortcut(input.shortcut);
  const expansion = input.expansion.trim();
  if (shortcut.length < 2 || shortcut.length > 32) {
    return 'Shortcut must be 2-32 characters.';
  }
  if (/\s/.test(shortcut)) {
    return 'Shortcut must be a single word (no spaces).';
  }
  if (expansion.length === 0) {
    return 'Expansion text is required.';
  }
  return null;
}

export async function fetchMacros() {
  const { data, error } = await supabase
    .from('note_macros')
    .select('*')
    .order('shortcut', { ascending: true });
  if (error) throw error;
  return data;
}

export async function createMacro(input: MacroInput) {
  const { data, error } = await supabase
    .from('note_macros')
    .insert({
      shortcut: normalizeShortcut(input.shortcut),
      expansion: input.expansion.trim(),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteMacro(id: string) {
  const { error } = await supabase.from('note_macros').delete().eq('id', id);
  if (error) throw error;
}
