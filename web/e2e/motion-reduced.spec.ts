import { expect, test, type Page } from "@playwright/test";
import { wizardToSummary } from "./helpers";

/* Com "reduzir movimento" ligado nada desliza, pisca ou gira: nos elementos do kit de animações (revela-motion.css)
   não pode haver animação que mexa em transform/filter nem transição de transform com duração real. Só "aparecer" (rv-fade). */
test.use({ reducedMotion: "reduce" });

const KIT = [
  ".rv-press", ".rv-rise", ".rv-fade", ".rv-pop", ".rv-step", ".rv-seg", ".rv-sheet-motion", ".rv-backdrop", ".rv-cam-in", ".rv-float", ".rv-tilt",
  ".rv-live-dot", ".rv-dots > i", ".rv-skeleton", ".rv-spin", ".rv-toast-in", ".rv-toast-out", ".rv-blurred", ".rv-lock-nudge", ".rv-develop",
  ".rv-btn", ".rv-icon-btn", ".rv-tab", ".rv-chip",
].join(", ");
const ALLOWED_ANIMATIONS = new Set(["none", "rv-fade"]);

type Report = { kit: number; violations: string[] };

/** Conta os elementos do kit na tela e lista os que ainda têm animação de movimento ou transição de transform. */
async function audit(page: Page): Promise<Report> {
  return page.evaluate(({ kit, allowed }) => {
    const violations: string[] = [];
    const ms = (v: string) => (v.trim().endsWith("ms") ? parseFloat(v) : parseFloat(v) * 1000);
    const els = Array.from(document.querySelectorAll<HTMLElement>(kit));
    for (const el of els) {
      for (const pseudo of [null, "::before", "::after"] as const) {
        const cs = getComputedStyle(el, pseudo);
        const names = cs.animationName.split(",").map((s) => s.trim());
        const durs = cs.animationDuration.split(",");
        names.forEach((n, i) => {
          const d = ms(durs[i % durs.length]);
          if (!allowed.includes(n) && d > 1) violations.push(`${el.className} ${pseudo ?? ""} animation-name=${n} (${d}ms)`);
        });
        const props = cs.transitionProperty.split(",").map((s) => s.trim());
        const tdurs = cs.transitionDuration.split(",");
        props.forEach((p, i) => {
          const d = ms(tdurs[i % tdurs.length]);
          if ((p === "transform" || p === "all") && d > 1) violations.push(`${el.className} ${pseudo ?? ""} transition ${p} ${d}ms`);
        });
      }
    }
    return { kit: els.length, violations };
  }, { kit: KIT, allowed: [...ALLOWED_ANIMATIONS] });
}

async function expectCalm(page: Page, label: string, min = 1) {
  expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
  // deixa as entradas (rv-fade de 160 ms) terminarem antes de medir
  await page.waitForTimeout(200);
  const r = await audit(page);
  expect(r.kit, `${label}: elementos do kit na tela`).toBeGreaterThanOrEqual(min);
  expect(r.violations, label).toEqual([]);
}

test("home: botões e entradas sem movimento", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Montar câmera" })).toBeVisible();
  await expectCalm(page, "home");
});

test("assistente: passos, traços, câmera 3D e folha 'Antes de criar' sem movimento", async ({ page }) => {
  await page.goto("/criar");
  await page.getByRole("heading", { level: 1, name: "Escolha a embalagem" }).waitFor();
  await expectCalm(page, "passo 1 (câmera 3D, rv-cam-in, rv-float)", 3);
  expect(await page.locator(".rv-cam-in").count()).toBeGreaterThan(0);
  expect(await page.locator(".rv-float").count()).toBeGreaterThan(0);

  await wizardToSummary(page);
  await expectCalm(page, "passo 8 (rv-step, rv-seg)", 3);
  expect(await page.locator(".rv-step, .rv-rise").count()).toBeGreaterThan(0);
  expect(await page.locator(".rv-steps .rv-seg").count()).toBe(8);

  await page.getByRole("button", { name: /Criar câmera|Continuar ·/ }).click();
  const dialog = page.getByRole("dialog", { name: "Antes de criar" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".rv-sheet-motion")).toHaveAttribute("data-open", "true");
  await expectCalm(page, "folha (rv-sheet-motion, rv-backdrop)", 2);
  // a folha aberta fica no lugar, sem deslocamento
  expect(await dialog.locator(".rv-sheet-motion").evaluate((el) => getComputedStyle(el).transform)).toBe("none");
});

test("feed e Minhas: listas sem movimento", async ({ page }) => {
  await page.goto("/");
  await page.goto("/dev/seed");
  await page.waitForURL(/\/e\/[A-Z0-9]{8}\/agora/);
  const code = page.url().match(/\/e\/([A-Z0-9]{8})\//)![1];
  await expect(page.getByRole("link", { name: "Notificações" })).toBeVisible();
  await expectCalm(page, "feed");
  await page.goto(`/e/${code}/minhas`);
  await expect(page).toHaveURL(/\/minhas/);
  await expectCalm(page, "minhas");
});
