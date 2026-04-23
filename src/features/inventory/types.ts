export interface InventoryProduct {
  id: string;
  name: string;
  quantity: number;
  minStock: number;
  unit?: string;
  categoryId: string;
  validityDate?: string | null;
  needsValidity?: boolean;
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
}

export type InventoryTab = "stock" | "list" | "settings";
export type StockFilter = "low" | "out";
