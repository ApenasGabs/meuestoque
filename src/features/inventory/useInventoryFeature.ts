import { useMemo, useState } from "react";

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

export interface ShoppingItem {
  id: string;
  productId: string;
  quantity: number;
  checked: boolean;
}

export type InventoryTab = "stock" | "list" | "settings";
export type StockFilter = "all" | "low" | "out";

interface InventoryFeatureState {
  products: InventoryProduct[];
  categories: InventoryCategory[];
  shoppingList: ShoppingItem[];
  activeTab: InventoryTab;
  search: string;
  filter: StockFilter;
  lowStockCount: number;
  outOfStockCount: number;
  uncheckedCount: number;
  checkedCount: number;
}

interface InventoryFeatureActions {
  setActiveTab: (tab: InventoryTab) => void;
  setSearch: (value: string) => void;
  setFilter: (value: StockFilter) => void;
  addProduct: (product: Omit<InventoryProduct, "id">) => void;
  updateProduct: (id: string, product: Omit<InventoryProduct, "id">) => void;
  removeProduct: (id: string) => void;
  addCategory: (name: string) => string;
  updateQuantity: (id: string, quantity: number) => void;
  addToShoppingList: (productId: string, quantity: number) => void;
  toggleItemChecked: (id: string) => void;
  removeFromShoppingList: (id: string) => void;
  updateShoppingQuantity: (id: string, quantity: number) => void;
  markItemAsBought: (id: string) => void;
  clearCheckedItems: () => void;
  generateSmartList: () => void;
}

const initialCategories: InventoryCategory[] = [
  { id: "cat-1", name: "Graos e Cereais", order: 0 },
  { id: "cat-2", name: "Laticinios", order: 1 },
  { id: "cat-3", name: "Carnes", order: 2 },
  { id: "cat-4", name: "Frutas e Verduras", order: 3 },
  { id: "cat-5", name: "Bebidas", order: 4 },
  { id: "cat-6", name: "Limpeza", order: 5 },
  { id: "cat-7", name: "Higiene", order: 6 },
];

const initialProducts: InventoryProduct[] = [
  { id: "p-1", name: "Arroz", quantity: 1, minStock: 2, unit: "kg", categoryId: "cat-1" },
  { id: "p-2", name: "Feijao", quantity: 0, minStock: 1, unit: "kg", categoryId: "cat-1" },
  { id: "p-3", name: "Macarrao", quantity: 3, minStock: 2, unit: "un", categoryId: "cat-1" },
  { id: "p-4", name: "Leite", quantity: 2, minStock: 3, unit: "L", categoryId: "cat-2" },
  { id: "p-5", name: "Queijo", quantity: 0, minStock: 1, unit: "un", categoryId: "cat-2" },
  { id: "p-6", name: "Manteiga", quantity: 1, minStock: 1, unit: "un", categoryId: "cat-2" },
  { id: "p-7", name: "Frango", quantity: 0, minStock: 1, unit: "kg", categoryId: "cat-3" },
  { id: "p-8", name: "Carne moida", quantity: 1, minStock: 1, unit: "kg", categoryId: "cat-3" },
  { id: "p-9", name: "Banana", quantity: 6, minStock: 6, unit: "un", categoryId: "cat-4" },
  { id: "p-10", name: "Tomate", quantity: 2, minStock: 4, unit: "un", categoryId: "cat-4" },
];

const initialShoppingList: ShoppingItem[] = [
  { id: "sl-1", productId: "p-2", quantity: 2, checked: false },
  { id: "sl-2", productId: "p-5", quantity: 1, checked: false },
];

