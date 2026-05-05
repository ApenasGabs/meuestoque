import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * Clicks the "Lista" tab in the bottom navigation.
 *
 * @param page - Playwright page instance
 */
export const clickNavList = async (page: Page): Promise<void> => {
  await page.getByTestId("nav-list").click();
};

/**
 * Clicks the "Estoque" tab in the bottom navigation.
 *
 * @param page - Playwright page instance
 */
export const clickNavStock = async (page: Page): Promise<void> => {
  await page.getByTestId("nav-stock").click();
};

/**
 * Clicks the config/settings tab in the bottom navigation.
 *
 * @param page - Playwright page instance
 */
export const clickNavConfig = async (page: Page): Promise<void> => {
  await page.getByTestId("nav-config").click();
};

/**
 * Verifies that a specific navigation tab is in "active" state.
 *
 * @param page - Playwright page instance
 * @param tab - Which tab to check
 */
export const verifyNavActive = async (
  page: Page,
  tab: "list" | "stock" | "config"
): Promise<void> => {
  const testIdMap = { list: "nav-list", stock: "nav-stock", config: "nav-config" };
  const navButton = page.getByTestId(testIdMap[tab]);
  await expect(navButton).toHaveClass(/text-primary/);
};

/**
 * Verifies the badge count on a navigation tab.
 *
 * @param page - Playwright page instance
 * @param tab - Which tab to check
 * @param count - Expected badge count
 */
export const verifyNavBadge = async (
  page: Page,
  tab: "list" | "stock",
  count: number
): Promise<void> => {
  const testIdMap = { list: "nav-list", stock: "nav-stock" };
  const navButton = page.getByTestId(testIdMap[tab]);

  if (count > 0) {
    await expect(navButton.locator(".badge")).toContainText(String(count));
  } else {
    await expect(navButton.locator(".badge")).toHaveCount(0);
  }
};

/**
 * Verifies the bottom navigation bar is visible (user is authenticated).
 *
 * @param page - Playwright page instance
 */
export const verifyNavVisible = async (page: Page): Promise<void> => {
  await expect(page.getByTestId("nav-list")).toBeVisible();
};

/**
 * Verifies the bottom navigation bar is NOT visible (user not authenticated).
 *
 * @param page - Playwright page instance
 */
export const verifyNavNotVisible = async (page: Page): Promise<void> => {
  await expect(page.getByTestId("nav-list")).toHaveCount(0);
};
