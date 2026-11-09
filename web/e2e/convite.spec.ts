import { expect, test, type Page } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { createViaWizard, type RevealOpt } from "./helpers";

// Convite A5 do painel (17k): prévia, PDF real para gráfica (download direto) e impressão só do convite.

const MM = 72 / 25.4;
const mm = (pt: number) => Math.round((pt / MM) * 10) / 10;

async function openStudio(page: Page, title: string, reveal: RevealOpt = "desligada") {
  const { id, code } = await createViaWizard(page, { title, reveal, shots: "10" });
  await page.goto(`/painel/${id}/convite`);
  // a folha vetorial só aparece no papel (print-only): fica no DOM, escondida na tela
  await expect(page.locator(`svg.convite-a5[aria-label*="QR Code para https://newmemocuiaba.vercel.app/e/${code}, código ${code}"]`)).toBeAttached();
  await expect(page.getByText(code, { exact: true })).toBeVisible();
  return { id, code };
}

test("Baixar PDF para gráfica: arquivo A5 com sangria, nome seguro e sem controles", async ({ page }) => {
  await openStudio(page, "Formatura da Júlia & Turma");
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Baixar PDF" }).click()]);
  expect(dl.suggestedFilename()).toBe("convite-formatura-da-julia-e-turma.pdf");
  const bytes = await (await dl.createReadStream()).toArray();
  const doc = await PDFDocument.load(Buffer.concat(bytes));
  expect(doc.getPageCount()).toBe(1);
  const p = doc.getPage(0);
  expect([mm(p.getMediaBox().width), mm(p.getMediaBox().height)]).toEqual([154, 216]);
  const t = p.getTrimBox();
  expect([mm(t.x), mm(t.y), mm(t.width), mm(t.height)]).toEqual([3, 3, 148, 210]);
  // o PDF é desenhado do zero: nenhum texto de botão vai para o arquivo
  const raw = Buffer.concat(bytes).toString("latin1");
  expect(raw).not.toContain("Baixar PDF");
  await expect(page.getByRole("button", { name: "Baixar PDF" })).toBeEnabled();
});

test("Imprimir: só o convite, em uma página A5, sem controles nem cards de mesa", async ({ page }) => {
  await openStudio(page, "Ana & Rui");
  // o botão Imprimir marca o modo e chama window.print(); aqui o diálogo é trocado por um PDF do Chromium com o mesmo CSS de impressão
  await page.evaluate(() => { window.print = () => undefined; });
  await page.getByRole("button", { name: "Imprimir", exact: true }).click();
  expect(await page.evaluate(() => document.body.dataset.imprimir)).toBe("convite");
  await page.emulateMedia({ media: "print" });
  for (const hidden of [page.getByRole("button", { name: "Baixar PDF" }), page.getByRole("heading", { name: "Convite A5" })]) await expect(hidden.first()).toBeHidden();
  await expect(page.locator(".convite-a5")).toBeVisible();
  const pdf = await PDFDocument.load(await page.pdf({ preferCSSPageSize: true, printBackground: true }));
  expect(pdf.getPageCount()).toBe(1);
  const s = pdf.getPage(0).getSize();
  // o Chromium arredonda a página para pixels inteiros (≤ 0,5 mm)
  expect(mm(s.width)).toBeCloseTo(148, 0);
  expect(mm(s.height)).toBeCloseTo(210, 0);
});

test("revelação programada aparece por extenso no fuso do evento", async ({ page }) => {
  await openStudio(page, "Bodas", { date: "2030-11-23", time: "22:00", tz: "America/Cuiaba" });
  await expect(page.locator(".convite-a5")).toContainText("As fotos aparecem para todos no sábado, 23 de novembro, às 22h.");
  await expect(page.locator(".convite-a5")).toContainText("Cada pessoa tem 10 fotos.");
});

test("nome muito longo não vaza da folha", async ({ page }) => {
  await openStudio(page, "Celebração dos cinquenta anos de casamento de Maria Aparecida e José Antônio");
  await page.evaluate(() => { document.body.dataset.imprimir = "convite"; });
  await page.emulateMedia({ media: "print" });
  const box = (await page.locator(".convite-a5").boundingBox())!;
  for (const t of await page.locator(".convite-a5 text").all()) {
    const b = (await t.boundingBox())!;
    expect(b.x).toBeGreaterThanOrEqual(box.x);
    expect(b.x + b.width).toBeLessThanOrEqual(box.x + box.width + 0.5);
  }
});

test("celular 360 px: as duas ações visíveis e sem rolagem lateral", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await openStudio(page, "Festa");
  for (const name of ["Baixar PDF", "Imprimir"]) {
    const b = page.getByRole("button", { name, exact: true });
    await b.scrollIntoViewIfNeeded();
    await expect(b).toBeVisible();
    expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("evidências: prévia, PDF baixado e PDF da impressão (CONVITE_EVIDENCE_DIR)", async ({ page }) => {
  const dir = process.env.CONVITE_EVIDENCE_DIR;
  test.skip(!dir, "defina CONVITE_EVIDENCE_DIR");
  await page.setViewportSize({ width: 1280, height: 1100 });
  await openStudio(page, "Ana & Rui", { date: "2030-11-23", time: "22:00", tz: "America/Cuiaba" });
  await page.screenshot({ path: `${dir}/depois-studio-1280.png`, fullPage: true });
  await page.locator(".a5").screenshot({ path: `${dir}/depois-previa-convite.png`, scale: "device" });
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Baixar PDF" }).click()]);
  await dl.saveAs(`${dir}/${dl.suggestedFilename()}`);
  await page.evaluate(() => { window.print = () => undefined; });
  await page.getByRole("button", { name: "Imprimir", exact: true }).click();
  await page.emulateMedia({ media: "print" });
  await page.pdf({ path: `${dir}/impressao-navegador.pdf`, preferCSSPageSize: true, printBackground: true });
  await page.emulateMedia({ media: "screen" });
  await page.setViewportSize({ width: 360, height: 740 });
  await page.screenshot({ path: `${dir}/depois-studio-360.png`, fullPage: true });
});

test.describe("sem rede para as fontes", () => {
  // o service worker guardaria as fontes; aqui a falha precisa chegar à tela
  test.use({ serviceWorkers: "block" });
  test("mostra o erro e baixar de novo funciona quando a rede volta", async ({ page }) => {
    const { id } = await createViaWizard(page, { title: "Sem fonte", reveal: "desligada" });
    await page.route("**/fonts/pdf/**", (r) => r.abort());
    await page.goto(`/painel/${id}/convite`);
    await expect(page.getByRole("alert").filter({ hasText: "Não conseguimos carregar as fontes do convite." })).toBeVisible();
    await page.unroute("**/fonts/pdf/**");
    const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Baixar PDF" }).click()]);
    expect(dl.suggestedFilename()).toMatch(/^convite-.*\.pdf$/);
  });
});
