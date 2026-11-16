import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/** Regra do Revela 2.0: valores de cor hex só em tokens.css. Exceções explícitas e justificadas abaixo. */
const SRC = join(__dirname, "..");
const HEX = /#[0-9A-Fa-f]{3,8}\b/;
const ALLOW: Record<string, string> = {
  "styles/tokens.css": "fonte única das cores",
  "app/manifest.ts": "background_color/theme_color do PWA precisam ser literais (espelham --bg)",
  "app/layout.tsx": "themeColor do viewport precisa ser literal (espelha --bg)",
  "components/revela/GoogleButton.tsx": "logotipo do Google: cores de marca de terceiro",
  "features/invitations": "convite A5 e QR são impressos em papel: valores literais exigidos pelo PDF (pdf-lib) e pelo QR",
  "features/photos/film": "kit Filme 35mm do Revela (zip do designer): cor do carimbo de data e LUT embutida, copiados sem alteração",
  "lib/motion": "kit de animações do Revela (zip do designer): cores do confete, copiado sem alteração",
  "styles/revela-motion.css": "kit de animações do Revela (zip do designer): cores do confete e do carimbo, copiado sem alteração",
  "lib/event-theme": "dados legados de paleta por evento (não usados pela UI do Revela)",
  "lib/event-theme.ts": "dados legados de paleta por evento (não usados pela UI do Revela)",
};
function walk(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(css|tsx?)$/.test(f) && !/\.test\.tsx?$/.test(f)) out.push(p);
  }
  return out;
}
describe("no-hex", () => {
  it("nenhum hex fora de tokens.css (exceto allowlist documentada)", () => {
    const bad = walk(SRC)
      .map((p) => relative(SRC, p))
      .filter((rel) => !Object.keys(ALLOW).some((a) => rel === a || rel.startsWith(a + "/")))
      .filter((rel) => HEX.test(readFileSync(join(SRC, rel), "utf8")));
    expect(bad).toEqual([]);
  });
});
