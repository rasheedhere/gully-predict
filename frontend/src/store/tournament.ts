import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface TournamentState {
  activeTournamentId: string | null;
  setActiveTournamentId: (id: string | null) => void;
}

export const useTournamentStore = create<TournamentState>()(
  persist(
    (set) => ({
      activeTournamentId: null,
      setActiveTournamentId: (id) => set({ activeTournamentId: id }),
    }),
    {
      name: 'tournament-storage',
    }
  )
);
