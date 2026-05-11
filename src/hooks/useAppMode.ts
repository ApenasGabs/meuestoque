import { useAuthStore } from "../stores/authStore";
import { useGroupStore } from "../stores/groupStore";

export type AppMode = "solo" | "shared";

interface AppModeResult {
  /** Current app mode based on the user's active groupId */
  mode: AppMode;
  /** True when the user is currently in a shared group */
  isShared: boolean;
  /** Primary app title: "Meu Estoque" or "Nosso Estoque" */
  appTitle: string;
  /** Possessive prefix: "Meu" (My) or "Nosso" (Our) */
  prefix: string;
}

/**
 * Hook that centralizes the app's dynamic context logic.
 *
 * - If the user doesn't belong to any group → **solo** mode ("Meu Estoque")
 * - If the user has an active groupId → **shared** mode ("Nosso Estoque")
 *
 * Returns formatted labels and status flags ready for UI consumption.
 */
export const useAppMode = (): AppModeResult => {
  const userId = useAuthStore((state) => state.userId);
  const groupId = useGroupStore((state) => state.groupId);

  const isShared = !!userId && !!groupId;
  const mode: AppMode = isShared ? "shared" : "solo";

  return {
    mode,
    isShared,
    appTitle: isShared ? "Nosso Estoque" : "Meu Estoque",
    prefix: isShared ? "Nosso" : "Meu",
  };
};

/**
 * Non-reactive version of the app mode logic for use outside of React components.
 * Reads directly from Zustand stores.
 */
export const getAppMode = (): AppModeResult => {
  const userId = useAuthStore.getState().userId;
  const groupId = useGroupStore.getState().groupId;

  const isShared = !!userId && !!groupId;
  const mode: AppMode = isShared ? "shared" : "solo";

  return {
    mode,
    isShared,
    appTitle: isShared ? "Nosso Estoque" : "Meu Estoque",
    prefix: isShared ? "Nosso" : "Meu",
  };
};
