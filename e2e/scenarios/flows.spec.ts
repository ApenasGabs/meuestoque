import { test, expect } from "@playwright/test";
import { seedFullContext } from "../state/group.state";
import { seedStockWithProducts } from "../state/stock.state";
import { cleanupAll } from "../state/cleanup.state";
import { testEmail, testGroupName } from "../fixtures/testData";
import * as AuthScreen from "../screens/auth.screen";
import * as ListScreen from "../screens/list.screen";
import * as StockScreen from "../screens/stock.screen";

/**
 * FLW-01..03: Cross-domain E2E flow tests.
 *
 * These test full user journeys spanning multiple domains.
 */
test.describe("Flows - Fluxos Cross-Domain", () => {
  const password = "e2e-senha-segura-123";

  // --- FLW-01 (P0): Jornada completa de compra ---
  test.describe("FLW-01: Jornada completa de compra", () => {
    const email = testEmail("flw01");
    const groupName = testGroupName();
    let userId: string;
    let groupId: string;

    test.beforeAll(async () => {
      const ctx = await seedFullContext(email, password, "Flow01 User", groupName);
      userId = ctx.userId;
      groupId = ctx.groupId;
    });

    test.afterAll(async () => {
      await cleanupAll(userId, groupId);
    });

    test("deve completar fluxo: lista → comprar → finalizar → estoque", async ({ page }) => {
      test.setTimeout(90000);

      await AuthScreen.performLogin(page, email, password);
      await ListScreen.navigateToList(page);
      await ListScreen.verifyListHeadingVisible(page);

      // 1. Add items to shopping list
      const itemName = `Flow Item ${Date.now()}`;
      await ListScreen.addItemViaSmartInput(page, `${itemName}, 2, 10.00`);
      await ListScreen.verifyItemVisible(page, itemName);

      // 2. Mark as purchased
      await ListScreen.toggleItemChecked(page, itemName);
      await ListScreen.verifyItemChecked(page, itemName);

      // 3. Finalize shopping
      await ListScreen.clickFinalizeShopping(page);

      // 4. Verify in stock
      await StockScreen.navigateToStock(page);
      await StockScreen.verifyStockHeadingVisible(page);
      await StockScreen.verifyProductVisible(page, itemName);
    });
  });

  // --- FLW-02 (P0): Ciclo de reposição ---
  test.describe("FLW-02: Ciclo de reposição", () => {
    const email = testEmail("flw02");
    const groupName = testGroupName();
    let userId: string;
    let groupId: string;

    test.beforeAll(async () => {
      const ctx = await seedFullContext(email, password, "Flow02 User", groupName);
      userId = ctx.userId;
      groupId = ctx.groupId;
    });

    test.afterAll(async () => {
      await cleanupAll(userId, groupId);
    });

    test("deve gerar lista inteligente com itens abaixo do mínimo", async ({ page }) => {
      test.setTimeout(60000);

      const productName = `Repor ${Date.now()}`;
      // Seed stock item below minimum
      await seedStockWithProducts(groupId, [
        {
          nome: productName,
          quantidade: 1,
          quantidade_minima: 5,
          unidade: "un",
        },
      ]);

      await AuthScreen.performLogin(page, email, password);
      await ListScreen.navigateToList(page);

      // Generate smart list
      await ListScreen.clickGenerateSmartList(page);

      // Item below minimum should appear in the list
      await expect(page.getByText(productName)).toBeVisible({ timeout: 10000 });
    });
  });

  // --- FLW-03 (P1): Multi-grupo isolamento ---
  test.describe("FLW-03: Isolamento multi-grupo", () => {
    const email = testEmail("flw03");
    const group1Name = `Grupo1 ${Date.now()}`;
    const group2Name = `Grupo2 ${Date.now()}`;
    let userId: string;
    let group1Id: string;
    let group2Id: string;

    test.beforeAll(async () => {
      // Create user with first group
      const ctx = await seedFullContext(email, password, "Flow03 User", group1Name);
      userId = ctx.userId;
      group1Id = ctx.groupId;

      // Create second group and add user
      const { seedGroup, seedUserInGroup } = await import("../state/group.state");
      const g2 = await seedGroup(group2Name);
      group2Id = g2.groupId;
      await seedUserInGroup(userId, group2Id);

      // Seed different stock in each group
      await seedStockWithProducts(group1Id, [
        { nome: `Produto G1 ${Date.now()}`, quantidade: 10, unidade: "un" },
      ]);
      await seedStockWithProducts(group2Id, [
        { nome: `Produto G2 ${Date.now()}`, quantidade: 5, unidade: "un" },
      ]);

      // Create active list for group2
      const { supabaseAdmin } = await import("../config/supabaseAdmin");
      await supabaseAdmin
        .from("shopping_lists")
        .insert({ group_id: group2Id, ativa: true, status: "active" });
    });

    test.afterAll(async () => {
      await cleanupAll(userId, group1Id);
      const { supabaseAdmin } = await import("../config/supabaseAdmin");
      await supabaseAdmin.from("groups").delete().eq("id", group2Id);
    });

    test("deve isolar estoque entre grupos", async ({ page }) => {
      test.setTimeout(60000);

      await AuthScreen.performLogin(page, email, password);

      // Verify group1 stock
      await StockScreen.navigateToStock(page);
      await expect(page.getByText(/Produto G1/)).toBeVisible({ timeout: 10000 });
      await expect(page.getByText(/Produto G2/)).toHaveCount(0);
    });
  });
});
