// Integração contra um Supabase real (local por padrão). Lê as chaves do ambiente; nunca as grava.
//   SUPABASE_URL=http://127.0.0.1:55421 SUPABASE_PUBLISHABLE_KEY=... SUPABASE_SERVICE_KEY=... node --test integration/
// SUPABASE_SERVICE_KEY só é usada para criar usuários de teste e simular o relógio; em hipótese alguma contra produção.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL;
const PUB = process.env.SUPABASE_PUBLISHABLE_KEY;
const SVC = process.env.SUPABASE_SERVICE_KEY;
if (!URL || !PUB || !SVC) throw new Error("defina SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY e SUPABASE_SERVICE_KEY");
if (!/^https?:\/\/(127\.0\.0\.1|localhost)/.test(URL) && process.env.ALLOW_REMOTE_TEST !== "1") throw new Error("recusado: alvo não é local (use ALLOW_REMOTE_TEST=1 só em projeto de teste)");

const mk = (key = PUB) => createClient(URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
const admin = mk(SVC);
// JPEG mínimo válido (1x1)
const JPEG = Buffer.from("/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=", "base64");

const tag = randomUUID().slice(0, 8);
let host, g1, g2, g3, ev, code;
const waitFor = async (fn, ms = 6000) => { const t = Date.now(); while (Date.now() - t < ms) { const v = await fn(); if (v) return v; await new Promise((r) => setTimeout(r, 150)); } return undefined; };
const upload = (c, path, body = JPEG, type = "image/jpeg", opts = {}) => c.storage.from("event-photos").upload(path, body, { contentType: type, ...opts });

before(async () => {
  const email = `host-${tag}@memoriesmt.test`;
  const u = await admin.auth.admin.createUser({ email, password: `Pw-${tag}-x1`, email_confirm: true });
  assert.ifError(u.error);
  host = mk();
  assert.ifError((await host.auth.signInWithPassword({ email, password: `Pw-${tag}-x1` })).error);
  for (const n of ["g1", "g2", "g3"]) {
    const c = mk();
    const r = await c.auth.signInAnonymously();
    assert.ifError(r.error);
    if (n === "g1") g1 = c; else if (n === "g2") g2 = c; else g3 = c;
  }
  const hostId = (await host.auth.getUser()).data.user.id;
  const ins = await host.from("events").insert({ title: `Teste ${tag}`, category: "casamento", host_id: hostId, host_name: "Emy", duration_hours: 6, reveal_enabled: true, reveal_anchor: "fim", capacity: 2, shots_per_person: 2 }).select().single();
  assert.ifError(ins.error);
  ev = ins.data; code = ev.code;
});

after(async () => {
  if (ev) await admin.from("events").delete().eq("id", ev.id);
});

describe("Auth e papéis", () => {
  it("convidado anônimo não cria evento; organizador com conta cria", async () => {
    const hostId = (await g1.auth.getUser()).data.user.id;
    const r = await g1.from("events").insert({ title: "x", category: "casamento", host_id: hostId, duration_hours: 6 });
    assert.ok(r.error, "anônimo deveria ser negado");
    assert.equal(ev.reveal_status, "pendente");
  });
  it("revelação 'ao terminar' calculada no servidor", () => {
    assert.equal(Date.parse(ev.reveal_at) - Date.parse(ev.start_at), 6 * 3600_000);
  });
  it("prévia do convite só com os campos seguros; sem login não há prévia", async () => {
    const p = await g1.rpc("event_preview", { p_code: code });
    assert.ifError(p.error);
    assert.deepEqual(Object.keys(p.data).sort(), ["capacity", "category", "code", "eventFont", "full", "hostName", "palette", "place", "startAt", "status", "title"]);
    const anon = await mk().rpc("event_preview", { p_code: code });
    assert.ok(anon.error, "sem sessão deveria falhar");
  });
});

describe("Entrada, lotação e convites", () => {
  it("entra por código; lotação no servidor; código errado", async () => {
    assert.equal((await g1.rpc("join_event", { p_code: code, p_name: "Ana" })).data.role, "membro");
    assert.equal((await g2.rpc("join_event", { p_code: code, p_name: "Bia" })).data.role, "membro");
    const full = await g3.rpc("join_event", { p_code: code, p_name: "Caio" });
    assert.equal(full.error?.code, "MM003");
    const bad = await g3.rpc("join_event", { p_code: "ZZZZZZZZ", p_name: "Caio" });
    assert.equal(bad.error?.code, "MM005");
  });
  it("convite: token só em claro uma vez, uso limitado, revogação", async () => {
    await admin.from("events").update({ capacity: 10 }).eq("id", ev.id);
    const inv = await host.rpc("create_invitation", { p_event: ev.id, p_label: "Mesa 8", p_max_uses: 1 });
    assert.ifError(inv.error);
    const list = await host.from("invitations").select("*");
    assert.ok(list.data.every((i) => !("token" in i) && /^[0-9a-f]{64}$/.test(i.token_hash)));
    const guestList = await g3.from("invitations").select("*");
    assert.equal(guestList.data.length, 0, "convidado não lê convites");
    const ok = await g3.rpc("join_event", { p_code: code, p_name: "Caio", p_token: inv.data.token });
    assert.equal(ok.data?.role, "membro");
    const g4 = mk(); await g4.auth.signInAnonymously();
    const used = await g4.rpc("join_event", { p_code: code, p_name: "Duda", p_token: inv.data.token });
    assert.equal(used.error?.code, "MM007", "uso esgotado");
    await host.rpc("revoke_invitation", { p_invitation: inv.data.id });
  });
});

describe("Storage privado, upload e revelação", () => {
  let p1, p2;
  it("upload em duas fases; só o autor sobe no próprio caminho; MIME e tamanho; sem sobrescrever", async () => {
    p1 = randomUUID(); p2 = randomUUID();
    const b = await g1.rpc("begin_photo", { p_id: p1, p_event: ev.id, p_moment: "O sim" });
    assert.ifError(b.error);
    const path = b.data.storagePath;
    assert.equal((await upload(g2, path)).error ? "negado" : "ok", "negado", "outro convidado não sobe no caminho alheio");
    assert.equal((await upload(g1, path, Buffer.from("texto"), "text/plain")).error ? "negado" : "ok", "negado", "MIME fora da lista");
    assert.equal((await upload(g1, path, Buffer.alloc(8 * 1024 * 1024 + 10, 1))).error ? "negado" : "ok", "negado", "acima de 8 MiB");
    assert.equal((await upload(g1, `${ev.id}/${randomUUID()}`)).error ? "negado" : "ok", "negado", "caminho sem linha de foto");
    assert.ifError((await upload(g1, path)).error);
    assert.ok((await upload(g1, path)).error, "sem sobrescrever (upsert)");
    assert.ok((await g1.storage.from("event-photos").upload(path, JPEG, { contentType: "image/jpeg", upsert: true })).error, "upsert negado");
    assert.equal((await g1.rpc("finalize_photo", { p_id: p1 })).data.uploadStatus, "pronta");
    const b2 = await g2.rpc("begin_photo", { p_id: p2, p_event: ev.id });
    assert.ifError((await upload(g2, b2.data.storagePath)).error);
    assert.ifError((await g2.rpc("finalize_photo", { p_id: p2 })).error);
  });
  it("antes da revelação: convidado não lista, não baixa, não assina URL; organizador sim", async () => {
    const path1 = `${ev.id}/${p1}`;
    assert.ok((await g1.storage.from("event-photos").createSignedUrl(path1, 60)).error, "nem o autor assina antes da revelação");
    assert.ok((await g2.storage.from("event-photos").createSignedUrl(path1, 60)).error, "outro convidado não assina");
    assert.ok((await g2.storage.from("event-photos").download(path1)).error, "download direto negado");
    assert.equal((await g2.storage.from("event-photos").list(ev.id)).data.length, 0, "listagem do bucket vazia para o convidado");
    assert.equal((await g2.from("photos").select("id")).data.length, 0, "tabela photos vazia para o convidado");
    const signed = await host.storage.from("event-photos").createSignedUrl(path1, 60);
    assert.ifError(signed.error);
    const res = await fetch(signed.data.signedUrl);
    assert.equal(res.status, 200);
    assert.equal(Buffer.from(await res.arrayBuffer()).length, JPEG.length);
    assert.ok(!(await fetch(`${URL}/storage/v1/object/public/event-photos/${path1}`)).ok, "bucket não é público");
  });
  it("rolo: terceira foto recusada pelo servidor", async () => {
    await g1.rpc("begin_photo", { p_id: randomUUID(), p_event: ev.id });
    const third = await g1.rpc("begin_photo", { p_id: randomUUID(), p_event: ev.id });
    assert.equal(third.error?.code, "MM001");
  });
  it("revelação: a tarefa do servidor libera; reexecutar é idempotente; depois o convidado vê e assina", async () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    await admin.from("events").update({ start_at: new Date(Date.now() - 7 * 3600_000).toISOString(), reveal_at: past }).eq("id", ev.id);
    assert.equal((await admin.rpc("reveal_due_events")).data, 1);
    assert.equal((await admin.rpc("reveal_due_events")).data, 0);
    const seen = await g2.from("photos").select("id");
    assert.equal(seen.data.length, 2, "agora o convidado vê as duas fotos");
    const s = await g2.storage.from("event-photos").createSignedUrl(`${ev.id}/${p1}`, 60);
    assert.ifError(s.error);
    assert.equal((await fetch(s.data.signedUrl)).status, 200);
    const reopen = await host.from("events").update({ reveal_enabled: false }).eq("id", ev.id);
    assert.equal(reopen.error?.code, "MM008", "dono não reabre a revelação");
  });
  it("moderação: foto oculta some do convidado e do Storage; removida entra na fila de limpeza", async () => {
    assert.ifError((await host.from("photos").update({ status: "oculta" }).eq("id", p1)).error);
    assert.ok((await g2.storage.from("event-photos").createSignedUrl(`${ev.id}/${p1}`, 60)).error);
    assert.equal((await g2.from("photos").select("id").eq("id", p1)).data.length, 0);
    assert.ifError((await host.from("photos").update({ status: "removida" }).eq("id", p1)).error);
    const q = await admin.from("storage_purge_queue").select("path").eq("path", `${ev.id}/${p1}`);
    assert.equal(q.data.length, 1);
  });
});

