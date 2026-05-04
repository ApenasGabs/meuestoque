import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { defineConfig, devices } from "@playwright/test";

const __dirname = dirname(fileURLToPath(import.meta.url));

config({
  path: `${__dirname}/.env.local`,
  override: true,
});

const configuredBaseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:5174";
const isRemoteMode = process.env.PLAYWRIGHT_REMOTE_MODE === "1";

/**
 * Playwright configuration for end-to-end testing
 * See https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: !isRemoteMode,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : isRemoteMode ? 1 : undefined,

  reporter: [["html"], ["list"]],

  use: {
    baseURL: configuredBaseURL,
    trace: "on-first-retry",
    screenshot: "on",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: isRemoteMode
    ? undefined
    : {
      command: "npm run dev",
      url: "http://localhost:5174",
      reuseExistingServer: !process.env.CI,
    },
});
