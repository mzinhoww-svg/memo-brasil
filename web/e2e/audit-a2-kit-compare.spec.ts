/* Auditoria A2: compara estilos computados das classes mm-* das prévias do kit com os mesmos elementos no app. */
import fs from "node:fs";
import path from "node:path";
import { test } from "@playwright/test";
import { createViaWizard, setTheme, postViaFile } from "./helpers";

const KIT = path.resolve(__dirname, "../../design-system/MemoriesMT-design-system/componentes");
const OUT = path.resolve(__dirname, "../../docs/audit/evidence/test-results/a2-kit-compare.json");
const PROPS = ["height", "minHeight", "borderTopLeftRadius", "borderTopWidth", "borderTopColor", "fontSize", "fontWeight", "fontFamily", "letterSpacing", "color", "backgroundColor", "boxShadow", "paddingTop", "paddingLeft", "gap"] as const;

const COLLECT = (props: readonly string[]) => {
  const m: Record<string, Record<string, string>> = {};
  document.querySelectorAll("[class]").forEach((el) => {
    const cls = typeof (el as HTMLElement).className === "string" ? (el as HTMLElement).className.trim() : "";
    if (!/\bmm-|\b(eyebrow|corpo|titulo|display|emocao|nome|meta|rotulo|nav|cta|botao)/.test(cls)) return;
    const key = cls.split(/\s+/).filter((c) => /^(mm-|eyebrow|corpo|titulo|display|emocao|nome|meta|rotulo|nav$|cta|botao|numero)/.test(c)).sort().join(".");
    if (!key || m[key]) return;
    const r = el.getBoundingClientRect();
    if (r.width < 1) return;
    const s = getComputedStyle(el);
    const o: Record<string, string> = { w: String(Math.round(r.width)), h: String(Math.round(r.height * 10) / 10) };
    for (const p of props) o[p] = (s as unknown as Record<string, string>)[p];
    m[key] = o;
  });
  return m;
};

test("kit vs app", async ({ browser }) => {
  test.setTimeout(300_000);
  const result: Record<string, unknown> = {};
  for (const theme of ["dia", "noite"] as const) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    const kit: Record<string, Record<string, string>> = {};
    const dirs = fs.readdirSync(KIT).filter((d) => fs.existsSync(path.join(KIT, d, "preview.html")));
    for (const d of dirs) {
      await page.goto(`file://${path.join(KIT, d, "preview.html")}?tema=${theme}`);
      await page.waitForTimeout(150);
      await page.evaluate(() => document.fonts.ready);
      const c = await page.evaluate(COLLECT, PROPS as unknown as string[]);
      for (const [k, v] of Object.entries(c)) if (!kit[k]) kit[k] = { ...v, _src: d };
    }
    await setTheme(page, theme);
    const app: Record<string, Record<string, string>> = {};
    const merge = async () => { const c = await page.evaluate(COLLECT, PROPS as unknown as string[]); for (const [k, v] of Object.entries(c)) if (!app[k]) app[k] = { ...v, _page: page.url().replace(/^https?:\/\/[^/]+/, "").slice(0, 30) }; };
    const { code, id } = await createViaWizard(page, { title: "Emy e Igor" });
    await merge();
    await postViaFile(page, code);
    for (const u of ["/", "/entrar", "/criar", `/e/${code}/agora`, `/e/${code}/explorar`, `/e/${code}/voce`, `/e/${code}/postar`, `/painel/${id}`, `/painel/${id}/configuracoes`, `/painel/${id}/qr`, `/painel/${id}/conteudo`, `/painel/${id}/momentos`, "/design", "/offline"]) { await page.goto(u); await page.waitForTimeout(500); await merge(); }
    const diffs: unknown[] = []; const same: string[] = []; const onlyKit: string[] = []; const onlyApp: string[] = [];
    for (const k of Object.keys(kit)) {
      if (!app[k]) { onlyKit.push(k); continue; }
      const d: Record<string, string[]> = {};
      for (const p of PROPS) if (kit[k][p] !== app[k][p]) d[p] = [kit[k][p], app[k][p]];
      if (Object.keys(d).length) diffs.push({ cls: k, kit: kit[k]._src, app: app[k]._page, d }); else same.push(k);
    }
    for (const k of Object.keys(app)) if (!kit[k]) onlyApp.push(k);
    result[theme] = { kitClasses: Object.keys(kit).length, appClasses: Object.keys(app).length, identical: same.length, diffs, onlyKit, onlyApp };
    await ctx.close();
  }
  fs.writeFileSync(OUT, JSON.stringify(result, null, 1));
});
