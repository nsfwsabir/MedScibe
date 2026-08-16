import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

export type Database = {
  public: {
    Tables: {
      notes: {
        Row: {
          id: string;
          author_id: string;
          note_type: 'dictation' | 'consultation';
          status: 'draft' | 'finalized';
          patient_name: string | null;
          patient_age: number | null;
          patient_sex: string | null;
          visit_date: string;
          chief_complaint: string | null;
          raw_transcript: string | null;
          subjective: string | null;
          objective: string | null;
          assessment: string | null;
          plan: string | null;
          audio_path: string | null;
          audio_retention_until: string | null;
          duration_seconds: number | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          author_id?: string;
          note_type: 'dictation' | 'consultation';
          status?: 'draft' | 'finalized';
          patient_name?: string | null;
          patient_age?: number | null;
          patient_sex?: string | null;
          visit_date?: string;
          chief_complaint?: string | null;
          raw_transcript?: string | null;
          subjective?: string | null;
          objective?: string | null;
          assessment?: string | null;
          plan?: string | null;
          audio_path?: string | null;
          audio_retention_until?: string | null;
          duration_seconds?: number | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          author_id?: string;
          note_type?: 'dictation' | 'consultation';
          status?: 'draft' | 'finalized';
          patient_name?: string | null;
          patient_age?: number | null;
          patient_sex?: string | null;
          visit_date?: string;
          chief_complaint?: string | null;
          raw_transcript?: string | null;
          subjective?: string | null;
          objective?: string | null;
          assessment?: string | null;
          plan?: string | null;
          audio_path?: string | null;
          audio_retention_until?: string | null;
          duration_seconds?: number | null;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};

export const supabase: SupabaseClient<Database> = createClient<Database>(
  env.supabaseUrl,
  env.supabaseAnonKey,
);
