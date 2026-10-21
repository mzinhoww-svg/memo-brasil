import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Testes contra um Supabase real (local por padrão): npm run test:integration (precisa de SUPABASE_URL, chaves no ambiente)
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { environment: "node", include: ["integration/**/*.itest.ts"], testTimeout: 30_000, hookTimeout: 30_000, fileParallelism: false },
});
