import { defineConfig, devices } from "@playwright/test";

/** Smoke contra um ambiente publicado: E2E_BASE_URL=https://... npx playwright test -c playwright.remote.config.ts */
export default defineConfig({
  testDir: "./e2e",
  testMatch: /remote\.spec\.ts/,
  timeout: 90_000,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL,
    ...devices["Desktop Chrome"],
    permissions: ["camera"],
    launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] },
  },
});
