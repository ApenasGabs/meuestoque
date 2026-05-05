import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * Navigates to the stock/inventory page.
 * Uses page.goto to navigate directly — the Supabase session persists in localStorage
 * and survives page reloads. Waits for the stock heading to confirm the app
 * finished bootstrapping the session and loading stock data.
 *
 * @param page - Playwright page instance
 */
export const navigateToStock = async (page: Page): Promise<void> => {
  await page.goto("/stock");
  await expect(page.getByTestId("stock-heading")).toBeVisible({ timeout: 30000 });
};

/**
 * Verifies a product is visible on the stock page.
 *
 * @param page - Playwright page instance
 * @param productName - Product name
 */
export const verifyProductVisible = async (
  page: Page,
  productName: string
): Promise<void> => {
  await expect(page.getByText(productName).first()).toBeVisible({ timeout: 10000 });
};

/**
 * Verifies a product is NOT visible on the stock page.
 *
 * @param page - Playwright page instance
 * @param productName - Product name
 */
export const verifyProductNotVisible = async (
  page: Page,
  productName: string
): Promise<void> => {
  await expect(page.getByText(productName)).toHaveCount(0);
};

/**
 * Types a search query in the stock search input.
 *
 * @param page - Playwright page instance
 * @param query - Search text
 */
export const searchProduct = async (
  page: Page,
  query: string
): Promise<void> => {
  await page.getByTestId("stock-search").fill(query);
};

/**
 * Clears the search input.
 *
 * @param page - Playwright page instance
 */
export const clearSearch = async (page: Page): Promise<void> => {
  await page.getByTestId("stock-search").fill("");
};

/**
 * Clicks a filter button (Baixos or Zerados).
 *
 * @param page - Playwright page instance
 * @param filter - Which filter to toggle
 */
export const toggleFilter = async (
  page: Page,
  filter: "low" | "out"
): Promise<void> => {
  const testId = filter === "low" ? "filter-low" : "filter-out";
  await page.getByTestId(testId).click();
};

/**
 * Clicks "Todos" to clear all filters.
 *
 * @param page - Playwright page instance
 */
export const clearFilters = async (page: Page): Promise<void> => {
  await page.getByTestId("filter-all").click();
};

/**
 * Clicks "Novo produto" to open the product creation form.
 *
 * @param page - Playwright page instance
 */
export const clickAddProduct = async (page: Page): Promise<void> => {
  await page.getByTestId("add-product-button").click();
};

/**
 * Fills the product form (create or edit).
 *
 * @param page - Playwright page instance
 * @param product - Product data to fill
 */
export const fillProductForm = async (
  page: Page,
  product: {
    name: string;
    quantity?: string;
    minStock?: string;
    unit?: string;
    portionSize?: string;
  }
): Promise<void> => {
  await page.getByTestId("product-name").fill(product.name);

  if (product.quantity !== undefined) {
    await page.getByTestId("product-quantity").fill(product.quantity);
  }
  if (product.minStock !== undefined) {
    await page.getByTestId("product-min").fill(product.minStock);
  }
  if (product.unit !== undefined) {
    await page.getByTestId("product-unit").selectOption(product.unit);
  }
  if (product.portionSize !== undefined) {
    await page.getByTestId("product-portion-size").fill(product.portionSize);
  }
};

/**
 * Submits the product form (clicks "Adicionar" or "Salvar").
 *
 * @param page - Playwright page instance
 * @param isEdit - True if editing (button says "Salvar"), false if creating ("Adicionar")
 */
export const submitProductForm = async (
  page: Page,
  _isEdit = false
): Promise<void> => {
  await page.getByTestId("product-save-button").click();
};

/**
 * Opens a product's edit form by clicking its edit button.
 *
 * @param page - Playwright page instance
 * @param productName - Product to edit
 */
export const openProductEdit = async (
  page: Page,
  productName: string
): Promise<void> => {
  await page.getByRole("button", { name: `Editar ${productName}` }).click();
};

/**
 * Removes a product via the delete button and confirms.
 *
 * @param page - Playwright page instance
 * @param productName - Product to remove
 */
export const removeProduct = async (
  page: Page,
  productName: string
): Promise<void> => {
  await page.getByRole("button", { name: `Remover ${productName}` }).click();
  // Confirm in the deletion drawer
  await page.getByRole("button", { name: "Remover" }).last().click();
};

/**
 * Clicks the consume button (-portion) on a product card.
 *
 * @param page - Playwright page instance
 * @param productName - Product to consume
 */
export const consumeProduct = async (
  page: Page,
  productName: string
): Promise<void> => {
  await page.getByRole("button", { name: `Consumir ${productName}` }).click();
};

/**
 * Clicks "Add to shopping list" (cart icon) on a product card.
 *
 * @param page - Playwright page instance
 * @param productName - Product to add to list
 */
export const addToShoppingList = async (
  page: Page,
  productName: string
): Promise<void> => {
  await page.getByRole("button", { name: `Adicionar ${productName} na lista` }).click();
};

/**
 * Verifies the stock page heading is visible.
 *
 * @param page - Playwright page instance
 */
export const verifyStockHeadingVisible = async (page: Page): Promise<void> => {
  await expect(page.getByTestId("stock-heading")).toBeVisible();
};

/**
 * Verifies a toast message is visible.
 *
 * @param page - Playwright page instance
 * @param message - Expected message substring
 */
export const verifyToast = async (
  page: Page,
  message: string
): Promise<void> => {
  await expect(page.getByText(message).first()).toBeVisible({ timeout: 10000 });
};
