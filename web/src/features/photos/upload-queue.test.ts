import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryRepositories, RepositoryError, type Repositories, type User } from "@/repositories";
import { createEvent, type EventInput } from "../events/service";
import { loadQueuedUploads, removeQueuedUpload } from "./draft";
import { postPhoto } from "./service";
import { backoffMs, blocksShooting, optimisticUsed, queueStatus, UploadQueue, type QueueEntry, type ShotJob } from "./upload-queue";

const now = 1_800_000_000_000;
const user: User = { id: "fila-ana", name: "Ana", createdAt: 1 };
const input = { title: "Festa", category: "festa", durationHours: 3, reveal: { enabled: false }, cameraStyle: "original", capacity: 10, shotsPerPerson: 5, everyoneSeesAll: false, palette: "salvia", eventFont: "birthstone" } as EventInput;
const bytes = () => ({ bytes: new Uint8Array([1, 2, 3]).buffer, type: "image/jpeg" });
const frame = () => ({ source: {} as CanvasImageSource, width: 4, height: 3, close: vi.fn() });
let repos: Repositories;
let event: Awaited<ReturnType<typeof createEvent>> & { ok: true };

const deferred = <T,>() => { let res!: (v: T) => void; const p = new Promise<T>((r) => { res = r; }); return { p, res }; };
const job = (over: Partial<ShotJob> = {}): ShotJob => ({ photoId: crypto.randomUUID(), event: event.event, user, createdAt: now, takenAt: new Date(now), meta: { moment: "Agora" }, frame: frame(), style: "original", mirror: false, ...over });
const settle = async (q: UploadQueue, done: (s: QueueEntry[]) => boolean) => { await vi.waitFor(() => expect(done(q.getSnapshot())).toBe(true), { timeout: 3000 }); };

