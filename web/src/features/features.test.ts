import { beforeEach, describe, expect, it, vi } from "vitest";
import { endAt } from "@/domain/event";
import { computeRevealStatus } from "@/domain/reveal";
import { createMemoryRepositories, type Repositories, type User } from "@/repositories";
import { eventStats, moderate } from "./admin/service";
import { seedDemoEvent } from "./demo/seed";
import { createEvent, endEventNow, reconcileReveal, setEndIn, updateReveal, updateSettings, type EventInput } from "./events/service";
import { inviteUrl, tableFromSearch } from "./invitations/links";
import { joinEvent } from "./participants/service";
import { loadFeed, postPhoto, react, usedShots } from "./photos/service";

const NOW = 1_800_000_000_000;
const host: User = { id: "host", name: "Emy", createdAt: 1 };
const guest: User = { id: "g1", name: "Ana", createdAt: 1 };
const img = { bytes: new Uint8Array([1, 2, 3]).buffer, type: "image/jpeg" };
const input: EventInput = {
  title: "Emy e Igor", category: "casamento", durationHours: 6, reveal: { enabled: true, kind: "ao-terminar", days: 1, date: "", time: "", timezone: "America/Cuiaba" }, cameraStyle: "original",
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

describe("concorrência (rolo e vagas)", () => {
  it("postagens simultâneas não passam do rolo", async () => {
    const r = await createEvent(repos, host, { ...input, shotsPerPerson: 5 }, NOW);
    if (!r.ok) throw new Error();
    const results = await Promise.all(Array.from({ length: 12 }, (_, i) => postPhoto(repos, r.event, guest, img, { moment: "O sim" }, NOW + i)));
    expect(results.filter((x) => x.ok)).toHaveLength(5);
    expect(await usedShots(repos, r.event.id, guest.id)).toBe(5);
  });
  it("entradas simultâneas não passam da capacidade", async () => {
    const r = await createEvent(repos, host, { ...input, capacity: 5 }, NOW);
    if (!r.ok) throw new Error();
    const results = await Promise.all(Array.from({ length: 12 }, (_, i) => joinEvent(repos, { ...guest, id: `u${i}` }, r.event.code, "Fulano", NOW)));
    expect(results.filter((x) => x.ok)).toHaveLength(5);
    expect((await repos.participants.listByEvent(r.event.id)).length).toBe(5);
  });
  it("capacidade não pode ficar abaixo dos convidados atuais", async () => {
    const r = await createEvent(repos, host, { ...input, capacity: 20 }, NOW);
    if (!r.ok) throw new Error();
    for (let i = 0; i < 8; i++) await joinEvent(repos, { ...guest, id: `u${i}` }, r.event.code, "F", NOW);
    expect(await updateSettings(repos, r.event.id, { capacity: 5 })).toEqual({ ok: false, reason: "capacidade-menor-que-convidados" });
    expect((await updateSettings(repos, r.event.id, { capacity: 10 })).ok).toBe(true);
  });
  it("reagir em foto inexistente ou removida não grava", async () => {
    const r = await createEvent(repos, host, { ...input, reveal: { ...input.reveal, enabled: false } }, NOW);
    if (!r.ok) throw new Error();
    expect(await react(repos, r.event, "nao-existe", guest.id, "amei")).toEqual([]);
    expect(await repos.reactions.listByEvent(r.event.id)).toEqual([]);
  });
});

describe("revelação programada (serviços; o tempo é simulado pelo parâmetro `now`)", () => {
  const H = 3_600_000;
  const rev = (o: Partial<EventInput["reveal"]> = {}) => ({ enabled: true, kind: "data" as const, days: 1, date: "", time: "", timezone: "UTC", ...o });
  const at = (h: number) => new Date(NOW + h * H);
  const dt = (h: number) => ({ date: at(h).toISOString().slice(0, 10), time: at(h).toISOString().slice(11, 16) });

  it("cria com data e hora no fuso e guarda reveal_at em UTC", async () => {
    const r = await createEvent(repos, host, { ...input, reveal: rev({ ...dt(10), timezone: "America/Cuiaba" }) }, NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.event.revealEnabled).toBe(true);
    expect(r.event.timezone).toBe("America/Cuiaba");
    expect(r.event.revealStatus).toBe("pendente");
    expect(r.event.revealAt).toBeGreaterThan(NOW + 10 * H); // 21h40 em Cuiabá é depois de 21h40 UTC
  });
  it("recusa data passada ou inválida sem gravar", async () => {
    expect(await createEvent(repos, host, { ...input, reveal: rev({ ...dt(-5) }) }, NOW)).toMatchObject({ ok: false, errors: { reveal: { data: "passado" } } });
    expect(await createEvent(repos, host, { ...input, reveal: rev({ date: "", time: "" }) }, NOW)).toMatchObject({ ok: false, errors: { reveal: { data: "invalida" } } });
    expect(await repos.events.list()).toHaveLength(0);
  });
  it("desligada: fotos visíveis na hora, sem reveal_at", async () => {
    const r = await createEvent(repos, host, { ...input, reveal: rev({ enabled: false }) }, NOW);
    if (!r.ok) throw new Error();
    expect(r.event).toMatchObject({ revealEnabled: false, revealAt: null, revealStatus: "desativada" });
  });
  it("ao terminar e N dias depois derivam do fim do evento", async () => {
    const a = await createEvent(repos, host, { ...input, reveal: rev({ kind: "ao-terminar" }) }, NOW);
    const b = await createEvent(repos, host, { ...input, reveal: rev({ kind: "depois", days: 2 }) }, NOW);
    if (!a.ok || !b.ok) throw new Error();
    expect(a.event.revealAt).toBe(endAt(a.event));
    expect(b.event.revealAt).toBe(endAt(b.event) + 2 * 24 * H);
  });
  it("altera data e fuso enquanto pendente; depois de revelada o organizador não consegue", async () => {
    const r = await createEvent(repos, host, { ...input, reveal: rev({ ...dt(5) }) }, NOW);
    if (!r.ok) throw new Error();
    const moved = await updateReveal(repos, r.event.id, rev({ ...dt(8), timezone: "America/Sao_Paulo" }), NOW + H);
    expect(moved.ok && moved.event.timezone).toBe("America/Sao_Paulo");
    const late = await updateReveal(repos, r.event.id, rev({ ...dt(20) }), NOW + 30 * H);
    expect(late).toEqual({ ok: false, reason: "ja-revelada" });
    expect(await updateReveal(repos, r.event.id, rev({ enabled: false }), NOW + 30 * H)).toEqual({ ok: false, reason: "ja-revelada" });
  });
  it("não liga a revelação se já há fotos visíveis (não esconde o que já foi visto)", async () => {
    const r = await createEvent(repos, host, { ...input, reveal: rev({ enabled: false }) }, NOW);
    if (!r.ok) throw new Error();
    await postPhoto(repos, r.event, guest, img, { moment: "O sim" }, NOW + 1);
    expect(await updateReveal(repos, r.event.id, rev({ ...dt(5) }), NOW + 2)).toEqual({ ok: false, reason: "fotos-ja-visiveis" });
  });
  it("evento encerrado antes da revelação continua pendente e bloqueia postagem", async () => {
    const r = await createEvent(repos, host, { ...input, reveal: rev({ ...dt(10) }) }, NOW);
    if (!r.ok) throw new Error();
    const ended = await endEventNow(repos, r.event.id, NOW + 2 * H);
    expect(ended).toBeDefined();
    expect(await postPhoto(repos, ended!, guest, img, { moment: "O sim" }, NOW + 3 * H)).toEqual({ ok: false, reason: "encerrado" });
    expect((await reconcileReveal(repos, r.event.id, NOW + 3 * H))?.revealStatus).toBe("pendente");
  });
  it("reconciliação é idempotente e reflete 'app fechado na hora da revelação' na próxima abertura", async () => {
    const r = await createEvent(repos, host, { ...input, reveal: rev({ ...dt(5) }) }, NOW);
    if (!r.ok) throw new Error();
    const spy = vi.spyOn(repos.events, "save");
    const first = await reconcileReveal(repos, r.event.id, NOW + 6 * H); // abriu o app depois do horário
    expect(first?.revealStatus).toBe("revelada");
    const saves = spy.mock.calls.length;
    await reconcileReveal(repos, r.event.id, NOW + 7 * H);
    await reconcileReveal(repos, r.event.id, NOW + 8 * H);
    expect(spy.mock.calls.length).toBe(saves); // nada novo a gravar
  });
  it("dois participantes: antes da revelação nenhum vê foto; depois ambos veem; removida some para todos", async () => {
    const r = await createEvent(repos, host, { ...input, reveal: rev({ ...dt(5) }) }, NOW);
    if (!r.ok) throw new Error();
    const ana = { ...guest, id: "ana" }, beto = { ...guest, id: "beto" };
    const pa = await postPhoto(repos, r.event, ana, img, { moment: "O sim" }, NOW + 1);
    await postPhoto(repos, r.event, beto, img, { moment: "O sim" }, NOW + 2);
    if (!pa.ok) throw new Error();
    expect(await loadFeed(repos, r.event, { id: "ana", host: false }, NOW + H)).toHaveLength(0);
    expect(await loadFeed(repos, r.event, { id: "beto", host: false }, NOW + H)).toHaveLength(0);
    expect(await loadFeed(repos, r.event, { id: "ana", host: false }, NOW + 6 * H)).toHaveLength(2);
    await moderate(repos, pa.photo.id, "remover");
    expect(await loadFeed(repos, r.event, { id: "beto", host: false }, NOW + 6 * H)).toHaveLength(1);
  });
  it("participante que entra depois da revelação já vê a galeria", async () => {
    const r = await createEvent(repos, host, { ...input, reveal: rev({ ...dt(5) }) }, NOW);
    if (!r.ok) throw new Error();
    await postPhoto(repos, r.event, guest, img, { moment: "O sim" }, NOW + 1);
    const t = NOW + 5.5 * H; // depois da revelação (5 h), antes do fim do evento (6 h)
    expect((await joinEvent(repos, { ...guest, id: "tarde" }, r.event.code, "Tarde", t)).ok).toBe(true);
    expect(await loadFeed(repos, r.event, { id: "tarde", host: false }, t)).toHaveLength(1);
    // depois do fim do evento ninguém novo entra (regra do REA), mesmo com a galeria liberada
    expect(await joinEvent(repos, { ...guest, id: "muito-tarde" }, r.event.code, "X", NOW + 7 * H)).toEqual({ ok: false, reason: "encerrado" });
  });
});

describe("BG-101: revelação relativa ao término acompanha o fim do evento", () => {
  const H = 3_600_000, DAY = 24 * H;
  const rel = (o: Partial<EventInput["reveal"]> = {}) => ({ enabled: true, kind: "ao-terminar" as const, days: 1, date: "", time: "", timezone: "UTC", ...o });

  it("'ao terminar' guarda âncora no fim; estender o fim move a revelação junto", async () => {
    const r = await createEvent(repos, host, { ...input, reveal: rel() }, NOW);
    if (!r.ok) throw new Error();
    expect(r.event).toMatchObject({ revealAnchor: "fim", revealOffsetDays: 0 });
    const ext = await setEndIn(repos, r.event.id, 30, NOW + H); // novo fim = NOW + 31 h
    if (!ext.ok) throw new Error();
    expect(ext.event.revealAt).toBe(endAt(ext.event));
    expect((await repos.events.get(r.event.id))!.revealAt).toBe(endAt(ext.event));
  });
  it("'Encerrar agora' revela no instante do encerramento, sem esperar as horas que sobravam", async () => {
    const r = await createEvent(repos, host, { ...input, reveal: rel() }, NOW);
    if (!r.ok) throw new Error();
    const ended = await endEventNow(repos, r.event.id, NOW + 2 * H);
    expect(ended!.revealAt).toBe(NOW + 2 * H);
    expect(computeRevealStatus(ended!, NOW + 2 * H)).toBe("revelada");
  });
  it("'N dias depois' soma N dias ao novo fim", async () => {
    const r = await createEvent(repos, host, { ...input, reveal: rel({ kind: "depois", days: 2 }) }, NOW);
    if (!r.ok) throw new Error();
    expect(r.event).toMatchObject({ revealAnchor: "fim", revealOffsetDays: 2 });
    const ext = await setEndIn(repos, r.event.id, 10, NOW + H);
    if (!ext.ok) throw new Error();
    expect(ext.event.revealAt).toBe(endAt(ext.event) + 2 * DAY);
  });
  it("data escolhida (âncora 'data') não muda quando o fim muda", async () => {
    const d = new Date(NOW + 20 * H);
    const r = await createEvent(repos, host, { ...input, reveal: rel({ kind: "data", date: d.toISOString().slice(0, 10), time: d.toISOString().slice(11, 16) }) }, NOW);
    if (!r.ok) throw new Error();
    expect(r.event.revealAnchor).toBe("data");
    const before = r.event.revealAt;
    const ext = await setEndIn(repos, r.event.id, 40, NOW + H);
    expect(ext.ok && ext.event.revealAt).toBe(before);
  });
  it("revelação desligada não ganha data ao estender o fim", async () => {
    const r = await createEvent(repos, host, { ...input, reveal: rel({ enabled: false }) }, NOW);
    if (!r.ok) throw new Error();
    const ext = await setEndIn(repos, r.event.id, 10, NOW + H);
    expect(ext.ok && ext.event.revealAt).toBeNull();
  });
  it("trocar o tipo na configuração atualiza a âncora", async () => {
    const r = await createEvent(repos, host, { ...input, reveal: rel() }, NOW);
    if (!r.ok) throw new Error();
    const u = await updateReveal(repos, r.event.id, rel({ kind: "depois", days: 3 }), NOW + H);
    expect(u.ok && u.event).toMatchObject({ revealAnchor: "fim", revealOffsetDays: 3 });
  });
});

describe("BG-102: espelho da revelação não regride com o relógio recuado", () => {
  const H = 3_600_000;
  it("reconcile grava revealedAt uma vez e o recuo do relógio não desfaz", async () => {
    const r = await createEvent(repos, host, { ...input, reveal: { enabled: true, kind: "ao-terminar", days: 1, date: "", time: "", timezone: "UTC" } }, NOW);
    if (!r.ok) throw new Error();
    const at = r.event.revealAt!;
    const first = await reconcileReveal(repos, r.event.id, at + H);
    expect(first).toMatchObject({ revealStatus: "revelada", revealedAt: at });
    const back = await reconcileReveal(repos, r.event.id, NOW); // relógio recuado para antes do início
    expect(back).toMatchObject({ revealStatus: "revelada", revealedAt: at });
    expect(await updateReveal(repos, r.event.id, { enabled: false, kind: "data", days: 1, date: "", time: "", timezone: "UTC" }, NOW)).toEqual({ ok: false, reason: "ja-revelada" });
  });
  it("com revealedAt, as fotos continuam liberadas com o relógio recuado", async () => {
    const r = await createEvent(repos, host, { ...input, reveal: { enabled: true, kind: "ao-terminar", days: 1, date: "", time: "", timezone: "UTC" } }, NOW);
    if (!r.ok) throw new Error();
    await postPhoto(repos, r.event, guest, img, { moment: "O sim" }, NOW + 1);
    const revealed = (await reconcileReveal(repos, r.event.id, r.event.revealAt! + 1))!;
    expect(await loadFeed(repos, revealed, { id: "outro", host: false }, NOW + 2)).toHaveLength(1);
  });
});

describe("BG-113: escritas concorrentes não perdem atualização", () => {
  const H = 3_600_000;
  const mk = async () => {
    const r = await createEvent(repos, host, { ...input, reveal: { enabled: true, kind: "ao-terminar", days: 1, date: "", time: "", timezone: "UTC" } }, NOW);
    if (!r.ok) throw new Error();
    return r.event;
  };
  it("duas configurações em paralelo (título e local) ficam as duas", async () => {
    const e = await mk();
    await Promise.all([updateSettings(repos, e.id, { title: "Novo título" }), updateSettings(repos, e.id, { place: "Salão Azul" })]);
    expect(await repos.events.get(e.id)).toMatchObject({ title: "Novo título", place: "Salão Azul" });
  });
  it("estender o fim e mudar uma configuração ao mesmo tempo preserva as duas mudanças", async () => {
    const e = await mk();
    const [ext] = await Promise.all([setEndIn(repos, e.id, 30, NOW + H), updateSettings(repos, e.id, { shotsPerPerson: 5 })]);
    if (!ext.ok) throw new Error();
    const saved = (await repos.events.get(e.id))!;
    expect(saved.shotsPerPerson).toBe(5);
    expect(saved.revealAt).toBe(endAt(saved));
  });
  it("cada gravação incrementa a versão e o serviço devolve o evento gravado", async () => {
    const e = await mk();
    const s = await updateSettings(repos, e.id, { title: "A" });
    if (!s.ok) throw new Error();
    expect(s.event.version).toBe(e.version + 1);
    expect((await repos.events.get(e.id))!.version).toBe(s.event.version);
  });
  it("reconciliar duas vezes em paralelo grava revealedAt uma vez só (idempotente)", async () => {
    const e = await mk();
    const at = e.revealAt! + 1;
    const [a, b] = await Promise.all([reconcileReveal(repos, e.id, at), reconcileReveal(repos, e.id, at)]);
    expect(a!.revealedAt).toBe(b!.revealedAt);
    expect((await repos.events.get(e.id))!.version).toBe(e.version + 1);
  });
  it("moderar uma foto removida no meio devolve resultado tipado em vez de estourar", async () => {
    const e = await mk();
    const p = await postPhoto(repos, e, guest, img, { moment: "O sim" }, NOW + 1);
    if (!p.ok) throw new Error();
    await repos.photos.remove(p.photo.id);
    await expect(moderate(repos, p.photo.id, "ocultar")).resolves.toBeUndefined();
    // e a corrida real: a foto some entre a leitura e a gravação
    const q = await postPhoto(repos, e, guest, img, { moment: "O sim" }, NOW + 2);
    if (!q.ok) throw new Error();
    const racing = { ...repos, photos: { ...repos.photos, update: async () => { await repos.photos.remove(q.photo.id); return repos.photos.update(q.photo); } } } as typeof repos;
    await expect(moderate(racing, q.photo.id, "ocultar")).resolves.toBeUndefined();
  });
});
