import { defineConfig, devices } from "@playwright/test";

/** Config da AUDITORIA: sem webServer. Suba `npx next start -p <porta>` sobre o build existente e passe AUDIT_BASE_URL. */
export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.AUDIT_BASE_URL,
    ...devices["Desktop Chrome"],
    permissions: ["camera"],
    launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] },
  },
});
