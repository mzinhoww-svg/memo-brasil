import AxeBuilder from "@axe-core/playwright";
import { createClient, type Session } from "@supabase/supabase-js";
import { expect, test, type BrowserContext } from "@playwright/test";
import { readFileSync } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";

// COM-006 contra Supabase LOCAL + `supabase functions serve` + AbacatePay FALSA (e2e/fixtures/fake-abacatepay.mjs).
// REAL (backend local): listPublicPlans/getPublicSettings/quote, payments-checkout/status/webhook, openOrder, effective_entitlement.
// SIMULADO: o provedor (a fake assina o webhook como o real); a RPC redeem_code (Task 7A, ainda inexistente) é respondida por page.route.
// Só valores fictícios; recusa alvo não local. Precisa de PAYMENTS_FUNCTIONS_ENV_FILE (o mesmo arquivo do `functions serve --env-file`).
const URL = process.env.SUPABASE_URL!, PUB = process.env.SUPABASE_PUBLISHABLE_KEY!, SVC = process.env.SUPABASE_SERVICE_KEY!;
const ENV_FILE = process.env.PAYMENTS_FUNCTIONS_ENV_FILE!;
test.skip(!URL || !PUB || !SVC || !ENV_FILE || !/127\.0\.0\.1|localhost/.test(URL), "precisa de Supabase local, functions serve e PAYMENTS_FUNCTIONS_ENV_FILE");
test.describe.configure({ mode: "serial" });

const fnEnv: Record<string, string> = {};
if (ENV_FILE) for (const line of readFileSync(ENV_FILE, "utf8").split(/\r?\n/)) { const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim()); if (m) fnEnv[m[1]] = m[2]; }
const FAKE_PORT = Number(fnEnv.FAKE_ABACATEPAY_PORT || 55490);
const FAKE = `http://127.0.0.1:${FAKE_PORT}`;
const mk = (k = PUB) => createClient(URL, k, { auth: { persistSession: false, autoRefreshToken: false } });
const admin = URL ? mk(SVC) : (undefined as never);
const tag = Math.random().toString(36).slice(2, 8);
const refName = () => `sb-${new globalThis.URL(URL).hostname.split(".")[0]}-auth-token`;

async function setSession(ctx: BrowserContext, s: Session, base: string) {
  const v = "base64-" + Buffer.from(JSON.stringify(s)).toString("base64url");
  const parts = v.match(/.{1,3180}/g)!;
  const host = new globalThis.URL(base).hostname;
  await ctx.addCookies(parts.map((p, i) => ({ name: parts.length === 1 ? refName() : `${refName()}.${i}`, value: p, domain: host, path: "/", httpOnly: false, secure: false, sameSite: "Lax" as const })));
}
async function user(label: string) {
  const email = `pay-${label}-${tag}@memoriesmt.test`, password = `Pw-${tag}-x1`;
  const u = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  expect(u.error).toBeNull();
  const c = mk();
  const s = await c.auth.signInWithPassword({ email, password });
  return { id: u.data.user!.id, session: s.data.session!, client: c };
}
async function newEvent(u: Awaited<ReturnType<typeof user>>, title: string) {
  const r = await u.client.from("events").insert({ title, category: "casamento", host_id: u.id, host_name: "Emy", duration_hours: 6 }).select().single();
  expect(r.error).toBeNull();
  return r.data!.id as string;
}
const control = async (path: string, body?: unknown) => (await fetch(`${FAKE}/__control/${path}`, { method: body === undefined ? "GET" : "POST", headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) })).json();
const plan = async (id: string) => ((await admin.rpc("effective_entitlement", { p_event: id })).data as { plan_code: string }[])[0].plan_code;
const orders = async (id: string) => (await admin.from("payment_orders").select("id,status,plan_code,provider_charge_id").eq("event_id", id).order("created_at")).data ?? [];

let fake: ChildProcess | undefined;
let env0: unknown;
const created: string[] = [];

test.beforeAll(async () => {
  env0 = (await admin.from("platform_settings").select("value").eq("key", "payments_env").single()).data?.value;
  expect((await admin.from("platform_settings").update({ value: "sandbox" }).eq("key", "payments_env")).error).toBeNull();
  const probe = await fetch(`${FAKE}/__control/calls`).catch(() => null);
  if (!probe) {
    // processo à parte (o loader do Playwright é CJS e o fixture é ESM); assina o webhook como o provedor real
    fake = spawn("node", [path.resolve(__dirname, "fixtures/fake-abacatepay.mjs")], {
      env: { ...process.env, FAKE_ABACATEPAY_PORT: String(FAKE_PORT), ABACATEPAY_HMAC_KEY: fnEnv.ABACATEPAY_HMAC_KEY, FAKE_ABACATEPAY_WEBHOOK_URL: `${URL}/functions/v1/payments-webhook?webhookSecret=${encodeURIComponent(fnEnv.ABACATEPAY_WEBHOOK_SECRET)}` },
      stdio: "ignore",
    });
    for (let i = 0; i < 40 && !(await fetch(`${FAKE}/__control/calls`).catch(() => null)); i++) await new Promise((r) => setTimeout(r, 250));
  }
});
test.afterAll(async () => {
  await admin.from("platform_settings").update({ value: env0 }).eq("key", "payments_env");
  for (const id of created) await admin.from("events").delete().eq("id", id);
  fake?.kill();
});
test.beforeEach(async () => { await control("reset", {}); });

