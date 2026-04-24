import { useEffect, useRef } from "react";
import { useAppMode } from "./useAppMode";

/**
 * Domínios de produção reconhecidos pelo app.
 * Apenas nesses hosts o hook tenta corrigir o subdomínio.
 */
const KNOWN_HOSTS = new Set([
  "meuestoque.apenasgabs.dev",
  "nossoestoque.apenasgabs.dev",
  // Localhost aliases for development
  "meuestoque.localhost",
  "nossoestoque.localhost",
]);

/**
 * Hook que sincroniza o subdomínio (URL) com o modo atual do app
 * usando `window.history.replaceState`, sem causar reload (F5).
 *
 * Fluxo:
 * 1. Ao montar ou quando `mode` muda, verifica se o hostname atual
 *    é um dos domínios de produção conhecidos.
 * 2. Se estiver no domínio errado para o modo atual, faz
 *    `replaceState` trocando apenas o hostname.
 * 3. Também atualiza `document.title` de forma reativa.
 *
 * Em localhost ou domínios de preview (Vercel), o hook não interfere na URL.
 */
export const useSubdomainSync = (): void => {
  const { appTitle, targetDomain, mode } = useAppMode();
  const lastSyncedMode = useRef(mode);

  useEffect(() => {
    // Sempre mantém o document.title atualizado
    document.title = appTitle;
  }, [appTitle]);

  useEffect(() => {
    // Evita re-runs desnecessários se o mode não mudou de fato
    if (lastSyncedMode.current === mode) return;
    lastSyncedMode.current = mode;

    const currentHost = window.location.hostname;

    // Só sincroniza em hosts de produção reconhecidos
    if (!KNOWN_HOSTS.has(currentHost)) return;

    // Se já está no domínio correto, nada a fazer
    if (currentHost === targetDomain) return;

    // Monta a nova URL preservando path, search e hash
    const newUrl = `${window.location.protocol}//${targetDomain}${window.location.pathname}${window.location.search}${window.location.hash}`;

    // replaceState não causa reload — apenas atualiza a barra de endereço
    window.history.replaceState(window.history.state, "", newUrl);
  }, [mode, targetDomain]);
}
