import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { PNG } from "pngjs";
import { createViaWizard, postViaFile, switchPerson } from "./helpers";

/**
 * Revela Smart Album · Minhas Fotos em modo local (sem servidor). As chaves ligam pelo localStorage, que só vale em build de
 * homologação (NEXT_PUBLIC_MM_DEV_TOOLS=1, como este config). A busca facial aqui é SIMULADA: não há motor; os "resultados" vêm da
 * chave de teste `mm-smart-album-fake-matches` e ainda passam pelo filtro de visibilidade da galeria.
 */
const EVID = path.resolve(__dirname, "../../docs/smart-album/evidence");
fs.mkdirSync(EVID, { recursive: true });

/** Referência sintética 480×480 (cor lisa: o Chromium de teste não tem FaceDetector, então a contagem de rostos fica "não verificada"). */
function referencePng(): Buffer {
  const png = new PNG({ width: 480, height: 480 });
  for (let i = 0; i < png.data.length; i += 4) { png.data[i] = 200; png.data[i + 1] = 160; png.data[i + 2] = 140; png.data[i + 3] = 255; }
  return PNG.sync.write(png);
}
const TINY = (() => { const p = new PNG({ width: 64, height: 64 }); p.data.fill(255); return PNG.sync.write(p); })();

async function setFlag(page: Page, v: "ui" | "face" | null, fake?: Record<string, string[]>) {
  await page.evaluate(([flag, matches]) => {
    if (flag) localStorage.setItem("mm-smart-album", flag as string); else localStorage.removeItem("mm-smart-album");
    if (matches) localStorage.setItem("mm-smart-album-fake-matches", matches as string);
  }, [v, fake ? JSON.stringify(fake) : null] as const);
}
/** A folha (Sheet) guarda uma entrada de histórico e devolve com history.back() 60 ms depois de fechar: espera antes de navegar. */
const settled = (page: Page) => page.waitForFunction(() => !(window.history.state as { mmSheet?: boolean } | null)?.mmSheet).then(() => page.waitForTimeout(150));
const refInput = (page: Page) => page.locator('input[type="file"][accept*="heic"]');

test("chave desligada: sem aba Minhas Fotos e a rota direta só informa que não está disponível", async ({ page }) => {
  const { code } = await createViaWizard(page, { title: "SA desligado", reveal: "desligada" });
  await switchPerson(page, code, "Ana");
  await setFlag(page, null);
  await page.goto(`/e/${code}/minhas`);
  await expect(page.getByRole("link", { name: "Fotos", exact: true })).toBeVisible();
  await expect(page.locator('[data-tab="fotos"]')).toHaveCount(0);
  await page.goto(`/e/${code}/minhas-fotos`);
  await expect(page.getByText("Minhas Fotos ainda não está disponível neste evento.")).toBeVisible();
  await expect(page.locator(".sa-tile")).toHaveCount(0);
});

