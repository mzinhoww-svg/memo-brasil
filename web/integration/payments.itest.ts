// Integração das Edge Functions de pagamento (Mercado Pago): stack local + `supabase functions serve` + Mercado Pago FALSO
// (e2e/fixtures/fake-mercadopago.mjs). ATENÇÃO: o fake NÃO é homologação externa; prova o contrato que o código consome.
// Precisa de SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_KEY e PAYMENTS_FUNCTIONS_ENV_FILE (o mesmo arquivo passado a
// `functions serve --env-file`, só com valores fictícios: MERCADOPAGO_ACCESS_TOKEN=FAKE-..., MERCADOPAGO_WEBHOOK_SECRET,
// PAYMENTS_CRON_TOKEN, MERCADOPAGO_BASE_URL=http://host.docker.internal:<porta>, PAYMENTS_WEBHOOK_URL, FAKE_MERCADOPAGO_PORT).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startFakeMercadoPago } from "../e2e/fixtures/fake-mercadopago.mjs";

const URL_ = process.env.SUPABASE_URL!, PUB = process.env.SUPABASE_PUBLISHABLE_KEY!, SVC = process.env.SUPABASE_SERVICE_KEY!;
const ENV_FILE = process.env.PAYMENTS_FUNCTIONS_ENV_FILE!;
if (!URL_ || !PUB || !SVC || !ENV_FILE) throw new Error("defina SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_KEY e PAYMENTS_FUNCTIONS_ENV_FILE");
if (!/^https?:\/\/(127\.0\.0\.1|localhost)/.test(URL_)) throw new Error("recusado: alvo não é local");

