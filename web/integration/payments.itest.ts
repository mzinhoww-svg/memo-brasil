// Integração das Edge Functions de pagamento: stack local + `supabase functions serve` + AbacatePay falsa (fixtures/fake-abacatepay.mjs).
// Precisa de SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_KEY e PAYMENTS_FUNCTIONS_ENV_FILE (o mesmo arquivo passado a
// `functions serve --env-file`, só com valores fictícios). A fake sobe neste processo na porta FAKE_ABACATEPAY_PORT do arquivo.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { signBody, startFakeAbacatePay } from "../e2e/fixtures/fake-abacatepay.mjs";

const URL_ = process.env.SUPABASE_URL!, PUB = process.env.SUPABASE_PUBLISHABLE_KEY!, SVC = process.env.SUPABASE_SERVICE_KEY!;
const ENV_FILE = process.env.PAYMENTS_FUNCTIONS_ENV_FILE!;
if (!URL_ || !PUB || !SVC || !ENV_FILE) throw new Error("defina SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_KEY e PAYMENTS_FUNCTIONS_ENV_FILE");
if (!/^https?:\/\/(127\.0\.0\.1|localhost)/.test(URL_)) throw new Error("recusado: alvo não é local");

const fnEnv: Record<string, string> = {};
for (const line of readFileSync(ENV_FILE, "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (m) fnEnv[m[1]] = m[2];
}
if (!fnEnv.ABACATEPAY_API_KEY?.startsWith("abc_dev_fake")) throw new Error("o arquivo de ambiente das funções deve ter só chave fictícia abc_dev_fake…");
const FAKE_PORT = Number(fnEnv.FAKE_ABACATEPAY_PORT || 56490);
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
const creates = async () => Number((await ctl("calls")).create);
async function order(id: string) {
  const { data, error } = await admin.from("payment_orders").select("*").eq("id", id).single();
  if (error) throw error;
  return data as Json;
}
async function waitFor<T>(fn: () => Promise<T>, ok: (v: T) => boolean, ms = 8000): Promise<T> {
  const end = Date.now() + ms;
  let v = await fn();
  while (!ok(v) && Date.now() < end) { await sleep(200); v = await fn(); }
  return v;
}
async function plan(eventId: string) {
  const { data, error } = await admin.rpc("effective_entitlement", { p_event: eventId });
  if (error) throw error;
  return (data as Json[])[0]?.plan_code;
}

// cobranças-isca mais novas: metadata.orderId de outro pedido (valor certo) e metadata deste pedido com valor ou ambiente
// errados. A fake omite externalId em create/get/list (como a doc garante), então a identidade vem só de metadata.orderId.
async function decoys(orderId: string) {
  const other = randomUUID();
  await ctl("charge", { externalId: other, metadata: { orderId: other }, amount: 18900 });
  await ctl("charge", { externalId: orderId, metadata: { orderId }, amount: 100 });
  await ctl("charge", { externalId: orderId, metadata: { orderId }, amount: 18900, devMode: false });
}

let fake: { close: () => Promise<void> } | null = null;
let hostA: string, hostB: string, master: string, guest: string, hostAId: string;
const events: string[] = [];
const users: string[] = [];

async function newUser(kind: "a" | "b" | "m"): Promise<{ token: string; id: string }> {
  const email = `pay-${kind}-${tag}@memoriesmt.test`, password = `Pw-${tag}-x1`;
  const app_metadata = kind === "m" ? { role: "master" } : undefined;
  const c = await admin.auth.admin.createUser({ email, password, email_confirm: true, app_metadata });
  expect(c.error).toBeNull();
  users.push(c.data.user!.id);
  if (kind === "m") expect((await admin.from("platform_roles").insert({ user_id: c.data.user!.id, role: "master" })).error).toBeNull();
  const sb: SupabaseClient = mk();
  const s = await sb.auth.signInWithPassword({ email, password });
  expect(s.error).toBeNull();
  return { token: s.data.session!.access_token, id: c.data.user!.id };
}
async function newEvent(): Promise<string> {
  const { data, error } = await admin.from("events").insert({
    title: `Pagamento ${tag}`, category: "festa", host_id: hostAId, host_name: "Ana", duration_hours: 6, capacity: 10, shots_per_person: 10,
    start_at: new Date().toISOString(),
  }).select("id").single();
  if (error) throw error;
  events.push(data.id);
  return data.id as string;
}
async function checkout(eventId: string, planCode = "casamento", key = randomUUID(), token = hostA) {
  return call("payments-checkout", token, { eventId, planCode, idempotencyKey: key });
}
async function backdate(id: string, minutes: number) {
  const t = new Date(Date.now() - minutes * 60_000).toISOString();
  expect((await admin.from("payment_orders").update({ created_at: t, last_checked_at: t }).eq("id", id)).error).toBeNull();
}
const reconcile = () => fetch(`${FN}/payments-reconcile`, { method: "POST", headers: { authorization: `Bearer ${fnEnv.PAYMENTS_CRON_TOKEN}`, apikey: PUB } });

beforeAll(async () => {
  const probe = await fetch(`${FAKE}/__control/calls`).catch(() => null);
  if (!probe) {
    fake = await startFakeAbacatePay({
      port: FAKE_PORT,
      webhookUrl: `${WEBHOOK}?webhookSecret=${encodeURIComponent(fnEnv.ABACATEPAY_WEBHOOK_SECRET)}`,
      hmacKey: fnEnv.ABACATEPAY_HMAC_KEY,
    });
  }
  await ctl("reset", {});
  expect((await admin.from("platform_settings").update({ value: "sandbox" }).eq("key", "payments_env")).error).toBeNull();
  const a = await newUser("a"), b = await newUser("b"), m = await newUser("m");
  hostA = a.token; hostAId = a.id; hostB = b.token; master = m.token;
  const g = mk();
  const s = await g.auth.signInAnonymously();
  expect(s.error).toBeNull();
  guest = s.data.session!.access_token;
}, 60_000);

afterAll(async () => {
  if (events.length) await admin.from("events").delete().in("id", events);
  await admin.from("platform_settings").update({ value: "desligado" }).eq("key", "payments_env");
  for (const id of users) await admin.auth.admin.deleteUser(id);
  await fake?.close();
});

describe("payments-checkout", () => {
  it("checkout cria pedido pendente com brCode e expiresAt ~30min", async () => {
    const ev = await newEvent();
    const r = await checkout(ev);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ status: "pendente", amountCents: 18900 });
    expect(Object.keys(r.body).sort()).toEqual(["amountCents", "brCode", "brCodeBase64", "expiresAt", "orderId", "status"]);
    expect(String(r.body.brCode)).toContain("FAKE");
    const mins = (Date.parse(String(r.body.expiresAt)) - Date.now()) / 60_000;
    expect(mins).toBeGreaterThan(28);
    expect(mins).toBeLessThanOrEqual(30.5);
    const charge = ((await ctl("charges")) as Json[]).find((c) => c.externalId === r.body.orderId)!;
    expect(charge.metadata).toEqual({ orderId: r.body.orderId, eventId: ev, planCode: "casamento", env: "sandbox" });
  });

  it("segundo checkout com a mesma chave devolve o mesmo pedido e o fake recebeu 1 create", async () => {
    const ev = await newEvent(), key = randomUUID();
    const before = await creates();
    const r1 = await checkout(ev, "casamento", key);
    const r2 = await checkout(ev, "casamento", key);
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(r2.body.orderId).toBe(r1.body.orderId);
    expect(r2.body.brCode).toBe(r1.body.brCode);
    expect((await creates()) - before).toBe(1);
  });

  it("clique duplo concorrente (Promise.all de 2 chamadas) gera 1 create", async () => {
    const ev = await newEvent(), key = randomUUID();
    const before = await creates();
    const [r1, r2] = await Promise.all([checkout(ev, "casamento", key), checkout(ev, "casamento", key)]);
    expect([r1.status, r2.status]).toEqual([200, 200]);
    expect(r1.body.orderId).toBe(r2.body.orderId);
    expect(r1.body.status).toBe("pendente");
    expect(r2.body.status).toBe("pendente");
    expect((await creates()) - before).toBe(1);
  });

  it("outro plano com Pix aberto → 409 pedido_aberto; plano já incluído → 422 ja_incluido", async () => {
    const ev = await newEvent();
    const r1 = await checkout(ev, "festa");
    const r2 = await checkout(ev, "casamento");
    expect(r2).toEqual({ status: 409, body: { error: "pedido_aberto", orderId: r1.body.orderId } });
    const r3 = await checkout(await newEvent(), "gratis");
    expect(r3).toEqual({ status: 422, body: { error: "ja_incluido" } });
  });

  it("convidado anônimo chama payments-checkout → 403", async () => {
    const ev = await newEvent();
    const r = await checkout(ev, "casamento", randomUUID(), guest);
    expect(r.status).toBe(403);
    expect((await admin.from("payment_orders").select("id").eq("event_id", ev)).data).toEqual([]);
  });

  it("organizador que não é o anfitrião → 403", async () => {
    const ev = await newEvent();
    expect((await checkout(ev, "casamento", randomUUID(), hostB)).status).toBe(403);
  });

  it("pagamentos desligados → 503 pagamento_indisponivel", async () => {
    const ev = await newEvent();
    await admin.from("platform_settings").update({ value: "desligado" }).eq("key", "payments_env");
    try {
      expect(await checkout(ev)).toEqual({ status: 503, body: { error: "pagamento_indisponivel" } });
    } finally {
      await admin.from("platform_settings").update({ value: "sandbox" }).eq("key", "payments_env");
    }
  });

  it("checkout com provedor 500 → 502 provedor_indisponivel, pedido criado vira falhou no reconcile, novo checkout permitido", async () => {
    const ev = await newEvent();
    await ctl("config", { failCreate: 500 });
    let r: Awaited<ReturnType<typeof checkout>>;
    try {
      r = await checkout(ev);
    } finally {
      await ctl("config", { failCreate: null });
    }
    expect(r.status).toBe(502);
    expect(r.body.error).toBe("provedor_indisponivel");
    const id = String(r.body.orderId);
    expect((await order(id)).status).toBe("criado");
    // cobranças mais novas de outros pedidos, e uma com o externalId certo mas valor errado: nenhuma pode ser adotada
    await decoys(id);
    await backdate(id, 6);
    const rc = await reconcile();
    expect(rc.status).toBe(200);
    const failed = await order(id);
    expect(failed.status).toBe("falhou");
    expect(failed.provider_charge_id).toBeNull();
    const r2 = await checkout(ev);
    expect(r2.status).toBe(200);
    expect(r2.body.status).toBe("pendente");
    expect(r2.body.orderId).not.toBe(id);
  });
});

