import { create } from 'zustand';

type UiState = {
  newNoteModalVisible: boolean;
  setNewNoteModalVisible: (visible: boolean) => void;
};

export const useUiStore = create<UiState>((set) => ({
  newNoteModalVisible: false,
  setNewNoteModalVisible: (visible) => set({ newNoteModalVisible: visible }),
}));
