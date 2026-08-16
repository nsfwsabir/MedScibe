import { create } from 'zustand';

export type RetentionDays = 30 | 60 | 90;

type SettingsState = {
  retainOriginalAudio: boolean;
  retentionDays: RetentionDays;
  setRetainOriginalAudio: (value: boolean) => void;
  setRetentionDays: (days: RetentionDays) => void;
};

export const useSettingsStore = create<SettingsState>((set) => ({
  retainOriginalAudio: true,
  retentionDays: 30,
  setRetainOriginalAudio: (value) => set({ retainOriginalAudio: value }),
  setRetentionDays: (days) => set({ retentionDays: days }),
}));
