import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // Telas portadas da referência: imagens estáticas já em WebP/JPG nos tamanhos do desenho.
  { files: ["src/revela/screens/**"], rules: { "@next/next/no-img-element": "off" } },
]);

export default eslintConfig;
