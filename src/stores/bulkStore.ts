import { create } from "zustand";

/**
 * Scope discriminator for bulk selection mode.
 *
 * The same store powers bulk-mode in two distinct screens (Inventory and Shopping List).
 * The scope ensures a long-press in one screen does not bleed selection state into the other.
 */
export type BulkScope = "inventory" | "shopping_list";

/**
 * Zustand store for managing the "Bulk Selection Mode" state across the app.
 * Used to coordinate selection across multiple cards and the dynamic action bar.
 */
interface BulkState {
  /** Indicates whether the UI is currently in bulk selection mode */
  isBulkMode: boolean;
  /** Which screen is currently driving the bulk selection */
  scope: BulkScope | null;
  /** Array of currently selected item UUIDs (stock_item_id or shopping_list_item_id) */
  selectedItems: string[];
  /** Activates bulk mode for a specific scope, optionally seeding the first selected item */
  enterBulkMode: (scope: BulkScope, initialItemId?: string) => void;
  /** Deactivates bulk mode and clears all selections */
  exitBulkMode: () => void;
  /** Toggles the selection status of a single item. If the last item is unselected, exits bulk mode */
  toggleItemSelection: (itemId: string) => void;
  /** Returns true if the specified item is currently selected */
  isSelected: (itemId: string) => boolean;
}

export const useBulkStore = create<BulkState>((set, get) => ({
  isBulkMode: false,
  scope: null,
  selectedItems: [],
  enterBulkMode: (scope, initialItemId) =>
    set({
      isBulkMode: true,
      scope,
      selectedItems: initialItemId ? [initialItemId] : [],
    }),
  exitBulkMode: () =>
    set({
      isBulkMode: false,
      scope: null,
      selectedItems: [],
    }),
  toggleItemSelection: (itemId) => {
    const { selectedItems } = get();
    if (selectedItems.includes(itemId)) {
      const next = selectedItems.filter((id) => id !== itemId);
      if (next.length === 0) {
        set({ isBulkMode: false, scope: null, selectedItems: [] });
      } else {
        set({ selectedItems: next });
      }
    } else {
      set({ selectedItems: [...selectedItems, itemId] });
    }
  },
  isSelected: (itemId) => get().selectedItems.includes(itemId),
}));