describe("cobrança criada com a resposta perdida (create sem resposta)", () => {
  async function lostCreate() {
    const ev = await newEvent();
    await ctl("config", { failCreateAfterCreate: 500 });
    let r: Awaited<ReturnType<typeof checkout>>;
    try {
      r = await checkout(ev);
    } finally {
      await ctl("config", { failCreateAfterCreate: null });
    }
    expect(r.status).toBe(502);
    const id = String(r.body.orderId);
    const target = ((await ctl("charges")) as Json[]).find((c) => c.externalId === id)!;
    expect(target).toBeTruthy();
    expect((await order(id))).toMatchObject({ status: "criado", provider_charge_id: null });
    return { ev, id, target };
  }

  it("reconcile acha na página 2, entre cobranças mais novas de outros pedidos, só a exata — identidade só por metadata.orderId — e adota", async () => {
    const { id, target } = await lostCreate();
    await decoys(id);
    await backdate(id, 6);
    await ctl("config", { maxPageSize: 2 });
    const lists = Number((await ctl("calls")).list);
    try {
      expect((await reconcile()).status).toBe(200);
    } finally {
      await ctl("config", { maxPageSize: 100 });
    }
    expect(Number((await ctl("calls")).list) - lists).toBeGreaterThanOrEqual(2);
    const o = await order(id);
    expect(o.provider_charge_id).toBe(target.id);
    expect(o.status).toBe("pendente");
    expect(o.brcode).toBe(target.brCode);
  });

  it("webhook adota a cobrança de pedido 'criado' só após reconsultar (get, sem externalId: metadata.orderId) com valor exato", async () => {
    const { ev, id, target } = await lostCreate();
    await ctl("status", { id: target.id, status: "PAID" });
    const gets = Number((await ctl("calls")).get);
    expect(await ctl("webhook", { chargeId: target.id })).toMatchObject({ status: 200, body: { ok: true } });
    expect(Number((await ctl("calls")).get) - gets).toBeGreaterThanOrEqual(1);
    const o = await order(id);
    expect(o).toMatchObject({ status: "pago", provider_charge_id: target.id });
    expect(Date.parse(String(o.expires_at))).toBe(Date.parse(String(target.expiresAt)));
    expect(await plan(ev)).toBe("casamento");
  });

  it("webhook com cobrança que não confere (externalId do corpo ≠ provedor) → 200 cobranca_nao_confere, nada adotado", async () => {
    const { id } = await lostCreate();
    const other = randomUUID();
    const decoy = (await ctl("charge", { externalId: other, metadata: { orderId: other }, amount: 18900, status: "PAID" })) as Json;
    const eid = `log_fake_naoconfere_${tag}`;
    expect(await ctl("webhook", { chargeId: decoy.id, externalId: id, id: eid })).toMatchObject({ status: 200, body: { ok: true } });
    expect(await order(id)).toMatchObject({ status: "criado", provider_charge_id: null });
    const e = await admin.from("payment_events").select("outcome").eq("provider_event_id", eid).single();
    expect(e.data?.outcome).toBe("cobranca_nao_confere");
  });
});

