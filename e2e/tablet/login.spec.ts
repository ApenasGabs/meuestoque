import { expect, resolveRemoteUrl, test } from "./remote-test";

test.describe("Tablet / remoto — login Supabase", () => {
  test("entra com credenciais de ambiente", async ({ page }) => {
    const email = process.env.E2E_REMOTE_EMAIL ?? "";
    const password = process.env.E2E_REMOTE_PASSWORD ?? "";
    test.skip(!email || !password, "Defina E2E_REMOTE_EMAIL e E2E_REMOTE_PASSWORD no .env.local");

    await page.goto(resolveRemoteUrl("/login"));
    await page.waitForLoadState("domcontentloaded");

    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.getByRole("button", { name: "Entrar" }).click();

    await expect(page.getByRole("button", { name: "Grupo" })).toBeVisible({ timeout: 25_000 });
  });
});
