import {
  chromium,
  expect,
  test as base,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";

interface RemoteFixtures {
  context: BrowserContext;
  page: Page;
}

interface RemoteWorkerFixtures {
  remoteBrowser: Browser;
}

const getRemoteBaseUrl = (): string =>
  process.env.PLAYWRIGHT_BASE_URL || process.env.PLAYWRIGHT_APP_URL || "http://localhost:5173";

export const resolveRemoteUrl = (path: string): string =>
  new URL(path, getRemoteBaseUrl()).toString();

export const test = base.extend<RemoteFixtures, RemoteWorkerFixtures>({
  remoteBrowser: [
    async ({}, use): Promise<void> => {
      const cdpUrl =
        process.env.PLAYWRIGHT_CDP_URL ||
        `http://127.0.0.1:${process.env.LOCAL_TUNNEL_PORT || "9223"}`;
      const browser = await chromium.connectOverCDP(cdpUrl);

      try {
        await use(browser);
      } finally {
        await browser.close();
      }
    },
    { scope: "worker" },
  ],

  context: async ({ remoteBrowser }, use): Promise<void> => {
    const existingContext = remoteBrowser.contexts()[0];
    const context =
      existingContext ?? (await remoteBrowser.newContext({ baseURL: getRemoteBaseUrl() }));
    await use(context);
  },

  page: async ({ context }, use): Promise<void> => {
    const page = context.pages()[0] ?? (await context.newPage());
    await use(page);
  },
});

export { expect };
