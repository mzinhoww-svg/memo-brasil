import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { acceptTerms } from "./helpers";
const PNG = fs.readFileSync(path.resolve(__dirname, "../public/pwa/icon-192.png"));

// Navegador real contra o app em modo Supabase + Supabase local. Chaves só do ambiente; recusa alvo que não seja local.
const URL = process.env.SUPABASE_URL!, PUB = process.env.SUPABASE_PUBLISHABLE_KEY!, SVC = process.env.SUPABASE_SERVICE_KEY!;
test.skip(!URL || !PUB || !SVC || !/127\.0\.0\.1|localhost/.test(URL), "precisa de Supabase local e das chaves no ambiente");
const mk = (k = PUB) => createClient(URL, k, { auth: { persistSession: false, autoRefreshToken: false } });

test("convidado anônimo entra pelo código, posta, espera e vê a foto só depois da revelação do servidor", async ({ browser }) => {
  const tag = Math.random().toString(36).slice(2, 8);
  const admin = mk(SVC), host = mk();
  const email = `e2e-${tag}@memoriesmt.test`;
  await admin.auth.admin.createUser({ email, password: `Pw-${tag}-x1`, email_confirm: true });
  const s = await host.auth.signInWithPassword({ email, password: `Pw-${tag}-x1` });
  const hostId = s.data.user!.id;
  const ev = (await host.from("events").insert({ title: `E2E ${tag}`, category: "casamento", host_id: hostId, host_name: "Emy", duration_hours: 6, reveal_enabled: true, reveal_anchor: "fim", shots_per_person: 5, moments: ["O sim", "Brinde"] }).select().single()).data!;
  expect(ev.retention_policy).toBe("2026-10-22-v1"); // a política de retenção é gravada pelo servidor na criação
  try {
    const ctx = await browser.newContext(); // contexto independente: outro IndexedDB/cookies, como outro aparelho
    const page = await ctx.newPage();
    await page.goto(`/e/${ev.code}`);
    await expect(page.getByText(`E2E ${tag}`)).toBeVisible();
    await page.getByLabel("Como te chamam na festa?").fill("Ana");
    await acceptTerms(page);
    await page.getByRole("button", { name: "Entrar e abrir a câmera" }).click();
    await page.waitForURL(/postar$/);
    await page.goto(`/e/${ev.code}/agora`);
    await expect(page.getByTestId("aguardando-revelacao")).toBeVisible();
    // COM-004: o aceite foi gravado no servidor, com as versões vigentes, para o próprio convidado
    const part = (await admin.from("participants").select("user_id").eq("event_id", ev.id)).data!;
    expect(part).toHaveLength(1);
    const aceites = (await admin.from("user_consents").select("role,terms_version,privacy_version,context,terms_accepted_at,privacy_acknowledged_at").eq("user_id", part[0].user_id)).data!;
    expect(aceites).toHaveLength(1);
    expect(aceites[0]).toMatchObject({ role: "convidado", terms_version: "2026-10-22-v1", privacy_version: "2026-10-22-v1", context: "entrar-evento" });
    expect(aceites[0].terms_accepted_at).toBeTruthy();
    expect(aceites[0].privacy_acknowledged_at).toBeTruthy();

    await page.goto(`/e/${ev.code}/postar`);
    await page.getByLabel("Escolher foto do aparelho").setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: PNG });
    await page.getByRole("button", { name: "O sim", exact: true }).click();
    await page.getByRole("button", { name: "Postar", exact: true }).click();
    await expect(page.getByText("Sua visão entrou na história.")).toBeVisible();

    await page.goto(`/e/${ev.code}/agora`);
    await expect(page.getByTestId("aguardando-revelacao")).toBeVisible();
    await expect(page.locator(".rv-post")).toHaveCount(0); // bloqueada: nem a própria
    // o servidor revela (simula o tempo passando: início 7 h atrás, duração 1 h)
    await admin.from("events").update({ start_at: new Date(Date.now() - 7 * 3600_000).toISOString(), duration_hours: 1 }).eq("id", ev.id);
    expect((await admin.rpc("reveal_due_events")).data).toBeGreaterThanOrEqual(1);
    await page.reload();
    await expect(page.locator(".rv-post")).toHaveCount(1, { timeout: 15_000 });
    await ctx.close();
  } finally {
    await admin.from("events").delete().eq("id", ev.id);
  }
});

test("falha ao gravar o aceite: o convidado não entra, nada é gravado pela metade; com a rede de volta entra uma única vez e outro usuário não lê o aceite", async ({ browser }) => {
  const tag = Math.random().toString(36).slice(2, 8);
  const admin = mk(SVC), host = mk();
  const email = `e2e-f${tag}@memoriesmt.test`;
  await admin.auth.admin.createUser({ email, password: `Pw-${tag}-x1`, email_confirm: true });
  const hostId = (await host.auth.signInWithPassword({ email, password: `Pw-${tag}-x1` })).data.user!.id;
  const ev = (await host.from("events").insert({ title: `E2E F${tag}`, category: "festa", host_id: hostId, host_name: "Emy", duration_hours: 6 }).select().single()).data!;
  try {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    let falhar = true;
    await page.route("**/rest/v1/rpc/record_consent", (r) => (falhar ? r.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "indisponível" }) }) : r.continue()));
    await page.goto(`/e/${ev.code}`);
    await page.getByLabel("Como te chamam na festa?").fill("Bia");
    await acceptTerms(page);
    await page.getByRole("button", { name: "Entrar e abrir a câmera" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Não foi possível registrar o seu aceite" })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/e/${ev.code}$`));
    expect((await admin.from("participants").select("user_id").eq("event_id", ev.id)).data).toHaveLength(0); // sem aceite, sem entrada
    falhar = false;
    await page.getByRole("button", { name: "Entrar e abrir a câmera" }).click();
    await page.waitForURL(/postar$/);
    const part = (await admin.from("participants").select("user_id").eq("event_id", ev.id)).data!;
    expect(part).toHaveLength(1);
    expect((await admin.from("user_consents").select("id").eq("user_id", part[0].user_id)).data).toHaveLength(1);
    // isolamento: outro usuário (anônimo) não lê o aceite alheio
    const outro = mk();
    await outro.auth.signInAnonymously();
    expect((await outro.from("user_consents").select("id")).data).toEqual([]);
    await ctx.close();
  } finally {
    await admin.from("events").delete().eq("id", ev.id);
  }
});

test("quem não organiza não cria evento: o portão pede entrar com Google", async ({ page }) => {
  await page.goto("/criar");
  await expect(page.getByRole("button", { name: "Entrar com o Google" })).toBeVisible();
});
