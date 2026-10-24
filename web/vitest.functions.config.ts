import { defineConfig } from "vitest/config";

// Testes puros (compatíveis com Deno) das Edge Functions: npx vitest run --config vitest.functions.config.ts
// Resolve ../supabase/functions/_shared/**/*.test.ts a partir de web/; usa Web Crypto do Node.
export default defineConfig({
  test: {
    environment: "node",
    include: ["../supabase/functions/_shared/**/*.test.ts", "../supabase/functions/_legacy/**/*.test.ts"],
  },
});
