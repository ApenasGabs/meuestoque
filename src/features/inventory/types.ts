import type { Unit } from "../../types/inventory.types";

export interface InventoryProduct {
  id: string;
  name: string;
  quantity: number;
  minStock: number;
  unit?: Unit;
  portionSize?: number;
  compositeUnit?: boolean;
  lastPurchaseDate?: string | null;
  categoryId: string;
  validityDate?: string | null;
  needsValidity?: boolean;
  packLabel?: string;
  packSize?: number;
  /** Auto-consumption: whether to add to shopping list when below minimum */
  autoAddToList?: boolean;
  /** Auto-consumption: frequency ('daily', 'weekly', 'monthly') */
  consumeFrequency?: "daily" | "weekly" | "monthly";
  /** Auto-consumption: portions consumed per frequency cycle */
  consumeValue?: number;
  /** Auto-consumption: last auto-consumed timestamp */
  lastAutoConsumedAt?: string | null;
}

export interface InventoryCategory {
  id: string;
  name: string;
  order: number;
}

export interface InventoryShoppingListItem {
  id: string;
  productId: string;
  quantity: number;
  checked: boolean;
  price?: number | null;
  isPriceStale?: boolean;
  pricePerUnit?: number | null;
  totalPrice?: number | null;
  validityDate?: string | null;
}

export type InventoryTab = "stock" | "list" | "settings";
export type StockFilter = "low" | "out";
