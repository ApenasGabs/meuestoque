import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * Navigates to the group management page.
 * Uses page.goto to navigate directly — the Supabase session persists in localStorage
 * and survives page reloads. Waits for the group heading to confirm the app
 * finished bootstrapping the session and loading group data.
 *
 * @param page - Playwright page instance
 */
export const navigateToGroup = async (page: Page): Promise<void> => {
  await page.goto("/group");
  await expect(page.getByTestId("group-heading")).toBeVisible({ timeout: 30000 });
};

/**
 * Fills the "Create group" name input.
 *
 * @param page - Playwright page instance
 * @param name - Group name to type
 */
export const fillCreateGroupName = async (
  page: Page,
  name: string
): Promise<void> => {
  await page.getByTestId("create-group-name").fill(name);
};

/**
 * Submits the "Create group" form.
 *
 * @param page - Playwright page instance
 */
export const submitCreateGroup = async (page: Page): Promise<void> => {
  await page.getByTestId("create-group-button").click();
};

/**
 * Verifies that the invite code badge is visible on the page.
 *
 * @param page - Playwright page instance
 * @param code - Expected invite code text
 */
export const verifyInviteCodeVisible = async (
  page: Page,
  code: string
): Promise<void> => {
  await expect(page.getByText(code).first()).toBeVisible();
};

/**
 * Fills the "Join group by code" input.
 *
 * @param page - Playwright page instance
 * @param code - Invite code to type
 */
export const fillJoinGroupCode = async (
  page: Page,
  code: string
): Promise<void> => {
  await page.getByTestId("join-group-code").fill(code);
};

/**
 * Submits the "Join group" form.
 *
 * @param page - Playwright page instance
 */
export const submitJoinGroup = async (page: Page): Promise<void> => {
  await page.getByTestId("join-group-button").click();
};

/**
 * Verifies the active group name is displayed on the page.
 *
 * @param page - Playwright page instance
 * @param groupName - Expected group name
 */
export const verifyGroupActive = async (
  page: Page,
  groupName: string
): Promise<void> => {
  await expect(page.getByTestId("group-heading")).toContainText(groupName);
};

/**
 * Clicks the "Usar" button for a specific group in the list.
 *
 * @param page - Playwright page instance
 * @param groupName - Name of the group to activate
 */
export const clickUseGroup = async (
  page: Page,
  groupName: string
): Promise<void> => {
  const groupItem = page.locator("article").filter({ hasText: groupName });
  await groupItem.getByRole("button", { name: "Usar" }).click();
};

/**
 * Clicks the "Sair do grupo" button.
 *
 * @param page - Playwright page instance
 */
export const clickLeaveGroup = async (page: Page): Promise<void> => {
  await page.getByTestId("leave-group-button").click();
};

/**
 * Verifies that no active group is shown.
 *
 * @param page - Playwright page instance
 */
export const verifyNoActiveGroup = async (page: Page): Promise<void> => {
  await expect(
    page.locator("h2").filter({ hasText: "Nenhum grupo ativo" })
  ).toBeVisible();
};

/**
 * Clicks the "Copiar código" button.
 *
 * @param page - Playwright page instance
 */
export const clickCopyInviteCode = async (page: Page): Promise<void> => {
  await page.getByRole("button", { name: "Copiar código" }).first().click();
};

/**
 * Verifies the group list contains a specific group name.
 *
 * @param page - Playwright page instance
 * @param groupName - Group name to find
 */
export const verifyGroupInList = async (
  page: Page,
  groupName: string
): Promise<void> => {
  const groupsList = page.locator(".stack-list").last();
  await expect(groupsList.getByText(groupName)).toBeVisible();
};

/**
 * Verifies a group error alert is visible.
 *
 * @param page - Playwright page instance
 * @param message - Optional error substring
 */
export const verifyGroupError = async (
  page: Page,
  message?: string
): Promise<void> => {
  const alert = page.locator('[role="alert"]');
  await expect(alert).toBeVisible();

  if (message) {
    await expect(alert).toContainText(message);
  }
};