const createId = (): string => `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const useInventoryFeature = (): InventoryFeatureState & InventoryFeatureActions => {
  const [products, setProducts] = useState<InventoryProduct[]>(initialProducts);
  const [categories, setCategories] = useState<InventoryCategory[]>(initialCategories);
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>(initialShoppingList);
  const [activeTab, setActiveTab] = useState<InventoryTab>("stock");
  const [search, setSearch] = useState<string>("");
  const [filter, setFilter] = useState<StockFilter>("all");

  const addCategory = (name: string): string => {
    const newId = createId();

    setCategories((previous) => [...previous, { id: newId, name, order: previous.length }]);

    return newId;
  };

  const addProduct = (product: Omit<InventoryProduct, "id">): void => {
    setProducts((previous) => [...previous, { ...product, id: createId() }]);
  };

  const updateProduct = (id: string, product: Omit<InventoryProduct, "id">): void => {
    setProducts((previous) =>
      previous.map((current) => (current.id === id ? { ...product, id } : current)),
    );
  };

  const removeProduct = (id: string): void => {
    setProducts((previous) => previous.filter((product) => product.id !== id));
    setShoppingList((previous) => previous.filter((item) => item.productId !== id));
  };

  const updateQuantity = (id: string, quantity: number): void => {
    setProducts((previous) =>
      previous.map((product) =>
        product.id === id ? { ...product, quantity: Math.max(0, quantity) } : product,
      ),
    );
  };

  const toggleItemChecked = (id: string): void => {
    setShoppingList((previous) =>
      previous.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item)),
    );
  };

  const removeFromShoppingList = (id: string): void => {
    setShoppingList((previous) => previous.filter((item) => item.id !== id));
  };

  const clearCheckedItems = (): void => {
    setShoppingList((previous) => previous.filter((item) => !item.checked));
  };

  const generateSmartList = (): void => {
    setShoppingList((previous) => {
      const newItems = products
        .filter((product) => product.quantity <= product.minStock)
        .filter((product) => !previous.some((item) => item.productId === product.id))
        .map((product) => ({
          id: createId(),
          productId: product.id,
          quantity: Math.max(product.minStock - product.quantity + 1, 1),
          checked: false,
        }));

      if (newItems.length === 0) {
        return previous;
      }

      return [...previous, ...newItems];
    });
  };

  const addToShoppingList = (productId: string, quantity: number): void => {
    setShoppingList((previous) => {
      const existing = previous.find((item) => item.productId === productId);

      if (existing) {
        return previous.map((item) =>
          item.productId === productId ? { ...item, quantity: item.quantity + quantity } : item,
        );
      }

      return [...previous, { id: createId(), productId, quantity, checked: false }];
    });
  };

  const updateShoppingQuantity = (id: string, quantity: number): void => {
    setShoppingList((previous) =>
      previous.map((item) =>
        item.id === id ? { ...item, quantity: Math.max(1, quantity) } : item,
      ),
    );
  };

  const markItemAsBought = (id: string): void => {
    setShoppingList((previous) =>
      previous.map((item) => (item.id === id ? { ...item, checked: true } : item)),
    );
  };

  const lowStockCount = useMemo(
    () => products.filter((product) => product.quantity <= product.minStock).length,
    [products],
  );

  const outOfStockCount = useMemo(
    () => products.filter((product) => product.quantity === 0).length,
    [products],
  );

  const checkedCount = useMemo(
    () => shoppingList.filter((item) => item.checked).length,
    [shoppingList],
  );

  const uncheckedCount = useMemo(
    () => shoppingList.filter((item) => !item.checked).length,
    [shoppingList],
  );

  return {
    products,
    categories,
    shoppingList,
    activeTab,
    search,
    filter,
    lowStockCount,
    outOfStockCount,
    checkedCount,
    uncheckedCount,
    setActiveTab,
    setSearch,
    setFilter,
    addProduct,
    updateProduct,
    removeProduct,
    addCategory,
    updateQuantity,
    addToShoppingList,
    toggleItemChecked,
    removeFromShoppingList,
    updateShoppingQuantity,
    markItemAsBought,
    clearCheckedItems,
    generateSmartList,
  };
};