describe("payments-webhook", () => {
  it("simulate-payment + webhook libera plano: effective_entitlement = casamento", async () => {
    const ev = await newEvent();
    const r = await checkout(ev);
    const id = String(r.body.orderId);
    const charge = String((await order(id)).provider_charge_id);
    const sim = await fetch(`${FAKE}/v2/transparents/simulate-payment?id=${charge}`, { method: "POST", headers: { authorization: `Bearer ${fnEnv.ABACATEPAY_API_KEY}` } });
    expect(sim.status).toBe(200);
    const d = ((await ctl("deliveries")) as Json[]).filter((x) => x.chargeId === charge);
    expect(d.at(-1)).toMatchObject({ status: 200, body: { ok: true } });
    expect((await order(id)).status).toBe("pago");
    expect(await plan(ev)).toBe("casamento");
    const st = await call("payments-status", hostA, { orderId: id });
    expect(st.status).toBe(200);
    expect(st.body).toMatchObject({ orderId: id, status: "pago", planCode: "casamento", amountCents: 18900 });
  });

  it("webhook repetido 3x mantém 1 direito", async () => {
    const ev = await newEvent();
    const id = String((await checkout(ev)).body.orderId);
    const charge = String((await order(id)).provider_charge_id);
    await ctl("status", { id: charge, status: "PAID" });
    const same = `log_fake_repeat_${tag}`;
    for (let i = 0; i < 3; i++) expect(await ctl("webhook", { chargeId: charge, id: same })).toMatchObject({ status: 200, body: { ok: true } });
    for (let i = 0; i < 3; i++) expect(await ctl("webhook", { chargeId: charge })).toMatchObject({ status: 200 }); // entregas novas, mesma cobrança
    expect((await order(id)).status).toBe("pago");
    const ents = await admin.from("event_entitlements").select("id").eq("order_id", id);
    expect(ents.data).toHaveLength(1);
    const evs = await admin.from("payment_events").select("id").eq("provider_event_id", same);
    expect(evs.data).toHaveLength(1);
  });

  it("webhook sem segredo → 401 e nada muda", async () => {
    const ev = await newEvent();
    const id = String((await checkout(ev)).body.orderId);
    const charge = String((await order(id)).provider_charge_id);
    await ctl("status", { id: charge, status: "PAID" });
    expect(await ctl("webhook", { chargeId: charge, secret: null })).toMatchObject({ status: 401 });
    expect(await ctl("webhook", { chargeId: charge, secret: "0".repeat(64) })).toMatchObject({ status: 401 });
    expect(await ctl("webhook", { chargeId: charge, sign: false })).toMatchObject({ status: 401 });
    // corpo adulterado com assinatura de outro corpo
    const raw = JSON.stringify({ id: "log_x", event: "transparent.completed", apiVersion: 2, devMode: true, data: { transparent: { id: charge, externalId: id } } });
    const bad = await fetch(`${WEBHOOK}?webhookSecret=${fnEnv.ABACATEPAY_WEBHOOK_SECRET}`, { method: "POST", headers: { "x-webhook-signature": signBody(fnEnv.ABACATEPAY_HMAC_KEY, raw + " ") }, body: raw });
    expect(bad.status).toBe(401);
    expect((await order(id)).status).toBe("pendente");
    expect(await plan(ev)).toBe("gratis");
    expect((await admin.from("payment_events").select("id").eq("provider_event_id", "log_x")).data).toEqual([]);
  });

  it("webhook com devMode divergente não libera", async () => {
    const ev = await newEvent();
    const id = String((await checkout(ev)).body.orderId);
    const charge = String((await order(id)).provider_charge_id);
    await ctl("status", { id: charge, status: "PAID" });
    const eid = `log_fake_prod_${tag}`;
    expect(await ctl("webhook", { chargeId: charge, devMode: false, id: eid })).toMatchObject({ status: 200, body: { ok: true } });
    expect((await order(id)).status).toBe("pendente");
    expect(await plan(ev)).toBe("gratis");
    const e = await admin.from("payment_events").select("outcome").eq("provider_event_id", eid).single();
    expect(e.data?.outcome).toBe("ambiente_divergente");
  });

  it("evento de pedido desconhecido → 200 pedido_desconhecido", async () => {
    const raw = JSON.stringify({ id: `log_unknown_${tag}`, event: "transparent.completed", apiVersion: 2, devMode: true,
      data: { transparent: { id: "pix_char_nao_existe", externalId: randomUUID(), status: "PAID", metadata: null } } });
    const r = await fetch(`${WEBHOOK}?webhookSecret=${fnEnv.ABACATEPAY_WEBHOOK_SECRET}`, { method: "POST", headers: { "x-webhook-signature": signBody(fnEnv.ABACATEPAY_HMAC_KEY, raw) }, body: raw });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true });
    const e = await admin.from("payment_events").select("outcome").eq("provider_event_id", `log_unknown_${tag}`).single();
    expect(e.data?.outcome).toBe("pedido_desconhecido");
  });
});

