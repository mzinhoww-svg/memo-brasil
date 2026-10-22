import path from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { openDemo, setTheme } from "./helpers";

const SHOTS = path.resolve(__dirname, "../../docs/qa/screenshots");
const DS = path.resolve(__dirname, "../../design-system/MemoriesMT-design-system");
const VIEWPORTS = [
  { name: "375", width: 375, height: 812 },
  { name: "390", width: 390, height: 844 },
  { name: "768", width: 768, height: 1024 },
  { name: "1440", width: 1440, height: 900 },
] as const;
const THEMES = ["dia", "noite"] as const;

async function noOverflow(page: Page, label: string) {
  const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  expect(o.sw, `${label}: rolagem horizontal (${o.sw} > ${o.iw})`).toBeLessThanOrEqual(o.iw);
}
async function shot(page: Page, name: string, fullPage = false) {
  await page.evaluate(() => document.fonts.ready);
  if (!process.env.SAVE_SHOTS) return; // evita sujar docs/qa a cada execução: SAVE_SHOTS=1 regrava as capturas
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage, animations: "disabled" });
}

for (const vp of VIEWPORTS) {
  for (const theme of THEMES) {
    test(`telas principais em ${vp.name}px, tema ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await setTheme(page, theme);
      const key = `${vp.name}-${theme}`;

      await page.goto("/");
      await expect(page.getByRole("heading", { name: "Seu evento pelo olhar de cada convidado." })).toBeVisible();
      await noOverflow(page, `home ${key}`);
      await shot(page, `${key}-home`);

      await page.goto("/design");
      await noOverflow(page, `design ${key}`);
      await shot(page, `${key}-design`, true);

      const code = await openDemo(page);
      await noOverflow(page, `agora ${key}`);
      await shot(page, `${key}-agora`);

      await page.goto(`/e/${code}/explorar`);
      await expect(page.getByRole("heading", { name: "Explorar" })).toBeVisible();
      await noOverflow(page, `explorar ${key}`);

      await page.goto(`/e/${code}/voce`);
      await expect(page.getByRole("heading", { name: "Você", exact: true })).toBeVisible();
      await noOverflow(page, `voce ${key}`);

      const painel = await page.evaluate(async () => {
        const db: IDBDatabase = await new Promise((res) => { const r = indexedDB.open("memoriesmt"); r.onsuccess = () => res(r.result); });
        const all: { id: string }[] = await new Promise((res) => { const r = db.transaction("events").objectStore("events").getAll(); r.onsuccess = () => res(r.result); });
        return all[0].id;
      });
      for (const section of ["", "/conteudo", "/convidados", "/momentos", "/qr", "/configuracoes", "/downloads"]) {
        await page.goto(`/painel/${painel}${section}`);
        await expect(page.locator("h1").first()).toBeVisible();
        await noOverflow(page, `painel${section} ${key}`);
        if (section === "" || section === "/conteudo") await shot(page, `${key}-painel${section.replace("/", "-") || "-visao-geral"}`, section !== "");
      }

      if (vp.name === "390") {
        await page.goto(`/e/${code}/voce`);
        await shot(page, `${key}-voce`);
        await page.goto(`/e/${code}/explorar`);
        await shot(page, `${key}-explorar`);
        await page.goto(`/e/${code}/postar`);
        await expect(page.getByRole("heading", { name: "Postar daqui" })).toBeVisible();
        await expect(page.getByRole("button", { name: "Tirar foto" })).toBeVisible({ timeout: 15_000 });
        await shot(page, `${key}-postar`);
        await page.goto("/criar");
        await shot(page, `${key}-criar`);
        await page.goto("/entrar");
        await shot(page, `${key}-entrar`);
        await page.goto(`/e/${code}/qr`).catch(() => undefined);
        await page.goto(`/painel/${painel}/qr`);
        await expect(page.locator(".mm-card-mesa").first()).toBeVisible();
        await shot(page, `${key}-qr`, true);
      }
    });
  }
}

// Paridade com os previews oficiais do kit: mesmas classes, mesmos valores computados.
const PARITY: { dir: string; selector: string }[] = [
  { dir: "Button", selector: ".mm-btn--primario" },
  { dir: "Button", selector: ".mm-btn--cta:not(.mm-btn--cta-xl)" },
  { dir: "Button", selector: ".mm-btn--secundario:not(.mm-btn--pequeno)" },
  { dir: "Button", selector: ".mm-btn--primario.mm-btn--pequeno" },
  { dir: "Button", selector: ".mm-btn--destrutivo.mm-btn--pequeno" },
  { dir: "Button", selector: ".mm-btn--secundario.mm-btn--pequeno" },
  { dir: "Button", selector: ".mm-btn--texto" },
  { dir: "Button", selector: ".mm-btn--cta-xl" },
  { dir: "Chip", selector: ".mm-chip" },
  { dir: "Field", selector: ".mm-field-input" },
  { dir: "OptionGroup", selector: ".mm-opt[aria-pressed=\"false\"]" },
  { dir: "Tabs", selector: ".mm-tab" },
  { dir: "CountBadge", selector: ".mm-count" },
  { dir: "LiveIndicator", selector: ".mm-live-dot" },
  { dir: "Notice", selector: ".mm-notice" },
  { dir: "StatTile", selector: ".mm-stat-num" },
  { dir: "PostCard", selector: ".mm-avatar" },
  { dir: "TabBar", selector: ".mm-tabbar-item" },
  { dir: "TableCard", selector: ".mm-card-mesa" },
];
const PROPS = ["height", "width", "borderRadius", "borderTopWidth", "fontFamily", "fontSize", "fontWeight", "letterSpacing", "textTransform", "color", "backgroundColor", "borderTopColor", "paddingLeft", "paddingTop", "gap"] as const;

async function metrics(page: Page, selector: string) {
  return page.locator(selector).first().evaluate((el, props) => {
    const cs = getComputedStyle(el);
    return Object.fromEntries(props.map((p) => [p, (cs as unknown as Record<string, string>)[p]]));
  }, PROPS as unknown as string[]);
}

for (const theme of THEMES) {
  test(`paridade com os previews do kit, tema ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setTheme(page, theme);
    await page.goto("/design");
    await page.evaluate(() => document.fonts.ready);
    const mismatches: string[] = [];
    for (const { dir, selector } of PARITY) {
      const ours = await metrics(page, selector);
      await page.goto(pathToFileURL(path.join(DS, "componentes", dir, "preview.html")).href + `?tema=${theme}`);
      await page.evaluate(() => document.fonts.ready);
      const ref = await metrics(page, selector);
      for (const p of PROPS) if (ours[p] !== ref[p] && p !== "width") mismatches.push(`${dir} ${selector} ${p}: app=${ours[p]} kit=${ref[p]}`);
      await page.goto("/design");
      await page.evaluate(() => document.fonts.ready);
    }
    expect(mismatches, mismatches.join("\n")).toEqual([]);
  });
}

test("fontes oficiais carregam e tokens batem com tokens.json", async ({ page }) => {
  await page.goto("/design");
  await page.evaluate(() => document.fonts.ready);
  const fonts = await page.evaluate(() => ({ bricolage: document.fonts.check('800 20px "Bricolage Grotesque"'), serif: document.fonts.check('italic 400 20px "Instrument Serif"') }));
  expect(fonts).toEqual({ bricolage: true, serif: true });
  const tokens = JSON.parse(await (await import("node:fs/promises")).readFile(path.join(DS, "tokens/tokens.json"), "utf8"));
  const css = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    return Object.fromEntries(["--tinta", "--rec", "--space-6", "--radius-control", "--size-campo", "--size-cta"].map((k) => [k, cs.getPropertyValue(k).trim()]));
  });
  expect(css["--tinta"].toLowerCase()).toBe("#1c1917");
  expect(css["--rec"].toLowerCase()).toBe("#e1261c");
  expect(css["--space-6"]).toBe("24px");
  expect(css["--radius-control"]).toBe("14px");
  expect(css["--size-campo"]).toBe("56px");
  expect(css["--size-cta"]).toBe("64px");
  expect(JSON.stringify(tokens).toLowerCase()).toContain("#1c1917");
});
