/**
 * Fila de envio da câmera descartável. O disparo só congela o quadro e entra aqui; a revelação em tamanho cheio (no worker),
 * a gravação no aparelho e o envio acontecem em segundo plano, um de cada vez, fora da tela da câmera.
 *
 * - Persistente: cada foto revelada fica no IndexedDB (chave `photoId`) até o servidor confirmar; reabrir o app retoma.
 * - Em série, com espera crescente depois de falha de rede (2 s, 5 s, 15 s, 30 s e depois a cada 60 s); o evento `online`
 *   tenta na hora.
 * - Confirmação limpa o item mesmo com a tela da câmera fechada. Recusa do servidor (rolo, encerrado, bloqueado...) marca o
 *   item e avisa; não há tela de "Sem sinal" para a câmera.
 * - Guarda também a prévia pequena da última foto (objectURL), revogada só quando outra a substitui.
 */
import type { CameraStyle, FilmLook } from "@/domain/options";
import type { MemoEvent } from "@/domain/event";
import type { PhotoData, Repositories, User } from "@/repositories";
import { renderPhoto, type Frame } from "./capture";
import { loadQueuedUploads, removeQueuedUpload, saveQueuedUpload, type QueuedUpload } from "./draft";
import { postPhoto, type PostOutcome } from "./service";

export type QueueStatus = "revelando" | "pendente" | "enviando" | "esperando" | "enviada" | "recusada" | "falhou";
export type Refusal = "rolo" | "encerrado" | "bloqueado" | "acesso" | "nao-encontrado" | "arquivo";
export interface QueueEntry {
  photoId: string; eventId: string; userId: string; createdAt: number;
  status: QueueStatus; failures: number; reserved: boolean;
  reason?: Refusal;
  /** Próxima tentativa (status `esperando`). */
  nextAt?: number;
  /** Não foi possível gravar no aparelho: só existe na memória desta aba. */
  volatile?: boolean;
}
export interface ShotJob {
  photoId: string; event: MemoEvent; user: User; createdAt: number; takenAt: Date;
  meta: { moment: string; caption?: string; tableLabel?: string };
  frame: Frame; style: CameraStyle | FilmLook; mirror: boolean;
}
export interface LastShot { photoId: string; eventId: string; userId: string; url: string; createdAt: number }
export interface QueueDeps {
  repos: Repositories;
  userId: string;
  /** Depois de cada confirmação (ex.: atualizar o contador). O item só sai da lista quando isto termina. */
  onConfirmed?: () => unknown;
}
type Post = typeof postPhoto;
type Render = (job: ShotJob) => Promise<PhotoData>;
type Store = { save: typeof saveQueuedUpload; load: typeof loadQueuedUploads; remove: typeof removeQueuedUpload };

export const QUEUE_BACKOFF_MS = [2000, 5000, 15000, 30000, 60000] as const;
export const backoffMs = (failures: number): number => QUEUE_BACKOFF_MS[Math.min(Math.max(failures, 1), QUEUE_BACKOFF_MS.length) - 1];
const REFUSALS = new Set<string>(["rolo", "encerrado", "bloqueado", "acesso", "nao-encontrado", "arquivo"]);
const isRefusal = (r: Exclude<PostOutcome, { ok: true }>["reason"]): r is Refusal => REFUSALS.has(r);

/** Entra na conta do rolo: tudo o que ainda pode virar foto publicada (ou já virou e o contador ainda não soube). */
export const countsTowardRoll = (e: QueueEntry): boolean => e.status !== "recusada" && e.status !== "falhou";
/** Ainda não confirmado pelo servidor. */
export const isPending = (e: QueueEntry): boolean => countsTowardRoll(e) && e.status !== "enviada";

const defaultRender: Render = (job) => renderPhoto(job.frame.source, job.frame.width, job.frame.height, job.style, job.mirror, job.takenAt);

export class UploadQueue {
  private entries = new Map<string, QueueEntry>();
  private records = new Map<string, QueuedUpload>();
  private listeners = new Set<() => void>();
  private snap: QueueEntry[] = [];
  private last: LastShot | undefined;
  private deps: QueueDeps | undefined;
  private running = false;
  private wake: ReturnType<typeof setTimeout> | undefined;
  private developing: Promise<void> = Promise.resolve();
  private loadedFor: string | undefined;

  constructor(private opts: { post?: Post; render?: Render; store?: Store; now?: () => number } = {}) {}

  private get now() { return (this.opts.now ?? Date.now)(); }
  private get store(): Store { return this.opts.store ?? { save: saveQueuedUpload, load: loadQueuedUploads, remove: removeQueuedUpload }; }

