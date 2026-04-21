export interface InventoryProduct {
  id: string;
  name: string;
  quantity: number;
  minStock: number;
  unit?: string;
  categoryId: string;
}

export interface InventoryCategory {
  id: string;
  name: string;
  order: number;
}

export interface ShoppingListItem {
  id: string;
  productId: string;
  quantity: number;
  checked: boolean;
}
