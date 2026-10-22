import { createClient, type Session } from "@supabase/supabase-js";
import { expect, test, type BrowserContext } from "@playwright/test";

// M1/M2 no navegador real contra o app em modo Supabase + Supabase LOCAL. Chaves só do ambiente; recusa alvo não local.
// Desvio registrado (Task 7): /precos é de outra sessão (Tasks 10–14); o preço novo é conferido por list_public_plans() como anon,
// que é a fonte que /precos, o assistente e /painel/[id]/plano consomem.
const URL = process.env.SUPABASE_URL!, PUB = process.env.SUPABASE_PUBLISHABLE_KEY!, SVC = process.env.SUPABASE_SERVICE_KEY!;
test.skip(!URL || !PUB || !SVC || !/127\.0\.0\.1|localhost/.test(URL), "precisa de Supabase local e das chaves no ambiente");
const mk = (k = PUB) => createClient(URL, k, { auth: { persistSession: false, autoRefreshToken: false } });
const admin = URL ? mk(SVC) : (undefined as never);
const tag = Math.random().toString(36).slice(2, 8);
const refName = () => `sb-${new globalThis.URL(URL).hostname.split(".")[0]}-auth-token`;

async function login(ctx: BrowserContext, s: Session, base: string) {
  const v = "base64-" + Buffer.from(JSON.stringify(s)).toString("base64url");
  const parts = v.match(/.{1,3180}/g)!;
  const host = new globalThis.URL(base).hostname;
  await ctx.addCookies(parts.map((p, i) => ({ name: parts.length === 1 ? refName() : `${refName()}.${i}`, value: p, domain: host, path: "/", httpOnly: false, secure: false, sameSite: "Lax" as const })));
}
async function master() {
  const email = `master-pay-${tag}@memoriesmt.test`, password = `Pw-${tag}-x1`;
  const u = await admin.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { role: "master" } });
  expect(u.error).toBeNull();
  expect((await admin.from("platform_roles").insert({ user_id: u.data.user!.id, role: "master", granted_by: u.data.user!.id })).error).toBeNull();
  const s = await mk().auth.signInWithPassword({ email, password });
  return { id: u.data.user!.id, session: s.data.session! };
}
const publicPrice = async (code: string) => {
  const { data, error } = await mk().rpc("list_public_plans");
  expect(error).toBeNull();
  return (data as { code: string; priceCents: number }[]).find((p) => p.code === code)?.priceCents;
};

test("master altera o preço do Casamento com motivo e list_public_plans mostra o novo valor", async ({ browser, baseURL }) => {
  const env0 = (await admin.from("platform_settings").select("value").eq("key", "payments_env").single()).data?.value;
  const plan0 = (await admin.from("plans").select("price_cents,sandbox_active,production_active").eq("code", "casamento").single()).data!;
  const m = await master();
  try {
    expect((await admin.from("platform_settings").update({ value: "sandbox" }).eq("key", "payments_env")).error).toBeNull();
    const ctx = await browser.newContext(); await login(ctx, m.session, baseURL!);
    const page = await ctx.newPage();
    await page.goto("/master/planos");
    await expect(page.getByRole("heading", { name: "Planos e preços" })).toBeVisible();
    await expect(page.getByText("Mudanças valem para pedidos novos; um Pix já gerado mantém o valor dele.", { exact: false })).toBeVisible();
    await expect(page.getByText("Limites de convidados e fotos mudam só por migration", { exact: false })).toBeVisible();

    await page.getByRole("button", { name: "Editar Casamento" }).click();
    const sheet = page.getByRole("dialog", { name: "Editar Casamento" });
    await sheet.getByLabel("Preço (R$)").fill("199,00");
    await expect(sheet.getByText("Até 250 · R$ 199")).toBeVisible(); // prévia do cartão do organizador
    await sheet.getByRole("button", { name: "Salvar com motivo" }).click();
    await expect(sheet.getByText("Escreva o motivo com pelo menos 10 caracteres.")).toBeVisible(); // motivo obrigatório no cliente
    expect(await publicPrice("casamento")).toBe(plan0.price_cents);

    await sheet.getByLabel("Motivo (obrigatório)").fill("Ajuste de preço após piloto de novembro");
    await sheet.getByRole("button", { name: "Salvar com motivo" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("row", { name: /Casamento/ })).toContainText("R$ 199,00");
    expect(await publicPrice("casamento")).toBe(19900);
    await expect(page.getByText(/Última alteração em \d{2}\/\d{2}\/\d{4}\./)).toBeVisible();

    await page.getByRole("button", { name: "Editar Casamento" }).click();
    await expect(page.getByRole("dialog", { name: "Editar Casamento" })).toContainText("Ajuste de preço após piloto de novembro"); // histórico
    await page.keyboard.press("Escape");

    const pay = await page.goto("/master/pagamentos");
    expect(pay?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Pagamentos" })).toBeVisible();
    await expect(page.getByText("SANDBOX", { exact: true })).toBeVisible();
    await expect(page.getByText("Pagos (30 dias)")).toBeVisible();
    await expect(page.getByRole("button", { name: "Conceder cortesia" })).toBeVisible();
    await ctx.close();
  } finally {
    await admin.from("plans").update({ price_cents: plan0.price_cents, sandbox_active: plan0.sandbox_active, production_active: plan0.production_active }).eq("code", "casamento");
    await admin.from("platform_settings").update({ value: env0 }).eq("key", "payments_env");
    await admin.from("platform_roles").update({ revoked_at: new Date().toISOString() }).eq("user_id", m.id);
  }
});
