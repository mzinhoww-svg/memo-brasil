/* Auditoria A2: foco visível por teclado (2px, offset 2px) em rotas representativas. */
import fs from "node:fs";
import path from "node:path";
import { test } from "@playwright/test";
import { createViaWizard, postViaFile, setTheme } from "./helpers";
const OUT = path.resolve(__dirname, "../../docs/audit/evidence/test-results/a2-focus.json");
test("foco por teclado", async ({ browser }) => {
  test.setTimeout(240_000);
  const res: Record<string, unknown> = {};
  for (const theme of ["dia", "noite"] as const) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await setTheme(page, theme);
    const { code, id } = await createViaWizard(page, { title: "Emy e Igor" });
    await postViaFile(page, code);
    for (const u of ["/", "/entrar", "/criar", `/e/${code}/agora`, `/e/${code}/explorar`, `/e/${code}/voce`, `/e/${code}/postar`, `/painel/${id}`, `/painel/${id}/configuracoes`, `/painel/${id}/qr`, "/design"]) {
      await page.goto(u); await page.waitForTimeout(500);
      const seen: unknown[] = [];
      const bad: unknown[] = [];
      for (let i = 0; i < 70; i++) {
        await page.keyboard.press("Tab");
        const info = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null;
          if (!el || el === document.body) return null;
          const s = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          return { el: el.tagName.toLowerCase() + "." + String(el.className).split(" ").slice(0, 2).join("."), label: (el.getAttribute("aria-label") || el.innerText || "").trim().slice(0, 30), ow: s.outlineWidth, os: s.outlineStyle, oo: s.outlineOffset, oc: s.outlineColor, inView: r.bottom > 0 && r.top < innerHeight, bs: s.boxShadow !== "none" };
        });
        if (!info) continue;
        const key = info.el + info.label;
        if (seen.some((x) => (x as { k: string }).k === key)) break;
        seen.push({ k: key });
        if (!(info.os === "solid" && info.ow === "2px" && info.oo === "2px")) bad.push(info);
      }
      res[`${theme} ${u.replace(code, "CODE").replace(id, "ID")}`] = { tabStops: seen.length, notStandard: bad };
    }
    await ctx.close();
  }
  fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
});
