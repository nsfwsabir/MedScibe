import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

export type Profile = {
  displayName: string | null;
  specialty: string | null;
  phone: string | null;
  clinicName: string | null;
};

type ProfileState = {
  profile: Profile;
  hasLoaded: boolean;
  loadProfile: () => Promise<void>;
  setProfile: (updates: Partial<Profile>) => Promise<void>;
  clearProfile: () => Promise<void>;
};

const PROFILE_KEY = 'medscribe.profile';

const defaultProfile: Profile = {
  displayName: null,
  specialty: null,
  phone: null,
  clinicName: null,
};

export const useProfileStore = create<ProfileState>((set, get) => ({
  profile: defaultProfile,
  hasLoaded: false,

  loadProfile: async () => {
    const raw = await SecureStore.getItemAsync(PROFILE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Profile;
        set({ profile: { ...defaultProfile, ...parsed }, hasLoaded: true });
        return;
      } catch {
        await SecureStore.deleteItemAsync(PROFILE_KEY);
      }
    }
    set({ hasLoaded: true });
  },

  setProfile: async (updates) => {
    const next = { ...get().profile, ...updates };
    // Trim empty strings to null
    (Object.keys(next) as (keyof Profile)[]).forEach((k) => {
      const v = next[k];
      if (typeof v === 'string' && v.trim() === '') next[k] = null;
      else if (typeof v === 'string') next[k] = v.trim() as any;
    });
    set({ profile: next });
    await SecureStore.setItemAsync(PROFILE_KEY, JSON.stringify(next));
  },

  clearProfile: async () => {
    set({ profile: defaultProfile });
    await SecureStore.deleteItemAsync(PROFILE_KEY);
  },
}));

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 21) return 'Good evening';
  return 'Good night';
}