test("álbum manual: onboarding com galeria, busca indisponível não envia nada, fotos que tirei e favoritas", async ({ page }) => {
  const { code } = await createViaWizard(page, { title: "SA manual", reveal: "desligada" });
  await switchPerson(page, code, "Ana");
  await postViaFile(page, code);
  await setFlag(page, "ui");
  await page.goto(`/e/${code}/agora`);
  const tab = page.locator('[data-tab="fotos"]');
  await expect(tab).toHaveText("Minhas Fotos");
  await tab.click();
  await page.waitForURL(/minhas-fotos$/);

  // primeiro acesso: mini onboarding (passo 1 → 2)
  const sheet = page.getByRole("dialog", { name: "Encontre seus momentos." });
  await expect(sheet.getByText("Passo 1 de 3")).toBeVisible();
  await sheet.getByRole("button", { name: "Continuar", exact: true }).click();
  const pick = page.getByRole("dialog", { name: "Escolha uma foto sua" });
  await expect(pick.getByRole("button", { name: "Foto do Google" })).toBeDisabled(); // modo local: sem conta Google
  await expect(pick.getByText("Sua conta não tem foto do Google disponível")).toBeVisible();

  // arquivo pequeno demais é recusado com mensagem clara
  await refInput(page).setInputFiles({ name: "mini.png", mimeType: "image/png", buffer: TINY });
  await expect(pick.getByRole("alert")).toContainText("Foto pequena demais");
  // arquivo que não é imagem (nome mente)
  await refInput(page).setInputFiles({ name: "foto.jpg", mimeType: "image/jpeg", buffer: Buffer.from("<svg onload=alert(1)>") });
  await expect(pick.getByRole("alert")).toContainText("Formato não aceito");

  await refInput(page).setInputFiles({ name: "eu.png", mimeType: "image/png", buffer: referencePng() });
  const review = page.getByRole("dialog", { name: "Confira a foto" });
  await expect(review.getByRole("img", { name: "Prévia da sua foto de referência" })).toBeVisible();
  const cont = review.getByRole("button", { name: "Continuar", exact: true });
  await expect(cont).toBeDisabled();
  await review.getByRole("checkbox", { name: "Esta foto é minha e mostra o meu rosto." }).check();
  await cont.click();

  // passo 3 sem liberação: nada é enviado, oferece o álbum manual
  const consent = page.getByRole("dialog", { name: "Autorização" });
  await expect(consent.getByText("A busca por reconhecimento ainda não está liberada.")).toBeVisible();
  await expect(consent.getByText("Nada da sua foto foi enviado.", { exact: false })).toBeVisible();
  await expect(consent.getByRole("button", { name: "Ativar Minhas Fotos" })).toHaveCount(0);
  await consent.getByRole("button", { name: "Usar o álbum manual" }).click();

  // hub: sem segmento "Encontradas"; "Que tirei" com a foto
  await expect(page.getByRole("tab", { name: /Encontradas/ })).toHaveCount(0);
  await expect(page.getByRole("tab", { name: /Que tirei · 1/ })).toHaveAttribute("aria-selected", "true");
  await page.locator(".sa-tile").first().click();
  const viewer = page.getByRole("dialog", { name: "Foto" });
  await viewer.getByRole("button", { name: "Favoritar" }).click();
  await expect(viewer.getByRole("button", { name: "Tirar das favoritas" })).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await page.getByRole("tab", { name: /Favoritas/ }).click();
  await expect(page.getByRole("tab", { name: /Favoritas · 1/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".sa-tile")).toHaveCount(1);
  // nenhum dado do fluxo guarda a imagem no aparelho
  const stored = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("mm-sa") || k.startsWith("mm-smart")).map((k) => localStorage.getItem(k) ?? "").join(""));
  expect(stored).not.toMatch(/data:image|base64/);

  // reabrir não repete o convite
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await settled(page);
  await page.goto(`/e/${code}/minhas-fotos`);
  await expect(page.getByRole("tab", { name: /Que tirei/ })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("busca simulada: consentimento explícito, resultados só visíveis, ocultar falso positivo e revogar", async ({ page }) => {
  const { code } = await createViaWizard(page, { title: "SA face", reveal: "desligada" });
  await switchPerson(page, code, "Ana");
  await postViaFile(page, code);
  await page.goto(`/e/${code}/agora`);
  const photoId = await page.locator("article.post").first().getAttribute("data-post-id");
  expect(photoId).toBeTruthy();
  await setFlag(page, "face");
  await page.goto(`/e/${code}/minhas-fotos`);

  const sheet = page.getByRole("dialog", { name: "Encontre seus momentos." });
  await sheet.getByRole("button", { name: "Continuar", exact: true }).click();
  await refInput(page).setInputFiles({ name: "eu.png", mimeType: "image/png", buffer: referencePng() });
  const review = page.getByRole("dialog", { name: "Confira a foto" });
  await review.getByRole("checkbox", { name: "Esta foto é minha e mostra o meu rosto." }).check();
  await review.getByRole("button", { name: "Continuar", exact: true }).click();

  const consent = page.getByRole("dialog", { name: "Autorização" });
  await expect(consent.getByText("Passo 3 de 3")).toBeVisible();
  await expect(consent.getByText(/Quero usar uma imagem minha como referência/)).toBeVisible();
  await expect(consent.getByRole("link", { name: "Política de privacidade" })).toHaveAttribute("href", "/privacidade");
  const box = consent.getByRole("checkbox", { name: /Li e autorizo/ });
  await expect(box).not.toBeChecked(); // nunca pré-marcado
  const activate = consent.getByRole("button", { name: "Ativar Minhas Fotos" });
  await expect(activate).toBeDisabled();
  await box.check();
  await page.screenshot({ path: path.join(EVID, "e2e-consentimento.png") });

  await activate.click();
  await expect(page.getByRole("dialog", { name: "Autorização" })).toHaveCount(0);
  // o id do evento aparece no aparelho depois do aceite (chave do álbum local); planta os resultados do "motor" de teste
  const evKey = (await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) { const m = k.match(/^mm-smart-album-v1:([^:]+):/); if (m) return m[1]; }
    return null;
  }));
  expect(evKey).toBeTruthy();
  await setFlag(page, "face", { [evKey!]: [photoId!, "00000000-0000-4000-8000-00000000dead"] });
  await page.reload();

  const found = page.getByRole("tab", { name: /Encontradas · 1/ });
  await expect(found).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".sa-tile")).toHaveCount(1); // a foto inexistente nunca aparece
  await page.screenshot({ path: path.join(EVID, "e2e-encontradas.png") });
  await page.locator(".sa-tile").first().click();
  const viewer = page.getByRole("dialog", { name: "Fotos que podem ser suas" });
  await expect(viewer.getByText("Sugestão automática: pode não ser você.")).toBeVisible();
  await viewer.getByRole("button", { name: "Não sou eu · ocultar" }).click();
  await expect(page.getByText("Essa foto não aparece mais nas suas sugestões.")).toBeVisible();
  await expect(page.getByText("Ainda não encontramos correspondências.")).toBeVisible();

  // revogar: confirmação, aviso honesto da purga, segmento some
  await page.getByRole("button", { name: "Desativar busca facial e apagar meus dados de referência" }).click();
  await page.getByRole("dialog", { name: "Desativar a busca facial?" }).getByRole("button", { name: "Desativar e apagar" }).click();
  await expect(page.getByText(/Busca desativada\. A foto de referência foi enviada para exclusão/)).toBeVisible();
  await expect(page.getByRole("tab", { name: /Encontradas/ })).toHaveCount(0);
  await expect(page.getByText("Encontre fotos em que você aparece")).toBeVisible();
});

