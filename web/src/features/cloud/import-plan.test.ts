import { beforeEach, describe, expect, it } from "vitest";
import { createMemoryRepositories, type Repositories, type User } from "@/repositories";
import { moderate } from "../admin/service";
import { createEvent, type EventInput } from "../events/service";
import { joinEvent } from "../participants/service";
import { postPhoto, react } from "../photos/service";
import { buildImportBundle, identityPolicy } from "./import-plan";

const NOW = 1_800_000_000_000;
const host: User = { id: "local-host", name: "Emy", createdAt: 1 };
const other: User = { id: "local-other", name: "Outro", createdAt: 1 };
const ana: User = { id: "local-ana", name: "Ana", createdAt: 1 };
const AUTH = "9b2c1f3e-0000-4000-8000-00000000a001";
const img = (n: number) => ({ bytes: new Uint8Array([n]).buffer, type: "image/jpeg" });
const input: EventInput = {
  title: "Emy e Igor", category: "casamento", durationHours: 6, reveal: { enabled: true, kind: "ao-terminar", days: 1, date: "", time: "", timezone: "UTC" }, cameraStyle: "original",
  capacity: 10, shotsPerPerson: 5, everyoneSeesAll: true, palette: "salvia", eventFont: "birthstone",
};
let repos: Repositories;
let eventId: string, code: string;
beforeEach(async () => {
  repos = createMemoryRepositories();
  const e = await createEvent(repos, host, input, NOW);
  const o = await createEvent(repos, other, { ...input, title: "Evento de outro" }, NOW);
  if (!e.ok || !o.ok) throw new Error();
  ({ id: eventId, code } = e.event);
  await joinEvent(repos, ana, code, "Ana", NOW + 1);
  const mk = async (u: User, n: number) => { const p = await postPhoto(repos, e.event, u, img(n), { moment: "O sim" }, NOW + 10 + n); if (!p.ok) throw new Error(); return p.photo.id; };
  const hostPhoto = await mk(host, 1), anaPhoto = await mk(ana, 2), removed = await mk(ana, 3);
  await moderate(repos, removed, "remover");
  const ev = (await repos.events.get(eventId))!;
  await react(repos, ev, hostPhoto, host.id, "amei", ev.revealAt! + 1);
  await react(repos, ev, hostPhoto, ana.id, "uau", ev.revealAt! + 1);
  await react(repos, ev, anaPhoto, host.id, "amei", ev.revealAt! + 1);
});

describe("ITG-105: pacote de importação local → nuvem", () => {
  it("leva só os eventos do anfitrião, com o mesmo id e código e hostId = auth.uid()", async () => {
    const b = await buildImportBundle(repos, { localUserId: host.id, authUid: AUTH });
    expect(b.events).toHaveLength(1);
    expect(b.events[0]).toMatchObject({ id: eventId, code, hostId: AUTH, version: 1 });
  });
  it("fotos: as do anfitrião ficam dele; as de convidados perdem o autor (nullable) mas guardam o nome; removidas não vão", async () => {
    const b = await buildImportBundle(repos, { localUserId: host.id, authUid: AUTH });
    const byAuthor = Object.fromEntries(b.photos.map((p) => [p.authorName, p]));
    expect(b.photos).toHaveLength(2);
    expect(byAuthor["Emy"]).toMatchObject({ authorId: AUTH });
    expect(byAuthor["Ana"]).toMatchObject({ authorId: null, authorName: "Ana" });
    expect(b.photos.every((p) => p.uploadStatus === "pronta" && p.storagePath === `${eventId}/${p.id}`)).toBe(true);
    expect(b.report).toMatchObject({ photosDroppedRemoved: 1, photosDroppedUnfinished: 0 });
  });
  it("envio inacabado não vira foto: fica fora e é contado à parte", async () => {
    await repos.photos.begin({ id: "meio", eventId, authorId: host.id, authorName: "Emy", createdAt: NOW + 99, moment: "O sim", status: "visivel", reports: 0, highlighted: false, version: 1, uploadStatus: "enviando" });
    const b = await buildImportBundle(repos, { localUserId: host.id, authUid: AUTH });
    expect(b.photos.map((p) => p.id)).not.toContain("meio");
    expect(b.report).toMatchObject({ photosDroppedRemoved: 1, photosDroppedUnfinished: 1 });
  });
  it("reações: só as do anfitrião (convidado não tem conta para a chave); as demais são contadas como perdidas", async () => {
    const b = await buildImportBundle(repos, { localUserId: host.id, authUid: AUTH });
    expect(b.reactions.map((r) => r.authorId)).toEqual([AUTH, AUTH]);
    expect(b.report.reactionsDroppedGuests).toBe(1);
  });
  it("convidados não viram participantes (precisam entrar pela conta); o relatório diz quantos ficaram de fora", async () => {
    const b = await buildImportBundle(repos, { localUserId: host.id, authUid: AUTH });
    expect(b).not.toHaveProperty("participants");
    expect(b.report.guestsNotImported).toBe(1);
  });
  it("é determinístico e não altera o armazenamento local (idempotente por UUID)", async () => {
    const before = JSON.stringify(await repos.photos.listByEvent(eventId));
    const a = await buildImportBundle(repos, { localUserId: host.id, authUid: AUTH });
    const b = await buildImportBundle(repos, { localUserId: host.id, authUid: AUTH });
    expect(b).toEqual(a);
    expect(JSON.stringify(await repos.photos.listByEvent(eventId))).toBe(before);
  });
  it("não carrega bytes nem identificadores locais de outras pessoas", async () => {
    const text = JSON.stringify(await buildImportBundle(repos, { localUserId: host.id, authUid: AUTH }));
    expect(text).not.toContain(ana.id);
    expect(text).not.toContain(host.id);
    expect(text).not.toContain("bytes");
  });
  it("exige um auth.uid() válido e uma identidade local", async () => {
    await expect(buildImportBundle(repos, { localUserId: host.id, authUid: "" })).rejects.toMatchObject({ code: "invalid" });
    await expect(buildImportBundle(repos, { localUserId: host.id, authUid: "nao-e-uuid" })).rejects.toMatchObject({ code: "invalid" });
    const none = await buildImportBundle(repos, { localUserId: "ninguem", authUid: AUTH });
    expect(none.events).toEqual([]);
  });
});

describe("ITG-105: política de identidade", () => {
  it("local: pode trocar de pessoa (demo no aparelho); nuvem: a identidade é a da sessão e não se troca", () => {
    expect(identityPolicy("local")).toEqual({ canSwitch: true, remembersPeople: true });
    expect(identityPolicy("cloud")).toEqual({ canSwitch: false, remembersPeople: false });
  });
});
