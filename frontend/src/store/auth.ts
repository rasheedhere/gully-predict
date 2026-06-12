import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface User {
  id: string;
  name: string;
  alias: string;
  use_alias: boolean;
  email: string;
  avatar: string;
  is_admin: boolean;
  is_guest: boolean;
  is_dev: boolean;
  telegram_username?: string;
  last_read_announcements_at?: string;
  is_telegram_admin?: boolean;
  is_league_admin?: boolean;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setUser: (user: User, token: string) => void;
  updateUser: (updates: Partial<User>) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      setUser: (user, token) => set({ user, token, isAuthenticated: true }),
      updateUser: (updates) => set((state) => ({
        user: state.user ? { ...state.user, ...updates } : null
      })),
      logout: () => set({ user: null, token: null, isAuthenticated: false }),
    }),
    {
      name: 'ipl-fantasy-auth',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
