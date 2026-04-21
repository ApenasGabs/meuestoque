#!/usr/bin/env node
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

// Carrega variáveis de ambiente
config({ path: path.join(projectRoot, ".env.local") });
config({ path: path.join(projectRoot, ".env") });

const cdpUrl = process.env.PLAYWRIGHT_CDP_URL || "ws://127.0.0.1:9223";
const appUrl = process.env.PLAYWRIGHT_APP_URL || "http://192.168.31.2:5174";

// Cria diretório de screenshots se não existir
const screenshotsDir = path.join(projectRoot, "e2e", "screenshots");
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

// Gera nome do arquivo com timestamp
const timestamp = new Date().toISOString().replace(/:/g, "-").split(".")[0];
const screenshotPath = path.join(screenshotsDir, `tablet-${timestamp}.png`);

console.log("📸 Capturando screenshot do tablet...");
console.log(`🔌 CDP URL: ${cdpUrl}`);
console.log(`🌐 App URL: ${appUrl}`);

try {
  // Conecta ao CDP do tablet
  const browser = await chromium.connectOverCDP(cdpUrl);
  const context = browser.contexts()[0];
  const page = context.pages()[0] || (await context.newPage());

  // Navega para a app (apenas se a página estiver vazia)
  if (page.url() === "about:blank") {
    console.log("🚀 Navegando para a aplicação...");
    await page.goto(appUrl, { waitUntil: "networkidle" });
  } else {
    console.log(`✅ Página já carregada: ${page.url()}`);
  }

  // Aguarda um pouco para garantir que tudo está renderizado
  await page.waitForLoadState("networkidle");
  await new Promise((r) => setTimeout(r, 300));

  // Captura o screenshot
  console.log("📷 Capturando screenshot...");
  await page.screenshot({ path: screenshotPath, fullPage: false });

  console.log(`\n✨ Screenshot salvo em: ${screenshotPath}`);
  console.log(`\n📱 Dimensões: ${page.viewportSize()?.width}x${page.viewportSize()?.height}`);
  console.log(`📄 URL atual: ${page.url()}`);

  await browser.close();
  process.exit(0);
} catch (error) {
  console.error("\n❌ Erro ao capturar screenshot:", error.message);
  console.error("\n💡 Dicas:");
  console.error("   1. Verifique se o túnel está aberto: npm run e2e:tunnel");
  console.error("   2. Verifique as variáveis de ambiente em .env.local");
  console.error("   3. Verifique se o tablet está acessível");
  process.exit(1);
}
