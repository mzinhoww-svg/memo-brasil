import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PUBLIC_PORT ?? 3194);

/** Superfície PÚBLICA: build sem NEXT_PUBLIC_MM_DEV_TOOLS nem relógio de teste, como o cliente recebe. Só a spec public-surface. */
export default defineConfig({
  testDir: "./e2e",
  testMatch: /(public-surface|capture-screens)\.spec\.ts/,
  timeout: 60_000,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, ...devices["Desktop Chrome"], permissions: ["camera"], launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] } },
  webServer: { command: `npm run build && npx next start -p ${PORT}`, port: PORT, reuseExistingServer: false, timeout: 300_000 },
});
