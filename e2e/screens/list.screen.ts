import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * Navigates to the shopping list page.
 *
 * @param page - Playwright page instance
 */
export const navigateToList = async (page: Page): Promise<void> => {
  await page.goto("/list");
  await page.waitForLoadState("domcontentloaded");
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
  await page.getByPlaceholder("Nome, quantidade, valor").fill(input);
  await page.getByRole("button", { name: "Adicionar" }).click();
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
  await expect(page.getByText(itemName).first()).toBeVisible({ timeout: 10000 });
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
  const itemRow = page.locator(".card").filter({ hasText: itemName }).first();
  await itemRow.locator('input[type="checkbox"]').first().click();
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
  const itemRow = page.locator(".card").filter({ hasText: itemName }).first();
  await expect(itemRow.locator('input[type="checkbox"]').first()).toBeChecked();
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
  const itemRow = page.locator(".card").filter({ hasText: itemName }).first();
  await expect(itemRow.locator('input[type="checkbox"]').first()).not.toBeChecked();
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
  await itemRow.getByRole("button", { name: "Excluir" }).click();
};

/**
 * Clicks "Lista inteligente" to auto-add items below minimum stock.
 *
 * @param page - Playwright page instance
 */
export const clickGenerateSmartList = async (page: Page): Promise<void> => {
  await page.getByRole("button", { name: "Lista inteligente" }).click();
};

/**
 * Clicks "Finalizar compra" to finalize the shopping list.
 *
 * @param page - Playwright page instance
 */
export const clickFinalizeShopping = async (page: Page): Promise<void> => {
  await page.getByRole("button", { name: /Finalizar compra/i }).click();
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
  await expect(
    page.getByRole("heading", { name: "Lista de Compras" })
  ).toBeVisible({ timeout: 10000 });
};
