import { useAuthStore } from "../stores/authStore";
import { useGroupStore } from "../stores/groupStore";

/**
 * Domínios mapeados por modo de uso.
 * Solo → meuestoque | Compartilhado → nossoestoque
 */
const DOMAINS = {
  solo: "meuestoque.apenasgabs.dev",
  shared: "nossoestoque.apenasgabs.dev",
} as const;

export type AppMode = "solo" | "shared";

interface AppModeResult {
  /** Modo atual do app baseado no groupId do usuário */
  mode: AppMode;
  /** true quando o usuário está em um grupo compartilhado */
  isShared: boolean;
  /** Título principal do app: "Meu Estoque" ou "Nosso Estoque" */
  appTitle: string;
  /** Domínio esperado para o modo atual */
  targetDomain: string;
  /** Prefixo possessivo: "Meu" ou "Nosso" */
  prefix: string;
}

/**
 * Hook que centraliza a lógica de contexto dinâmico do app.
 *
 * - Se o usuário não pertence a nenhum grupo → modo **solo** ("Meu Estoque")
 * - Se o usuário possui um groupId ativo → modo **shared** ("Nosso Estoque")
 *
 * Retorna textos, domínio-alvo e flags prontos para consumo pelos componentes.
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
    targetDomain: isShared ? DOMAINS.shared : DOMAINS.solo,
    prefix: isShared ? "Nosso" : "Meu",
  };
};

/**
 * Versão não-reativa para uso fora de componentes React.
 * Lê diretamente dos stores Zustand.
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
    targetDomain: isShared ? DOMAINS.shared : DOMAINS.solo,
    prefix: isShared ? "Nosso" : "Meu",
  };
};
