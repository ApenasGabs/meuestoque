export type TabKey = "lista" | "pendentes" | "estoque";
export type SyncStatus = "synced" | "syncing" | "offline" | "error";
export type Unit = "Un" | "Kg" | "g" | "L" | "mL" | "cx" | "pct";

export const UNITS: Unit[] = ["Un", "Kg", "g", "L", "mL", "cx", "pct"];

/**
 * Safely converts a string to a Unit type.
 * Normalizes common variations like 'un' -> 'Un', 'kg' -> 'Kg', etc.
 */
export function toUnit(raw: string | null | undefined): Unit {
  if (!raw) return "Un";

  const normalized = raw.trim().toLowerCase();

  const mapping: Record<string, Unit> = {
    un: "Un",
    kg: "Kg",
    g: "g",
    l: "L",
    ml: "mL",
    cx: "cx",
    pct: "pct",
    unidade: "Un",
    unidades: "Un",
    quilo: "Kg",
    quilos: "Kg",
    grama: "g",
    gramas: "g",
    litro: "L",
    litros: "L",
    mililitro: "mL",
    mililitros: "mL",
    caixa: "cx",
    caixas: "cx",
    pacote: "pct",
    pacotes: "pct",
  };

  return mapping[normalized] ?? "Un";
}

export interface ShoppingItem {
  id: number;
  name: string;
  checked: boolean;
}

export interface PendingItem {
  id: number;
  name: string;
}

export interface StockBatch {
  id: number;
  qty: number;
  expiry: string | null;
}

export interface StockItem {
  id: number;
  name: string;
  canonical: string;
  brand: string | null;
  category: string;
  unit: Unit;
  qty: number;
  min: number;
  autoInclude: boolean;
  autoConsume: boolean;
  consumePerEvent: number | null;
  portion?: string | null;
  batches: StockBatch[];
}

export interface PendingStockPayload {
  id: number;
  name: string;
  canonical: string;
  brand: string | null;
  category: string;
  unit: Unit;
  qty: number;
  min: number;
  autoInclude: boolean;
  autoConsume: boolean;
  consumePerEvent: number | null;
  portion: string | null;
  batches: StockBatch[];
}
