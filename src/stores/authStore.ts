import { create } from "zustand";

interface AuthStore {
  userId: string | null;
  userName: string | null;
  setUser: (id: string, name: string) => void;
  clearUser: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  userId: null,
  userName: null,
  setUser: (id, name) => set({ userId: id, userName: name }),
  clearUser: () => set({ userId: null, userName: null }),
}));
