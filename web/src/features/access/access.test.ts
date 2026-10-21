import { beforeEach, describe, expect, it } from "vitest";
import type { Actor } from "@/domain/roles";
import { createMemoryRepositories, type Repositories, type User } from "@/repositories";
import { moderate } from "../admin/service";
import { createEvent, reconcileReveal, updateSettings, type EventInput } from "../events/service";
import { joinEvent } from "../participants/service";
import { expirePending, postPhoto, react } from "../photos/service";
import { readEventScoped, readPhotoData } from "./read";

const NOW = 1_800_000_000_000;
const host: User = { id: "host", name: "Emy", createdAt: 1 };
const ana: User = { id: "ana", name: "Ana", createdAt: 1 };
const bia: User = { id: "bia", name: "Bia", createdAt: 1 };
const img = (n: number) => ({ bytes: new Uint8Array([n]).buffer, type: "image/jpeg" });
const input: EventInput = {
  title: "Emy e Igor", category: "casamento", durationHours: 6, reveal: { enabled: true, kind: "ao-terminar", days: 1, date: "", time: "", timezone: "UTC" }, cameraStyle: "original",
  capacity: 10, shotsPerPerson: 5, everyoneSeesAll: true, palette: "salvia", eventFont: "birthstone",
};
const asHost = (u: User): Actor => ({ userId: u.id, role: "organizador" });
const asGuest = (u: User | null): Actor => ({ userId: u?.id ?? null, role: "convidado" });

let repos: Repositories;
let code: string, id: string, revealAt: number;
let anaPhoto: string, biaPhoto: string, hiddenPhoto: string, removedPhoto: string;
beforeEach(async () => {
  repos = createMemoryRepositories();
  const r = await createEvent(repos, host, input, NOW);
  if (!r.ok) throw new Error();
  ({ code, id } = r.event); revealAt = r.event.revealAt!;
  await joinEvent(repos, ana, code, "Ana", NOW + 1);
  await joinEvent(repos, bia, code, "Bia", NOW + 2);
  const post = async (u: User, n: number) => { const p = await postPhoto(repos, r.event, u, img(n), { moment: "O sim" }, NOW + 10 + n); if (!p.ok) throw new Error(); return p.photo.id; };
  anaPhoto = await post(ana, 1); biaPhoto = await post(bia, 2); hiddenPhoto = await post(bia, 3); removedPhoto = await post(bia, 4);
  await moderate(repos, hiddenPhoto, "ocultar"); await moderate(repos, removedPhoto, "remover");
});

