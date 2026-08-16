import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { loadPersistedSession, persistSession } from '../../lib/session';

type AuthState = {
  session: Session | null;
  user: User | null;
  initializing: boolean;
  error: string | null;
  bootstrap: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  initializing: true,
  error: null,

  bootstrap: async () => {
    const { data } = await supabase.auth.getSession();
    const session = data.session ?? (await loadPersistedSession());
    await persistSession(session);
    supabase.auth.onAuthStateChange((_event, newSession) => {
      set({ session: newSession, user: newSession?.user ?? null });
      void persistSession(newSession);
    });
    set({ session, user: session?.user ?? null, initializing: false });
  },

  signIn: async (email, password) => {
    set({ error: null });
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      set({ error: error.message });
      throw error;
    }
    await persistSession(data.session);
    set({ session: data.session, user: data.session.user });
  },

  signUp: async (email, password) => {
    set({ error: null });
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      set({ error: error.message });
      throw error;
    }
    await persistSession(data.session);
    set({ session: data.session, user: data.session?.user ?? null });
  },

  signOut: async () => {
    await supabase.auth.signOut();
    await persistSession(null);
    set({ session: null, user: null });
  },

  clearError: () => set({ error: null }),
}));