const fnEnv: Record<string, string> = {};
for (const line of readFileSync(ENV_FILE, "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (m) fnEnv[m[1]] = m[2];
}
if (!fnEnv.MERCADOPAGO_ACCESS_TOKEN?.startsWith("FAKE-")) throw new Error("o arquivo de ambiente das funções deve ter só token fictício FAKE-…");
if (!/^http:\/\/host\.docker\.internal:\d+$/.test(fnEnv.MERCADOPAGO_BASE_URL ?? "")) throw new Error("MERCADOPAGO_BASE_URL deve apontar para o fake local");
const FAKE_PORT = Number(fnEnv.FAKE_MERCADOPAGO_PORT || 56491);
const FAKE = `http://127.0.0.1:${FAKE_PORT}`;
const FN = `${URL_}/functions/v1`;
const WEBHOOK = `${FN}/payments-webhook`;

const mk = (key = PUB) => createClient(URL_, key, { auth: { persistSession: false, autoRefreshToken: false } });
const admin = mk(SVC);
const tag = randomUUID().slice(0, 8);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Json = Record<string, unknown>;
async function call(name: string, token: string | null, body?: unknown): Promise<{ status: number; body: Json }> {
  const headers: Record<string, string> = { "content-type": "application/json", apikey: PUB };
  if (token) headers.authorization = `Bearer ${token}`;
  const r = await fetch(`${FN}/${name}`, { method: "POST", headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text();
  let parsed: Json = {};
  try { parsed = JSON.parse(text) as Json; } catch { parsed = { raw: text }; }
  return { status: r.status, body: parsed };
}
async function ctl(path: string, body?: unknown): Promise<Json & Json[]> {
  const r = await fetch(`${FAKE}/__control/${path}`, { method: body === undefined ? "GET" : "POST", headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  return (await r.json()) as Json & Json[];
}
const calls = async () => (await ctl("calls")) as Record<string, number>;
async function order(id: string) {
  const { data, error } = await admin.from("payment_orders").select("*").eq("id", id).single();
  if (error) throw error;
  return data as Json;
}
/** Resultados de aplicação (event_type apply.*): o registro de entrega do webhook (recebido/duplicado) é outro assunto. */
async function events(id: string) {
  const { data } = await admin.from("payment_events").select("outcome").eq("order_id", id).like("event_type", "apply.%").order("id");
  return (data ?? []).map((x) => String(x.outcome));
}
async function plan(eventId: string) {
  const { data, error } = await admin.rpc("effective_entitlement", { p_event: eventId });
  if (error) throw error;
  return (data as Json[])[0]?.plan_code;
}
const CASAMENTO = 18900;
/** Cria pagamento no fake para o pedido (valor do pedido por padrão) e, por padrão, dispara o webhook assinado. */
const pay = (orderId: string, o: Json = {}) => ctl("pay", { externalReference: orderId, ...o });

let fake: { close: () => Promise<void> } | null = null;
let hostA: string, hostB: string, master: string, guest: string, hostAId: string;
let masterClient: SupabaseClient;
const events_: string[] = [];
const users: string[] = [];

async function newUser(kind: "a" | "b" | "m"): Promise<{ token: string; id: string; client: SupabaseClient }> {
  const email = `pay-${kind}-${tag}@memoriesmt.test`, password = `Pw-${tag}-x1`;
  const app_metadata = kind === "m" ? { role: "master" } : undefined;
  const c = await admin.auth.admin.createUser({ email, password, email_confirm: true, app_metadata });
  expect(c.error).toBeNull();
  users.push(c.data.user!.id);
  if (kind === "m") expect((await admin.from("platform_roles").insert({ user_id: c.data.user!.id, role: "master" })).error).toBeNull();
  const sb: SupabaseClient = mk();
  const s = await sb.auth.signInWithPassword({ email, password });
  expect(s.error).toBeNull();
  return { token: s.data.session!.access_token, id: c.data.user!.id, client: sb };
}
async function newEvent(): Promise<string> {
  const { data, error } = await admin.from("events").insert({
    title: `Pagamento ${tag}`, category: "festa", host_id: hostAId, host_name: "Ana", duration_hours: 6, capacity: 10, shots_per_person: 10,
    start_at: new Date().toISOString(),
  }).select("id").single();
  if (error) throw error;
  events_.push(data.id);
  return data.id as string;
}
async function checkout(eventId: string, planCode = "casamento", key = randomUUID(), token = hostA) {
  return call("payments-checkout", token, { eventId, planCode, idempotencyKey: key });
}
/** Evento + checkout; devolve ids. */
async function paidSetup() {
  const ev = await newEvent();
  const r = await checkout(ev);
  expect(r.status).toBe(200);
  return { ev, id: String(r.body.orderId) };
}
async function backdate(id: string, minutes: number) {
  const t = new Date(Date.now() - minutes * 60_000).toISOString();
  expect((await admin.from("payment_orders").update({ created_at: t, last_checked_at: t }).eq("id", id)).error).toBeNull();
}
const reconcile = () => fetch(`${FN}/payments-reconcile`, { method: "POST", headers: { authorization: `Bearer ${fnEnv.PAYMENTS_CRON_TOKEN}`, apikey: PUB } });
async function reconcileJson() {
  const r = await reconcile();
  return { status: r.status, body: (await r.json()) as Json };
}
async function waitFor<T>(fn: () => Promise<T>, ok: (v: T) => boolean, ms = 8000): Promise<T> {
  const end = Date.now() + ms;
  let v = await fn();
  while (!ok(v) && Date.now() < end) { await sleep(200); v = await fn(); }
  return v;
}
const askRefund = (client: SupabaseClient, orderId: string, paymentId: string | null, reason = "devolucao solicitada pelo cliente", amount: number | null = null) =>
  client.rpc("admin_request_payment_refund", { p_order: orderId, p_payment: paymentId, p_reason: reason, p_amount_cents: amount });

beforeAll(async () => {
  const probe = await fetch(`${FAKE}/__control/calls`).catch(() => null);
  if (!probe) fake = await startFakeMercadoPago({ port: FAKE_PORT, webhookUrl: WEBHOOK, webhookSecret: fnEnv.MERCADOPAGO_WEBHOOK_SECRET });
  await ctl("reset", {});
  expect((await admin.from("platform_settings").update({ value: "sandbox" }).eq("key", "payments_env")).error).toBeNull();
  const a = await newUser("a"), b = await newUser("b"), m = await newUser("m");
  hostA = a.token; hostAId = a.id; hostB = b.token; master = m.token; masterClient = m.client;
  const g = mk();
  const s = await g.auth.signInAnonymously();
  expect(s.error).toBeNull();
  guest = s.data.session!.access_token;
}, 60_000);

afterAll(async () => {
  if (events_.length) await admin.from("events").delete().in("id", events_);
  await admin.from("platform_settings").update({ value: "desligado" }).eq("key", "payments_env");
  for (const id of users) await admin.auth.admin.deleteUser(id);
  await fake?.close();
});

describe("payments-checkout (Preferences)", () => {
  it("cria pedido pendente com checkoutUrl, sem brCode; a preferência leva external_reference = pedido, expiração de 60 min e back_urls fixas", async () => {
    const ev = await newEvent();
    const r = await checkout(ev);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ status: "pendente", amountCents: CASAMENTO, provider: "mercadopago", paymentMethod: null });
    expect(Object.keys(r.body).sort()).toEqual(["amountCents", "checkoutUrl", "expiresAt", "orderId", "paymentMethod", "provider", "status"]);
    expect(String(r.body.checkoutUrl)).toMatch(/^https:\/\//);
    const mins = (Date.parse(String(r.body.expiresAt)) - Date.now()) / 60_000;
    expect(mins).toBeGreaterThan(58);
    expect(mins).toBeLessThanOrEqual(61);
    const pref = ((await ctl("preferences")) as Json[]).find((p) => p.external_reference === r.body.orderId)!;
    const b = pref.body as Json;
    expect(b).toMatchObject({ auto_return: "approved", expires: true, metadata: { order_id: r.body.orderId, event_id: ev, plan_code: "casamento" } });
    expect(b.notification_url).toBe(fnEnv.PAYMENTS_WEBHOOK_URL);
    const back = b.back_urls as Record<string, string>;
    for (const [k, v] of [["success", "sucesso"], ["pending", "pendente"], ["failure", "falha"]]) expect(back[k]).toBe(`https://newmemocuiaba.vercel.app/painel/${ev}/plano?retorno=${v}`);
    expect(((b.items as Json[])[0]).unit_price).toBe(189);
    expect(JSON.stringify(b)).not.toContain("@"); // nenhum dado pessoal vai ao provedor
  });

  it("mesma chave devolve o mesmo pedido e o fake recebeu 1 create; clique duplo concorrente também gera 1 create", async () => {
    const ev = await newEvent(), key = randomUUID();
    const before = (await calls()).create;
    const r1 = await checkout(ev, "casamento", key);
    const r2 = await checkout(ev, "casamento", key);
    expect(r2.body.orderId).toBe(r1.body.orderId);
    expect(r2.body.checkoutUrl).toBe(r1.body.checkoutUrl);
    expect((await calls()).create - before).toBe(1);
    const ev2 = await newEvent(), key2 = randomUUID();
    const b2 = (await calls()).create;
    const [a, b] = await Promise.all([checkout(ev2, "casamento", key2), checkout(ev2, "casamento", key2)]);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(a.body.orderId).toBe(b.body.orderId);
    expect(a.body.status).toBe("pendente");
    expect(b.body.status).toBe("pendente");
    expect((await calls()).create - b2).toBe(1);
  });

  it("outro plano com pedido aberto → 409; plano incluído → 422; anônimo e não-anfitrião → 403; desligado → 503", async () => {
    const ev = await newEvent();
    const r1 = await checkout(ev, "festa");
    expect(await checkout(ev, "casamento")).toEqual({ status: 409, body: { error: "pedido_aberto", orderId: r1.body.orderId } });
    expect(await checkout(await newEvent(), "gratis")).toEqual({ status: 422, body: { error: "ja_incluido" } });
    expect((await checkout(await newEvent(), "casamento", randomUUID(), guest)).status).toBe(403);
    expect((await checkout(await newEvent(), "casamento", randomUUID(), hostB)).status).toBe(403);
    const ev3 = await newEvent();
    await admin.from("platform_settings").update({ value: "desligado" }).eq("key", "payments_env");
    try {
      expect(await checkout(ev3)).toEqual({ status: 503, body: { error: "pagamento_indisponivel" } });
    } finally {
      await admin.from("platform_settings").update({ value: "sandbox" }).eq("key", "payments_env");
    }
  });

  it("provedor 500 → 502, pedido fica 'criado'; sem preferência por mais de 5 min a conciliação o falha e novo checkout é permitido", async () => {
    const ev = await newEvent();
    await ctl("config", { failCreate: 500 });
    let r: Awaited<ReturnType<typeof checkout>>;
    try { r = await checkout(ev); } finally { await ctl("config", { failCreate: null }); }
    expect(r.status).toBe(502);
    expect(r.body.error).toBe("provedor_indisponivel");
    const id = String(r.body.orderId);
    expect((await order(id)).status).toBe("criado");
    await backdate(id, 6);
    expect((await reconcile()).status).toBe(200);
    expect((await order(id)).status).toBe("falhou");
    const r2 = await checkout(ev);
    expect(r2.status).toBe(200);
    expect(r2.body.orderId).not.toBe(id);
  });

  it("timeout na criação da preferência (resultado desconhecido): 502, pedido 'criado'; a nova tentativa reusa o MESMO pedido e conclui", async () => {
    const ev = await newEvent(), key = randomUUID();
    await ctl("config", { createDelayMs: 9_500 });
    let r: Awaited<ReturnType<typeof checkout>>;
    try { r = await checkout(ev, "casamento", key); } finally { await ctl("config", { createDelayMs: 0 }); }
    expect(r.status).toBe(502);
    const id = String(r.body.orderId);
    expect((await order(id)).status).toBe("criado");
    const r2 = await checkout(ev, "casamento", key);
    expect(r2.status).toBe(200);
    expect(r2.body.orderId).toBe(id);
    expect(r2.body.status).toBe("pendente");
    expect((await order(id)).mp_preference_id).toBeTruthy();
  }, 40_000);
});

describe("payments-webhook", () => {
  it("pagamento aprovado + webhook assinado libera o plano; payments-status devolve o pedido pago", async () => {
    const { ev, id } = await paidSetup();
    const p = (await pay(id)) as Json;
    expect(p.status).toBe("approved");
    const o = await waitFor(() => order(id), (x) => x.status === "pago");
    expect(o).toMatchObject({ status: "pago", mp_payment_id: p.id, provider: "mercadopago" });
    expect(await plan(ev)).toBe("casamento");
    const d = ((await ctl("deliveries")) as Json[]).filter((x) => x.paymentId === p.id);
    expect(d.at(-1)?.status).toBe(200);
    const st = await call("payments-status", hostA, { orderId: id });
    expect(st.body).toMatchObject({ status: "pago", provider: "mercadopago", planCode: "casamento" });
  });

  it("assinatura inválida, ausente, vencida ou o antigo ?webhookSecret= → 401 e nada muda", async () => {
    const { id } = await paidSetup();
    const p = (await pay(id, { status: "approved", deliver: false })) as Json;
    for (const o of [{ secret: "outro-segredo" }, { sign: false }, { tsOffsetSec: -3600 }, { tsOffsetSec: 3600 }]) {
      expect(await ctl("webhook", { paymentId: p.id, ...o })).toMatchObject({ status: 401 });
    }
    const legacy = await fetch(`${WEBHOOK}?webhookSecret=${encodeURIComponent(fnEnv.MERCADOPAGO_WEBHOOK_SECRET)}&data.id=${p.id}&type=payment`, { method: "POST", body: JSON.stringify({ type: "payment", data: { id: p.id } }) });
    expect(legacy.status).toBe(401);
    expect((await order(id)).status).toBe("pendente");
    expect(await events(id)).toEqual([]);
  });

  it("notificação duplicada 3x mantém 1 direito e não regrava payment_events", async () => {
    const { ev, id } = await paidSetup();
    const p = (await pay(id)) as Json;
    await waitFor(() => order(id), (x) => x.status === "pago");
    const e1 = await events(id);
    for (let i = 0; i < 3; i++) expect(await ctl("webhook", { paymentId: p.id })).toMatchObject({ status: 200 });
    expect(await events(id)).toEqual(e1);
    const { data } = await admin.from("event_entitlements").select("id").eq("order_id", id);
    expect(data).toHaveLength(1);
    expect(await plan(ev)).toBe("casamento");
  });

  it("duas cobranças aprovadas para o mesmo pedido: a segunda é 'extra' + needs_refund; o vínculo e o direito não mudam", async () => {
    const { ev, id } = await paidSetup();
    const a = (await pay(id)) as Json;
    await waitFor(() => order(id), (x) => x.status === "pago");
    const b = (await pay(id)) as Json;
    const o = await waitFor(() => order(id), (x) => x.needs_refund === true);
    expect(o).toMatchObject({ status: "pago", mp_payment_id: a.id, needs_refund: true });
    expect(await events(id)).toContain("pagamento_duplicado");
    const { data } = await admin.from("payment_charges").select("payment_id,role").eq("order_id", id).order("id");
    expect(data).toEqual([{ payment_id: a.id, role: "primary" }, { payment_id: b.id, role: "extra" }]);
    expect(await plan(ev)).toBe("casamento");
  });

  it("valor, ambiente, recebedor e moeda divergentes não liberam plano (needs_refund, status mantido)", async () => {
    const cases: Array<[Json, string]> = [
      [{ amount: 1 }, "divergencia_valor"], [{ liveMode: true }, "divergencia_ambiente"],
      [{ collectorId: 12345 }, "divergencia_recebedor"], [{ currencyId: "USD" }, "divergencia_moeda"],
    ];
    for (const [o, outcome] of cases) {
      const { ev, id } = await paidSetup();
      await pay(id, o);
      const row = await waitFor(() => order(id), (x) => x.needs_refund === true);
      expect(row.status).toBe("pendente");
      expect(await events(id)).toContain(outcome);
      expect(await plan(ev)).toBe("gratis");
    }
  });

  it("rejeitado não muda o pedido; nova tentativa aprovada paga; pending (Pix gerado) mantém pendente", async () => {
    const { ev, id } = await paidSetup();
    await pay(id, { status: "rejected", method: "visa" });
    await pay(id, { status: "pending" });
    await sleep(500);
    expect((await order(id)).status).toBe("pendente");
    await pay(id);
    await waitFor(() => order(id), (x) => x.status === "pago");
    expect(await plan(ev)).toBe("casamento");
  });

  it("pagamento inexistente → 200 pagamento_inexistente; falha do provedor → 500 e a reentrega aplica", async () => {
    expect(await ctl("webhook", { paymentId: "999000111" })).toMatchObject({ status: 200 });
    const { id } = await paidSetup();
    const p = (await pay(id, { deliver: false })) as Json;
    await ctl("config", { failGet: 500 });
    try { expect(await ctl("webhook", { paymentId: p.id })).toMatchObject({ status: 500 }); } finally { await ctl("config", { failGet: null }); }
    expect((await order(id)).status).toBe("pendente");
    expect(await ctl("webhook", { paymentId: p.id })).toMatchObject({ status: 200 });
    expect((await order(id)).status).toBe("pago");
  });

  it("pedido desconhecido (external_reference sem pedido) → 200 sem efeito", async () => {
    const p = (await pay(randomUUID(), { amount: 189, deliver: false })) as Json;
    expect(await ctl("webhook", { paymentId: p.id })).toMatchObject({ status: 200 });
  });
});

describe("payments-reconcile e payments-status", () => {
  it("webhook perdido: a conciliação acha o pagamento por external_reference e paga; sem o token do agendador → 401", async () => {
    const { ev, id } = await paidSetup();
    await pay(id, { deliver: false });
    await backdate(id, 2);
    expect((await reconcile()).status).toBe(200);
    expect((await order(id)).status).toBe("pago");
    expect(await plan(ev)).toBe("casamento");
    const r = await fetch(`${FN}/payments-reconcile`, { method: "POST", headers: { apikey: PUB } });
    expect(r.status).toBe(401);
  });

  it("pedido com mais de 7 dias sai da varredura (PAY-004): pagamento perdido nele não é aplicado; reexecução não grava eventos", async () => {
    const { id } = await paidSetup();
    await pay(id, { deliver: false });
    await backdate(id, 8 * 24 * 60);
    expect((await reconcile()).status).toBe(200);
    expect((await order(id)).status).toBe("pendente");
    expect(await events(id)).toEqual([]);
  });

  it("pendente vencido expira; pagamento tardio ainda é reconhecido", async () => {
    const { ev, id } = await paidSetup();
    await admin.from("payment_orders").update({ expires_at: new Date(Date.now() - 10 * 60_000).toISOString() }).eq("id", id);
    expect((await reconcile()).status).toBe(200);
    expect((await order(id)).status).toBe("expirado");
    await pay(id);
    await waitFor(() => order(id), (x) => x.status === "pago");
    expect(await plan(ev)).toBe("casamento");
  });

  it("busca incompleta (teto de páginas) não falha o pedido 'criado' e é informada", async () => {
    const ev = await newEvent();
    await ctl("config", { failCreate: 500 });
    let r: Awaited<ReturnType<typeof checkout>>;
    try { r = await checkout(ev); } finally { await ctl("config", { failCreate: null }); }
    const id = String(r.body.orderId);
    for (let i = 0; i < 7; i++) await pay(id, { status: "pending", deliver: false });
    await backdate(id, 6);
    await ctl("config", { maxPageSize: 1 });
    let rc: Awaited<ReturnType<typeof reconcileJson>>;
    try { rc = await reconcileJson(); } finally { await ctl("config", { maxPageSize: 50 }); }
    expect(rc.status).toBe(200);
    expect(Number(rc.body.incompletos)).toBeGreaterThanOrEqual(1);
    expect((await order(id)).status).toBe("criado");
  });

  it("payments-status reconsulta o provedor quando o pedido está pendente há mais de 15 s; outro anfitrião → 404", async () => {
    const { id } = await paidSetup();
    await pay(id, { deliver: false });
    await backdate(id, 1);
    const st = await call("payments-status", hostA, { orderId: id });
    expect(st.body).toMatchObject({ status: "pago", provider: "mercadopago" });
    expect((await call("payments-status", hostB, { orderId: id })).status).toBe(404);
  });
});

describe("payments-refund", () => {
  async function paid() {
    const s = await paidSetup();
    const p = (await pay(s.id)) as Json;
    await waitFor(() => order(s.id), (x) => x.status === "pago");
    return { ...s, p };
  }

  it("total: solicitação + payments-refund + webhook 'refunded' → estornado e plano volta; repetir não reembolsa de novo", async () => {
    const { ev, id, p } = await paid();
    expect((await call("payments-refund", master, { orderId: id })).status).toBe(422); // sem solicitação gravada
    expect((await askRefund(masterClient, id, null)).error).toBeNull();
    const before = (await calls()).refund;
    const r = await call("payments-refund", master, { orderId: id });
    expect(r).toMatchObject({ status: 200, body: { ok: true, paymentId: p.id } });
    expect((await calls()).refund - before).toBe(1);
    await waitFor(() => order(id), (x) => x.status === "estornado");
    expect(await plan(ev)).toBe("gratis");
    expect((await call("payments-refund", master, { orderId: id })).status).toBe(200);
    expect((await calls()).refund - before).toBe(1);
  });

  it("parcial: o valor vai ao provedor em reais; o pedido segue pago com o direito", async () => {
    const { ev, id } = await paid();
    expect((await askRefund(masterClient, id, null, "devolucao parcial combinada", 1000)).error).toBeNull();
    expect((await call("payments-refund", master, { orderId: id })).status).toBe(200);
    const o = await waitFor(() => order(id), (x) => x.refunded_cents === 1000);
    expect(o).toMatchObject({ status: "pago", refunded_cents: 1000, refund_requested_at: null });
    expect(await plan(ev)).toBe("casamento");
  });

  it("Pix em processamento (in_process): o pedido segue pago até o webhook de 'refunded'", async () => {
    const { ev, id, p } = await paid();
    await ctl("config", { pixRefundInProcess: true });
    try {
      expect((await askRefund(masterClient, id, null)).error).toBeNull();
      expect((await call("payments-refund", master, { orderId: id })).body).toMatchObject({ ok: true, status: "in_process" });
    } finally { await ctl("config", { pixRefundInProcess: false }); }
    expect((await order(id)).status).toBe("pago");
    await ctl("settle-refund", { paymentId: p.id });
    await waitFor(() => order(id), (x) => x.status === "estornado");
    expect(await plan(ev)).toBe("gratis");
  });

  it("PAY-001: cobrança duplicada só é reembolsada por pedido explícito; o pagamento vinculado nunca é tocado", async () => {
    const { ev, id, p } = await paid();
    const dup = (await pay(id)) as Json;
    await waitFor(() => order(id), (x) => x.needs_refund === true);
    expect((await call("payments-refund", master, { orderId: id })).status).toBe(422); // padrão = vinculado, sem solicitação
    expect((await askRefund(masterClient, id, String(dup.id))).error).toBeNull();
    const before = ((await ctl("payments")) as Json[]).find((x) => x.id === p.id)!;
    const r = await call("payments-refund", master, { orderId: id, paymentId: dup.id });
    expect(r).toMatchObject({ status: 200, body: { paymentId: dup.id } });
    const all = (await ctl("payments")) as Json[];
    expect(all.find((x) => x.id === dup.id)).toMatchObject({ status: "refunded" });
    expect(all.find((x) => x.id === p.id)).toMatchObject({ status: "approved", transaction_amount_refunded: before.transaction_amount_refunded });
    const o = await waitFor(() => order(id), (x) => x.needs_refund === false);
    expect(o).toMatchObject({ status: "pago", mp_payment_id: p.id });
    expect(await plan(ev)).toBe("casamento");
  });

  it("não-Master → 403; reembolso de pagamento que não é aprovado no provedor é recusado (cobranca_nao_paga)", async () => {
    const { id, p } = await paid();
    expect((await call("payments-refund", hostA, { orderId: id })).status).toBe(403);
    expect((await askRefund(masterClient, id, null)).error).toBeNull();
    await ctl("status", { id: p.id, status: "cancelled", deliver: false });
    const before = (await calls()).refund;
    expect(await call("payments-refund", master, { orderId: id })).toMatchObject({ status: 422, body: { error: "cobranca_nao_paga" } });
    expect((await calls()).refund).toBe(before);
  });
});

describe("payments-diagnose", () => {
  it("Master recebe só metadados não secretos; não-Master → 403", async () => {
    const r = await call("payments-diagnose", master, {});
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ ok: true, paymentsEnv: "sandbox", account: { ok: true, accountId: "900001", siteId: "MLB", countryId: "BR" }, preferencesSearch: { ok: true } });
    expect(r.body.secrets).toEqual({ MERCADOPAGO_ACCESS_TOKEN: true, MERCADOPAGO_WEBHOOK_SECRET: true, PAYMENTS_CRON_TOKEN: true });
    const text = JSON.stringify(r.body);
    for (const v of [fnEnv.MERCADOPAGO_ACCESS_TOKEN, fnEnv.MERCADOPAGO_WEBHOOK_SECRET, fnEnv.PAYMENTS_CRON_TOKEN]) expect(text).not.toContain(v);
    expect((await call("payments-diagnose", hostA, {})).status).toBe(403);
  });
});
