import { beforeEach, describe, expect, it } from "vitest";
import { endAt } from "@/domain/event";
import { createMemoryRepositories, type Repositories, type User } from "@/repositories";
import { eventStats, moderate } from "./admin/service";
import { seedDemoEvent } from "./demo/seed";
import { createEvent, endEventNow, setEndIn, type EventInput } from "./events/service";
import { inviteUrl, tableFromSearch } from "./invitations/links";
import { joinEvent } from "./participants/service";
import { loadFeed, postPhoto, react, usedShots } from "./photos/service";

const NOW = 1_800_000_000_000;
const host: User = { id: "host", name: "Emy", createdAt: 1 };
const guest: User = { id: "g1", name: "Ana", createdAt: 1 };
const img = { bytes: new Uint8Array([1, 2, 3]).buffer, type: "image/jpeg" };
const input: EventInput = {
  title: "Emy e Igor", category: "casamento", durationHours: 6, revealTiming: "ao-terminar", revealDelayDays: 0, cameraStyle: "original",
  capacity: 5, shotsPerPerson: 5, everyoneSeesAll: true, palette: "salvia", eventFont: "birthstone",
};
let repos: Repositories;
beforeEach(() => {
  repos = createMemoryRepositories();
});

describe("criar evento", () => {
  it("gera código válido e único, início agora", async () => {
    const r = await createEvent(repos, host, input, NOW);
    expect(r.ok && r.event.code).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/);
    expect(r.ok && r.event.startAt).toBe(NOW);
    expect(await repos.events.list()).toHaveLength(1);
  });
  it("recusa nome vazio e término curto sem gravar nada", async () => {
    expect(await createEvent(repos, host, { ...input, title: " " }, NOW)).toEqual({ ok: false, errors: { title: "obrigatorio" } });
    expect(await createEvent(repos, host, { ...input, durationHours: 0.25 }, NOW)).toEqual({ ok: false, errors: { termino: "curto" } });
    expect(await repos.events.list()).toHaveLength(0);
  });
});

describe("entrar e postar", () => {
  it("entra por código em minúsculas; rejeita código, nome vazio, lotado e encerrado", async () => {
    const r = await createEvent(repos, host, input, NOW);
    if (!r.ok) throw new Error();
    const e = r.event;
    expect((await joinEvent(repos, guest, e.code.toLowerCase(), "Ana", NOW + 1000)).ok).toBe(true);
    expect(await joinEvent(repos, guest, "ZZZZZZZZ", "Ana", NOW)).toEqual({ ok: false, reason: "codigo" });
    expect(await joinEvent(repos, guest, "abc", "Ana", NOW)).toEqual({ ok: false, reason: "codigo" });
    expect(await joinEvent(repos, { ...guest, id: "g2" }, e.code, "  ", NOW)).toEqual({ ok: false, reason: "nome" });
    for (let i = 0; i < 4; i++) await joinEvent(repos, { ...guest, id: `x${i}` }, e.code, "Fulano", NOW);
    expect(await joinEvent(repos, { ...guest, id: "late" }, e.code, "Tarde", NOW)).toEqual({ ok: false, reason: "lotado" });
    expect((await joinEvent(repos, guest, e.code, "Ana", NOW)).ok).toBe(true);
    expect(await joinEvent(repos, guest, e.code, "Ana", endAt(e))).toEqual({ ok: false, reason: "encerrado" });
  });
  it("respeita o rolo e não aceita arquivo inválido", async () => {
    const r = await createEvent(repos, host, input, NOW);
    if (!r.ok) throw new Error();
    const e = r.event;
    const meta = { moment: "O sim" };
    for (let i = 1; i <= 5; i++) expect((await postPhoto(repos, e, guest, img, meta, NOW + i)).ok).toBe(true);
    expect(await postPhoto(repos, e, guest, img, meta, NOW + 9)).toEqual({ ok: false, reason: "rolo" });
    expect(await usedShots(repos, e.id, guest.id)).toBe(5);
    expect(await postPhoto(repos, e, host, { bytes: new ArrayBuffer(0), type: "image/jpeg" }, meta, NOW)).toEqual({ ok: false, reason: "arquivo" });
    expect(await postPhoto(repos, e, host, { bytes: img.bytes, type: "text/plain" }, meta, NOW)).toEqual({ ok: false, reason: "arquivo" });
    expect(await postPhoto(repos, e, host, img, meta, endAt(e))).toEqual({ ok: false, reason: "encerrado" });
  });
  it("feed: outros só veem depois da revelação; reação é única por foto", async () => {
    const r = await createEvent(repos, host, input, NOW);
    if (!r.ok) throw new Error();
    const e = r.event;
    const p = await postPhoto(repos, e, guest, img, { moment: "O sim" }, NOW + 1);
    if (!p.ok) throw new Error();
    const other = { id: "g9", host: false };
    expect(await loadFeed(repos, e, other, NOW + 10)).toHaveLength(0);
    expect(await loadFeed(repos, e, other, endAt(e))).toHaveLength(1);
    await react(repos, e, p.photo.id, other.id, "amei");
    const after = await react(repos, e, p.photo.id, other.id, "uau");
    expect(after).toHaveLength(1);
    expect(await repos.reactions.listByEvent(e.id)).toEqual([{ eventId: e.id, photoId: p.photo.id, authorId: "g9", kind: "uau" }]);
    expect(await react(repos, e, p.photo.id, other.id, "uau")).toHaveLength(0);
    expect(await repos.reactions.listByEvent(e.id)).toHaveLength(0);
  });
});

