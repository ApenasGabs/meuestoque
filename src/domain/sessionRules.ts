export interface GroupRecord {
  id: string;
  nome: string;
  codigo_convite: string;
}

export const pickActiveGroup = (
  groups: GroupRecord[],
  savedGroupId: string | null,
): GroupRecord | null => {
  if (groups.length === 0) return null;
  if (savedGroupId) {
    const saved = groups.find((group) => group.id === savedGroupId);
    if (saved) return saved;
  }
  return groups[0];
};

export const shouldRedirectToGroup = (hasSession: boolean, hasGroup: boolean): boolean => {
  return hasSession && !hasGroup;
};

export const shouldRedirectToList = (hasSession: boolean, hasGroup: boolean): boolean => {
  return hasSession && hasGroup;
};

/**
 * Determina se o subdomínio atual precisa ser corrigido.
 *
 * @param currentHost - hostname atual do navegador
 * @param hasGroup - se o usuário está em um grupo compartilhado
 * @returns o domínio correto ou `null` se não houver necessidade de troca
 */
export const shouldSyncSubdomain = (currentHost: string, hasGroup: boolean): string | null => {
  const SOLO_DOMAIN = "meuestoque.apenasgabs.dev";
  const SHARED_DOMAIN = "nossoestoque.apenasgabs.dev";

  const knownHosts = new Set([SOLO_DOMAIN, SHARED_DOMAIN]);
  if (!knownHosts.has(currentHost)) return null;

  const targetDomain = hasGroup ? SHARED_DOMAIN : SOLO_DOMAIN;
  if (currentHost === targetDomain) return null;

  return targetDomain;
};
