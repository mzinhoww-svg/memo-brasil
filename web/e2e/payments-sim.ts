import { createClient, type Session } from "@supabase/supabase-js";
import { expect, type BrowserContext, type Page, type Route } from "@playwright/test";

/**
 * Apoio dos E2E de pagamento (Mercado Pago, Checkout Pro) em modo Supabase LOCAL.
 * REAL: autenticação, evento, RLS e `effective_entitlement` do Supabase local.
 * SIMULADO por `page.route`: o catálogo/configuração públicos, `payments_quote`, as Edge Functions `payments-checkout` e
 * `payments-status`, a leitura de `payment_orders` e o próprio domínio do Mercado Pago (nenhuma requisição real sai).
 * Nada é gravado em `platform_settings`: as funções do outro agente (backend) e o fake do provedor não são necessários aqui.
 */
export const SB_URL = process.env.SUPABASE_URL ?? "";
export const SB_PUB = process.env.SUPABASE_PUBLISHABLE_KEY ?? "";
export const SB_SVC = process.env.SUPABASE_SERVICE_KEY ?? "";
export const SB_READY = !!(SB_URL && SB_PUB && SB_SVC && /127\.0\.0\.1|localhost/.test(SB_URL));

export const mk = (k = SB_PUB) => createClient(SB_URL, k, { auth: { persistSession: false, autoRefreshToken: false } });
export const admin = SB_URL ? mk(SB_SVC) : (undefined as never);
export const tag = Math.random().toString(36).slice(2, 8);
const refName = () => `sb-${new globalThis.URL(SB_URL).hostname.split(".")[0]}-auth-token`;

export async function setSession(ctx: BrowserContext, s: Session, base: string) {
  const v = "base64-" + Buffer.from(JSON.stringify(s)).toString("base64url");
  const parts = v.match(/.{1,3180}/g)!;
  const host = new globalThis.URL(base).hostname;
  await ctx.addCookies(parts.map((p, i) => ({ name: parts.length === 1 ? refName() : `${refName()}.${i}`, value: p, domain: host, path: "/", httpOnly: false, secure: false, sameSite: "Lax" as const })));
}
export async function makeUser(label: string) {
  const email = `pay-${label}-${tag}@memoriesmt.test`, password = `Pw-${tag}-x1`;
  const u = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  expect(u.error).toBeNull();
  const c = mk();
  const s = await c.auth.signInWithPassword({ email, password });
  return { id: u.data.user!.id, session: s.data.session!, client: c };
}
export type TestUser = Awaited<ReturnType<typeof makeUser>>;
export async function makeEvent(u: TestUser, title: string) {
  const r = await u.client.from("events").insert({ title, category: "casamento", host_id: u.id, host_name: "Emy", duration_hours: 6 }).select().single();
  expect(r.error).toBeNull();
  return r.data!.id as string;
}

// ---------------------------------------------------------------- simulação do servidor de pagamentos
export const MP_CHECKOUT_URL = "https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=TESTE-0001";
const PLAN_ROWS = [
  { code: "gratis", name: "Grátis", maxGuests: 10, maxShots: 10, priceCents: 0, sort: 0, isFree: true, features: [] },
  { code: "festa", name: "Festa", maxGuests: 30, maxShots: 24, priceCents: 2900, sort: 1, isFree: false, features: [] },
  { code: "celebracao", name: "Celebração", maxGuests: 100, maxShots: 24, priceCents: 8900, sort: 2, isFree: false, features: [] },
  { code: "casamento", name: "Casamento", maxGuests: 250, maxShots: 36, priceCents: 18900, sort: 3, isFree: false, features: [] },
  { code: "grande", name: "Grande", maxGuests: 500, maxShots: null, priceCents: 34900, sort: 4, isFree: false, features: [] },
];

export type SimOrder = {
  id: string; status: string; planCode: string; amountCents: number; provider: "mercadopago" | "abacatepay";
  checkoutUrl: string | null; expiresAt: string | null; paidAt: string | null; paymentMethod: string | null;
};
export type Sim = {
  order: SimOrder | null;
  checkoutBodies: Record<string, unknown>[];
  statusCalls: number;
  failCheckout: boolean;
  mpRequests: string[];
};
export const plansPrice = (code: string) => PLAN_ROWS.find((p) => p.code === code)!.priceCents;