  subscribe = (fn: () => void): (() => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  getSnapshot = (): QueueEntry[] => this.snap;
  getLastShot = (): LastShot | undefined => this.last;
  private emit() {
    this.snap = [...this.entries.values()].map((e) => ({ ...e }));
    for (const fn of this.listeners) fn();
  }
  private patch(id: string, p: Partial<QueueEntry>) {
    const cur = this.entries.get(id);
    if (!cur) return;
    this.entries.set(id, { ...cur, ...p });
    this.emit();
  }

  /** Liga a fila à sessão atual. Trocar de pessoa tira da memória os itens da anterior (eles seguem guardados no aparelho). */
  configure(deps: QueueDeps): Promise<void> {
    const changed = this.deps?.userId !== deps.userId;
    this.deps = deps;
    if (changed) {
      for (const [id, e] of this.entries) if (e.userId !== deps.userId && e.status !== "enviando" && e.status !== "revelando") { this.entries.delete(id); this.records.delete(id); }
      this.emit();
    }
    return this.resume();
  }

  /** Para de chamar o `onConfirmed` da tela que saiu (a fila continua). */
  release(onConfirmed: QueueDeps["onConfirmed"]): void {
    if (this.deps && this.deps.onConfirmed === onConfirmed) this.deps = { ...this.deps, onConfirmed: undefined };
  }

  /** Ao abrir o app (ou voltar a ele): carrega o que ficou no aparelho e tenta enviar. */
  async resume(): Promise<void> {
    const userId = this.deps?.userId;
    if (!userId) return;
    if (this.loadedFor !== userId) {
      this.loadedFor = userId;
      const { items } = await this.store.load(userId);
      for (const item of items) {
        if (this.entries.has(item.photoId)) continue;
        this.records.set(item.photoId, item);
        this.entries.set(item.photoId, { photoId: item.photoId, eventId: item.eventId, userId: item.userId, createdAt: item.createdAt, status: "pendente", failures: item.failures, reserved: !!item.reserved });
      }
      this.emit();
    }
    this.kick();
  }

  /** Internet voltou (ou "tentar agora"): quem estava esperando tenta já. */
  retryNow(): void {
    for (const e of this.entries.values()) if (e.status === "esperando") e.nextAt = 0;
    this.emit();
    this.kick();
  }

  /** Disparo: entra na hora (conta no rolo) e é revelado em segundo plano. */
  enqueue(job: ShotJob): void {
    this.entries.set(job.photoId, { photoId: job.photoId, eventId: job.event.id, userId: job.user.id, createdAt: job.createdAt, status: "revelando", failures: 0, reserved: false });
    this.emit();
    this.developing = this.developing.then(() => this.develop(job));
  }

  /** Some com os avisos de recusa/falha deste evento (a pessoa já viu). */
  dismiss(eventId: string): void {
    let changed = false;
    for (const [id, e] of this.entries) if (e.eventId === eventId && !countsTowardRoll(e)) { this.entries.delete(id); changed = true; }
    if (changed) this.emit();
  }

  /** Prévia da última foto. Revoga a anterior só quando substituída; uma prévia mais velha que chega atrasada é descartada. */
  setLastShot(shot: LastShot): void {
    if (this.last && this.last.createdAt > shot.createdAt) { URL.revokeObjectURL(shot.url); return; }
    const old = this.last;
    this.last = shot;
    if (old && old.url !== shot.url) URL.revokeObjectURL(old.url);
    this.emit();
  }

  /** Quantos ainda não foram revelados (os bytes só existem na memória): fechar a aba agora perderia essas fotos. */
  unsaved(): number {
    return [...this.entries.values()].filter((e) => e.status === "revelando" || (e.volatile && isPending(e))).length;
  }

  private async develop(job: ShotJob): Promise<void> {
    let data: PhotoData;
    try {
      data = await (this.opts.render ?? defaultRender)(job);
    } catch {
      this.patch(job.photoId, { status: "falhou" });
      return;
    } finally {
      try { job.frame.close(); } catch { /* já liberado */ }
    }
    const record: QueuedUpload = {
      photoId: job.photoId, eventId: job.event.id, userId: job.user.id, createdAt: job.createdAt,
      user: job.user, event: job.event, data, meta: job.meta, attempted: false, failures: 0,
    };
    this.records.set(job.photoId, record);
    const saved = await this.store.save(record);
    this.patch(job.photoId, { status: "pendente", volatile: !saved.ok });
    this.kick();
  }

  private next(): QueueEntry | undefined {
    const userId = this.deps?.userId;
    const t = this.now;
    return [...this.entries.values()].find((e) => e.userId === userId && this.records.has(e.photoId) && (e.status === "pendente" || (e.status === "esperando" && (e.nextAt ?? 0) <= t)));
  }

  private schedule() {
    if (this.wake) clearTimeout(this.wake);
    this.wake = undefined;
    const waits = [...this.entries.values()].filter((e) => e.status === "esperando" && e.userId === this.deps?.userId).map((e) => e.nextAt ?? 0);
    if (!waits.length) return;
    this.wake = setTimeout(() => { this.wake = undefined; this.kick(); }, Math.max(0, Math.min(...waits) - this.now));
  }

  /** Envia em série. Pode ser chamada a qualquer momento: só um laço roda por vez. */
  kick(): void {
    if (this.running || !this.deps) return;
    this.running = true;
    void (async () => {
      try {
        for (let e = this.next(); e && this.deps; e = this.next()) await this.send(e.photoId, this.deps);
      } finally {
        this.running = false;
        this.schedule();
      }
    })();
  }

  private async send(photoId: string, deps: QueueDeps): Promise<void> {
    const record = this.records.get(photoId);
    if (!record) return;
    this.patch(photoId, { status: "enviando" });
    let r: PostOutcome;
    try {
      r = await (this.opts.post ?? postPhoto)(deps.repos, record.event, record.user, record.data, record.meta, record.createdAt, {
        photoId, resume: record.attempted,
        onReserved: () => { record.reserved = true; const e = this.entries.get(photoId); if (e) e.reserved = true; },
      });
    } catch {
      r = { ok: false, reason: "falha" };
    }
    record.attempted = true;
    if (r.ok) {
      this.records.delete(photoId);
      await this.store.remove(photoId);
      this.patch(photoId, { status: "enviada" });
      // o item fica na conta do rolo até o contador real saber da foto
      void Promise.resolve().then(() => deps.onConfirmed?.()).catch(() => undefined).finally(() => { this.entries.delete(photoId); this.emit(); });
      return;
    }
    const mine = this.deps?.userId === record.userId;
    if (isRefusal(r.reason) && mine) {
      this.records.delete(photoId);
      await this.store.remove(photoId);
      this.patch(photoId, { status: "recusada", reason: r.reason });
      return;
    }
    // rede, armazenamento ou resposta incerta: a mesma foto (mesma photoId) tenta de novo mais tarde
    record.failures += 1;
    await this.store.save(record);
    this.patch(photoId, { status: "esperando", failures: record.failures, reserved: !!record.reserved, nextAt: this.now + backoffMs(record.failures) });
  }
}

/** A fila do app: uma só, fora das telas, para sobreviver à navegação entre páginas. */
export const uploadQueue = new UploadQueue();

const REFUSAL_COPY: Record<Refusal, string> = {
  rolo: "Você usou todas as suas fotos deste evento. A última pose não entrou.",
  encerrado: "O evento terminou. A última pose não entrou.",
  bloqueado: "Seu acesso para postar foi bloqueado pelo organizador.",
  acesso: "Você não tem acesso para postar neste evento.",
  "nao-encontrado": "O evento não foi encontrado. Volte ao convite para conferir.",
  arquivo: "Essa foto não pode ser postada. Tire outra.",
};

/** Texto discreto da fila na câmera (mesmo lugar do status de antes) e se é um alerta. */
export function queueStatus(entries: QueueEntry[]): { text: string; alert: boolean } | undefined {
  const refused = entries.filter((e) => e.status === "recusada");
  if (refused.length) return { text: REFUSAL_COPY[refused[refused.length - 1].reason ?? "arquivo"], alert: true };
  if (entries.some((e) => e.status === "falhou")) return { text: "Não foi possível tirar a foto. Tente de novo.", alert: true };
  const pending = entries.filter(isPending);
  if (!pending.length) return undefined;
  const n = pending.length;
  const fotos = n === 1 ? "1 foto" : `${n} fotos`;
  if (pending.some((e) => e.status === "esperando")) return { text: `Sem sinal: ${fotos} na fila. Enviamos assim que a internet voltar.`, alert: false };
  return { text: `Mandando ${fotos}…`, alert: false };
}

/** Recusas que fecham a câmera para novos disparos neste evento. */
export const blocksShooting = (entries: QueueEntry[]): boolean => entries.some((e) => e.status === "recusada" && (e.reason === "bloqueado" || e.reason === "acesso" || e.reason === "nao-encontrado"));

/**
 * Poses usadas para o contador otimista. `base` é a contagem real congelada quando a fila começou a ter itens
 * (e quais deles já estavam reservados no servidor, portanto já contados nela). Sem fila, vale a contagem real.
 */
export function optimisticUsed(realUsed: number, active: QueueEntry[], base: { mine: number; reserved: string[] } | null): number {
  if (!active.length) return realUsed;
  const b = base ?? { mine: realUsed, reserved: active.filter((e) => e.reserved).map((e) => e.photoId) };
  return b.mine + active.filter((e) => !b.reserved.includes(e.photoId)).length;
}
