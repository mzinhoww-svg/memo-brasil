import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3187);

export default defineConfig({
  testDir: "./e2e",
  testIgnore: /audit-.*\.spec\.ts/, // specs da auditoria rodam só com playwright.audit.config.ts
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    ...devices["Desktop Chrome"],
    permissions: ["camera"],
    launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] },
    serviceWorkers: "allow",
  },
  // Build com relógio de teste ligado (só neste build): permite simular fim e revelação.
  webServer: {
    command: `NEXT_PUBLIC_MM_TEST_CLOCK=1 npm run build && npx next start -p ${PORT}`,
    port: PORT,
    reuseExistingServer: false,
    timeout: 300_000,
  },
});
