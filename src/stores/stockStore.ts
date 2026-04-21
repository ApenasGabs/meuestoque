import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  deleteStockItemById,
  getStockItems,
  recordStockMovement,
  setStockItemInShoppingList,
  upsertStockItem,
  type StockItemRecord,
  type UpsertStockItemInput,
} from "../lib/webData";

const STOCK_WRITE_DEBOUNCE_MS = 700;

interface PendingStockMovement {
  itemId: string;
  groupId: string;
  createdBy?: string | null;
  itemName: string;
  delta: number;
}

const pendingStockMovements = new Map<string, PendingStockMovement>();
const pendingStockTimers = new Map<string, ReturnType<typeof setTimeout>>();

interface StockState {
  items: StockItemRecord[];
  loading: boolean;
  keepScreenOn: boolean;
  lastAutoAddedItemName: string | null;
  clearAutoAddedNotice: () => void;
  setKeepScreenOn: (value: boolean) => void;
  fetchItems: (groupId: string) => Promise<void>;
  upsertItem: (payload: UpsertStockItemInput) => Promise<StockItemRecord>;
  updateItemQuantity: (
    itemId: string,
    delta: number,
    createdBy?: string | null,
  ) => Promise<{ item: StockItemRecord | null; autoAddedToList: boolean }>;
  toggleInShoppingList: (itemId: string, include: boolean) => Promise<StockItemRecord>;
  removeItem: (itemId: string) => Promise<void>;
  clearStock: () => void;
}

const sortByName = (items: StockItemRecord[]): StockItemRecord[] => {
  return [...items].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
};

const clearPendingStockWrites = (): void => {
  pendingStockTimers.forEach((timer) => {
    clearTimeout(timer);
  });
  pendingStockTimers.clear();
  pendingStockMovements.clear();
};

export const useStockStore = create<StockState>()(
  persist(
    (set, get) => ({
      items: [],
      loading: false,
      keepScreenOn: false,
      lastAutoAddedItemName: null,
      clearAutoAddedNotice: () => set({ lastAutoAddedItemName: null }),
      setKeepScreenOn: (value) => set({ keepScreenOn: value }),
      fetchItems: async (groupId) => {
        set({ loading: true });
        try {
          const data = await getStockItems(groupId);
          set({ items: sortByName(data) });
        } finally {
          set({ loading: false });
        }
      },
      upsertItem: async (payload) => {
        const saved = await upsertStockItem(payload);
        set((state) => {
          const withoutCurrent = state.items.filter((item) => item.id !== saved.id);
          return { items: sortByName([...withoutCurrent, saved]) };
        });
        return saved;
      },
      updateItemQuantity: async (itemId, delta, createdBy) => {
        const current = get().items.find((item) => item.id === itemId);
        if (!current || delta === 0) {
          return { item: current ?? null, autoAddedToList: false };
        }

        const nextQuantity = Math.max(0, current.quantidade + delta);
        const quantityDiff = nextQuantity - current.quantidade;
        if (quantityDiff === 0) {
          return { item: current, autoAddedToList: false };
        }

        set((state) => ({
          items: sortByName(
            state.items.map((item) =>
              item.id === itemId
                ? {
                    ...item,
                    quantidade: nextQuantity,
                  }
                : item,
            ),
          ),
        }));

        const previousPending = pendingStockMovements.get(itemId);
        const mergedDelta = (previousPending?.delta ?? 0) + quantityDiff;

        if (mergedDelta === 0) {
          const existingTimer = pendingStockTimers.get(itemId);
          if (existingTimer) {
            clearTimeout(existingTimer);
            pendingStockTimers.delete(itemId);
          }
          pendingStockMovements.delete(itemId);
          return { item: { ...current, quantidade: nextQuantity }, autoAddedToList: false };
        }

        pendingStockMovements.set(itemId, {
          itemId,
          groupId: current.group_id,
          createdBy,
          itemName: current.nome,
          delta: mergedDelta,
        });

        const existingTimer = pendingStockTimers.get(itemId);
        if (existingTimer) {
          clearTimeout(existingTimer);
        }

        const flushTimer = setTimeout(() => {
          void (async () => {
            const pending = pendingStockMovements.get(itemId);
            if (!pending) return;

            pendingStockMovements.delete(itemId);
            pendingStockTimers.delete(itemId);

            try {
              const movementResult = await recordStockMovement({
                itemId: pending.itemId,
                tipo: pending.delta > 0 ? "entrada" : "saida",
                quantidade: Math.abs(pending.delta),
                createdBy: pending.createdBy,
              });

              const refreshedItems = await getStockItems(pending.groupId);
              set({
                items: sortByName(refreshedItems),
                lastAutoAddedItemName: movementResult.autoAddedToList ? pending.itemName : null,
              });
            } catch (error) {
              try {
                const refreshedItems = await getStockItems(pending.groupId);
                set({ items: sortByName(refreshedItems) });
              } catch (refreshError) {
                console.error("Failed to refresh stock items after movement write failure.", {
                  error,
                  refreshError,
                  itemId: pending.itemId,
                  groupId: pending.groupId,
                });
              }
            }
          })();
        }, STOCK_WRITE_DEBOUNCE_MS);

        pendingStockTimers.set(itemId, flushTimer);

        return {
          item: { ...current, quantidade: nextQuantity },
          autoAddedToList: false,
        };
      },
      toggleInShoppingList: async (itemId, include) => {
        const updated = await setStockItemInShoppingList(itemId, include);
        set((state) => {
          const withoutCurrent = state.items.filter((item) => item.id !== itemId);
          return { items: sortByName([...withoutCurrent, updated]) };
        });
        return updated;
      },
      removeItem: async (itemId) => {
        await deleteStockItemById(itemId);
        set((state) => ({ items: state.items.filter((item) => item.id !== itemId) }));
      },
      clearStock: () => {
        clearPendingStockWrites();
        set({ items: [], loading: false, lastAutoAddedItemName: null });
      },
    }),
    {
      name: "stock-store-web",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ keepScreenOn: state.keepScreenOn }),
    },
  ),
);
