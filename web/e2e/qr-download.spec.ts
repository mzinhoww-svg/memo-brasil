import fs from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import jsQR from "jsqr";
import { PNG } from "pngjs";
import { createViaWizard } from "./helpers";

// Baixar QR code (17k, 25 e 26): SVG, PNG 2048 px fundo branco e PNG fundo transparente; o QR baixado é decodificado de volta.

async function open(page: Page, route: string, title = "Ana & Rui") {
  const { id, code } = await createViaWizard(page, { title, reveal: "desligada" });
  await page.goto(`/painel/${id}/${route}`);
  return { id, code, url: `https://fotosdocasamento.online/e/${code}` };
}

async function download(page: Page, option: string) {
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("dialog").getByRole("button", { name: option }).click()]);
  const file = (await dl.path())!;
  return { name: dl.suggestedFilename(), bytes: fs.readFileSync(file) };
}

function decodePng(bytes: Buffer, onWhite = false) {
  const png = PNG.sync.read(bytes);
  const px = new Uint8ClampedArray(png.data);
  if (onWhite) for (let i = 0; i < px.length; i += 4) { const a = px[i + 3] / 255; px[i] = px[i + 1] = px[i + 2] = px[i] * a + 255 * (1 - a); px[i + 3] = 255; }
  return { png, text: jsQR(px, png.width, png.height)?.data };
}

const SCREENS: [string, string, string][] = [
  ["convite", "Baixar QR code", "17k"],
  ["qr", "Baixar QR code", "25"],
  ["compartilhar", "Baixar QR code", "26"],
];

for (const [route, button, tela] of SCREENS) {
  test(`tela ${tela} (/${route}): baixa SVG, PNG branco e PNG transparente que leem a URL do evento`, async ({ page }) => {
    const { url } = await open(page, route);
    await expect(page.getByRole("button", { name: /^Imprimir|Baixar PDF|Salvar PDF/ })).toHaveCount(0);
    await page.getByRole("button", { name: button, exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Baixar QR code" })).toBeVisible();

    const svg = await download(page, "SVG (vetorial)");
    expect(svg.name).toBe("qr-ana-e-rui.svg");
    const text = svg.bytes.toString("utf8");
    expect(text).toContain("<svg");
    expect(text).not.toMatch(/<(text|image)/);

    const white = await download(page, "PNG 2048 px, fundo branco");
    expect(white.name).toBe("qr-ana-e-rui.png");
    const w = decodePng(white.bytes);
    expect([w.png.width, w.png.height]).toEqual([2048, 2048]);
    expect(w.png.data[3]).toBe(255);
    expect(w.text).toBe(url);

    const clear = await download(page, "PNG 2048 px, fundo transparente");
    expect(clear.name).toBe("qr-ana-e-rui-transparente.png");
    const t = decodePng(clear.bytes, true);
    expect([t.png.width, t.png.height]).toEqual([2048, 2048]);
    expect(t.png.data[3]).toBe(0);
    expect(t.text).toBe(url);

    // o SVG, rasterizado pelo navegador, também lê a mesma URL
    const dataUrl = await page.evaluate(async (svgText) => {
      const img = new Image();
      img.src = `data:image/svg+xml;utf8,${encodeURIComponent(svgText)}`;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = c.height = 800;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, 800, 800);
      ctx.drawImage(img, 0, 0, 800, 800);
      return Array.from(ctx.getImageData(0, 0, 800, 800).data);
    }, text);
    expect(jsQR(new Uint8ClampedArray(dataUrl), 800, 800)?.data).toBe(url);
  });
}

test("iOS: usa o Web Share de arquivo (Salvar em Arquivos) em vez do link de download", async ({ browser }) => {
  const ctx = await browser.newContext({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1", viewport: { width: 390, height: 800 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    const w = window as unknown as { __shared: { name: string; type: string; size: number }[] };
    w.__shared = [];
    Object.defineProperty(navigator, "canShare", { value: () => true, configurable: true });
    Object.defineProperty(navigator, "share", { value: async (d: { files: File[] }) => { w.__shared.push(...d.files.map((f) => ({ name: f.name, type: f.type, size: f.size }))); }, configurable: true });
  });
  await open(page, "convite", "Festa da Júlia");
  await page.getByRole("button", { name: "Baixar QR code", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "SVG (vetorial)" }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __shared: unknown[] }).__shared.length)).toBe(1);
  const shared = await page.evaluate(() => (window as unknown as { __shared: { name: string; type: string }[] }).__shared[0]);
  expect(shared).toMatchObject({ name: "qr-festa-da-julia.svg", type: "image/svg+xml" });
  await ctx.close();
});
