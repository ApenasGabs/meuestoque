import { useMemo } from "react";
import type {
  InventoryCategory,
  InventoryProduct,
  InventoryShoppingListItem,
  StockFilter,
} from "./types";
import type { StockItemRecord } from "../../lib/webData";
import { useGroupStore } from "../../stores/groupStore";
import { useStockStore } from "../../stores/stockStore";
import { useAuthStore } from "../../stores/authStore";
import { toUnit } from "../../types/inventory.types";

/**
 * Bridge hook between new inventory UI and Supabase-backed stores.
 * Maps StockItemRecord from useStockStore to InventoryProduct interface.
 */
interface InventoryFeatureWebState {
  products: InventoryProduct[];
  categories: InventoryCategory[];
  shoppingList: InventoryShoppingListItem[];
  lowStockCount: number;
  outOfStockCount: number;
  uncheckedCount: number;
  checkedCount: number;
  loading: boolean;
  lastAutoAddedItemName: string | null;
}

interface InventoryFeatureWebActions {
  toggleFilter: (value: StockFilter) => void;
  clearFilters: () => void;
  addProduct: (product: Omit<InventoryProduct, "id">) => Promise<string>;
  updateProduct: (id: string, product: Omit<InventoryProduct, "id">) => Promise<void>;
  removeProduct: (id: string) => Promise<void>;
  updateQuantity: (id: string, delta: number) => Promise<void>;
  toggleInShoppingList: (id: string, include: boolean) => Promise<void>;
}

/**
 * Maps Supabase StockItemRecord to InventoryProduct format.
 */
const mapStockItemToProduct = (item: StockItemRecord): InventoryProduct => ({
  id: item.id,
  name: item.nome,
  quantity: item.quantidade,
  minStock: item.quantidade_minima,
  unit: toUnit(item.unidade),
  portionSize: item.tamanho_porcao,
  compositeUnit: item.tamanho_porcao !== 1,
  lastPurchaseDate: item.data_compra,
  categoryId: item.categoria || "Outros",
  validityDate: item.data_validade,
  needsValidity: !item.data_validade,
});

/**
 * Extracts unique categories from stock items in priority order.
 */
const extractCategories = (items: StockItemRecord[]): InventoryCategory[] => {
  const categoryMap = new Map<string, InventoryCategory>();
  let order = 0;

  const prioritized = [
    "Hortifruti",
    "Carnes",
    "Laticinios",
    "Limpeza",
    "Higiene",
    "Graos e secos",
    "Bebidas",
    "Pet",
    "Outros",
  ];

  prioritized.forEach((name) => {
    categoryMap.set(name, { id: name, name, order });
    order++;
  });

  items.forEach((item) => {
    const category = item.categoria || "Outros";
    if (!categoryMap.has(category)) {
      categoryMap.set(category, { id: category, name: category, order });
      order++;
    }
  });

  return Array.from(categoryMap.values()).sort((a, b) => a.order - b.order);
};

export const useInventoryFeatureWeb = (): InventoryFeatureWebState & InventoryFeatureWebActions => {
  const groupId = useGroupStore((state) => state.groupId);
  const items = useStockStore((state) => state.items);
  const loading = useStockStore((state) => state.loading);
  const upsertItem = useStockStore((state) => state.upsertItem);
  const updateItemQuantity = useStockStore((state) => state.updateItemQuantity);
  const removeItem = useStockStore((state) => state.removeItem);
  const toggleInShoppingListStore = useStockStore((state) => state.toggleInShoppingList);
  const lastAutoAddedItemName = useStockStore((state) => state.lastAutoAddedItemName);

  const products = useMemo(() => items.map(mapStockItemToProduct), [items]);

  const categories = useMemo(() => extractCategories(items), [items]);

  const lowStockCount = useMemo(
    () => products.filter((product) => product.quantity <= product.minStock).length,
    [products],
  );

  const outOfStockCount = useMemo(
    () => products.filter((product) => product.quantity === 0).length,
    [products],
  );

  const shoppingList: InventoryShoppingListItem[] = [];
  const uncheckedCount = 0;
  const checkedCount = 0;

  const toggleFilter = (): void => {
    // Filtering is handled at page level
  };

  const clearFilters = (): void => {
    // Filtering is handled at page level
  };

  const addProduct = async (product: Omit<InventoryProduct, "id">): Promise<string> => {
    if (!groupId) {
      throw new Error("Grupo não selecionado");
    }

    const saved = await upsertItem({
      groupId,
      nome: product.name,
      categoria: product.categoryId,
      quantidade: product.quantity,
      quantidadeMinima: product.minStock,
      unidade: product.unit || "Un",
      tamanhoPorcao: Math.max(0.0001, product.portionSize ?? 1),
      autoAdicionarLista: false,
      consumoFrequencia: "weekly",
      consumoValor: 0,
      dataValidade: product.validityDate || null,
    });

    return saved.id;
  };

  const updateProduct = async (
    id: string,
    product: Omit<InventoryProduct, "id">,
  ): Promise<void> => {
    if (!groupId) {
      throw new Error("Grupo não selecionado");
    }

    const currentItem = items.find((item) => item.id === id);
    if (!currentItem) {
      throw new Error("Item não encontrado para atualização");
    }

    await upsertItem({
      id,
      groupId,
      nome: product.name,
      categoria: product.categoryId,
      quantidade: product.quantity,
      quantidadeMinima: product.minStock,
      unidade: product.unit || "Un",
      tamanhoPorcao: Math.max(0.0001, product.portionSize ?? 1),
      autoAdicionarLista: currentItem.auto_adicionar_lista,
      consumoFrequencia: currentItem.consumo_frequencia,
      consumoValor: currentItem.consumo_valor,
      dataValidade: product.validityDate || null,
    });
  };

  const removeProduct = async (id: string): Promise<void> => {
    await removeItem(id);
  };

  const updateQuantity = async (id: string, delta: number): Promise<void> => {
    await updateItemQuantity(id, delta, useAuthStore.getState().userId);
  };

  const toggleInShoppingList = async (id: string, include: boolean): Promise<void> => {
    await toggleInShoppingListStore(id, include);
  };

  return {
    products,
    categories,
    shoppingList,
    lowStockCount,
    outOfStockCount,
    uncheckedCount,
    checkedCount,
    loading,
    lastAutoAddedItemName,
    // Actions
    toggleFilter,
    clearFilters,
    addProduct,
    updateProduct,
    removeProduct,
    updateQuantity,
    toggleInShoppingList,
  };
};
