import { expect, resolveRemoteUrl, test } from "./remote-test";

test.describe("Tablet / remoto — falha forçada", () => {
  test("sempre falha para gerar screenshot", async ({ page }) => {
    await page.goto(resolveRemoteUrl("/login"));
    await page.waitForLoadState("domcontentloaded");
    const estoqueBtn = page.getByRole("button", { name: "Estoque" });
    await expect(estoqueBtn).toBeVisible();
    await estoqueBtn.click();
    await page.screenshot({
      path: "test-results/remote-cdp/forced-failure-device.png",
      fullPage: true,
    });

    expect(false, "Falha intencional para capturar print de tela do dispositivo").toBe(true);
  });
});
