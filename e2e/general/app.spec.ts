import { expect, test } from "@playwright/test";

test.describe("App - Page Load", () => {
  test("should load the app successfully", async ({ page }) => {
    await page.goto("/");

    // Verificar se a navbar está visível com o título correto
    const navbarTitle = page.getByTestId("navbar-title");
    await expect(navbarTitle).toBeVisible();
    await expect(navbarTitle).toContainText("Meu estoque");
  });

  test("should redirect root to login", async ({ page }) => {
    await page.goto("/");

    // A rota raiz redireciona para /login
    await page.waitForURL("**/login");
    await expect(page).toHaveURL(/\/login/);
  });
});
