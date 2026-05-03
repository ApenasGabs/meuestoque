import { test, expect } from "@playwright/test";
import { seedFullContext } from "../state/group.state";
import { seedStockWithProducts, seedStockAtMinimum } from "../state/stock.state";
import { cleanupAll, resetGroupData } from "../state/cleanup.state";
import { testEmail, testGroupName, STOCK_PRODUCTS } from "../fixtures/testData";
import * as AuthScreen from "../screens/auth.screen";
import * as StockScreen from "../screens/stock.screen";

/**
 * STK-01..12: Stock/Inventory domain E2E tests.
 *
 * Covers product visibility, search, filters, CRUD, consume, and add-to-list.
 */
test.describe("Stock - Estoque", () => {
  const password = "e2e-senha-segura-123";
  const email = testEmail("stock");
  const groupName = testGroupName();
  let userId: string;
  let groupId: string;

  test.beforeAll(async () => {
    const ctx = await seedFullContext(email, password, "Stock User", groupName);
    userId = ctx.userId;
    groupId = ctx.groupId;
  });

  test.afterAll(async () => {
    await cleanupAll(userId, groupId);
  });

  test.beforeEach(async () => {
    await resetGroupData(groupId);
    // Re-create active list after reset
    const { supabaseAdmin } = await import("../config/supabaseAdmin");
    await supabaseAdmin
      .from("shopping_lists")
      .insert({ group_id: groupId, ativa: true, status: "active" });
  });

  // --- STK-01 (P0): Produtos do estoque são visíveis ---
  test("STK-01: deve exibir produtos do estoque", async ({ page }) => {
    const suffix = Date.now();
    await seedStockWithProducts(groupId, [
      { ...STOCK_PRODUCTS.arroz, nome: `Arroz STK01 ${suffix}` },
      { ...STOCK_PRODUCTS.feijao, nome: `Feijão STK01 ${suffix}` },
    ]);

    await AuthScreen.performLogin(page, email, password);
    await StockScreen.navigateToStock(page);
    await StockScreen.verifyStockHeadingVisible(page);
    await StockScreen.verifyProductVisible(page, `Arroz STK01 ${suffix}`);
    await StockScreen.verifyProductVisible(page, `Feijão STK01 ${suffix}`);
  });

  // --- STK-02 (P0): Buscar produto por nome ---
  test("STK-02: deve filtrar produto por busca", async ({ page }) => {
    const suffix = Date.now();
    await seedStockWithProducts(groupId, [
      { ...STOCK_PRODUCTS.arroz, nome: `Arroz STK02 ${suffix}` },
      { ...STOCK_PRODUCTS.cafe, nome: `Café STK02 ${suffix}`, quantidade: 1 },
    ]);

    await AuthScreen.performLogin(page, email, password);
    await StockScreen.navigateToStock(page);

    await StockScreen.searchProduct(page, "Arroz");
    await StockScreen.verifyProductVisible(page, `Arroz STK02 ${suffix}`);
    await expect(page.getByText(`Café STK02 ${suffix}`)).toHaveCount(0);
  });

  // --- STK-03 (P1): Filtro "low" exibe apenas itens abaixo do mínimo ---
  test("STK-03: deve filtrar por estoque baixo", async ({ page }) => {
    const suffix = Date.now();
    await seedStockWithProducts(groupId, [
      { nome: `Normal STK03 ${suffix}`, quantidade: 10, quantidade_minima: 2, unidade: "un" },
    ]);
    await seedStockAtMinimum(groupId, {
      nome: `Baixo STK03 ${suffix}`,
      quantidade: 1,
      quantidade_minima: 5,
      unidade: "un",
    });

    await AuthScreen.performLogin(page, email, password);
    await StockScreen.navigateToStock(page);
    await StockScreen.toggleFilter(page, "low");

    await StockScreen.verifyProductVisible(page, `Baixo STK03 ${suffix}`);
    await expect(page.getByText(`Normal STK03 ${suffix}`)).toHaveCount(0);
  });

  // --- STK-04 (P1): Filtro "out" exibe apenas itens zerados ---
  test("STK-04: deve filtrar por estoque zerado", async ({ page }) => {
    const suffix = Date.now();
    await seedStockWithProducts(groupId, [
      { nome: `Tem STK04 ${suffix}`, quantidade: 5, quantidade_minima: 1, unidade: "un" },
      { ...STOCK_PRODUCTS.cafe, nome: `Zerado STK04 ${suffix}` },
    ]);

    await AuthScreen.performLogin(page, email, password);
    await StockScreen.navigateToStock(page);
    await StockScreen.toggleFilter(page, "out");

    await StockScreen.verifyProductVisible(page, `Zerado STK04 ${suffix}`);
    await expect(page.getByText(`Tem STK04 ${suffix}`)).toHaveCount(0);
  });

  // --- STK-07 (P0): Adicionar novo produto via formulário ---
  test("STK-07: deve adicionar produto via formulário", async ({ page }) => {
    const productName = `Produto Novo ${Date.now()}`;

    await AuthScreen.performLogin(page, email, password);
    await StockScreen.navigateToStock(page);
    await StockScreen.clickAddProduct(page);

    await StockScreen.fillProductForm(page, {
      name: productName,
      quantity: "5",
      minStock: "2",
    });
    await StockScreen.submitProductForm(page);

    await StockScreen.verifyProductVisible(page, productName);
  });

  // --- STK-09 (P0): Remover produto do estoque ---
  test("STK-09: deve remover produto do estoque", async ({ page }) => {
    const suffix = Date.now();
    const productName = `Remover STK09 ${suffix}`;
    await seedStockWithProducts(groupId, [
      { nome: productName, quantidade: 3, unidade: "un" },
    ]);

    await AuthScreen.performLogin(page, email, password);
    await StockScreen.navigateToStock(page);
    await StockScreen.verifyProductVisible(page, productName);
    await StockScreen.removeProduct(page, productName);
    await StockScreen.verifyProductNotVisible(page, productName);
  });

  // --- STK-10 (P1): Adicionar produto à lista de compras via estoque ---
  test("STK-10: deve adicionar produto à lista via estoque", async ({ page }) => {
    const suffix = Date.now();
    const productName = `Listar STK10 ${suffix}`;
    await seedStockWithProducts(groupId, [
      { nome: productName, quantidade: 2, unidade: "un" },
    ]);

    await AuthScreen.performLogin(page, email, password);
    await StockScreen.navigateToStock(page);
    await StockScreen.addToShoppingList(page, productName);
    await StockScreen.verifyToast(page, "marcado para compra");
  });
});
