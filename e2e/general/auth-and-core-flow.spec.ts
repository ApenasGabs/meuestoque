import { expect, test, type Page } from "@playwright/test";

declare const process: {
  env: Record<string, string | undefined>;
};

const getCredentials = (): { email: string; password: string } => {
  const email = process.env.E2E_EMAIL ?? process.env.E2E_REMOTE_EMAIL ?? "";
  const password = process.env.E2E_PASSWORD ?? process.env.E2E_REMOTE_PASSWORD ?? "";

  return { email, password };
};

const submitLogin = async (page: Page, email: string, password: string): Promise<void> => {
  await page.goto("/login");
  await page.waitForLoadState("domcontentloaded");

  if (/\/(group|list)(?:[?#].*)?$/.test(page.url())) {
    return;
  }

  await expect(page).toHaveURL(/\/login(?:[?#].*)?$/);

  const loginForm = page.locator("form").first();
  await loginForm.locator('input[type="email"]').first().fill(email);
  await loginForm.locator('input[type="password"]').first().fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
};

const ensureInListPage = async (page: Page): Promise<void> => {
  await expect(page).toHaveURL(/\/(group|list)(?:[?#].*)?$/);

  if (page.url().includes("/group")) {
    const groupName = `e2e-grupo-${Date.now()}`;

    await page.getByLabel("Nome do grupo").fill(groupName);
    await page.getByRole("button", { name: "Criar" }).click();

    const goToListButton = page.getByRole("button", { name: "Ir para a lista" });
    const continueButton = page.getByRole("button", { name: "Continuar" });

    if (await goToListButton.isVisible()) {
      await goToListButton.click();
    } else {
      await continueButton.click();
    }
  }

  await expect(page).toHaveURL(/\/list(?:[?#].*)?$/);
  await expect(page.getByRole("heading", { name: "Lista de Compras" })).toBeVisible();
};

test.describe("Desktop E2E - login e fluxo principal", () => {
  test("deve autenticar e validar fluxo de lista e estoque", async ({ page }) => {
    test.setTimeout(120000);

    const { email, password } = getCredentials();
    test.skip(
      !email || !password,
      "Defina E2E_EMAIL/E2E_PASSWORD (ou E2E_REMOTE_EMAIL/E2E_REMOTE_PASSWORD) para rodar este fluxo autenticado.",
    );

    const uniqueId = Date.now();
    const listItemName = `e2e-item-lista-${uniqueId}`;
    const stockItemName = `e2e-item-estoque-${uniqueId}`;

    await submitLogin(page, email, password);

    await ensureInListPage(page);

    await page.getByPlaceholder("Nome, quantidade, valor").fill(`${listItemName}, 2, 9.90`);
    await page.getByRole("button", { name: "Adicionar" }).click();

    const listItemCard = page.locator(".card").filter({ hasText: listItemName }).first();
    await expect(listItemCard).toBeVisible();
    await listItemCard.getByRole("button", { name: "Excluir" }).click();
    await expect(page.getByText(listItemName)).toHaveCount(0);

    await page.getByTestId("nav-stock").click();
    await expect(page).toHaveURL(/\/stock(?:[?#].*)?$/);
    await expect(page.getByRole("button", { name: "Novo produto" })).toBeVisible();

    await page.getByRole("button", { name: "Novo produto" }).click();
    await page.getByLabel("Nome do produto").fill(stockItemName);
    await page.getByLabel("Qtd atual").fill("3");
    await page.getByLabel("Mínimo").fill("1");
    await page.getByLabel("Unidade").fill("un");
    await page.getByRole("button", { name: "Adicionar" }).click();

    const stockCard = page
      .locator('[data-testid^="product-card-"]')
      .filter({ hasText: stockItemName })
      .first();
    await expect(stockCard).toBeVisible();
    await expect(stockCard.getByText("Pendente Validade")).toBeVisible();

    await stockCard.click();
    await expect(page.getByRole("heading", { name: "Data de validade" })).toBeVisible();

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowIso = tomorrow.toISOString().slice(0, 10);

    await page.getByLabel("Data de validade").fill(tomorrowIso);
    await page.getByRole("button", { name: "Salvar validade" }).click();
    await expect(page.getByRole("heading", { name: "Data de validade" })).toHaveCount(0);

    const removeButton = page.getByRole("button", { name: `Remover ${stockItemName}` });
    await expect(removeButton).toBeVisible();
    await removeButton.click();

    await expect(page.getByText(stockItemName)).toHaveCount(0);
  });
});
