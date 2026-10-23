import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { acceptTerms } from "./helpers";

/**
 * Smoke PÚBLICO de convidado contra o ambiente publicado (backend Supabase real). Dados sintéticos identificados.
 * E2E_BASE_URL=https://newmemocuiaba.vercel.app E2E_EVENT_CODE=<código de um evento "TESTE – excluir" criado pelo organizador>
 * Contexto novo = convidado novo (sessão anônima própria). Nunca use evento de gente real.
 */
const PNG = fs.readFileSync(path.resolve(__dirname, "../public/pwa/icon-192.png"));
const CODE = process.env.E2E_EVENT_CODE;
test.skip(!process.env.E2E_BASE_URL || !CODE, "defina E2E_BASE_URL e E2E_EVENT_CODE");

test("publicado: convidado entra pelo código, aceita termos, posta e vê no Agora", async ({ page }) => {
  await page.goto(`/e/${CODE}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.getByLabel("Como te chamam na festa?").fill("Convidado Smoke");
  await expect(page.getByRole("checkbox", { name: /Li e aceito os Termos/ })).not.toBeChecked();
  await expect(page.getByRole("checkbox", { name: /Li a Política/ })).not.toBeChecked();
  await acceptTerms(page);
  await page.getByRole("button", { name: "Entrar e abrir a câmera" }).click();
  await page.waitForURL(new RegExp(`/e/${CODE}/postar$`));
  await page.getByLabel("Escolher foto do aparelho").setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: PNG });
  await page.getByRole("button", { name: "Postar", exact: true }).click();
  await expect(page.getByText("Sua visão entrou na história.")).toBeVisible({ timeout: 30_000 });
  await page.goto(`/e/${CODE}/agora`);
  await expect(page.getByText(/Visão de Convidado Smoke/)).toBeVisible({ timeout: 30_000 });
});

test("publicado: sem sessão, as áreas protegidas não abrem e o Master pede login", async ({ page }) => {
  const r = await page.goto("/master");
  expect(r?.status()).toBeLessThan(500);
  await expect(page.getByText(/Entrar com o Google|Acesso restrito|não encontrada/i).first()).toBeVisible();
  const d = await page.request.get("/design");
  expect(d.status()).toBe(404);
  const s = await page.request.get("/dev/seed");
  expect(s.status()).toBe(404);
});
