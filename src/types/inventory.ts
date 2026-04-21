export type TabKey = "lista" | "pendentes" | "estoque";
export type SyncStatus = "synced" | "syncing" | "offline" | "error";

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
  unit: string;
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
  unit: string;
  qty: number;
  min: number;
  autoInclude: boolean;
  autoConsume: boolean;
  consumePerEvent: number | null;
  portion: string | null;
  batches: StockBatch[];
}
