import { defineConfig, devices } from "@playwright/test";

/** E2E em modo Supabase: app em NEXT_PUBLIC_MM_BACKEND=supabase apontando para o Supabase LOCAL. E2E_BASE_URL=http://127.0.0.1:3187 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: /(supabase|master-studio)\.spec\.ts/,
  timeout: 90_000,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: process.env.E2E_BASE_URL, ...devices["Desktop Chrome"], permissions: ["camera"] },
});
