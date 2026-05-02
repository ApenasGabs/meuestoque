import { create } from "zustand";

/**
 * Zustand store for managing the "Bulk Selection Mode" state in the inventory.
 * Used to coordinate selection across multiple ProductCards and the StockView header/action bar.
 */
interface BulkState {
  /** Indicates whether the UI is currently in bulk selection mode */
  isBulkMode: boolean;
  /** Array of currently selected stock item UUIDs */
  selectedItems: string[];
  /** Activates bulk mode, optionally initializing it with a long-pressed item */
  enterBulkMode: (initialItemId?: string) => void;
  /** Deactivates bulk mode and clears all selections */
  exitBulkMode: () => void;
  /** Toggles the selection status of a single item. If the last item is unselected, exits bulk mode automatically */
  toggleItemSelection: (itemId: string) => void;
  /** Returns true if the specified item is currently selected */
  isSelected: (itemId: string) => boolean;
}

export const useBulkStore = create<BulkState>((set, get) => ({
  isBulkMode: false,
  selectedItems: [],
  enterBulkMode: (initialItemId) =>
    set({
      isBulkMode: true,
      selectedItems: initialItemId ? [initialItemId] : [],
    }),
  exitBulkMode: () =>
    set({
      isBulkMode: false,
      selectedItems: [],
    }),
  toggleItemSelection: (itemId) => {
    const { selectedItems } = get();
    if (selectedItems.includes(itemId)) {
      const next = selectedItems.filter((id) => id !== itemId);
      if (next.length === 0) {
        set({ isBulkMode: false, selectedItems: [] });
      } else {
        set({ selectedItems: next });
      }
    } else {
      set({ selectedItems: [...selectedItems, itemId] });
    }
  },
  isSelected: (itemId) => get().selectedItems.includes(itemId),
}));
