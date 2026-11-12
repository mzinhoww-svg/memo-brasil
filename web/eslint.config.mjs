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
    // Kit de animações do designer: copiado sem alteração, então fica fora do lint.
    "src/lib/motion/revela-motion.ts",
  ]),
  // Telas portadas da referência: imagens estáticas já em WebP/JPG nos tamanhos do desenho.
  // Kit de animações do designer: copiado sem alteração (não se edita o algoritmo nem o estilo do código).
  { files: ["src/lib/motion/revela-motion.ts", "src/features/photos/film/film35*.ts", "src/features/photos/film/film-canvas.ts"], rules: { "prefer-const": "off" } },
  { files: ["src/revela/screens/**"], rules: { "@next/next/no-img-element": "off" } },
  // Kit de movimento do designer, copiado sem alteração: não se reescreve para agradar o lint.
  { files: ["src/lib/motion/revela-motion.ts"], rules: { "prefer-const": "off" } },
]);

export default eslintConfig;