async function open(ctxBrowser: import("@playwright/test").Browser, u: Awaited<ReturnType<typeof user>>, id: string, baseURL: string) {
  const ctx = await ctxBrowser.newContext();
  await setSession(ctx, u.session, baseURL);
  const page = await ctx.newPage();
  await page.goto(`/painel/${id}/plano`);
  return { ctx, page };
}

test("organizador escolhe Casamento, vê QR e contagem; fake paga; tela mostra plano ativo sem recarregar", async ({ browser, baseURL }) => {
  const u = await user("a"), id = await newEvent(u, `Pay A ${tag}`); created.push(id);
  const { ctx, page } = await open(browser, u, id, baseURL!);
  await expect(page.getByRole("heading", { level: 1, name: "De que tamanho é a festa?" })).toBeVisible();
  await expect(page.getByText("Seu plano")).toBeVisible();
  await expect(page.getByRole("radio", { name: /Casamento/ })).toBeChecked();
  await expect(page.getByText("250 olhares por R$ 0,76 cada.")).toBeVisible();
  await page.getByRole("button", { name: "Pagar R$ 189,00 no Pix" }).click();
  await expect(page.getByRole("heading", { name: "Pague no app do seu banco" })).toBeVisible();
  await expect(page.getByAltText("QR Code Pix de R$ 189,00")).toBeVisible();
  await expect(page.getByText("Aguardando pagamento…")).toBeVisible();
  await expect(page.getByText(/^(29|30):\d\d$/)).toBeVisible();
  const [row] = await orders(id);
  expect(row.status).toBe("pendente");
  expect(await plan(id)).toBe("gratis"); // nada liberado antes do pagamento
  const sim = await fetch(`${FAKE}/v2/transparents/simulate-payment?id=${row.provider_charge_id}`, { method: "POST", headers: { authorization: `Bearer ${fnEnv.ABACATEPAY_API_KEY}` } });
  expect(sim.status).toBe(200);
  await expect(page.getByRole("heading", { name: "Plano Casamento ativo." })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Até 250 convidados e 36 fotos cada. Já vale para quem entrar agora.")).toBeVisible();
  await expect(page.getByText("R$ 189,00 · Pix")).toBeVisible();
  expect(await plan(id)).toBe("casamento");
  await ctx.close();
});

test("retomar-pedido: outra aba/contexto abre /plano e vê o mesmo Pix, sem novo create no fake", async ({ browser, baseURL }) => {
  const u = await user("b"), id = await newEvent(u, `Pay B ${tag}`); created.push(id);
  const first = await open(browser, u, id, baseURL!);
  await first.page.getByRole("button", { name: "Pagar R$ 189,00 no Pix" }).click();
  await expect(first.page.getByAltText("QR Code Pix de R$ 189,00")).toBeVisible();
  await first.ctx.close(); // "fecha a aba"
  const second = await open(browser, u, id, baseURL!);
  await expect(second.page.getByRole("heading", { name: "Pague no app do seu banco" })).toBeVisible();
  await expect(second.page.getByAltText("QR Code Pix de R$ 189,00")).toBeVisible();
  expect((await control("calls")).create).toBe(1);
  expect((await orders(id)).length).toBe(1);
  await second.ctx.close();
});

test("Pix expirado mostra Gerar novo Pix, não libera plano e o novo Pix é outro pedido", async ({ browser, baseURL }) => {
  const u = await user("c"), id = await newEvent(u, `Pay C ${tag}`); created.push(id);
  const a = await open(browser, u, id, baseURL!);
  await a.page.getByRole("button", { name: "Pagar R$ 189,00 no Pix" }).click();
  await expect(a.page.getByAltText("QR Code Pix de R$ 189,00")).toBeVisible();
  const [row] = await orders(id);
  await admin.from("payment_orders").update({ status: "expirado", expires_at: new Date(Date.now() - 60_000).toISOString() }).eq("id", row.id);
  await a.page.reload();
  await expect(a.page.getByRole("heading", { name: "Este Pix expirou." })).toBeVisible();
  await expect(a.page.getByText("Pagou agora há pouco?")).toBeVisible();
  expect(await plan(id)).toBe("gratis");
  await a.page.getByRole("button", { name: "Gerar novo Pix" }).click();
  await expect(a.page.getByAltText("QR Code Pix de R$ 189,00")).toBeVisible();
  const all = await orders(id);
  expect(all.length).toBe(2);
  expect(all[1].status).toBe("pendente");
  await a.ctx.close();
});

test("clique duplo em Pagar gera um pedido só", async ({ browser, baseURL }) => {
  const u = await user("d"), id = await newEvent(u, `Pay D ${tag}`); created.push(id);
  const a = await open(browser, u, id, baseURL!);
  await a.page.getByRole("button", { name: "Pagar R$ 189,00 no Pix" }).dblclick();
  await expect(a.page.getByAltText("QR Code Pix de R$ 189,00")).toBeVisible();
  expect((await orders(id)).length).toBe(1);
  expect((await control("calls")).create).toBe(1);
  await a.ctx.close();
});

test("provedor fora: mensagem de recuperação e nenhum plano liberado", async ({ browser, baseURL }) => {
  const u = await user("e"), id = await newEvent(u, `Pay E ${tag}`); created.push(id);
  await control("config", { failCreate: 500 });
  const a = await open(browser, u, id, baseURL!);
  await a.page.getByRole("button", { name: "Pagar R$ 189,00 no Pix" }).click();
  await expect(a.page.getByRole("heading", { name: "O sistema de pagamento não respondeu." })).toBeVisible({ timeout: 30_000 });
  await expect(a.page.getByText("Seu pedido está guardado; tente de novo em 1 minuto.")).toBeVisible();
  await expect(a.page.getByRole("button", { name: /Tentar de novo em/ })).toBeDisabled();
  expect(await plan(id)).toBe("gratis");
  await a.ctx.close();
});

test("evento de outro organizador: 'Só o anfitrião abre o painel' / sem painel", async ({ browser, baseURL }) => {
  const owner = await user("f"), other = await user("g"), id = await newEvent(owner, `Pay F ${tag}`); created.push(id);
  const a = await open(browser, other, id, baseURL!);
  await expect(a.page.getByText(/Só o anfitrião abre o painel|Não achamos este evento/)).toBeVisible();
  await expect(a.page.getByText("De que tamanho é a festa?")).toHaveCount(0);
  await a.ctx.close();
});

test("código (RPC redeem_code SIMULADA por page.route): válido mostra B9; inválido, a mensagem neutra", async ({ browser, baseURL }) => {
  const u = await user("h"), id = await newEvent(u, `Pay H ${tag}`); created.push(id);
  const a = await open(browser, u, id, baseURL!);
  let reply: object = { applied: false, planCode: null, reason: "invalido" };
  await a.page.route("**/rest/v1/rpc/redeem_code", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(reply) }));
  await a.page.getByRole("button", { name: "Tenho um código" }).click();
  await a.page.getByRole("textbox", { name: "Código" }).fill("mmt 7kq4-xr2p");
  await a.page.getByRole("button", { name: "Aplicar" }).click();
  await expect(a.page.getByText("Esse código não existe, expirou ou já foi usado. Confira as letras e tente de novo.")).toBeVisible();
  reply = { applied: true, planCode: "casamento", reason: "ok" };
  await a.page.getByRole("button", { name: "Aplicar" }).click();
  await expect(a.page.getByRole("heading", { name: "Plano Casamento liberado." })).toBeVisible();
  await expect(a.page.getByText("MMT-7KQ4-XR2P")).toBeVisible();
  await a.ctx.close();
});

test("axe: 0 violações em B1 e B2 (390 e 1280 px)", async ({ browser, baseURL }) => {
  const u = await user("i"), id = await newEvent(u, `Pay I ${tag}`); created.push(id);
  const problems: string[] = [];
  for (const width of [390, 1280]) {
    const a = await open(browser, u, id, baseURL!);
    await a.page.setViewportSize({ width, height: 900 });
    await a.page.getByRole("button", { name: /Pagar R\$/ }).waitFor();
    for (const stage of ["B1", "B2"]) {
      if (stage === "B2") { await a.page.getByRole("button", { name: /Pagar R\$/ }).click(); await a.page.getByAltText(/QR Code Pix/).waitFor(); }
      await a.page.evaluate(() => document.fonts.ready);
      const r = await new AxeBuilder({ page: a.page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      for (const v of r.violations) problems.push(`${stage}@${width} [${v.impact}] ${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
    }
    await a.ctx.close();
    await control("reset", {});
    await admin.from("payment_orders").delete().eq("event_id", id);
  }
  expect(problems, problems.join("\n")).toEqual([]);
});
