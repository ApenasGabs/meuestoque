import { test } from "@playwright/test";
import { seedFullContext, seedGroup, seedUserInGroup } from "../state/group.state";
import { seedTestUser, cleanupTestUser } from "../state/auth.state";
import { cleanupAll } from "../state/cleanup.state";
import { testEmail, testGroupName } from "../fixtures/testData";
import * as AuthScreen from "../screens/auth.screen";
import * as GroupScreen from "../screens/group.screen";

/**
 * GRP-01..08: Group management domain E2E tests.
 *
 * Covers creating groups, joining via invite code, switching active groups,
 * leaving groups, and edge cases like invalid codes and no-group redirect.
 */
test.describe("Groups - Gestão de Grupos", () => {
  const password = "e2e-senha-segura-123";

  // --- GRP-01 (P0): Criar grupo gera código de convite visível ---
  test.describe("GRP-01: Criar grupo", () => {
    const email = testEmail("grp01");
    const groupName = testGroupName();
    let userId: string;
    let groupId: string;

    test.beforeAll(async () => {
      const ctx = await seedFullContext(email, password, "Grp01 User", groupName);
      userId = ctx.userId;
      groupId = ctx.groupId;
    });

    test.afterAll(async () => {
      await cleanupAll(userId, groupId);
    });

    test("deve criar grupo e exibir código de convite", async ({ page }) => {
      await AuthScreen.performLogin(page, email, password);
      await AuthScreen.verifyRedirectedToList(page);

      await page.goto("/group");

      const newGroupName = `Novo Grupo ${Date.now()}`;
      await GroupScreen.fillCreateGroupName(page, newGroupName);
      await GroupScreen.submitCreateGroup(page);

      // After creation, the invite code should be visible
      await GroupScreen.verifyGroupActive(page, newGroupName);
    });
  });

  // --- GRP-02 (P0): Entrar em grupo com código válido redireciona para /list ---
  test.describe("GRP-02: Entrar com código válido", () => {
    const ownerEmail = testEmail("grp02owner");
    const joinerEmail = testEmail("grp02joiner");
    let ownerUserId: string;
    let joinerUserId: string;
    let groupId: string;
    let inviteCode: string;

    test.beforeAll(async () => {
      // Create owner with group
      const ctx = await seedFullContext(ownerEmail, password, "Owner", testGroupName());
      ownerUserId = ctx.userId;
      groupId = ctx.groupId;
      inviteCode = ctx.inviteCode;

      // Create joiner (no group)
      const joiner = await seedTestUser(joinerEmail, password, "Joiner");
      joinerUserId = joiner.userId;
    });

    test.afterAll(async () => {
      await cleanupAll(ownerUserId, groupId);
      await cleanupTestUser(joinerUserId);
    });

    test("deve entrar no grupo com código e ir para /list", async ({ page }) => {
      // Login as joiner
      await AuthScreen.performLogin(page, joinerEmail, password);
      // Joiner has no group, should land on /group
      await AuthScreen.verifyRedirectedToGroup(page);

      // Join group using invite code
      await GroupScreen.fillJoinGroupCode(page, inviteCode);
      await GroupScreen.submitJoinGroup(page);

      // Should redirect to /list after joining
      await AuthScreen.verifyRedirectedToList(page);
    });
  });

  // --- GRP-03 (P1): Entrar com código inválido exibe erro ---
  test.describe("GRP-03: Código inválido", () => {
    const email = testEmail("grp03");
    let userId: string;

    test.beforeAll(async () => {
      const result = await seedTestUser(email, password, "Grp03 User");
      userId = result.userId;
    });

    test.afterAll(async () => {
      await cleanupTestUser(userId);
    });

    test("deve exibir erro ao usar código inexistente", async ({ page }) => {
      await AuthScreen.performLogin(page, email, password);
      await AuthScreen.verifyRedirectedToGroup(page);

      await GroupScreen.fillJoinGroupCode(page, "ZZZZZZZZ");
      await GroupScreen.submitJoinGroup(page);

      await GroupScreen.verifyGroupError(page);
    });
  });

  // --- GRP-04 (P0): Trocar de grupo ativo carrega lista correta ---
  test.describe("GRP-04: Trocar grupo ativo", () => {
    const email = testEmail("grp04");
    const group1Name = `Grupo A ${Date.now()}`;
    const group2Name = `Grupo B ${Date.now()}`;
    let userId: string;
    let group1Id: string;
    let group2Id: string;

    test.beforeAll(async () => {
      // Create user with first group
      const ctx = await seedFullContext(email, password, "Grp04 User", group1Name);
      userId = ctx.userId;
      group1Id = ctx.groupId;

      // Create second group and add user
      const g2 = await seedGroup(group2Name);
      group2Id = g2.groupId;
      await seedUserInGroup(userId, group2Id);
    });

    test.afterAll(async () => {
      await cleanupAll(userId, group1Id);
      // group2 cleanup (user membership already cleaned via cleanupTestUser)
      const { supabaseAdmin } = await import("../config/supabaseAdmin");
      await supabaseAdmin.from("groups").delete().eq("id", group2Id);
    });

    test("deve trocar de grupo e ir para /list", async ({ page }) => {
      await AuthScreen.performLogin(page, email, password);
      await AuthScreen.verifyRedirectedToList(page);

      // Go to group page and switch
      await page.goto("/group");
      await GroupScreen.clickUseGroup(page, group2Name);
      await AuthScreen.verifyRedirectedToList(page);
    });
  });

  // --- GRP-05 (P1): Sair do grupo limpa contexto e volta para /group ---
  test.describe("GRP-05: Sair do grupo", () => {
    const email = testEmail("grp05");
    let userId: string;
    let groupId: string;

    test.beforeAll(async () => {
      const ctx = await seedFullContext(email, password, "Grp05 User", testGroupName());
      userId = ctx.userId;
      groupId = ctx.groupId;
    });

    test.afterAll(async () => {
      await cleanupAll(userId, groupId);
    });

    test("deve sair do grupo e voltar para /group", async ({ page }) => {
      await AuthScreen.performLogin(page, email, password);
      await AuthScreen.verifyRedirectedToList(page);

      await page.goto("/group");
      await GroupScreen.clickLeaveGroup(page);

      // Should show "Nenhum grupo ativo" or redirect
      await AuthScreen.verifyRedirectedToGroup(page);
    });
  });

  // --- GRP-06 (P1): Lista "Meus grupos" exibe todos os grupos do usuário ---
  test.describe("GRP-06: Listar meus grupos", () => {
    const email = testEmail("grp06");
    const group1Name = `Lista A ${Date.now()}`;
    const group2Name = `Lista B ${Date.now()}`;
    let userId: string;
    let group1Id: string;
    let group2Id: string;

    test.beforeAll(async () => {
      const ctx = await seedFullContext(email, password, "Grp06 User", group1Name);
      userId = ctx.userId;
      group1Id = ctx.groupId;

      const g2 = await seedGroup(group2Name);
      group2Id = g2.groupId;
      await seedUserInGroup(userId, group2Id);
    });

    test.afterAll(async () => {
      await cleanupAll(userId, group1Id);
      const { supabaseAdmin } = await import("../config/supabaseAdmin");
      await supabaseAdmin.from("groups").delete().eq("id", group2Id);
    });

    test("deve listar ambos os grupos do usuário", async ({ page }) => {
      await AuthScreen.performLogin(page, email, password);
      await page.goto("/group");

      await GroupScreen.verifyGroupInList(page, group1Name);
      await GroupScreen.verifyGroupInList(page, group2Name);
    });
  });

  // --- GRP-07 (P2): Usuário sem grupo é redirecionado para /group ---
  test.describe("GRP-07: Redirect sem grupo", () => {
    const email = testEmail("grp07");
    let userId: string;

    test.beforeAll(async () => {
      const result = await seedTestUser(email, password, "Grp07 User");
      userId = result.userId;
    });

    test.afterAll(async () => {
      await cleanupTestUser(userId);
    });

    test("deve redirecionar para /group quando não tem grupo", async ({ page }) => {
      await AuthScreen.performLogin(page, email, password);
      await AuthScreen.verifyRedirectedToGroup(page);
    });
  });

  // --- GRP-08 (P2): Copiar código de convite ---
  test.describe("GRP-08: Copiar código", () => {
    const email = testEmail("grp08");
    let userId: string;
    let groupId: string;

    test.beforeAll(async () => {
      const ctx = await seedFullContext(email, password, "Grp08 User", testGroupName());
      userId = ctx.userId;
      groupId = ctx.groupId;
    });

    test.afterAll(async () => {
      await cleanupAll(userId, groupId);
    });

    test("deve ter botão de copiar código visível", async ({ page }) => {
      // Grant clipboard permissions for the test
      await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);

      await AuthScreen.performLogin(page, email, password);
      await page.goto("/group");

      // The "Copiar código" button should be visible when group is active
      await GroupScreen.clickCopyInviteCode(page);
      // If no error thrown, the click succeeded
    });
  });
});
