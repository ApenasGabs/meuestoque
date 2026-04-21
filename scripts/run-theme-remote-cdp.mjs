import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";

const shellEnvKeys = new Set(Object.keys(process.env));
const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "..");

const loadEnvFile = (filePath) => {
  if (!existsSync(filePath)) {
    return;
  }

  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);

  lines.forEach((line) => {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      return;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      return;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^['\"]|['\"]$/g, "");

    if (shellEnvKeys.has(key)) {
      return;
    }

    process.env[key] = value;
  });
};

loadEnvFile(resolve(projectRoot, ".env"));
loadEnvFile(resolve(projectRoot, ".env.local"));

const localTunnelPort = process.env.LOCAL_TUNNEL_PORT || "9223";
const cdpUrl = process.env.PLAYWRIGHT_CDP_URL || `http://127.0.0.1:${localTunnelPort}`;
const appUrl =
  process.env.PLAYWRIGHT_APP_URL || process.env.PLAYWRIGHT_BASE_URL || "http://localhost:5173";

const run = async () => {
  const browser = await chromium.connectOverCDP(cdpUrl);
  const context = browser.contexts()[0] ?? (await browser.newContext());
  const page = context.pages()[0] ?? (await context.newPage());

  const resultsDir = resolve(projectRoot, "test-results", "remote-cdp");
  if (!existsSync(resultsDir)) {
    import("node:fs").then((fs) => fs.mkdirSync(resultsDir, { recursive: true }));
  }

  try {
    await page.goto(appUrl, { waitUntil: "domcontentloaded" });

    // Print 1: Estado Inicial
    await page.screenshot({ path: `${resultsDir}/01-initial-state.png` });

    await page.getByRole("button", { name: "Abrir configurações do app" }).click();
    await page.getByRole("button", { name: "Temas" }).click();
    await page.getByRole("radio", { name: "Dark" }).click();

    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect.poll(async () => page.evaluate(() => localStorage.getItem("theme"))).toBe("dark");

    // Print 2: Após a troca de tema
    await page.screenshot({ path: `${resultsDir}/02-theme-applied.png` });

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    console.log("Theme remote CDP scenario passed.");
  } catch (error) {
    // Print de Erro: Fundamental para debug remoto
    await page.screenshot({ path: `${resultsDir}/ERROR-${Date.now()}.png`, fullPage: true });
    throw error;
  } finally {
    await browser.close();
  }
};
run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
