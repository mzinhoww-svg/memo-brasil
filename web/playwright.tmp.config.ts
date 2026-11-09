import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  testIgnore: [/audit-.*\.spec\.ts/, /public-surface\.spec\.ts/, /remote.*\.spec\.ts/, /supabase\.spec\.ts/, /prod-smoke/, /validapay-local/],
  timeout: 60_000, fullyParallel: false, workers: 1, reporter: [["line"]],
  use: { baseURL: "http://localhost:3187", ...devices["Desktop Chrome"], permissions: ["camera"], serviceWorkers: "block",
    launchOptions: { executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox", "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] } },
});