describe("ITG-101: leitura escopada por papel", () => {
  it("convidado antes da revelação não recebe foto nenhuma, nem as próprias, nem reações", async () => {
    await react(repos, (await repos.events.get(id))!, anaPhoto, bia.id, "amei");
    const v = await readEventScoped(repos, { code }, asGuest(ana), NOW + 20 * 60_000);
    expect(v.access).toBe("membro");
    expect(v.photos).toEqual([]);
    expect(v.reactions).toEqual([]);
  });
  it("o rolo funciona sem expor fotos: contagens (as minhas e o total) chegam mesmo antes da revelação", async () => {
    const v = await readEventScoped(repos, { code }, asGuest(ana), NOW + 20 * 60_000);
    expect(v.photos).toEqual([]);
    expect(v.counts).toEqual({ mine: 1, total: 2 }); // total do convidado: só as visíveis (ana 1 + bia 1)
    expect((await readEventScoped(repos, { code }, asGuest(bia), NOW + 20 * 60_000)).counts).toEqual({ mine: 2, total: 2 });
    expect((await readEventScoped(repos, { code }, asGuest(null), NOW)).counts).toEqual({ mine: 0, total: 0 }); // convite não conta nada
  });
  it("o organizador vê todas as fotos não removidas (moderação), inclusive ocultas e antes da revelação", async () => {
    const v = await readEventScoped(repos, { id }, asHost(host), NOW + 20 * 60_000);
    expect(v.access).toBe("organizador");
    expect(v.photos.map((p) => p.id).sort()).toEqual([anaPhoto, biaPhoto, hiddenPhoto].sort());
    expect(v.participants).toHaveLength(2);
  });
  it("depois da revelação o convidado vê as visíveis; nunca as ocultas nem as removidas", async () => {
    const ev = (await reconcileReveal(repos, id, revealAt + 1))!;
    expect(ev.revealStatus).toBe("revelada");
    await react(repos, ev, anaPhoto, bia.id, "amei");
    await react(repos, ev, hiddenPhoto, bia.id, "uau");
    const v = await readEventScoped(repos, { code }, asGuest(ana), revealAt + 1);
    expect(v.photos.map((p) => p.id).sort()).toEqual([anaPhoto, biaPhoto].sort());
    expect(v.reactions.map((r) => r.photoId)).toEqual([anaPhoto]); // reação em foto oculta não vaza
  });
  it("com 'todos veem tudo' desligado, o convidado só recebe as próprias fotos", async () => {
    await updateSettings(repos, id, { everyoneSeesAll: false });
    await reconcileReveal(repos, id, revealAt + 1);
    const v = await readEventScoped(repos, { code }, asGuest(ana), revealAt + 1);
    expect(v.photos.map((p) => p.id)).toEqual([anaPhoto]);
  });
  it("quem não entrou no evento recebe só a prévia do convite: sem evento completo, participantes, fotos ou reações", async () => {
    const v = await readEventScoped(repos, { code }, asGuest(null), revealAt + 1);
    expect(v.access).toBe("convite");
    expect(v.event).toBeUndefined();
    expect(v.photos).toEqual([]); expect(v.participants).toEqual([]); expect(v.reactions).toEqual([]);
    expect(v.preview).toMatchObject({ code, title: "Emy e Igor", hostName: "Emy", full: false });
    expect(Object.keys(v.preview!).sort()).toEqual(["capacity", "category", "code", "eventFont", "full", "hostName", "palette", "place", "startAt", "status", "title"].sort());
  });
  it("com tema personalizado a prévia ganha só a chave theme, sem expor nada além", async () => {
    const { PRESETS } = await import("@/lib/event-theme/spec");
    const { saveTheme } = await import("@/features/events/theme");
    await saveTheme(repos, id, { preset: "oceano", colors: { ...PRESETS.oceano.dia }, font: "vibes", welcomeMessage: "Oi!", qrStyle: "arredondado" }, NOW);
    const v = await readEventScoped(repos, { code }, asGuest(null), NOW + 1);
    expect(Object.keys(v.preview!).sort()).toEqual(["capacity", "category", "code", "eventFont", "full", "hostName", "palette", "place", "startAt", "status", "theme", "title"].sort());
  });
  it("preview indica lotação sem listar quem está dentro", async () => {
    await updateSettings(repos, id, { capacity: 5 });
    for (let i = 0; i < 3; i++) await joinEvent(repos, { id: `x${i}`, name: `X${i}`, createdAt: 1 }, code, `X${i}`, NOW + 3);
    const v = await readEventScoped(repos, { code }, asGuest(null), NOW + 5);
    expect(v.preview!.full).toBe(true);
  });
  it("organizador de outro evento e pessoa que não entrou não ganham acesso", async () => {
    const outro = await createEvent(repos, { id: "h2", name: "Outro", createdAt: 1 }, input, NOW);
    if (!outro.ok) throw new Error();
    expect((await readEventScoped(repos, { id }, asHost({ id: "h2", name: "", createdAt: 1 }), NOW)).access).toBe("convite");
    expect((await readEventScoped(repos, { code }, asGuest({ id: "zed", name: "Zed", createdAt: 1 }), NOW)).access).toBe("convite");
  });
  it("evento inexistente", async () => {
    expect((await readEventScoped(repos, { code: "ZZZZZZZZ" }, asGuest(ana), NOW)).access).toBe("inexistente");
  });
});

describe("ITG-101: bytes da foto passam pela mesma regra", () => {
  it("foto bloqueada (antes da revelação, oculta, removida, de outro evento) não devolve bytes; liberada devolve", async () => {
    const ev = (await repos.events.get(id))!;
    expect(await readPhotoData(repos, asGuest(ana), ev, anaPhoto, NOW + 60_000)).toBeUndefined(); // antes da revelação, nem a própria
    expect(await readPhotoData(repos, asHost(host), ev, anaPhoto, NOW + 60_000)).toBeDefined(); // organizador modera
    const rev = (await reconcileReveal(repos, id, revealAt + 1))!;
    expect(await readPhotoData(repos, asGuest(ana), rev, biaPhoto, revealAt + 1)).toBeDefined();
    expect(await readPhotoData(repos, asGuest(ana), rev, hiddenPhoto, revealAt + 1)).toBeUndefined();
    expect(await readPhotoData(repos, asGuest(ana), rev, removedPhoto, revealAt + 1)).toBeUndefined();
    expect(await readPhotoData(repos, asGuest(null), rev, biaPhoto, revealAt + 1)).toBeUndefined(); // sem entrar
    expect(await readPhotoData(repos, asGuest(ana), rev, "inexistente", revealAt + 1)).toBeUndefined();
  });
});

