import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

export type RetentionDays = 30 | 60 | 90;

type SettingsState = {
  retainOriginalAudio: boolean;
  retentionDays: RetentionDays;
  hasLoaded: boolean;
  loadSettings: () => Promise<void>;
  setRetainOriginalAudio: (value: boolean) => Promise<void>;
  setRetentionDays: (days: RetentionDays) => Promise<void>;
};

const SETTINGS_KEY = 'medscribe.settings';

const defaultSettings = {
  retainOriginalAudio: true as boolean,
  retentionDays: 30 as RetentionDays,
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  retainOriginalAudio: defaultSettings.retainOriginalAudio,
  retentionDays: defaultSettings.retentionDays,
  hasLoaded: false,

  loadSettings: async () => {
    const raw = await SecureStore.getItemAsync(SETTINGS_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<SettingsState>;
        const next: Partial<SettingsState> = {};
        if (typeof parsed.retainOriginalAudio === 'boolean') next.retainOriginalAudio = parsed.retainOriginalAudio;
        if (parsed.retentionDays === 30 || parsed.retentionDays === 60 || parsed.retentionDays === 90)
          next.retentionDays = parsed.retentionDays;
        set({ ...next, hasLoaded: true });
        return;
      } catch {
        await SecureStore.deleteItemAsync(SETTINGS_KEY);
      }
    }
    set({ hasLoaded: true });
  },

  setRetainOriginalAudio: async (value) => {
    set({ retainOriginalAudio: value });
    const { retainOriginalAudio, retentionDays } = get();
    await SecureStore.setItemAsync(SETTINGS_KEY, JSON.stringify({ retainOriginalAudio, retentionDays }));
  },
  setRetentionDays: async (days) => {
    set({ retentionDays: days });
    const { retainOriginalAudio, retentionDays } = get();
    await SecureStore.setItemAsync(SETTINGS_KEY, JSON.stringify({ retainOriginalAudio, retentionDays }));
  },
}));
