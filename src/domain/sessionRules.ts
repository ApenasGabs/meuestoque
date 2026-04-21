export interface GroupRecord {
  id: string;
  nome: string;
  codigo_convite: string;
}

export function pickActiveGroup(
  groups: GroupRecord[],
  savedGroupId: string | null,
): GroupRecord | null {
  if (groups.length === 0) return null;
  if (savedGroupId) {
    const saved = groups.find((group) => group.id === savedGroupId);
    if (saved) return saved;
  }
  return groups[0];
}

export function shouldRedirectToGroup(
  hasSession: boolean,
  hasGroup: boolean,
): boolean {
  return hasSession && !hasGroup;
}

export function shouldRedirectToList(
  hasSession: boolean,
  hasGroup: boolean,
): boolean {
  return hasSession && hasGroup;
}
