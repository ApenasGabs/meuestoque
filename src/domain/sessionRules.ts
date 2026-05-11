export interface GroupRecord {
  id: string;
  nome: string;
  codigo_convite: string;
  created_by?: string;
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

