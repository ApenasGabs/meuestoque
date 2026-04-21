import { create } from "zustand";

interface SessionStore {
  ready: boolean;
  setReady: (ready: boolean) => void;
}

export const useSessionStore = create<SessionStore>((set) => ({
  ready: false,
  setReady: (ready) => set({ ready }),
}));
