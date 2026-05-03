import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * Navigates to the login page.
 *
 * @param page - Playwright page instance
 */
export const navigateToLogin = async (page: Page): Promise<void> => {
  await page.goto("/login");
  await page.waitForLoadState("domcontentloaded");
};

/**
 * Fills the login form fields.
 *
 * @param page - Playwright page instance
 * @param email - Email to type
 * @param password - Password to type
 */
export const fillLoginForm = async (
  page: Page,
  email: string,
  password: string
): Promise<void> => {
  const form = page.locator("form").first();
  await form.locator('input[type="email"]').first().fill(email);
  await form.locator('input[type="password"]').first().fill(password);
};

/**
 * Clicks the submit (Entrar) button on the login form.
 *
 * @param page - Playwright page instance
 */
export const submitLogin = async (page: Page): Promise<void> => {
  await page.getByRole("button", { name: "Entrar" }).click();
};

/**
 * Performs the full login flow: navigate + fill + submit.
 *
 * @param page - Playwright page instance
 * @param email - User email
 * @param password - User password
 */
export const performLogin = async (
  page: Page,
  email: string,
  password: string
): Promise<void> => {
  await navigateToLogin(page);

  // If already redirected (session restored), skip the form
  if (/\/(group|list)(?:[?#].*)?$/.test(page.url())) {
    return;
  }

  await fillLoginForm(page, email, password);
  await submitLogin(page);
};

/**
 * Verifies that a login error message is displayed.
 *
 * @param page - Playwright page instance
 * @param expectedMessage - Optional substring to match in the error message
 */
export const verifyLoginError = async (
  page: Page,
  expectedMessage?: string
): Promise<void> => {
  const alert = page.locator('[role="alert"]');
  await expect(alert).toBeVisible({ timeout: 10000 });

  if (expectedMessage) {
    await expect(alert).toContainText(expectedMessage);
  }
};

/**
 * Verifies the browser was redirected to the list page after login.
 *
 * @param page - Playwright page instance
 */
export const verifyRedirectedToList = async (page: Page): Promise<void> => {
  await expect(page).toHaveURL(/\/list(?:[?#].*)?$/, { timeout: 15000 });
};

/**
 * Verifies the browser was redirected to the group page after login.
 *
 * @param page - Playwright page instance
 */
export const verifyRedirectedToGroup = async (page: Page): Promise<void> => {
  await expect(page).toHaveURL(/\/group(?:[?#].*)?$/, { timeout: 15000 });
};

/**
 * Verifies the browser is on the login page.
 *
 * @param page - Playwright page instance
 */
export const verifyOnLoginPage = async (page: Page): Promise<void> => {
  await expect(page).toHaveURL(/\/login(?:[?#].*)?$/, { timeout: 10000 });
  await expect(page.getByText("Entrar na sua conta")).toBeVisible();
};

/**
 * Navigates to the register page.
 *
 * @param page - Playwright page instance
 */
export const navigateToRegister = async (page: Page): Promise<void> => {
  await page.goto("/register");
  await page.waitForLoadState("domcontentloaded");
};

/**
 * Fills the registration form.
 *
 * @param page - Playwright page instance
 * @param name - Display name
 * @param email - User email
 * @param password - Password
 * @param confirmPassword - Password confirmation
 */
export const fillRegisterForm = async (
  page: Page,
  name: string,
  email: string,
  password: string,
  confirmPassword: string
): Promise<void> => {
  const form = page.locator("form").first();

  // The register form has: Nome, E-mail, Senha, Confirmar senha
  const inputs = form.locator("input");
  await inputs.nth(0).fill(name); // Nome
  await inputs.nth(1).fill(email); // E-mail
  await inputs.nth(2).fill(password); // Senha
  await inputs.nth(3).fill(confirmPassword); // Confirmar senha
};

/**
 * Clicks the submit button on the registration form.
 *
 * @param page - Playwright page instance
 */
export const submitRegister = async (page: Page): Promise<void> => {
  await page.getByRole("button", { name: /Criar conta/i }).click();
};