describe("payments-reconcile e payments-status", () => {
  it("webhook perdido: reconcile aplica pago", async () => {
    const ev = await newEvent();
    const id = String((await checkout(ev)).body.orderId);
    const charge = String((await order(id)).provider_charge_id);
    await ctl("config", { deliverWebhooks: false });
    try {
      await fetch(`${FAKE}/v2/transparents/simulate-payment?id=${charge}`, { method: "POST", headers: { authorization: `Bearer ${fnEnv.ABACATEPAY_API_KEY}` } });
    } finally {
      await ctl("config", { deliverWebhooks: true });
    }
    expect((await order(id)).status).toBe("pendente");
    await backdate(id, 2);
    const gets = Number((await ctl("calls")).get);
    const r = await reconcile();
    expect(r.status).toBe(200);
    const body = (await r.json()) as Json;
    expect(Object.keys(body).sort()).toEqual(["aplicados", "falhas", "verificados"]);
    expect(Number(body.verificados)).toBeGreaterThanOrEqual(1);
    expect(Number(body.aplicados)).toBeGreaterThanOrEqual(1);
    expect((await order(id)).status).toBe("pago");
    expect(await plan(ev)).toBe("casamento");
    // o check da fake não informa o valor (forma mínima documentada): o valor veio de GET /transparents/get
    expect(Number((await ctl("calls")).get) - gets).toBeGreaterThanOrEqual(1);
  });

  it("reconcile sem o token do agendador → 401", async () => {
    const r = await fetch(`${FN}/payments-reconcile`, { method: "POST", headers: { authorization: `Bearer ${SVC}`, apikey: PUB } });
    expect(r.status).toBe(401);
    const r2 = await fetch(`${FN}/payments-reconcile`, { method: "POST", headers: { apikey: PUB } });
    expect(r2.status).toBe(401);
  });

  it("payments-status reconsulta o provedor quando pendente há mais de 15 s", async () => {
    const ev = await newEvent();
    const id = String((await checkout(ev)).body.orderId);
    const charge = String((await order(id)).provider_charge_id);
    await ctl("status", { id: charge, status: "PAID" });
    const fresh = await call("payments-status", hostA, { orderId: id });
    expect(fresh.body.status).toBe("pendente"); // checado há < 15 s: não reconsulta
    await backdate(id, 1);
    const st = await call("payments-status", hostA, { orderId: id });
    expect(st.status).toBe(200);
    expect(st.body.status).toBe("pago");
    expect(Object.keys(st.body).sort()).toEqual(["amountCents", "brCode", "brCodeBase64", "expiresAt", "orderId", "paidAt", "planCode", "status"]);
  });

  it("organizador B não consulta pedido de A (payments-status → 404)", async () => {
    const ev = await newEvent();
    const id = String((await checkout(ev)).body.orderId);
    const r = await call("payments-status", hostB, { orderId: id });
    expect(r.status).toBe(404);
    expect(r.body).toEqual({ error: "nao_encontrado" });
    expect((await call("payments-status", hostA, { orderId: randomUUID() })).status).toBe(404);
  });
});