export function newOrder(over: Partial<SimOrder> = {}): SimOrder {
  return {
    id: "7f3a21c9-0000-4000-8000-000000000001", status: "pendente", planCode: "casamento", amountCents: 18900, provider: "mercadopago",
    checkoutUrl: MP_CHECKOUT_URL, expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(), paidAt: null, paymentMethod: null, ...over,
  };
}

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, apikey, content-type, x-client-info, prefer, accept-profile, content-profile, x-supabase-api-version, range, x-idempotency-key",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-expose-headers": "content-range",
};
const json = (r: Route, status: number, body: unknown) => r.fulfill({ status, headers: CORS, contentType: "application/json", body: JSON.stringify(body) });
const preflight = (r: Route) => r.request().method() === "OPTIONS" ? (r.fulfill({ status: 204, headers: CORS }), true) : false;

const view = (o: SimOrder, withPaid = true) => ({
  orderId: o.id, status: o.status, planCode: o.planCode, amountCents: o.amountCents, checkoutUrl: o.checkoutUrl, expiresAt: o.expiresAt,
  ...(withPaid ? { paidAt: o.paidAt } : {}), provider: o.provider, paymentMethod: o.paymentMethod,
});

/** Instala a simulação na página. O estado (`sim`) é mutável: o teste muda `sim.order` para simular o servidor. */
export async function installSim(page: Page, planCode = "casamento"): Promise<Sim> {
  const sim: Sim = { order: null, checkoutBodies: [], statusCalls: 0, failCheckout: false, mpRequests: [] };

  await page.route("**/rest/v1/rpc/list_public_plans", (r) => preflight(r) || json(r, 200, PLAN_ROWS));
  await page.route("**/rest/v1/rpc/get_public_settings", (r) => preflight(r) || json(r, 200, { payments_env: "sandbox", support_email: "oi@memoriesmt.test", support_phone: null, company_legal_name: null, company_cnpj: null, capacity_grace_pct: 10 }));
  await page.route("**/rest/v1/rpc/payments_quote", (r) => {
    if (preflight(r)) return;
    const body = r.request().postDataJSON() as { p_plan: string };
    return json(r, 200, { planCode: body.p_plan, fromPlanCode: null, amountCents: plansPrice(body.p_plan ?? planCode), payable: true, reason: "ok" });
  });
  await page.route("**/rest/v1/payment_orders**", (r) => {
    if (preflight(r)) return;
    const o = sim.order;
    return json(r, 200, o ? [{ id: o.id, status: o.status, plan_code: o.planCode, amount_cents: o.amountCents, provider: o.provider, checkout_url: o.checkoutUrl, payment_method: o.paymentMethod, expires_at: o.expiresAt, paid_at: o.paidAt, created_at: new Date().toISOString() }] : []);
  });
  await page.route("**/functions/v1/payments-checkout", (r) => {
    if (preflight(r)) return;
    const body = r.request().postDataJSON() as Record<string, unknown>;
    sim.checkoutBodies.push(body);
    if (sim.failCheckout) return json(r, 502, { error: "provedor_indisponivel", orderId: sim.order?.id ?? "7f3a21c9-0000-4000-8000-0000000000aa" });
    const open = sim.order && (sim.order.status === "pendente" || sim.order.status === "criado");
    if (open) return json(r, 409, { error: "pedido_aberto", orderId: sim.order!.id });
    const plan = String(body.planCode);
    sim.order = newOrder({ planCode: plan, amountCents: plansPrice(plan), id: `7f3a21c9-0000-4000-8000-${String(sim.checkoutBodies.length).padStart(12, "0")}` });
    return json(r, 200, view(sim.order, false));
  });
  await page.route("**/functions/v1/payments-status", (r) => {
    if (preflight(r)) return;
    sim.statusCalls += 1;
    return sim.order ? json(r, 200, view(sim.order)) : json(r, 404, { error: "nao_encontrado" });
  });

  // o domínio do Mercado Pago nunca é alcançado: o clique só precisa NAVEGAR para o checkoutUrl esperado
  await page.route(/https?:\/\/([^/]*\.)?(mercadopago|mercadolibre|mercadolivre)\.[^/]+\/.*/, (r) => {
    sim.mpRequests.push(r.request().url());
    return r.request().resourceType() === "document"
      ? r.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>Mercado Pago (simulado)</title><h1>Mercado Pago (simulado)</h1>" })
      : r.abort();
  });
  return sim;
}

export async function openPlano(browser: import("@playwright/test").Browser, u: TestUser, eventId: string, baseURL: string, query = "", viewport?: { width: number; height: number }) {
  const ctx = await browser.newContext(viewport ? { viewport, isMobile: true, hasTouch: true } : undefined);
  await setSession(ctx, u.session, baseURL);
  const page = await ctx.newPage();
  const sim = await installSim(page);
  return { ctx, page, sim, goto: () => page.goto(`/painel/${eventId}/plano${query}`) };
}