test("antes da revelação: nenhuma foto nem contagem reveladora; busca ativada espera a revelação", async ({ page }) => {
  const { code } = await createViaWizard(page, { title: "SA antes" }); // revela ao terminar (futuro)
  await switchPerson(page, code, "Bia");
  await postViaFile(page, code);
  await setFlag(page, "face", {});
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto(`/e/${code}/minhas-fotos`);
  await page.getByRole("dialog", { name: "Encontre seus momentos." }).getByRole("button", { name: "Continuar sem reconhecimento" }).click();
  await expect(page.getByText("Suas fotos serão mostradas quando o evento for revelado.")).toBeVisible();
  await expect(page.getByText("1 pose guardada até a revelação.")).toBeVisible();
  await expect(page.locator(".sa-tile")).toHaveCount(0);
  await expect(page.getByRole("tab", { name: /Que tirei/ })).toHaveText("Que tirei"); // sem número antes da revelação
  // a barra não transborda em 360 px com a aba nova
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.screenshot({ path: path.join(EVID, "e2e-antes-da-revelacao-360.png") });

  await page.getByRole("button", { name: "Escolher minha foto" }).click();
  await page.getByRole("dialog", { name: "Encontre seus momentos." }).getByRole("button", { name: "Continuar", exact: true }).click();
  await refInput(page).setInputFiles({ name: "eu.png", mimeType: "image/png", buffer: referencePng() });
  await page.getByRole("dialog", { name: "Confira a foto" }).getByRole("checkbox").check();
  await page.getByRole("dialog", { name: "Confira a foto" }).getByRole("button", { name: "Continuar", exact: true }).click();
  const consent = page.getByRole("dialog", { name: "Autorização" });
  await consent.getByRole("checkbox", { name: /Li e autorizo/ }).check();
  await consent.getByRole("button", { name: "Ativar Minhas Fotos" }).click();
  await expect(page.getByText("Busca ativada. Procuramos suas fotos quando o evento for revelado.")).toBeVisible();
  await expect(page.getByRole("tab", { name: /Encontradas/ })).toHaveCount(1);
  await expect(page.locator(".sa-tile")).toHaveCount(0);
});

test("câmera: frontal abre e captura; câmera do evento segue intacta", async ({ page }) => {
  const { code } = await createViaWizard(page, { title: "SA camera", reveal: "desligada" });
  await switchPerson(page, code, "Caio");
  await setFlag(page, "ui");
  await page.goto(`/e/${code}/minhas-fotos`);
  await page.getByRole("dialog", { name: "Encontre seus momentos." }).getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByRole("dialog", { name: "Escolha uma foto sua" }).getByRole("button", { name: "Tirar uma foto" }).click();
  const shoot = page.getByRole("button", { name: "Tirar a foto" });
  await expect(shoot).toBeEnabled();
  await shoot.click();
  // câmera falsa do Chromium tem 640×480: passa do mínimo e cai na revisão
  await expect(page.getByRole("dialog", { name: "Confira a foto" }).getByRole("img", { name: "Prévia da sua foto de referência" })).toBeVisible();
  await page.keyboard.press("Escape");
  // a câmera do evento (postar) continua abrindo, com a fila de envio de sempre
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await settled(page);
  await page.goto(`/e/${code}/postar`);
  await expect(page.getByLabel("Escolher foto do aparelho")).toBeAttached();
});
