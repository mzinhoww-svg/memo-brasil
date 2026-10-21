import fs from "node:fs";
import path from "node:path";
import { expect, type Page } from "@playwright/test";

const PNG = fs.readFileSync(path.resolve(__dirname, "../public/pwa/icon-192.png"));

export async function setTheme(page: Page, theme: "dia" | "noite") {
  await page.addInitScript((t) => localStorage.setItem("mm-tema", t), theme);
}

/** Cria o evento de exemplo pela home e devolve o código do convite. */
export async function openDemo(page: Page): Promise<string> {
  await page.goto("/");
  await page.getByRole("button", { name: "Ver uma festa de exemplo" }).click();
  await page.waitForURL(/\/e\/[A-Z0-9]{8}\/agora/);
  const code = page.url().match(/\/e\/([A-Z0-9]{8})\//)![1];
  await expect(page.getByRole("heading", { name: "Agora" })).toBeVisible();
  return code;
}

/** Cria um evento pelo wizard e devolve o código. Parâmetros avançam passo a passo pela UI real. */
export type RevealOpt = "ao-terminar" | "desligada" | { date: string; time: string; tz?: string };

/** Cria um evento pelo wizard e devolve o código. Cada passo usa a interface real. */
export async function createViaWizard(page: Page, opts: { title?: string; reveal?: RevealOpt; shots?: string; capacity?: string } = {}): Promise<{ code: string; id: string }> {
  await page.goto("/criar");
  await page.getByLabel("Nome do evento").fill(opts.title ?? "Emy e Igor");
  await page.getByLabel("Seu nome").fill("Emy");
  await page.getByRole("button", { name: "Próximo" }).click();
  await page.getByRole("button", { name: "Próximo" }).click(); // término: 6 horas
  const reveal = opts.reveal ?? "ao-terminar";
  const group = page.getByRole("group", { name: "Revelação programada" });
  if (reveal === "desligada") await group.getByRole("button", { name: /^Desligada/ }).click();
  else if (reveal === "ao-terminar") await page.getByRole("button", { name: "Quando o evento terminar" }).click();
  else {
    await page.getByRole("button", { name: "Escolher data e hora" }).click();
    await page.getByLabel("Data", { exact: true }).fill(reveal.date);
    await page.getByLabel("Horário", { exact: true }).fill(reveal.time);
    if (reveal.tz) await page.getByLabel("Fuso horário").selectOption(reveal.tz);
  }
  await page.getByRole("button", { name: "Próximo" }).click();
  await page.getByRole("button", { name: "Próximo" }).click(); // identidade
  if (opts.capacity) await page.getByRole("group", { name: "Convidados" }).getByRole("button", { name: opts.capacity, exact: true }).click();
  if (opts.shots) await page.getByRole("group", { name: "Fotos por pessoa" }).getByRole("button", { name: opts.shots, exact: true }).click();
  await page.getByRole("button", { name: "Próximo" }).click();
  await page.getByRole("button", { name: /Criar evento/ }).click();
  await page.waitForURL(/\/criar\/pronto\//);
  const code = (await page.getByTestId("codigo").textContent())!.trim();
  const id = page.url().split("/").pop()!;
  return { code, id };
}

export async function postViaFile(page: Page, code: string, moment = "O sim") {
  await page.goto(`/e/${code}/postar`);
  await page.getByLabel("Escolher foto do aparelho").setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: PNG });
  await page.getByRole("button", { name: moment, exact: true }).click();
  await page.getByRole("button", { name: "Postar", exact: true }).click();
  await expect(page.getByText("Sua visão entrou na história.")).toBeVisible();
}

export async function switchPerson(page: Page, code: string, name: string) {
  await page.goto(`/e/${code}/voce`);
  await page.getByRole("button", { name: "Entrar como outra pessoa" }).click();
  await page.waitForURL(new RegExp(`/e/${code}$`));
  await page.getByLabel("Como te chamam na festa?").fill(name);
  await page.getByRole("button", { name: "Entrar na festa" }).click();
  await page.waitForURL(/agora$/);
}

