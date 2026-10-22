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
export async function wizardToSummary(page: Page, opts: { title?: string; reveal?: RevealOpt; shots?: string; capacity?: string } = {}): Promise<void> {
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
}

/** Aceita os Termos e confirma a leitura da Política (duas caixas, ambas obrigatórias para criar o evento e para entrar na festa). */
export async function acceptTerms(page: Page) {
  await page.getByRole("checkbox", { name: /Li e aceito os Termos/ }).check();
  await page.getByRole("checkbox", { name: /Li a Política/ }).check();
}

export async function createViaWizard(page: Page, opts: { title?: string; reveal?: RevealOpt; shots?: string; capacity?: string } = {}): Promise<{ code: string; id: string }> {
  await wizardToSummary(page, opts);
  await acceptTerms(page);
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
  await acceptTerms(page);
  await page.getByRole("button", { name: "Entrar e abrir a câmera" }).click();
  await page.waitForURL(/postar$/);
  await page.goto(`/e/${code}/agora`);
}


/** Data civil (aaaa-mm-dd) daqui a `days` dias no fuso dado; o fuso do evento é quem manda no convite. */
export function dateIn(tz: string, days: number): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [y, m, d] = today.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
/** Dia da semana em português de uma data civil aaaa-mm-dd ("domingo", "segunda-feira"). */
export function weekdayOf(isoDate: string): string {
  return new Intl.DateTimeFormat("pt-BR", { weekday: "long", timeZone: "UTC" }).format(new Date(`${isoDate}T12:00:00Z`));
}

/** Entra na tela de convite como um convidado novo (sem entrar na festa ainda). */
export async function openInviteAsGuest(page: Page, code: string) {
  await page.goto(`/e/${code}/voce`);
  await page.getByRole("button", { name: "Entrar como outra pessoa" }).click();
  await page.waitForURL(new RegExp(`/e/${code}$`));
}

/** Faz o navegador negar a câmera e dizer que ainda vai perguntar (para ver a pré-permissão e a tela de câmera negada). */
export async function denyCamera(page: Page) {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("Permission denied", "NotAllowedError"));
    const q = navigator.permissions.query.bind(navigator.permissions);
    navigator.permissions.query = (d) => ((d as { name: string }).name === "camera" ? Promise.resolve({ state: "prompt", onchange: null } as PermissionStatus) : q(d));
  });
}
