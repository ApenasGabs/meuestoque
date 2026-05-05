import { test, expect } from "@playwright/test";
import { seedFullContext } from "../state/group.state";
import { seedTestUser, cleanupTestUser } from "../state/auth.state";
import { cleanupAll } from "../state/cleanup.state";
import { testEmail, testGroupName } from "../fixtures/testData";
import * as AuthScreen from "../screens/auth.screen";
import * as ProfileScreen from "../screens/profile.screen";

/**
 * AUTH-01..07: Authentication domain E2E tests.
 *
 * Covers login (happy + error), register (happy + validation), and logout.
 * State is injected via Supabase admin API — the UI is only used for validation.
 */
test.describe("Auth - Autenticação", () => {
  const password = "e2e-senha-segura-123";

  // --- AUTH-01 (P0): Login com credenciais válidas redireciona para /list ---
  test.describe("AUTH-01: Login válido", () => {
    const email = testEmail("auth01");
    const groupName = testGroupName();
    let userId: string;
    let groupId: string;

    test.beforeAll(async () => {
      const ctx = await seedFullContext(email, password, "Auth01 User", groupName);
      userId = ctx.userId;
      groupId = ctx.groupId;
    });

    test.afterAll(async () => {
      await cleanupAll(userId, groupId);
    });

    test("deve autenticar e redirecionar para /list", async ({ page }) => {
      await AuthScreen.performLogin(page, email, password);
      await AuthScreen.verifyRedirectedToList(page);
    });
  });

  // --- AUTH-02 (P0): Login com senha errada exibe mensagem de erro ---
  test.describe("AUTH-02: Senha incorreta", () => {
    const email = testEmail("auth02");
    let userId: string;
    let groupId: string;

    test.beforeAll(async () => {
      const ctx = await seedFullContext(email, password, "Auth02 User", testGroupName());
      userId = ctx.userId;
      groupId = ctx.groupId;
    });

    test.afterAll(async () => {
      await cleanupAll(userId, groupId);
    });

    test("deve exibir erro ao usar senha incorreta", async ({ page }) => {
      await AuthScreen.navigateToLogin(page);
      await AuthScreen.fillLoginForm(page, email, "senha-errada-999");
      await AuthScreen.submitLogin(page);
      await AuthScreen.verifyLoginError(page);
    });
  });

  // --- AUTH-03 (P1): Login com email inexistente exibe mensagem de erro ---
  test("AUTH-03: deve exibir erro ao usar email inexistente", async ({ page }) => {
    await AuthScreen.navigateToLogin(page);
    await AuthScreen.fillLoginForm(page, "naoexiste@e2e.test", "qualquer123");
    await AuthScreen.submitLogin(page);
    await AuthScreen.verifyLoginError(page);
  });

  // --- AUTH-04 (P0): Registro completo cria conta e redireciona para /group ---
  test.describe("AUTH-04: Registro válido", () => {
    const email = testEmail("auth04");
    let shouldCleanup = false;

    test.afterAll(async () => {
      // Cleanup: find and delete the created user if registration succeeded
      if (shouldCleanup) {
        try {
          const { supabaseAdmin } = await import("../config/supabaseAdmin");
          const { data } = await supabaseAdmin.auth.admin.listUsers({
            filter: `email.eq.${email}`,
          } as unknown as { page?: number; perPage?: number; filter?: string });
          const createdUser = data?.users?.[0];
          if (createdUser) {
            await cleanupTestUser(createdUser.id);
          }
        } catch {
          // Best-effort cleanup
        }
      }
    });

    test("deve registrar e redirecionar para /group", async ({ page }) => {
      await AuthScreen.navigateToRegister(page);
      await AuthScreen.fillRegisterForm(page, "E2E User Auth04", email, password, password);
      await AuthScreen.submitRegister(page);
      shouldCleanup = true;

      // After registration, user should go to /group (no group yet)
      await AuthScreen.verifyRedirectedToGroup(page);
    });
  });

  // --- AUTH-05 (P1): Registro com senhas divergentes exibe erro ---
  test("AUTH-05: deve exibir erro quando senhas divergem", async ({ page }) => {
    await AuthScreen.navigateToRegister(page);
    await AuthScreen.fillRegisterForm(
      page,
      "E2E User Auth05",
      testEmail("auth05"),
      "senha-a-123",
      "senha-b-456"
    );
    await AuthScreen.submitRegister(page);

    // Client-side validation: "As senhas não conferem."
    const alert = page.locator('[role="alert"]');
    await expect(alert).toBeVisible({ timeout: 5000 });
    await expect(alert).toContainText("senhas");
  });

  // --- AUTH-06 (P1): Registro com email já existente exibe erro ---
  test.describe("AUTH-06: Email duplicado no registro", () => {
    const email = testEmail("auth06");
    let userId: string;

    test.beforeAll(async () => {
      const result = await seedTestUser(email, password, "Auth06 Existing");
      userId = result.userId;
    });

    test.afterAll(async () => {
      await cleanupTestUser(userId);
    });

    test("deve exibir erro ao registrar com email existente", async ({ page }) => {
      await AuthScreen.navigateToRegister(page);
      await AuthScreen.fillRegisterForm(page, "Auth06 Duplicate", email, password, password);
      await AuthScreen.submitRegister(page);

      // Supabase returns an error for duplicate email
      await AuthScreen.verifyLoginError(page);
    });
  });

  // --- AUTH-07 (P0): Logout limpa sessão e redireciona para /login ---
  test.describe("AUTH-07: Logout", () => {
    const email = testEmail("auth07");
    const groupName = testGroupName();
    let userId: string;
    let groupId: string;

    test.beforeAll(async () => {
      const ctx = await seedFullContext(email, password, "Auth07 User", groupName);
      userId = ctx.userId;
      groupId = ctx.groupId;
    });

    test.afterAll(async () => {
      await cleanupAll(userId, groupId);
    });

    test("deve sair da conta e redirecionar para /login", async ({ page }) => {
      // Login first
      await AuthScreen.performLogin(page, email, password);
      await AuthScreen.verifyRedirectedToList(page);

      // Navigate to profile and logout
      await page.goto("/profile");
      await ProfileScreen.clickLogout(page);
      await ProfileScreen.verifyRedirectedToLogin(page);

      // Verify that navigating to a protected page redirects back to login
      await page.goto("/list");
      await AuthScreen.verifyOnLoginPage(page);
    });
  });
});
