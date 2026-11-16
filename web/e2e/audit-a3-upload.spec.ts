import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { createViaWizard } from "./helpers";

const FX = process.env.A3_FX ?? "/tmp/a3-fx";
const OUT = path.resolve(__dirname, "../../docs/audit/evidence/test-results");
const results: Record<string, unknown> = {};

async function tryUpload(page: import("@playwright/test").Page, code: string, name: string, mime: string, file: string) {
  await page.goto(`/e/${code}/postar`);
  const t0 = Date.now();
  await page.getByLabel("Escolher foto do aparelho").setInputFiles({ name, mimeType: mime, buffer: fs.readFileSync(path.join(FX, file)) });
  const outcome = await Promise.race([
    page.getByAltText("Prévia da sua foto").waitFor({ timeout: 60_000 }).then(() => "previa-aceita"),
    page.getByText("Essa imagem não abriu").waitFor({ timeout: 60_000 }).then(() => "rejeitada-nao-abriu"),
  ]).catch(() => "timeout-60s");
  return { outcome, ms: Date.now() - t0 };
}

test.describe("A3 uploads", () => {
  test.afterAll(() => fs.writeFileSync(path.join(OUT, "a3-upload-results.json"), JSON.stringify(results, null, 2)));

  test("matriz de arquivos e EXIF", async ({ page }) => {
    test.setTimeout(300_000);
    const { code } = await createViaWizard(page, { title: "Audit A3", capacity: "50" });
    for (const [k, name, mime, file] of [
      ["svg-script", "x.svg", "image/svg+xml", "evil.svg"],
      ["nao-imagem-mime-png", "x.png", "image/png", "notimage.png"],
      ["gps-jpg", "gps.jpg", "image/jpeg", "gps.jpg"],
      ["arquivo-40MB-aleatorio", "big.jpg", "image/jpeg", "big40mb.jpg"],
      ["bomba-png-20000x20000", "bomb.png", "image/png", "bomb20000.png"],
    ] as const) {
      const r = await tryUpload(page, code, name, mime, file);
      results[k] = r;
      if (k === "svg-script") results["svg-xss-flag"] = await page.evaluate(() => (window as unknown as { __svgxss?: number }).__svgxss ?? null);
      if (k === "gps-jpg" && r.outcome === "previa-aceita") {
        await page.getByRole("button", { name: "O sim", exact: true }).click().catch(() => undefined);
        await page.getByRole("button", { name: "Mandar para o laboratório", exact: true }).click();
        await expect(page.getByText("Foi para o laboratório")).toBeVisible();
        results["gps-stored"] = await page.evaluate(
          () => new Promise((res) => {
            const o = indexedDB.open("memoriesmt");
            o.onsuccess = () => {
              const g = o.result.transaction("photoData").objectStore("photoData").getAll();
              g.onsuccess = () => {
                const b = new Uint8Array((g.result[0] as { bytes: ArrayBuffer }).bytes);
                const s = new TextDecoder("latin1").decode(b);
                res({ size: b.length, hasExif: s.includes("Exif"), hasGPS: s.includes("GPS"), hasCamera: s.includes("AuditCam"), first2: [b[0], b[1]] });
              };
            };
          }),
        );
      }
    }
  });
});
