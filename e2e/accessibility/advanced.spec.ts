import { expect, test } from "@playwright/test";

test.describe("Accessibility Tests", () => {
  test("should have proper heading hierarchy", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("domcontentloaded");

    // Verificar se existe um h1 na página de login
    const h1 = page.locator("h1");
    await expect(h1).toBeVisible();

    // Verificar que o subtítulo "Entrar na sua conta" está presente
    await expect(page.getByText("Entrar na sua conta")).toBeVisible();
  });

  test("should have accessible buttons", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("domcontentloaded");

    // Todos os botões devem ter texto ou aria-label
    const buttons = page.locator("button");
    const buttonCount = await buttons.count();

    for (let i = 0; i < buttonCount; i++) {
      const button = buttons.nth(i);
      const text = await button.textContent();
      const ariaLabel = await button.getAttribute("aria-label");

      const hasContent = text && text.trim().length > 0;
      const hasAccessibleName = hasContent || ariaLabel;

      expect(hasAccessibleName).toBeTruthy();
    }
  });

  test("should display images with alt text", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("domcontentloaded");

    // Todas as imagens devem ter alt text
    const images = page.locator("img");
    const imageCount = await images.count();

    for (let i = 0; i < imageCount; i++) {
      const alt = await images.nth(i).getAttribute("alt");
      expect(alt).toBeTruthy();
    }
  });
});

test.describe("Performance Tests", () => {
  test("should load page within acceptable time", async ({ page }) => {
    const startTime = Date.now();

    await page.goto("/login");

    const endTime = Date.now();
    const loadTime = endTime - startTime;

    // Página deve carregar em menos de 3 segundos
    expect(loadTime).toBeLessThan(3000);
  });

  test("should not have console errors", async ({ page }) => {
    const errors: string[] = [];

    // Capture erros de console
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });

    await page.goto("/login");
    await page.waitForLoadState("domcontentloaded");

    // Não deve haver erros
    expect(errors.length).toBe(0);
  });
});

test.describe("Responsiveness Tests", () => {
  test("should be responsive on mobile", async ({ page }) => {
    // Viewport de celular
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto("/login");
    await page.waitForLoadState("domcontentloaded");

    // Verificar se a navbar está visível
    const navbar = page.locator("nav.navbar");
    await expect(navbar).toBeVisible();

    // Verificar se o formulário de login está visível
    const loginSubmit = page.getByTestId("login-submit");
    await expect(loginSubmit).toBeVisible();
  });

  test("should be responsive on tablet", async ({ page }) => {
    // Viewport de tablet
    await page.setViewportSize({ width: 768, height: 1024 });

    await page.goto("/login");
    await page.waitForLoadState("domcontentloaded");

    // Verificar se o formulário de login está visível e funcional
    const loginEmail = page.getByTestId("login-email");
    await expect(loginEmail).toBeVisible();

    const loginSubmit = page.getByTestId("login-submit");
    await expect(loginSubmit).toBeVisible();
  });

  test("should be responsive on desktop", async ({ page }) => {
    // Viewport de desktop
    await page.setViewportSize({ width: 1920, height: 1080 });

    await page.goto("/login");
    await page.waitForLoadState("domcontentloaded");

    // Verificar se todos os elementos estão visíveis
    const footer = page.locator("footer.footer");
    await expect(footer).toBeVisible();
  });
});