describe("AUD-002: achados corrigidos", () => {
  it("react respeita a visibilidade: antes da revelação, foto oculta, de outro com 'todos veem tudo' desligado e envio inacabado não recebem reação", async () => {
    let ev = (await repos.events.get(id))!;
    expect(await react(repos, ev, anaPhoto, bia.id, "amei", NOW + 60_000)).toEqual([]); // antes da revelação
    expect(await repos.reactions.listByEvent(id)).toEqual([]);
    ev = (await reconcileReveal(repos, id, revealAt + 1))!;
    await react(repos, ev, hiddenPhoto, ana.id, "uau", revealAt + 1);
    expect(await repos.reactions.listByEvent(id)).toEqual([]); // oculta
    await repos.photos.begin({ id: "meio", eventId: id, authorId: bia.id, authorName: "Bia", createdAt: NOW, moment: "x", status: "visivel", reports: 0, highlighted: false, version: 1, uploadStatus: "enviando" });
    await react(repos, ev, "meio", ana.id, "amei", revealAt + 1);
    expect(await repos.reactions.listByEvent(id)).toEqual([]); // enviando
    await updateSettings(repos, id, { everyoneSeesAll: false });
    const closed = (await repos.events.get(id))!;
    await react(repos, closed, biaPhoto, ana.id, "amei", revealAt + 1);
    expect(await repos.reactions.listByEvent(id)).toEqual([]); // foto de outro sem permissão
    await react(repos, closed, anaPhoto, ana.id, "amei", revealAt + 1);
    expect((await repos.reactions.listByEvent(id)).map((r) => r.photoId)).toEqual([anaPhoto]); // a própria pode
  });
  it("o total de fotos visto pelo convidado não inclui as ocultas; o do organizador sim", async () => {
    expect((await readEventScoped(repos, { code }, asGuest(ana), NOW + 60_000)).counts.total).toBe(2); // ana 1 + bia 1 visível (a oculta e a removida fora)
    expect((await readEventScoped(repos, { id }, asHost(host), NOW + 60_000)).counts.total).toBe(3);
  });
  it("evento apagado não ressuscita: save versionado vira not-found e o serviço devolve 'inexistente'", async () => {
    const ev = (await repos.events.get(id))!;
    await repos.events.remove(id);
    await expect(repos.events.save({ ...ev, title: "Fantasma" }, { expectedVersion: ev.version })).rejects.toMatchObject({ code: "not-found" });
    expect(await repos.events.get(id)).toBeUndefined();
    expect(await updateSettings(repos, id, { title: "X" })).toEqual({ ok: false, reason: "inexistente" });
    expect(await reconcileReveal(repos, id, revealAt + 1)).toBeUndefined();
  });
  it("envios inacabados vencidos são varridos e deixam de ocupar o rolo; os recentes ficam", async () => {
    const mk = (pid: string, createdAt: number) => repos.photos.begin({ id: pid, eventId: id, authorId: ana.id, authorName: "Ana", createdAt, moment: "x", status: "visivel", reports: 0, highlighted: false, version: 1, uploadStatus: "enviando" });
    await mk("velho", NOW); await mk("novo", NOW + 50 * 60_000);
    const before = await repos.photos.count(id, { authorId: ana.id, excludeStatus: "removida" });
    expect(await expirePending(repos, id, NOW + 61 * 60_000, 60 * 60_000)).toBe(1);
    expect(await repos.photos.get("velho")).toBeUndefined();
    expect(await repos.photos.get("novo")).toBeDefined();
    expect(await repos.photos.count(id, { authorId: ana.id, excludeStatus: "removida" })).toBe(before - 1);
  });
});
