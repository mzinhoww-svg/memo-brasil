import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 3197);
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${port}`;
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(baseURL).hostname)) {
  throw new Error("UX regressions only run against a local app.");
}

// Build first with these same NEXT_PUBLIC_* values. E2E_BASE_URL uses an
// already-running local production build; otherwise this config only starts it.
export default defineConfig({
  testDir: "./e2e",
  testMatch: "ux-flow-hardening.spec.ts",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  outputDir: "test-results/ux-flow-hardening",
  use: {
    baseURL,
    permissions: ["camera"],
    serviceWorkers: "block",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
      args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
    },
  },
  projects: [
    { name: "ux-desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "ux-mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: process.env.E2E_BASE_URL ? undefined : {
    command: `npx next start -H 127.0.0.1 -p ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 30_000,
    env: {
      NEXT_PUBLIC_MM_BACKEND: "local",
      NEXT_PUBLIC_MM_DEV_TOOLS: "1",
      NEXT_PUBLIC_MM_TEST_CLOCK: "1",
      NEXT_PUBLIC_VALIDAPAY_CHECKOUT: "1",
    },
  },
});
