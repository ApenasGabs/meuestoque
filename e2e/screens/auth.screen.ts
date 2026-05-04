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
  await page.getByTestId("login-email").fill(email);
  await page.getByTestId("login-password").fill(password);
};

/**
 * Clicks the submit (Entrar) button on the login form.
 *
 * @param page - Playwright page instance
 */
export const submitLogin = async (page: Page): Promise<void> => {
  await page.getByTestId("login-submit").click();
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
  // Wait for redirect to finish
  await page.waitForURL(/\/list|group|stock/, { timeout: 15000 });
  // Wait for the app to fully bootstrap (bottom nav visible = ready + authenticated)
  await expect(page.getByTestId("nav-list")).toBeVisible({ timeout: 15000 });
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
  const alert = page.getByTestId("login-error");
  await expect(alert).toBeVisible();

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
  await expect(page).toHaveURL(/\/list(?:[?#].*)?$/);
};

/**
 * Verifies the browser was redirected to the group page after login.
 *
 * @param page - Playwright page instance
 */
export const verifyRedirectedToGroup = async (page: Page): Promise<void> => {
  await expect(page).toHaveURL(/\/group(?:[?#].*)?$/);
};

/**
 * Verifies the browser is on the login page.
 *
 * @param page - Playwright page instance
 */
export const verifyOnLoginPage = async (page: Page): Promise<void> => {
  await expect(page).toHaveURL(/\/login(?:[?#].*)?$/);
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
  await page.getByTestId("register-name").fill(name);
  await page.getByTestId("register-email").fill(email);
  await page.getByTestId("register-password").fill(password);
  await page.getByTestId("register-confirm-password").fill(confirmPassword);
};

/**
 * Clicks the submit button on the registration form.
 *
 * @param page - Playwright page instance
 */
export const submitRegister = async (page: Page): Promise<void> => {
  await page.getByTestId("register-submit").click();
};
