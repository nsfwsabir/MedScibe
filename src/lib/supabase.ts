import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

export type Database = {
  public: {
    Tables: {
      note_macros: {
        Row: {
          id: string;
          author_id: string;
          shortcut: string;
          expansion: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          author_id?: string;
          shortcut: string;
          expansion: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          author_id?: string;
          shortcut?: string;
          expansion?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      notes: {
        Row: {
          id: string;
          author_id: string;
          status: 'draft' | 'finalized';
          patient_name: string | null;
          patient_age: number | null;
          patient_sex: string | null;
          visit_date: string;
          raw_transcript: string | null;
          note_text: string | null;
          audio_path: string | null;
          audio_retention_until: string | null;
          duration_seconds: number | null;
          low_confidence_spans: string[] | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          author_id?: string;
          status?: 'draft' | 'finalized';
          patient_name?: string | null;
          patient_age?: number | null;
          patient_sex?: string | null;
          visit_date?: string;
          raw_transcript?: string | null;
          note_text?: string | null;
          audio_path?: string | null;
          audio_retention_until?: string | null;
          duration_seconds?: number | null;
          low_confidence_spans?: string[] | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          author_id?: string;
          status?: 'draft' | 'finalized';
          patient_name?: string | null;
          patient_age?: number | null;
          patient_sex?: string | null;
          visit_date?: string;
          raw_transcript?: string | null;
          note_text?: string | null;
          audio_path?: string | null;
          audio_retention_until?: string | null;
          duration_seconds?: number | null;
          low_confidence_spans?: string[] | null;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      audit_log: {
        Row: {
          id: string;
          note_id: string | null;
          author_id: string;
          action: 'create' | 'view' | 'update' | 'export' | 'soft_delete' | 'permanent_delete';
          created_at: string;
        };
        Insert: {
          id?: string;
          note_id?: string | null;
          author_id?: string;
          action: 'create' | 'view' | 'update' | 'export' | 'soft_delete' | 'permanent_delete';
          created_at?: string;
        };
        Update: {
          id?: string;
          note_id?: string | null;
          author_id?: string;
          action?: 'create' | 'view' | 'update' | 'export' | 'soft_delete' | 'permanent_delete';
          created_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          specialty: string | null;
          phone: string | null;
          clinic_name: string | null;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          specialty?: string | null;
          phone?: string | null;
          clinic_name?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          specialty?: string | null;
          phone?: string | null;
          clinic_name?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};

const url = env.supabaseUrl || 'https://placeholder.supabase.co';
const anonKey = env.supabaseAnonKey || 'placeholder-anon-key';

if (!env.supabaseUrl || !env.supabaseAnonKey) {
  console.warn(
    '[supabase] EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY not set — using placeholder. Backend calls will fail.',
  );
}

export const supabase: SupabaseClient<Database> = createClient<Database>(url, anonKey);

/** Throws if backend is not configured — use before network calls to fail fast in dev. */
export function assertBackendConfigured(): void {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    throw new Error('Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.');
  }
}
