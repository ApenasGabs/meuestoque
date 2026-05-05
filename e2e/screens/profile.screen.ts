import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * Navigates to the profile/settings page.
 *
 * @param page - Playwright page instance
 */
export const navigateToProfile = async (page: Page): Promise<void> => {
  await page.goto("/profile");
  await page.waitForLoadState("domcontentloaded");
};

/**
 * Verifies the displayed user name on the profile page.
 *
 * @param page - Playwright page instance
 * @param name - Expected user name
 */
export const verifyUserName = async (
  page: Page,
  name: string
): Promise<void> => {
  await expect(page.getByText(name)).toBeVisible();
};

/**
 * Clicks the "Sair da conta" (logout) button.
 *
 * @param page - Playwright page instance
 */
export const clickLogout = async (page: Page): Promise<void> => {
  await page.getByTestId("logout-button").click();
};

/**
 * Verifies the browser was redirected to the login page after logout.
 *
 * @param page - Playwright page instance
 */
export const verifyRedirectedToLogin = async (page: Page): Promise<void> => {
  await expect(page).toHaveURL(/\/login(?:[?#].*)?$/);
};
