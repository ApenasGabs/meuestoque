export interface ListItem {
  id: string;
  nome: string;
  categoria: string;
  preco: number | null;
}

export function normalizeInviteCode(code: string): string {
  return code.trim().toUpperCase();
}

export function buildQuantityLabel(quantity: string, unit: string): string {
  const q = quantity.trim() || "1";
  const u = unit.trim() || "un";
  return `${q} ${u}`;
}

export function calculateShoppingTotal(
  items: Array<{ preco: number | null }>,
): number {
  return items.reduce((sum, item) => sum + (item.preco ?? 0), 0);
}

export function filterItemsByCategory(
  items: ListItem[],
  selectedCategory: string,
): ListItem[] {
  if (selectedCategory === "Todos") return items;
  const normalized = selectedCategory.replace(/^\S+\s/, "");
  return items.filter((item) => item.categoria === normalized);
}
