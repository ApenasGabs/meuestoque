# 📋 Technical Specification: Expiration Date Bulk Actions

## 1. Architecture & Data Model
Schema update to support the persistent "Does not apply" state and catalog learning.

```sql
-- Table: product_catalog (Global product catalog)
ALTER TABLE product_catalog 
ADD COLUMN perecivel BOOLEAN DEFAULT true,
ADD COLUMN validade_padrao_dias INT NULL;

-- Table: stock_items (Physical items in the user's inventory)
ALTER TABLE stock_items 
ADD COLUMN data_validade_alerta DATE NULL,
ADD COLUMN validade_nao_aplica BOOLEAN DEFAULT false;
```

## 2. API Contract (Backend / Supabase RPC)
The `rpc_finalize_shopping_list` function must be updated to process expiration dates defined directly on the shopping list.

**Expected Input Payload:**
```json
{
  "p_group_id": "uuid",
  "p_itens": [
    {
      "item_id": "uuid",
      "comprado": true,
      "data_validade": "2026-05-20", 
      "nao_aplica_validade": false
    }
  ]
}
```

**RPC Internal Logic:**
1. If `data_validade` is provided: Save to `stock_items.data_validade_alerta`. Do not create a pending alert at the top of the inventory.
2. If `nao_aplica_validade = true`: 
   - Update `stock_items.validade_nao_aplica = true`.
   - Update `product_catalog.perecivel = false` (Machine learning / Auto-behavior).
3. If neither is provided and `product_catalog.perecivel = true`: Create a pending expiration date alert in the inventory.

## 3. Frontend & UI/UX (Zustand / React)
State management for the Selection Mode (Bulk Mode).

*   **Global State:** `isBulkMode` (boolean), `selectedItems` (Array of UUIDs).
*   **Triggers:** `onLongPress` on an item card sets `isBulkMode = true`.
*   **Dynamic UI:** 
    *   Header: Displays `"{N} selected"` and a `[X]` button to reset the state.
    *   Footer: Renders the `ActionBar` with `[Set Expiration Date]` and `[Does not apply]` buttons.
*   **Smart Suggestion Rule:** If `(count of 'Limpeza' items selected / total selected) >= 0.8`, inject a "Suggested" badge into the `[Does not apply]` button.
*   **Error Prevention:** If there is a mix of incompatible categories (e.g., Food + Cleaning), disable the `[Does not apply]` button.

---

## 4. Acceptance Criteria (BDD / Gherkin)

### Epic 1: Selection Mode (Bulk Mode)
**Scenario:** Activating and canceling selection mode
*   **Given** the user is on the "Shopping List" or "Inventory" screen
*   **When** the user triggers the `LongPress` event on any item card
*   **Then** the interface must transition to `BulkMode`
*   **And** all cards must render `Checkbox` components
*   **And** the Header must display "1 selected" with a Cancel action
*   **And** an Action Bar must be fixed at the bottom of the screen.

### Epic 2: Shopping List Actions
**Scenario:** Setting a bulk expiration date before checkout
*   **Given** 3 items are selected in the active Shopping List
*   **When** the user sets the date to "2026-05-20" via the Action Bar and confirms
*   **Then** the list UI must display a visual chip with the date on the 3 items
*   **And** upon finishing the shopping trip, the RPC must save the `data_validade_alerta`
*   **And** the items must NOT be flagged as "Pending Expiration Date" in the Inventory.

**Scenario:** Auto-learning for non-perishable items
*   **Given** 5 items from the "Limpeza" (Cleaning) category are selected on the list
*   **When** the user clicks "Does not apply" and confirms
*   **Then** the RPC must set `validade_nao_aplica = true` in the inventory for the 5 items
*   **And** it must update `product_catalog.perecivel = false` for the 5 corresponding products.

**Scenario:** Smart UI suggestion based on category
*   **Given** 4 items are selected
*   **And** 100% of them belong to the "Limpeza" category
*   **When** the Action Bar is rendered
*   **Then** the "Does not apply" button must display a "Suggested" visual badge.

### Epic 3: Resolving Inventory Pending Alerts
**Scenario:** Clearing pending items from the top
*   **Given** 8 items are pinned at the top of the Inventory as "Pending Expiration Date"
*   **And** the user selects all 8
*   **When** the user applies the date "2026-06-15" in bulk
*   **Then** the `data_validade_alerta` must be updated in the database
*   **And** all 8 items must be instantly unpinned from the top
*   **And** 8 records of type `ajuste_validade_bulk` must be inserted into the `stock_movements` table.

**Scenario:** Handling date conflicts within a selection
*   **Given** the user selects 5 items in the inventory
*   **And** 2 of those items already have a `data_validade_alerta` populated
*   **When** the user opens the "Set Expiration Date" Bottom Sheet
*   **Then** the UI must display a warning: "2 items already have a date"
*   **And** it must offer a radio group with "Apply only to the 3 without a date" (Default) or "Overwrite all".

### Epic 4: Edge Cases
**Scenario:** Preventing incompatible bulk actions
*   **Given** the user selects 1 "Leite" (Milk) item and 1 "Detergente" (Detergent) item
*   **When** the Action Bar is rendered
*   **Then** the "Does not apply" button must be `disabled`
*   **And** a tooltip must instruct the user to select items of the same type.

**Scenario:** Discarding temporary dates for unpurchased items
*   **Given** an expiration date was set for an item on the Shopping List
*   **When** the shopping trip is finalized, but the item's "comprado" (purchased) checkbox was unchecked
*   **Then** the item must remain on the active shopping list
*   **And** its temporary expiration date must be reset to null.
