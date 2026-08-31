import { supabase } from '../../lib/supabase';

export type AuditAction = 'create' | 'view' | 'update' | 'export' | 'soft_delete' | 'permanent_delete';

export async function logAudit(noteId: string | null, action: AuditAction): Promise<void> {
  try {
    const { error } = await supabase.from('audit_log' as any).insert({ note_id: noteId, action } as any);
    if (error) throw error;
  } catch (e) {
    console.warn('[audit] failed to log', action, e);
  }
}
