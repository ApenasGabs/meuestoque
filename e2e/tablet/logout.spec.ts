import { expect, resolveRemoteUrl, test } from "./remote-test";

const signInRemoteUser = async (page: import("@playwright/test").Page): Promise<void> => {
  const email = process.env.E2E_REMOTE_EMAIL ?? "";
  const password = process.env.E2E_REMOTE_PASSWORD ?? "";
  test.skip(!email || !password, "Defina E2E_REMOTE_EMAIL e E2E_REMOTE_PASSWORD no .env.local");

  await page.goto(resolveRemoteUrl("/login"));
  await page.waitForLoadState("domcontentloaded");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("button", { name: "Grupo" })).toBeVisible({ timeout: 25_000 });
};

test.describe("Tablet / remoto — sair da conta", () => {
  test("faz logout e retorna para a tela de login", async ({ page }) => {
    await signInRemoteUser(page);

    await page.goto(resolveRemoteUrl("/profile"));
    await page.waitForLoadState("domcontentloaded");

    await expect(page.getByRole("button", { name: "Sair da conta" })).toBeVisible();
    await page.getByRole("button", { name: "Sair da conta" }).click();

    await expect(page).toHaveURL(/\/login(?:[?#].*)?$/);
    await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible({ timeout: 25_000 });
  });
});
