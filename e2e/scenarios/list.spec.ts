import { test, expect } from "@playwright/test";
import { seedFullContext } from "../state/group.state";
import { seedListWithItems } from "../state/list.state";
import { seedStockAtMinimum } from "../state/stock.state";
import { cleanupAll } from "../state/cleanup.state";
import { resetGroupData } from "../state/cleanup.state";
import { testEmail, testGroupName, STOCK_PRODUCTS } from "../fixtures/testData";
import * as AuthScreen from "../screens/auth.screen";
import * as ListScreen from "../screens/list.screen";

/**
 * LST-01..14: Shopping List domain E2E tests.
 *
 * Covers smart input, toggle, remove, quantity, price, smart list, finalize, and import.
 */
test.describe("Shopping List - Lista de Compras", () => {
  const password = "e2e-senha-segura-123";
  const email = testEmail("list");
  const groupName = testGroupName();
  let userId: string;
  let groupId: string;

  test.beforeAll(async () => {
    const ctx = await seedFullContext(email, password, "List User", groupName);
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

  // --- LST-01 (P0): Adicionar item via smart input ---
  test("LST-01: deve adicionar item via smart input", async ({ page }) => {
    await AuthScreen.performLogin(page, email, password);
    await ListScreen.navigateToList(page);
    await ListScreen.verifyListHeadingVisible(page);

    await ListScreen.addItemViaSmartInput(page, "Arroz, 2, 12.90");
    await ListScreen.verifyItemVisible(page, "Arroz");
  });

  // --- LST-02 (P0): Marcar item como comprado ---
  test("LST-02: deve marcar item como comprado", async ({ page }) => {
    await seedListWithItems(groupId, [
      { nome: "Feijão", quantidade: "1 kg" },
    ]);

    await AuthScreen.performLogin(page, email, password);
    await ListScreen.navigateToList(page);
    await ListScreen.verifyItemVisible(page, "Feijão");
    await ListScreen.toggleItemChecked(page, "Feijão");
    await ListScreen.verifyItemChecked(page, "Feijão");
  });

  // --- LST-03 (P0): Desmarcar item comprado ---
  test("LST-03: deve desmarcar item comprado", async ({ page }) => {
    await seedListWithItems(groupId, [
      { nome: "Açúcar", quantidade: "1 kg", comprado: true },
    ]);

    await AuthScreen.performLogin(page, email, password);
    await ListScreen.navigateToList(page);
    await ListScreen.toggleItemChecked(page, "Açúcar");
    await ListScreen.verifyItemUnchecked(page, "Açúcar");
  });

  // --- LST-04 (P0): Remover item da lista ---
  test("LST-04: deve remover item da lista", async ({ page }) => {
    await seedListWithItems(groupId, [
      { nome: "Manteiga", quantidade: "1 un" },
    ]);

    await AuthScreen.performLogin(page, email, password);
    await ListScreen.navigateToList(page);
    await ListScreen.verifyItemVisible(page, "Manteiga");
    await ListScreen.removeItem(page, "Manteiga");
    await ListScreen.verifyItemNotVisible(page, "Manteiga");
  });

  // --- LST-09 (P0): Lista inteligente adiciona itens abaixo do mínimo ---
  test("LST-09: deve gerar lista inteligente com itens baixos", async ({ page }) => {
    await seedStockAtMinimum(groupId, {
      ...STOCK_PRODUCTS.leite,
      nome: `Leite LST09 ${Date.now()}`,
    });

    await AuthScreen.performLogin(page, email, password);
    await ListScreen.navigateToList(page);
    await ListScreen.clickGenerateSmartList(page);

    // Item below minimum should appear in the list
    await expect(page.getByText(/Leite LST09/)).toBeVisible({ timeout: 10000 });
  });

  // --- LST-11 (P0): Finalizar compra fecha lista ---
  test("LST-11: deve finalizar compra com itens comprados", async ({ page }) => {
    await seedListWithItems(groupId, [
      { nome: "Arroz Final", quantidade: "2 kg", comprado: true, preco: 15.9 },
      { nome: "Feijão Final", quantidade: "1 kg", comprado: true, preco: 8.5 },
    ]);

    await AuthScreen.performLogin(page, email, password);
    await ListScreen.navigateToList(page);

    // Finalize button should be visible since there are checked items
    await ListScreen.clickFinalizeShopping(page);

    // After finalization: new list created, old items gone
    await expect(page.getByRole("heading", { name: "Lista de Compras" })).toBeVisible({ timeout: 10000 });
  });

  // --- LST-14 (P2): Contador de pendentes reflete na header ---
  test("LST-14: deve mostrar contagem de pendentes e comprados", async ({ page }) => {
    await seedListWithItems(groupId, [
      { nome: "Item A", quantidade: "1 un", comprado: false },
      { nome: "Item B", quantidade: "1 un", comprado: false },
      { nome: "Item C", quantidade: "1 un", comprado: true },
    ]);

    await AuthScreen.performLogin(page, email, password);
    await ListScreen.navigateToList(page);
    await ListScreen.verifyItemCount(page, { unchecked: 2, checked: 1 });
  });
});
