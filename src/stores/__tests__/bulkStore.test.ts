import { describe, it, expect, beforeEach } from "vitest";
import { useBulkStore } from "../bulkStore";

/**
 * Unit tests for the bulk selection store.
 * Covers Epic 1 (selection mode) and the multi-scope safety added to prevent
 * inventory/shopping-list cross-contamination.
 */
describe("useBulkStore", () => {
  beforeEach(() => {
    useBulkStore.getState().exitBulkMode();
  });

  it("starts inactive with no selection", () => {
    const state = useBulkStore.getState();
    expect(state.isBulkMode).toBe(false);
    expect(state.scope).toBeNull();
    expect(state.selectedItems).toEqual([]);
  });

  it("enters bulk mode with an initial item and scope", () => {
    useBulkStore.getState().enterBulkMode("inventory", "item-1");
    const state = useBulkStore.getState();
    expect(state.isBulkMode).toBe(true);
    expect(state.scope).toBe("inventory");
    expect(state.selectedItems).toEqual(["item-1"]);
  });

  it("toggles selection on and off", () => {
    const store = useBulkStore.getState();
    store.enterBulkMode("inventory", "a");
    store.toggleItemSelection("b");
    expect(useBulkStore.getState().selectedItems).toEqual(["a", "b"]);
    store.toggleItemSelection("a");
    expect(useBulkStore.getState().selectedItems).toEqual(["b"]);
  });

  it("exits bulk mode automatically when last item is deselected", () => {
    const store = useBulkStore.getState();
    store.enterBulkMode("inventory", "only");
    store.toggleItemSelection("only");
    const state = useBulkStore.getState();
    expect(state.isBulkMode).toBe(false);
    expect(state.scope).toBeNull();
    expect(state.selectedItems).toEqual([]);
  });

  it("isSelected reflects current selection", () => {
    const store = useBulkStore.getState();
    store.enterBulkMode("shopping_list", "x");
    expect(useBulkStore.getState().isSelected("x")).toBe(true);
    expect(useBulkStore.getState().isSelected("y")).toBe(false);
  });

  it("keeps scope information distinct between inventory and shopping_list", () => {
    const store = useBulkStore.getState();
    store.enterBulkMode("inventory", "i1");
    expect(useBulkStore.getState().scope).toBe("inventory");
    store.exitBulkMode();
    store.enterBulkMode("shopping_list", "s1");
    expect(useBulkStore.getState().scope).toBe("shopping_list");
  });
});