beforeEach(async () => {
  repos = createMemoryRepositories();
  const r = await createEvent(repos, user, input, now);
  if (!r.ok) throw new Error("fixture");
  event = r;
  for (const i of (await loadQueuedUploads(user.id)).items) await removeQueuedUpload(i.photoId);
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe("fila de envio da câmera", () => {
  it("entra na hora (revelando), revela em segundo plano, envia em série e limpa ao confirmar", async () => {
    const gate = deferred<void>();
    const order: string[] = [];
    const post: typeof postPhoto = async (...a) => { order.push(`ini:${a[6]?.photoId}`); await gate.p; const r = await postPhoto(...a); order.push(`fim:${a[6]?.photoId}`); return r; };
    const confirmed = vi.fn(async () => {});
    const q = new UploadQueue({ post, render: async () => bytes() });
    await q.configure({ repos, userId: user.id, onConfirmed: confirmed });
    const a = job({ photoId: "a" }), b = job({ photoId: "b", createdAt: now + 1 });
    q.enqueue(a); q.enqueue(b);
    expect(q.getSnapshot().map((e) => e.status)).toEqual(["revelando", "revelando"]);
    await settle(q, (s) => s[0]?.status === "enviando");
    expect(order).toEqual(["ini:a"]); // em série: b espera a
    expect((await loadQueuedUploads(user.id)).items.map((i) => i.photoId)).toEqual(["a", "b"]);
    expect(a.frame.close).toHaveBeenCalled();
    gate.res();
    await settle(q, (s) => s.length === 0);
    expect(order).toEqual(["ini:a", "fim:a", "ini:b", "fim:b"]);
    expect(confirmed).toHaveBeenCalledTimes(2);
    expect((await loadQueuedUploads(user.id)).items).toEqual([]);
    expect((await repos.photos.listByEvent(event.event.id)).map((p) => p.id).sort()).toEqual(["a", "b"]);
  });

  it("falha de rede espera com backoff, retoma no online com a mesma photoId e não duplica", async () => {
    let fail = 2;
    const begin = repos.photos.begin;
    const ids: string[] = [];
    repos.photos.begin = async (p) => { ids.push(p.id); if (fail-- > 0) throw new RepositoryError("unavailable", "offline"); return begin(p); };
    const q = new UploadQueue({ render: async () => bytes() });
    await q.configure({ repos, userId: user.id });
    q.enqueue(job({ photoId: "x" }));
    await settle(q, (s) => s[0]?.status === "esperando");
    expect(q.getSnapshot()[0].failures).toBe(1);
    expect(queueStatus(q.getSnapshot())?.text).toMatch(/Sem sinal: 1 foto na fila/);
    expect((await loadQueuedUploads(user.id)).items[0]).toMatchObject({ attempted: true, failures: 1 });
    q.retryNow();
    await settle(q, (s) => s[0]?.failures === 2 && s[0].status === "esperando");
    q.retryNow();
    await settle(q, (s) => s.length === 0);
    expect(new Set(ids)).toEqual(new Set(["x"]));
    expect(await repos.photos.listByEvent(event.event.id)).toHaveLength(1);
  });

  it("recusa do servidor marca o item, avisa e sai do aparelho sem tentar de novo", async () => {
    repos.photos.begin = async () => { throw new RepositoryError("event-ended", "MM002"); };
    const q = new UploadQueue({ render: async () => bytes() });
    await q.configure({ repos, userId: user.id });
    q.enqueue(job());
    await settle(q, (s) => s[0]?.status === "recusada");
    expect(q.getSnapshot()[0].reason).toBe("encerrado");
    expect(queueStatus(q.getSnapshot())).toEqual({ text: expect.stringMatching(/evento terminou/), alert: true });
    expect((await loadQueuedUploads(user.id)).items).toEqual([]);
    expect(blocksShooting(q.getSnapshot())).toBe(false);
    q.dismiss(event.event.id);
    expect(q.getSnapshot()).toEqual([]);
  });

  it("bloqueio do organizador fecha o obturador", async () => {
    const denial = new RepositoryError("forbidden", "blocked");
    Object.defineProperty(denial, "code", { value: "blocked" });
    repos.photos.begin = async () => { throw denial; };
    const q = new UploadQueue({ render: async () => bytes() });
    await q.configure({ repos, userId: user.id });
    q.enqueue(job());
    await settle(q, (s) => s[0]?.status === "recusada");
    expect(blocksShooting(q.getSnapshot())).toBe(true);
  });

  it("reabrir o app retoma o que ficou guardado (outra instância da fila)", async () => {
    const stuck = new UploadQueue({ render: async () => bytes(), post: () => new Promise(() => {}) });
    await stuck.configure({ repos, userId: user.id });
    stuck.enqueue(job({ photoId: "guardada" }));
    await settle(stuck, (s) => s[0]?.status === "enviando");
    const reopened = new UploadQueue();
    await reopened.configure({ repos, userId: user.id });
    await settle(reopened, (s) => s.length === 0);
    expect((await repos.photos.get("guardada"))?.uploadStatus).toBe("pronta");
  });

  it("só envia itens da pessoa da sessão", async () => {
    const q = new UploadQueue({ render: async () => bytes(), post: () => new Promise(() => {}) });
    await q.configure({ repos, userId: user.id });
    q.enqueue(job({ photoId: "da-ana" }));
    await settle(q, (s) => s[0]?.status === "enviando");
    const other = new UploadQueue();
    await other.configure({ repos, userId: "beto" });
    expect(other.getSnapshot()).toEqual([]);
  });

  it("falha ao revelar vira aviso e não conta no rolo", async () => {
    const q = new UploadQueue({ render: async () => { throw new Error("canvas"); } });
    await q.configure({ repos, userId: user.id });
    const j = job();
    q.enqueue(j);
    await settle(q, (s) => s[0]?.status === "falhou");
    expect(j.frame.close).toHaveBeenCalled();
    expect(optimisticUsed(0, q.getSnapshot().filter((e) => e.status !== "falhou"), null)).toBe(0);
    expect(queueStatus(q.getSnapshot())?.alert).toBe(true);
  });

  it("prévia: revoga a anterior só ao substituir e descarta uma mais velha que chega atrasada", () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const q = new UploadQueue();
    q.setLastShot({ photoId: "1", eventId: "e", userId: "u", url: "blob:1", createdAt: 1 });
    expect(revoke).not.toHaveBeenCalled();
    q.setLastShot({ photoId: "3", eventId: "e", userId: "u", url: "blob:3", createdAt: 3 });
    expect(revoke).toHaveBeenCalledWith("blob:1");
    q.setLastShot({ photoId: "2", eventId: "e", userId: "u", url: "blob:2", createdAt: 2 });
    expect(revoke).toHaveBeenCalledWith("blob:2");
    expect(q.getLastShot()?.url).toBe("blob:3");
  });
});

describe("contador otimista e textos da fila", () => {
  const e = (id: string, over: Partial<QueueEntry> = {}): QueueEntry => ({ photoId: id, eventId: "ev", userId: "u", createdAt: 1, status: "pendente", failures: 0, reserved: false, ...over });
  it("left = real − pendentes, sem contar duas vezes o que o servidor já reservou", () => {
    expect(optimisticUsed(2, [], null)).toBe(2);
    expect(optimisticUsed(2, [e("a"), e("b")], null)).toBe(4);
    // a base congelou com 2; depois o contador real passou a incluir a reservada: não muda o resultado
    const base = { mine: 2, reserved: [] };
    expect(optimisticUsed(3, [e("a", { reserved: true, status: "enviada" }), e("b")], base)).toBe(4);
    // item retomado que já estava reservado quando a base congelou já está na contagem real
    expect(optimisticUsed(3, [e("a", { reserved: true })], null)).toBe(3);
  });
  it("Mandando N fotos…", () => {
    expect(queueStatus([])).toBeUndefined();
    expect(queueStatus([e("a", { status: "revelando" })])).toEqual({ text: "Mandando 1 foto…", alert: false });
    expect(queueStatus([e("a"), e("b", { status: "enviando" })])).toEqual({ text: "Mandando 2 fotos…", alert: false });
    expect(queueStatus([e("a", { status: "enviada" })])).toBeUndefined();
  });
  it("backoff 2, 5, 15, 30 e depois 60 s", () => {
    expect([1, 2, 3, 4, 5, 9].map(backoffMs)).toEqual([2000, 5000, 15000, 30000, 60000, 60000]);
  });
});
