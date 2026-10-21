import { defineConfig, devices } from "@playwright/test";

/** Homologação no preview remoto: REMOTE_URL, REMOTE_SHARE, SUPABASE_*, ALLOW_REMOTE_TEST=1 (ver e2e/remote-flow.spec.ts). */
export default defineConfig({
  testDir: "./e2e",
  testMatch: /remote-flow\.spec\.ts/,
  timeout: 240_000,
  workers: 1,
  reporter: [["list"]],
  projects: [
    { name: "desktop-chrome", use: { ...devices["Desktop Chrome"], permissions: ["camera"] } },
    { name: "android-chrome-emulado", use: { ...devices["Pixel 7"], permissions: ["camera"] } },
    ...(process.env.WITH_WEBKIT === "1" ? [{ name: "ios-safari-emulado", use: { ...devices["iPhone 14"] } }] : []),
  ],
});
