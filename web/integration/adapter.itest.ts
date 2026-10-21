import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { assetUrl, currentAsset, uploadBrandAsset } from "@/features/studio/assets";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readEventScoped } from "@/features/access/read";
import { moderate } from "@/features/admin/service";
import { createEvent, setEndIn, updateSettings, type EventInput } from "@/features/events/service";
import { restoreDefaultTheme, saveTheme } from "@/features/events/theme";
import { PRESETS, type ThemeSpec } from "@/lib/event-theme/spec";
import { joinEvent } from "@/features/participants/service";
import { postPhoto } from "@/features/photos/service";
import { RepositoryError, type Repositories, type User } from "@/repositories";
import { createSupabaseRepositories, toRepositoryError } from "@/repositories/supabase";

const URL = process.env.SUPABASE_URL!, PUB = process.env.SUPABASE_PUBLISHABLE_KEY!, SVC = process.env.SUPABASE_SERVICE_KEY!;
if (!URL || !PUB || !SVC) throw new Error("defina SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY e SUPABASE_SERVICE_KEY");
if (!/^https?:\/\/(127\.0\.0\.1|localhost)/.test(URL) && process.env.ALLOW_REMOTE_TEST !== "1") throw new Error("recusado: alvo não é local");

const mk = (key = PUB) => createClient(URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
const admin = mk(SVC);
const JPEG = Buffer.from("/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=", "base64");
const img = { bytes: JPEG.buffer.slice(JPEG.byteOffset, JPEG.byteOffset + JPEG.byteLength) as ArrayBuffer, type: "image/jpeg" };
const tag = randomUUID().slice(0, 8);
const input: EventInput = {
  title: `Adapter ${tag}`, category: "casamento", durationHours: 6, reveal: { enabled: true, kind: "ao-terminar", days: 1, date: "", time: "", timezone: "UTC" }, cameraStyle: "original",
  capacity: 5, shotsPerPerson: 1 as unknown as 5 /* o servidor aceita 1..1000; o domínio local só oferece 5+ */, everyoneSeesAll: true, palette: "salvia", eventFont: "birthstone",
};

let hostSb: SupabaseClient, guestSb: SupabaseClient, strangerSb: SupabaseClient;
let host: Repositories, guest: Repositories, stranger: Repositories;
let hostUser: User, guestUser: User, strangerUser: User;
let eventId: string, code: string;
const NOW = () => Date.now();

beforeAll(async () => {
  const email = `ad-${tag}@memoriesmt.test`;
  expect((await admin.auth.admin.createUser({ email, password: `Pw-${tag}-x1`, email_confirm: true })).error).toBeNull();
  hostSb = mk(); expect((await hostSb.auth.signInWithPassword({ email, password: `Pw-${tag}-x1` })).error).toBeNull();
  guestSb = mk(); expect((await guestSb.auth.signInAnonymously()).error).toBeNull();
  strangerSb = mk(); expect((await strangerSb.auth.signInAnonymously()).error).toBeNull();
  [host, guest, stranger] = [createSupabaseRepositories(hostSb), createSupabaseRepositories(guestSb), createSupabaseRepositories(strangerSb)];
  const me = async (r: Repositories, name: string) => ({ ...(await r.users.current())!, name }) as User;
  hostUser = await me(host, "Emy"); guestUser = await me(guest, "Ana"); strangerUser = await me(stranger, "Zed");
  await host.users.save(hostUser); await guest.users.save(guestUser);
});
afterAll(async () => { if (eventId) await admin.from("events").delete().eq("id", eventId); });

describe("adaptador Supabase atrás do contrato de repositório", () => {
  it("createEvent: o repositório devolve o evento gravado (código e versão do servidor)", async () => {
    const r = await createEvent(host, hostUser, input, NOW());
    if (!r.ok) throw new Error(JSON.stringify(r.errors));
    expect(r.event.code).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/);
    expect(r.event).toMatchObject({ hostId: hostUser.id, version: 1, revealAnchor: "fim" });
    ({ id: eventId, code } = r.event);
    expect((await host.events.getByCode(code))?.id).toBe(eventId);
  });
  it("concorrência otimista e not-found vêm do servidor", async () => {
    const e = (await host.events.get(eventId))!;
    const [a, b] = await Promise.all([updateSettings(host, eventId, { title: "A" }), updateSettings(host, eventId, { place: "Salão" })]);
    expect(a.ok && b.ok).toBe(true);
    const now = (await host.events.get(eventId))!;
    expect(now).toMatchObject({ title: "A", place: "Salão" }); // nenhuma perda (retry em conflito)
    await expect(host.events.save({ ...e, title: "velho" }, { expectedVersion: e.version })).rejects.toMatchObject({ code: "conflict" });
    const ext = await setEndIn(host, eventId, 30, NOW());
    expect(ext.ok && ext.event.revealAt).toBe(ext.ok ? ext.event.startAt + ext.event.durationHours * 3_600_000 : null); // servidor recalcula a revelação (BG-101)
  });
  it("convite: não-membro só recebe a prévia (RPC) e não enxerga o evento", async () => {
    expect(await stranger.events.getByCode(code)).toBeUndefined();
    const v = await readEventScoped(stranger, { code }, { userId: strangerUser.id, role: "convidado" }, NOW());
    expect(v.access).toBe("convite");
    expect(v.event).toBeUndefined();
    expect(v.preview).toMatchObject({ code, hostName: "Emy", full: false });
  });
  it("entrada pelo serviço usa a RPC e traduz recusas", async () => {
    const j = await joinEvent(guest, guestUser, code, "Ana", NOW());
    expect(j.ok).toBe(true);
    expect(await joinEvent(stranger, strangerUser, "ZZZZZZZZ", "Zed", NOW())).toEqual({ ok: false, reason: "codigo" });
    expect(await joinEvent(stranger, strangerUser, code, "  ", NOW())).toEqual({ ok: false, reason: "nome" });
  });
  it("postar: envio em duas fases; rolo cheio vira 'rolo'; antes da revelação o convidado não recebe fotos, só contagens", async () => {
    const ev = (await guest.events.getByCode(code))!;
    const p = await postPhoto(guest, ev, guestUser, img, { moment: "O sim" }, NOW());
    expect(p.ok).toBe(true);
    expect(await postPhoto(guest, ev, guestUser, img, { moment: "O sim" }, NOW())).toEqual({ ok: false, reason: "rolo" }); // rolo=1: recusa do servidor ou do domínio
    const g = await readEventScoped(guest, { code }, { userId: guestUser.id, role: "convidado" }, NOW());
    expect(g).toMatchObject({ access: "membro", photos: [], reactions: [], counts: { mine: 1, total: 1 } });
    const h = await readEventScoped(host, { id: eventId }, { userId: hostUser.id, role: "organizador" }, NOW());
    expect(h.access).toBe("organizador");
    expect(h.photos).toHaveLength(1);
    expect(await guest.photos.getUrl(h.photos[0].id, "full")).toBeUndefined(); // arquivo bloqueado
    expect(await guest.photos.getData(h.photos[0].id)).toBeUndefined();
    const url = await host.photos.getUrl(h.photos[0].id, "thumb");
    expect(url && (await fetch(url.url)).status).toBe(200);
  });
  it("depois da revelação do servidor o convidado vê a foto e baixa o arquivo; moderação com versão", async () => {
    // simula o tempo passando: início 7 h atrás e duração 1 h (a âncora "fim" faz o servidor recalcular reveal_at = fim, já vencido)
    await admin.from("events").update({ start_at: new Date(Date.now() - 7 * 3600_000).toISOString(), duration_hours: 1 }).eq("id", eventId);
    expect((await admin.rpc("reveal_due_events")).data).toBeGreaterThanOrEqual(1);
    const g = await readEventScoped(guest, { code }, { userId: guestUser.id, role: "convidado" }, NOW());
    expect(g.photos).toHaveLength(1);
    const u = await guest.photos.getUrl(g.photos[0].id, "full");
    expect(u && (await fetch(u.url)).status).toBe(200);
    expect((await guest.photos.getData(g.photos[0].id))?.bytes.byteLength).toBe(JPEG.length);
    const hidden = await moderate(host, g.photos[0].id, "ocultar");
    expect(hidden?.status).toBe("oculta");
    expect((await readEventScoped(guest, { code }, { userId: guestUser.id, role: "convidado" }, NOW())).photos).toHaveLength(0);
    await expect(host.photos.update({ ...g.photos[0], status: "visivel" }, { expectedVersion: 1 })).rejects.toMatchObject({ code: "conflict" });
  });
  it("revelação já ocorrida: o servidor recusa reabrir e o erro chega tipado", async () => {
    const e = (await host.events.get(eventId))!;
    await expect(host.events.save({ ...e, revealEnabled: false }, { expectedVersion: e.version })).rejects.toMatchObject({ code: "reveal-locked" });
  });
  it("evento apagado: leitura some e save versionado vira not-found", async () => {
    const e = (await host.events.get(eventId))!;
    await host.events.remove(eventId);
    expect(await host.events.get(eventId)).toBeUndefined();
    await expect(host.events.save({ ...e, title: "x" }, { expectedVersion: e.version + 1 })).rejects.toBeInstanceOf(RepositoryError);
  });
  it("tradução de erros", () => {
    expect(toRepositoryError({ code: "MM001" }).code).toBe("shot-limit");
    expect(toRepositoryError({ code: "42501" }).code).toBe("forbidden");
    expect(toRepositoryError({ statusCode: "403" }).code).toBe("forbidden");
    expect(toRepositoryError(new TypeError("fetch failed")).code).toBe("unavailable");
  });

  describe("Event Theme (event_themes)", () => {
    // evento próprio: o principal já foi revelado/bloqueado pelos testes anteriores
    let tEvent = "", tCode = "";
    beforeAll(async () => {
      const r = await createEvent(host, hostUser, { ...input, title: `Tema ${tag}`, capacity: 5, shotsPerPerson: 5 }, NOW());
      if (!r.ok) throw new Error("setup tema");
      tEvent = r.event.id; tCode = r.event.code;
      await joinEvent(guest, guestUser, tCode, "Ana", NOW());
    });
    afterAll(async () => { if (tEvent) await admin.from("events").delete().eq("id", tEvent); });
    const oceano: ThemeSpec = { preset: "oceano", colors: { ...PRESETS.oceano.dia }, font: "pinyon", welcomeMessage: "Que bom ter você!", qrStyle: "pontos" };
    it("host grava o tema; o convidado vê na prévia e o estranho sem entrar também (só campos de tema)", async () => {
      const r = await saveTheme(host, tEvent, oceano, NOW());
      expect(r.ok && r.event.theme).toMatchObject({ preset: "oceano", font: "pinyon", welcomeMessage: "Que bom ter você!", qrStyle: "pontos" });
      expect((await host.events.get(tEvent))?.theme?.colors.superficie).toBe(PRESETS.oceano.dia.superficie);
      const prev = await stranger.events.preview(tCode, NOW());
      expect(prev?.theme).toMatchObject({ preset: "oceano", qrStyle: "pontos" });
    });
    it("convidado membro não grava tema (RLS) e tema sem contraste é recusado pelo banco", async () => {
      const bad = { ...oceano, colors: { ...oceano.colors, texto: "#EEEEEE" } };
      const e = (await guest.events.get(tEvent))!;
      await expect(guest.events.save({ ...e, theme: oceano })).rejects.toBeInstanceOf(RepositoryError);
      const h = (await host.events.get(tEvent))!;
      await expect(host.events.save({ ...h, theme: bad })).rejects.toBeInstanceOf(RepositoryError);
      expect((await host.events.get(tEvent))?.theme?.preset).toBe("oceano");
    });
    it("logo e capa: o servidor valida o ARQUIVO REAL (assinatura, tipo, dimensões); membro assina a URL, estranho não", async () => {
      const png = fs.readFileSync(path.resolve(__dirname, "../public/pwa/icon-192.png"));
      const file = (type = "image/png", body: Buffer | string = png) => new File([body as BlobPart], "x", { type });
      const JPEG1 = Buffer.from("/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=", "base64");
      // dimensões declaradas FALSAS (100x100): o servidor grava as reais (192x192)
      const a = await uploadBrandAsset(hostSb, tEvent, "logo", file(), { width: 100, height: 100 });
      const row = await admin.from("event_assets").select("width,height,mime,upload_status").eq("id", a.id).single();
      expect(row.data).toMatchObject({ width: 192, height: 192, mime: "image/png", upload_status: "pronta" });
      expect((await currentAsset(hostSb, tEvent, "logo"))?.id).toBe(a.id);
      expect(await assetUrl(guestSb, a)).toMatch(/^http/); // membro do evento
      expect(await assetUrl(strangerSb, a)).toBeUndefined(); // quem não entrou
      // arquivos hostis com Content-Type de imagem
      const antes = (await admin.from("event_assets").select("id").eq("event_id", tEvent)).data!.length;
      await expect(uploadBrandAsset(hostSb, tEvent, "cover", file("image/png", "<html><script>alert(1)</script></html>"), { width: 400, height: 300 })).rejects.toThrow(/não é uma imagem/);
      await expect(uploadBrandAsset(hostSb, tEvent, "cover", file("image/png", "GIF89a\x01\x00\x01\x00"), { width: 400, height: 300 })).rejects.toThrow(/não é uma imagem/);
      await expect(uploadBrandAsset(hostSb, tEvent, "cover", file("image/png", JPEG1), { width: 400, height: 300 })).rejects.toThrow(/não confere|dimensões|PNG/); // JPEG declarado como PNG (e 1x1)
      await expect(uploadBrandAsset(hostSb, tEvent, "cover", file("image/svg+xml", "<svg xmlns='http://www.w3.org/2000/svg'/>"), { width: 400, height: 300 })).rejects.toThrow(/PNG, JPEG ou WebP/);
      expect((await admin.from("event_assets").select("id").eq("event_id", tEvent)).data).toHaveLength(antes); // nenhuma linha órfã
      const objs = await admin.storage.from("event-branding").list(tEvent);
      expect((objs.data ?? []).filter((o) => o.name !== a.storagePath.split("/")[1])).toHaveLength(0); // nenhum objeto órfão
      // quem não é o host não finaliza nem aciona a função; anônimo é recusado
      const mine = crypto.randomUUID();
      expect((await hostSb.rpc("begin_asset", { p_id: mine, p_event: tEvent, p_kind: "cover", p_mime: "image/png", p_width: 192, p_height: 192 })).error).toBeNull();
      const byGuest = await guestSb.functions.invoke("finalize-asset", { body: { assetId: mine } });
      expect(byGuest.error).toBeTruthy();
      const viaRpc = await hostSb.rpc("finalize_asset", { p_id: mine });
      expect(viaRpc.error?.code).toBe("42501"); // o cliente não finaliza por RPC
      await hostSb.rpc("discard_asset", { p_id: mine });
      // substituir: o ativo anterior some
      const dup = await uploadBrandAsset(hostSb, tEvent, "logo", file(), { width: 192, height: 192 });
      expect(dup.id).not.toBe(a.id);
      const { data } = await admin.from("event_assets").select("id").eq("event_id", tEvent).eq("kind", "logo");
      expect(data).toHaveLength(1);
    });
    it("Edge Function: CORS só para origem permitida na resposta real e sem vazar texto do banco", async () => {
      const token = (await hostSb.auth.getSession()).data.session!.access_token;
      const call = (origin: string, assetId: string) => fetch(`${URL}/functions/v1/finalize-asset`, { method: "POST", headers: { authorization: `Bearer ${token}`, apikey: PUB, "content-type": "application/json", origin }, body: JSON.stringify({ assetId }) });
      // o gateway LOCAL do Supabase pode responder com `*`; em produção a função é a única fonte (origem restrita, testada em src/lib/cors.test.ts)
      const ok = await call("https://newmemocuiaba.vercel.app", crypto.randomUUID());
      expect(ok.status).toBe(403);
      expect(["*", "https://newmemocuiaba.vercel.app"]).toContain(ok.headers.get("access-control-allow-origin"));
      const evil = await call("https://evil.example", crypto.randomUUID());
      expect(evil.headers.get("access-control-allow-origin")).not.toBe("https://evil.example"); // a função nunca ecoa origem fora da lista
      expect(await ok.text()).not.toMatch(/MM00|postgres/i); // sem texto de erro do banco
    });
    it("restaurar o padrão apaga a linha; salvar outras configurações não mexe no tema", async () => {
      const r = await restoreDefaultTheme(host, tEvent, NOW());
      expect(r.ok && r.event.theme).toBeUndefined();
      expect((await host.events.get(tEvent))?.theme).toBeUndefined();
      await saveTheme(host, tEvent, oceano, NOW());
      const u = await updateSettings(host, tEvent, { place: "Salão" });
      expect(u.ok && u.event.theme?.preset).toBe("oceano");
    });
  });
});
