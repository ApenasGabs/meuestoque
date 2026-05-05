import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * Navigates to the shopping list page.
 * Uses page.goto to navigate directly — the Supabase session persists in localStorage
 * and survives page reloads. Waits for the list heading to confirm the app
 * finished bootstrapping the session and loading list data.
 *
 * @param page - Playwright page instance
 */
export const navigateToList = async (page: Page): Promise<void> => {
  await page.goto("/list");
  await expect(page.getByTestId("shopping-list-heading")).toBeVisible({ timeout: 30000 });
};

/**
 * Adds an item via the smart input (Name, Qty, Price format).
 *
 * @param page - Playwright page instance
 * @param input - Smart input string (e.g. "Arroz, 2, 12.90")
 */
export const addItemViaSmartInput = async (
  page: Page,
  input: string
): Promise<void> => {
  await page.getByTestId("smart-shopping-input").fill(input);
  await page.getByTestId("add-item-button").click();
};

/**
 * Verifies a specific item is visible in the shopping list.
 *
 * @param page - Playwright page instance
 * @param itemName - Item name to find
 */
export const verifyItemVisible = async (
  page: Page,
  itemName: string
): Promise<void> => {
  await expect(page.getByText(itemName).first()).toBeVisible();
};

/**
 * Verifies a specific item is NOT visible in the shopping list.
 *
 * @param page - Playwright page instance
 * @param itemName - Item name to check absence
 */
export const verifyItemNotVisible = async (
  page: Page,
  itemName: string
): Promise<void> => {
  await expect(page.getByText(itemName)).toHaveCount(0);
};

/**
 * Toggles an item's checked/purchased state by clicking its checkbox.
 *
 * @param page - Playwright page instance
 * @param itemName - Item name to toggle
 */
export const toggleItemChecked = async (
  page: Page,
  itemName: string
): Promise<void> => {
  const testId = `shopping-item-checkbox-${itemName.toLowerCase().replace(/\s+/g, "-")}`;
  await page.getByTestId(testId).first().click();
};

/**
 * Verifies that an item has been checked (purchased state).
 *
 * @param page - Playwright page instance
 * @param itemName - Item name to verify
 */
export const verifyItemChecked = async (
  page: Page,
  itemName: string
): Promise<void> => {
  const testId = `shopping-item-checkbox-${itemName.toLowerCase().replace(/\s+/g, "-")}`;
  await expect(page.getByTestId(testId).first()).toBeChecked();
};

/**
 * Verifies that an item is unchecked (not purchased).
 *
 * @param page - Playwright page instance
 * @param itemName - Item name to verify
 */
export const verifyItemUnchecked = async (
  page: Page,
  itemName: string
): Promise<void> => {
  const testId = `shopping-item-checkbox-${itemName.toLowerCase().replace(/\s+/g, "-")}`;
  await expect(page.getByTestId(testId).first()).not.toBeChecked();
};

/**
 * Removes an item from the shopping list using the delete button.
 *
 * @param page - Playwright page instance
 * @param itemName - Item name to remove
 */
export const removeItem = async (
  page: Page,
  itemName: string
): Promise<void> => {
  const itemRow = page.locator(".card").filter({ hasText: itemName }).first();
  await itemRow.getByTestId("remove-item-button").click();
};

/**
 * Clicks "Lista inteligente" to auto-add items below minimum stock.
 *
 * @param page - Playwright page instance
 */
export const clickGenerateSmartList = async (page: Page): Promise<void> => {
  await page.getByTestId("smart-list-button").click();
};

/**
 * Clicks "Finalizar compra" to finalize the shopping list.
 *
 * @param page - Playwright page instance
 */
export const clickFinalizeShopping = async (page: Page): Promise<void> => {
  await page.getByTestId("finalize-shopping-button").click();
};

/**
 * Clicks "Importar compra" to open the import modal.
 *
 * @param page - Playwright page instance
 */
export const clickOpenImportModal = async (page: Page): Promise<void> => {
  await page.getByRole("button", { name: "Importar compra" }).click();
};

/**
 * Clicks "Histórico" to navigate to history page.
 *
 * @param page - Playwright page instance
 */
export const clickViewHistory = async (page: Page): Promise<void> => {
  await page.getByRole("button", { name: "Histórico" }).click();
};

/**
 * Verifies the item counters in the list header.
 *
 * @param page - Playwright page instance
 * @param counts - Expected pending and purchased counts
 */
export const verifyItemCount = async (
  page: Page,
  counts: { unchecked?: number; checked?: number }
): Promise<void> => {
  if (counts.unchecked !== undefined) {
    await expect(page.getByText(`${counts.unchecked} pendentes`)).toBeVisible();
  }
  if (counts.checked !== undefined) {
    await expect(page.getByText(`${counts.checked} comprados`)).toBeVisible();
  }
};

/**
 * Verifies the list heading "Lista de Compras" is visible.
 *
 * @param page - Playwright page instance
 */
export const verifyListHeadingVisible = async (page: Page): Promise<void> => {
  await expect(page.getByTestId("shopping-list-heading")).toBeVisible();
};