describe("payments-refund", () => {
  it("refund: admin_request_refund + payments-refund + webhook refunded → estornado", async () => {
    const ev = await newEvent();
    const id = String((await checkout(ev)).body.orderId);
    const charge = String((await order(id)).provider_charge_id);
    await fetch(`${FAKE}/v2/transparents/simulate-payment?id=${charge}`, { method: "POST", headers: { authorization: `Bearer ${fnEnv.ABACATEPAY_API_KEY}` } });
    expect((await order(id)).status).toBe("pago");

    // sem pedido de reembolso registrado: recusa
    expect((await call("payments-refund", master, { orderId: id })).status).toBe(422);
    // admin_request_refund é da Task 7: aqui o pedido de reembolso é gravado direto pelo service_role
    expect((await admin.from("payment_orders").update({ refund_requested_at: new Date().toISOString(), refund_reason: "Teste de integração do reembolso" }).eq("id", id)).error).toBeNull();

    expect((await call("payments-refund", hostA, { orderId: id })).status).toBe(403); // não é Master
    expect((await call("payments-refund", guest, { orderId: id })).status).toBe(403);
    const before = Number((await ctl("calls")).refund);
    const r = await call("payments-refund", master, { orderId: id });
    expect(r).toEqual({ status: 200, body: { ok: true } });
    expect(Number((await ctl("calls")).refund) - before).toBe(1);
    const o = await waitFor(() => order(id), (x) => x.status === "estornado");
    expect(o.status).toBe("estornado");
    const ent = await admin.from("event_entitlements").select("status").eq("order_id", id).single();
    expect(ent.data?.status).toBe("estornado");
    expect(await plan(ev)).toBe("gratis");

    // de novo: já estornado → 200 sem chamar o provedor
    expect(await call("payments-refund", master, { orderId: id })).toEqual({ status: 200, body: { ok: true } });
    expect(Number((await ctl("calls")).refund) - before).toBe(1);
  });
});