describe("Realtime respeita a RLS", () => {
  it("o organizador recebe a foto publicada; convidado sem permissão não recebe antes da revelação", async () => {
    const e2 = await host.from("events").insert({ title: `RT ${tag}`, category: "outro", host_id: (await host.auth.getUser()).data.user.id, duration_hours: 6, reveal_enabled: true, reveal_anchor: "fim" }).select().single();
    assert.ifError(e2.error);
    const rtHost = [], rtGuest = [];
    const gA = mk(); await gA.auth.signInAnonymously();
    const gB = mk(); await gB.auth.signInAnonymously();
    await gA.rpc("join_event", { p_code: e2.data.code, p_name: "A" });
    await gB.rpc("join_event", { p_code: e2.data.code, p_name: "B" });
    const chH = host.channel(`h-${tag}`).on("postgres_changes", { event: "*", schema: "public", table: "photos", filter: `event_id=eq.${e2.data.id}` }, (m) => rtHost.push(m.eventType));
    const chG = gB.channel(`g-${tag}`).on("postgres_changes", { event: "*", schema: "public", table: "photos", filter: `event_id=eq.${e2.data.id}` }, (m) => rtGuest.push(m.eventType));
    await new Promise((res) => chH.subscribe((s) => s === "SUBSCRIBED" && res()));
    await new Promise((res) => chG.subscribe((s) => s === "SUBSCRIBED" && res()));
    // o remoto leva mais que o local para registrar a assinatura postgres_changes depois do SUBSCRIBED
    await new Promise((r) => setTimeout(r, Number(process.env.RT_SETTLE_MS ?? 3000)));
    const pid = randomUUID();
    const b = await gA.rpc("begin_photo", { p_id: pid, p_event: e2.data.id });
    assert.ifError((await upload(gA, b.data.storagePath)).error);
    assert.ifError((await gA.rpc("finalize_photo", { p_id: pid })).error);
    const got = await waitFor(() => rtHost.length > 0);
    assert.ok(got, "organizador deveria receber a mudança (a linha só fica visível na publicação)");
    await new Promise((r) => setTimeout(r, 1500));
    assert.equal(rtGuest.length, 0, "convidado não pode receber evento de foto bloqueada");
    await host.removeChannel(chH); await gB.removeChannel(chG);
    await admin.from("events").delete().eq("id", e2.data.id);
  });
});

describe("LGPD", () => {
  it("pedido de exclusão registrado; processamento anonimiza e não apaga fotos de outros", async () => {
    const uid = (await g2.auth.getUser()).data.user.id;
    assert.ifError((await g2.rpc("request_account_deletion")).error);
    assert.ok((await g2.rpc("process_account_deletion", { p_user: uid })).error, "cliente não processa exclusão");
    assert.ifError((await admin.rpc("process_account_deletion", { p_user: uid })).error);
    const rows = await admin.from("photos").select("author_id, author_name").eq("event_id", ev.id);
    assert.ok(rows.data.every((r) => r.author_id !== uid));
    assert.ok(rows.data.some((r) => r.author_name === "Participante removido"));
    assert.equal((await admin.from("events").select("id").eq("id", ev.id)).data.length, 1, "o evento do organizador segue");
  });
});
