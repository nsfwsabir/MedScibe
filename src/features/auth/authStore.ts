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

let authSubscription: { unsubscribe: () => void } | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  initializing: true,
  error: null,

  bootstrap: async () => {
    if (authSubscription) {
      authSubscription.unsubscribe();
      authSubscription = null;
    }
    const { data } = await supabase.auth.getSession();
    let session = data.session ?? (await loadPersistedSession());
    if (session) {
      try {
        // Refreshes the access token if expired; throws on dead refresh token.
        const { data: refreshed, error } = await supabase.auth.setSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        });
        if (error) throw error;
        session = refreshed.session;
        await persistSession(session);
      } catch (e) {
        // Zombie session (expired/revoked tokens): drop it so the user gets
        // the login screen instead of cryptic RLS failures on every write.
        console.warn('[auth] stored session invalid, clearing', e);
        session = null;
        await persistSession(null);
      }
    }
    set({ session, user: session?.user ?? null });
    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (newSession) {
        set({ session: newSession, user: newSession.user ?? null });
        void persistSession(newSession);
      } else if (event === 'SIGNED_OUT') {
        set({ session: null, user: null });
        void persistSession(null);
      }
    });
    authSubscription = listener.subscription;
    set({ initializing: false });
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
