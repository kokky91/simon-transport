import { create } from "zustand";

type SessionState = {
  accessToken: string | null;
  userId: string | null;
  setSession: (accessToken: string, userId: string) => void;
  clearSession: () => void;
};

export const useSessionStore = create<SessionState>((set) => ({
  accessToken: null,
  userId: null,
  setSession: (accessToken, userId) => set({ accessToken, userId }),
  clearSession: () => set({ accessToken: null, userId: null })
}));