describe("administração", () => {
  it("encerrar agora antecipa o fim e bloqueia reabrir com fotos", async () => {
    const r = await createEvent(repos, host, input, NOW);
    if (!r.ok) throw new Error();
    const e = r.event;
    await postPhoto(repos, e, guest, img, { moment: "O sim" }, NOW + 1);
    const ended = await endEventNow(repos, e.id, NOW + 1000);
    expect(endAt(ended!)).toBe(NOW + 1000);
    expect(await setEndIn(repos, e.id, 2, NOW + 5000)).toEqual({ ok: false, reason: "encerrado-com-fotos" });
  });
  it("estende o término de evento ativo e recusa menos de 30 minutos", async () => {
    const r = await createEvent(repos, host, input, NOW);
    if (!r.ok) throw new Error();
    expect(await setEndIn(repos, r.event.id, 0.1, NOW)).toEqual({ ok: false, reason: "termino-curto" });
    const ok = await setEndIn(repos, r.event.id, 3, NOW);
    expect(ok.ok && endAt(ok.event)).toBe(NOW + 3 * 3_600_000);
  });
  it("moderação: remover apaga reações; estatísticas ignoram removidas", async () => {
    const e = await seedDemoEvent(repos, host, NOW);
    const before = await eventStats(repos, e, NOW);
    expect(before.photos).toBe(12);
    expect(before.guests).toBe(5);
    expect(before.pending).toBe(1);
    const photos = await repos.photos.listByEvent(e.id);
    const victim = photos[0];
    await moderate(repos, victim.id, "remover");
    const after = await eventStats(repos, e, NOW);
    expect(after.photos).toBe(11);
    expect((await repos.reactions.listByEvent(e.id)).some((x) => x.photoId === victim.id)).toBe(false);
  });
});

describe("convites", () => {
  it("monta link com mesa e lê a mesa com segurança", () => {
    expect(inviteUrl("https://x.app", "NFVARBQX", "Mesa 8")).toBe("https://x.app/e/NFVARBQX?mesa=Mesa+8");
    expect(tableFromSearch("?mesa=Mesa%208")).toBe("Mesa 8");
    expect(tableFromSearch("?mesa=%3Cscript%3E")).toBeUndefined();
    expect(tableFromSearch("")).toBeUndefined();
  });
});
