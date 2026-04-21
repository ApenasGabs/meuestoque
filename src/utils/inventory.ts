import type { StockItem } from "../types/inventory";

export const UNITS = ["un", "kg", "g", "L", "mL", "cx", "pct"] as const;

export const CATEGORIES = [
  "Laticinios",
  "Proteinas",
  "Graos",
  "Bebidas",
  "Condimentos",
  "Hortifruti",
  "Higiene",
  "Limpeza",
  "Outros",
] as const;

export const isLow = (item: StockItem): boolean => item.qty <= item.min;

export const isExpiringSoon = (item: StockItem): boolean => {
  const soon = new Date();
  soon.setDate(soon.getDate() + 7);
  return item.batches.some((batch) => batch.expiry !== null && new Date(batch.expiry) <= soon);
};

export const groupByCategory = (items: StockItem[]): Record<string, StockItem[]> => {
  return items.reduce<Record<string, StockItem[]>>((accumulator, item) => {
    const category = item.category || "Outros";
    if (!accumulator[category]) {
      accumulator[category] = [];
    }
    accumulator[category].push(item);
    return accumulator;
  }, {});
};

export const parseNumericInput = (value: string, fallback: number, min = 0): number => {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return Math.max(min, parsed);
};
