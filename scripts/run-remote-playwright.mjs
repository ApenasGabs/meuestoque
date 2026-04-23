import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const shellEnvKeys = new Set(Object.keys(process.env));
const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "..");
const suitesPath = resolve(scriptDir, "remote-suites.json");

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

const loadSuites = () => {
  if (!existsSync(suitesPath)) {
    return {};
  }

  const raw = readFileSync(suitesPath, "utf8");
  const parsed = JSON.parse(raw);

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(
      "Arquivo remote-suites.json invalido: esperado objeto chave -> lista de caminhos.",
    );
  }

  return parsed;
};

const parseArgs = (argv, suites) => {
  const args = [...argv];
  const options = {
    listSuites: false,
    passthrough: [],
    suiteName: undefined,
    mode: "test",
  };

  if (args[0] && ["test", "ui", "debug", "report"].includes(args[0])) {
    options.mode = args.shift();
  }

  const rawArgs = [];

  args.forEach((arg) => {
    if (arg === "--list-suites") {
      options.listSuites = true;
      return;
    }

    rawArgs.push(arg);
  });

  if (rawArgs[0] && !rawArgs[0].startsWith("-") && suites[rawArgs[0]]) {
    options.suiteName = rawArgs.shift();
  }

  if (!options.suiteName && rawArgs.length === 0 && suites.tablet) {
    options.suiteName = "tablet";
  }

  options.passthrough = rawArgs;
  return options;
};

const getPlaywrightCommandForMode = (mode) => {
  switch (mode) {
    case "test":
      return ["playwright", "test"];
    case "ui":
    case "debug":
    case "report":
      throw new Error(
        "Modo remoto suporta apenas 'test'. Rode sem -remote para usar ui/debug/report localmente.",
      );
    default:
      throw new Error(`Modo invalido: ${mode}. Use: test | ui | debug | report`);
  }
};

const ensureCdpAndAppReachable = async (localTunnelPort, appUrl) => {
  const cdpMetaUrl = `http://127.0.0.1:${localTunnelPort}/json/version`;

  const cdpResponse = await fetch(cdpMetaUrl);
  if (!cdpResponse.ok) {
    throw new Error(
      `Tunel remoto indisponivel em 127.0.0.1:${localTunnelPort}. Execute primeiro: bash scripts/open-e2e-remote-tunnel.sh`,
    );
  }

  const cdpMeta = await cdpResponse.json();
  const wsEndpoint = cdpMeta?.webSocketDebuggerUrl;

  if (!wsEndpoint || typeof wsEndpoint !== "string") {
    throw new Error(`Resposta de ${cdpMetaUrl} nao contem webSocketDebuggerUrl valido.`);
  }

  const appResponse = await fetch(appUrl);
  if (!appResponse.ok) {
    throw new Error(`Endpoint da aplicacao indisponivel: ${appUrl}`);
  }

  return wsEndpoint;
};

const runPlaywright = (args) =>
  new Promise((resolvePromise, rejectPromise) => {
    const child = spawn("npx", args, {
      stdio: "inherit",
      cwd: projectRoot,
      shell: process.platform === "win32",
      env: process.env,
    });

    child.on("error", (error) => {
      rejectPromise(error);
    });

    child.on("exit", (code) => {
      resolvePromise(code ?? 1);
    });
  });

const main = async () => {
  loadEnvFile(resolve(projectRoot, ".env"));
  loadEnvFile(resolve(projectRoot, ".env.local"));

  const localTunnelPort = process.env.LOCAL_TUNNEL_PORT || "9223";
  const appUrl =
    process.env.PLAYWRIGHT_APP_URL || process.env.PLAYWRIGHT_BASE_URL || "http://localhost:5173";

  const suites = loadSuites();
  const { listSuites, mode, suiteName, passthrough } = parseArgs(process.argv.slice(2), suites);

  if (listSuites) {
    const suiteNames = Object.keys(suites);
    if (suiteNames.length === 0) {
      console.log("Nenhuma suite definida em scripts/remote-suites.json.");
      return;
    }

    console.log("Suites remotas disponiveis:");
    suiteNames.forEach((name) => {
      console.log(`- ${name}: ${suites[name].join(", ")}`);
    });
    return;
  }

  console.log("Modo remoto ativo: validando tunel e endpoint remoto...");
  const wsEndpoint = await ensureCdpAndAppReachable(localTunnelPort, appUrl);

  process.env.PLAYWRIGHT_BASE_URL = appUrl;
  process.env.PLAYWRIGHT_REMOTE_MODE = "1";
  process.env.PLAYWRIGHT_CDP_URL = `http://127.0.0.1:${localTunnelPort}`;

  const commandArgs = getPlaywrightCommandForMode(mode);
  const suiteArgs = suiteName ? suites[suiteName] : [];
  const finalArgs = [...commandArgs, ...suiteArgs, ...passthrough];

  console.log("Executando Playwright remoto via CDP no tablet...");
  console.log(`CDP WebSocket detectado: ${wsEndpoint}`);
  console.log(`Comando: npx ${finalArgs.join(" ")}`);

  const exitCode = await runPlaywright(finalArgs);
  process.exitCode = exitCode;
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
