import { create } from 'zustand';

interface UiState {
  headerTitle: string | null;
  setHeaderTitle: (title: string | null) => void;
}

export const useUiStore = create<UiState>((set) => ({
  headerTitle: null,
  setHeaderTitle: (title) => set({ headerTitle: title }),
}));
