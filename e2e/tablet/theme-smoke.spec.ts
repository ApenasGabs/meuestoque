import { expect, resolveRemoteUrl, test } from "./remote-test";

/**
 * Abre o seletor de temas: na UI antiga (bottom nav) passa por Config;
 * na UI web (navbar) o botão "Temas" já está acessível.
 */
const openThemeDrawer = async (page: import("@playwright/test").Page): Promise<void> => {
  const temas = page.getByRole("button", { name: "Temas" });
  if (await temas.isVisible().catch(() => false)) {
    await temas.click();
    return;
  }
  await page.getByRole("button", { name: "Abrir configurações do app" }).click();
  await expect(page.getByRole("button", { name: "Temas" })).toBeVisible();
  await page.getByRole("button", { name: "Temas" }).click();
};

test.describe("Tablet / remoto — smoke tema", () => {
  test("aplica tema dark e persiste após reload", async ({ page }) => {
    await page.goto(resolveRemoteUrl("/"));
    await page.waitForLoadState("domcontentloaded");

    await openThemeDrawer(page);
    await page.getByRole("radio", { name: "Dark" }).click();

    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect.poll(async () => page.evaluate(() => localStorage.getItem("theme"))).toBe("dark");

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });
});
