import * as SecureStore from 'expo-secure-store';
import { Session } from '@supabase/supabase-js';

const SESSION_KEY = 'medscribe.session';

export async function persistSession(session: Session | null): Promise<void> {
  if (session) {
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
  } else {
    await SecureStore.deleteItemAsync(SESSION_KEY);
  }
}

export async function loadPersistedSession(): Promise<Session | null> {
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    await SecureStore.deleteItemAsync(SESSION_KEY);
    return null;
  }
}
