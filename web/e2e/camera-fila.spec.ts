import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { createViaWizard, switchPerson } from "./helpers";

/**
 * Câmera descartável com fila de envio: o obturador libera logo depois de cada disparo, a prévia da última pose aparece
 * no rolo (canto da câmera) e o contador desce na hora; o envio segue em segundo plano. Grava a evidência
 * (390x844) em docs/evidence/perf/camera-disparos.webm + .png.
 */
const OUT = path.resolve(__dirname, "../../docs/evidence/perf");
test.use({ viewport: { width: 390, height: 844 }, video: { mode: "on", size: { width: 390, height: 844 } }, actionTimeout: 15_000 });

let hasFfmpeg = true;
try { execFileSync("which", ["ffmpeg"], { stdio: "ignore" }); } catch { hasFfmpeg = false; }

test.describe("fila de envio da câmera", () => {
  test("3 disparos seguidos: obturador livre, prévia no rolo e contador descendo", async ({ page }) => {
    const { code } = await createViaWizard(page, { title: "Disparos", reveal: "desligada", shots: "5" });
    await switchPerson(page, code, "Ana");
    await page.goto(`/e/${code}/postar`);
    const shutter = page.getByRole("button", { name: "Tirar foto" });
    await expect(shutter).toBeEnabled({ timeout: 15_000 });
    await expect(page.locator(".rv-counter b")).toHaveText("5");
    await page.waitForTimeout(800);
    const startedAt = Date.now();
    for (const left of ["4", "3", "2"]) {
      const t0 = Date.now();
      await shutter.click();
      await expect(page.locator(".rv-counter b")).toHaveText(left);
      await expect(shutter).toBeEnabled();
      expect(Date.now() - t0).toBeLessThan(1500); // antes, só liberava depois do envio inteiro
      await expect(page.getByTestId("ultima-pose")).toBeVisible();
      await page.waitForTimeout(450);
    }
    await expect(page.getByTestId("ultima-pose")).toHaveAttribute("src", /^blob:/);
    // o visor segue aberto e a fila esvazia sozinha; o contador não volta
    await expect(page.getByLabel("Câmera ao vivo")).toBeVisible();
    await expect(page.getByTestId("contador-rolo")).toHaveAttribute("data-fila", "0", { timeout: 20_000 });
    await expect(page.locator(".rv-counter b")).toHaveText("2");
    await page.waitForTimeout(600);
    fs.mkdirSync(OUT, { recursive: true });
    await page.screenshot({ path: path.join(OUT, "camera-disparos.png") });
    const video = page.video();
    const endedAt = Date.now();
    await page.close();
    if (!video) return;
    const raw = path.join(OUT, "_bruto.webm");
    await video.saveAs(raw);
    const dest = path.join(OUT, "camera-disparos.webm");
    if (!hasFfmpeg) { fs.renameSync(raw, dest); return; }
    // recorta só os disparos (o vídeo bruto começa com o assistente de criação)
    const elapsed = (endedAt - startedAt) / 1000 + 2;
    const total = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", raw]).toString().trim()) || elapsed;
    const ss = Math.max(0, total - elapsed);
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", ss.toFixed(2), "-i", raw, "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "36", "-an", dest]);
    fs.rmSync(raw, { force: true });
  });
});

test("rede cai no envio: a câmera continua, avisa a fila e envia sozinha quando volta", async ({ page }) => {
  const { code } = await createViaWizard(page, { title: "Sem sinal", reveal: "desligada", shots: "5" });
  await switchPerson(page, code, "Ana");
  await page.addInitScript(() => { (window as unknown as { __mmFaults: unknown }).__mmFaults = { attach: 1 }; });
  await page.goto(`/e/${code}/postar`);
  const shutter = page.getByRole("button", { name: "Tirar foto" });
  await expect(shutter).toBeEnabled({ timeout: 15_000 });
  await shutter.click();
  await expect(page.getByText(/Sem sinal: 1 foto na fila/)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("sem-sinal")).toHaveCount(0); // sem trocar a câmera pela prévia "Sem sinal"
  await expect(shutter).toBeEnabled();
  await expect(page.locator(".rv-counter b")).toHaveText("4");
  await expect(page.getByTestId("contador-rolo")).toHaveAttribute("data-fila", "0", { timeout: 20_000 });
  await expect(page.locator(".rv-counter b")).toHaveText("4");
  await page.goto(`/e/${code}/voce`);
  await expect(page.getByText("1 de 5", { exact: true })).toBeVisible();
});
