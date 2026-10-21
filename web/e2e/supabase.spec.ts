import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
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
  try {
    const ctx = await browser.newContext(); // contexto independente: outro IndexedDB/cookies, como outro aparelho
    const page = await ctx.newPage();
    await page.goto(`/e/${ev.code}`);
    await expect(page.getByText(`E2E ${tag}`)).toBeVisible();
    await page.getByLabel("Como te chamam na festa?").fill("Ana");
    await page.getByRole("button", { name: "Entrar na festa" }).click();
    await page.waitForURL(/agora$/);
    await expect(page.getByTestId("aguardando-revelacao")).toBeVisible();

    await page.goto(`/e/${ev.code}/postar`);
    await page.getByLabel("Escolher foto do aparelho").setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: PNG });
    await page.getByRole("button", { name: "O sim", exact: true }).click();
    await page.getByRole("button", { name: "Postar", exact: true }).click();
    await expect(page.getByText("Sua visão entrou na história.")).toBeVisible();

    await page.goto(`/e/${ev.code}/agora`);
    await expect(page.getByTestId("aguardando-revelacao")).toBeVisible();
    await expect(page.locator(".mm-post")).toHaveCount(0); // bloqueada: nem a própria
    // o servidor revela (simula o tempo passando: início 7 h atrás, duração 1 h)
    await admin.from("events").update({ start_at: new Date(Date.now() - 7 * 3600_000).toISOString(), duration_hours: 1 }).eq("id", ev.id);
    expect((await admin.rpc("reveal_due_events")).data).toBeGreaterThanOrEqual(1);
    await page.reload();
    await expect(page.locator(".mm-post")).toHaveCount(1, { timeout: 15_000 });
    await ctx.close();
  } finally {
    await admin.from("events").delete().eq("id", ev.id);
  }
});

test("quem não organiza não cria evento: o portão pede entrar com Google", async ({ page }) => {
  await page.goto("/criar");
  await expect(page.getByRole("button", { name: "Entrar com Google" })).toBeVisible();
});
