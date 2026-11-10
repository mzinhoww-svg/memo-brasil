import type { MemoEvent } from "@/domain/event";
import type { Photo, Reaction } from "@/domain/photo";

export interface User {
  id: string;
  name: string;
  createdAt: number;
}
export interface Participant {
  eventId: string;
  userId: string;
  name: string;
  joinedAt: number;
  tableLabel?: string;
  blockedAt?: number;
}
/** Convite rastreável por origem (ex.: "Mesa 8"): "cada QR sabe de onde veio". */
export interface Invitation {
  id: string;
  eventId: string;
  label: string;
  createdAt: number;
}
/** Bytes da foto. ArrayBuffer em vez de Blob: estável em IndexedDB (Safari) e em testes. */
export interface PhotoData {
  bytes: ArrayBuffer;
  type: string;
}

/** Código do erro: o chamador decide o que fazer sem inspecionar mensagens. */
export type RepositoryErrorCode =
  | "conflict" | "not-found" | "unavailable" | "invalid"
  /** Recusas do servidor (trigger/RLS): o rolo da pessoa acabou, o evento terminou, a lotação fechou. */
  | "shot-limit" | "event-ended" | "capacity-full"
  /** Recusas de política do servidor (RLS/trigger/RPC). */
  | "forbidden" | "reveal-locked" | "rate-limited" | "invalid-invite" | "reopen-forbidden"
  /** Limite de convidados/fotos acima do plano efetivo do evento (MM012): o servidor recusa até haver direito. */
  | "not-entitled" | "blocked";
export class RepositoryError extends Error {
  readonly code: RepositoryErrorCode;
  constructor(code: RepositoryErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = "RepositoryError";
    this.code = code;
    this.cause = cause;
  }
}

/** Concorrência otimista: se informada e diferente da gravada, a escrita falha com `conflict`. */
export interface WriteOptions { expectedVersion?: number }
export interface Page<T> { items: T[]; total: number; nextCursor: string | null }
export interface PhotoCountFilter { authorId?: string; status?: Photo["status"]; excludeStatus?: Photo["status"] }

/** URL para exibir a foto; `release` devolve o recurso (revoga o object URL ou descarta a URL assinada). */
export interface PhotoUrl { url: string; release: () => void }
export type PhotoSize = "thumb" | "full";
export interface RepositoryOptions {
  /** Relógio do repositório. Com ele, `createdAt` é do repositório (servidor); sem ele vale o horário do cliente. */
  now?: () => number;
}

/** O que quem ainda não entrou no evento pode saber: o suficiente para o convite, nada sobre pessoas, fotos ou revelação. */
export interface EventPreview {
  code: string;
  title: string;
  category: MemoEvent["category"];
  hostName: string;
  startAt: number;
  place?: string;
  cameraStyle?: MemoEvent["cameraStyle"];
  filmLook?: MemoEvent["filmLook"];
  palette: MemoEvent["palette"];
  eventFont: MemoEvent["eventFont"];
  theme?: MemoEvent["theme"];
  capacity: MemoEvent["capacity"];
  status: "ativo" | "encerrado";
  full: boolean;
  /** Para o convite explicar o combinado antes de entrar (já vêm de `event_preview`). */
  shotsPerPerson: MemoEvent["shotsPerPerson"];
  revealStatus: MemoEvent["revealStatus"];
  revealAt: number | null;
  timezone: string;
  everyoneSeesAll: boolean;
}
export interface PhotoCounts { mine: number; total: number }
export type JoinResult = { role: "organizador" | "membro"; eventId: string };

export interface EventRepository {
  /** Prévia do convite por código, mesmo para quem não é membro (no servidor, RPC; localmente, a partir do evento). */
  preview(code: string, now: number): Promise<EventPreview | undefined>;
  /** Contagens sem conteúdo (rolo e espera). No servidor quem decide o escopo é a sessão, não os parâmetros. */
  counts(eventId: string, who: { userId: string | null; host: boolean }): Promise<PhotoCounts>;
  /** Entrada por código no servidor (RPC `join_event`). Ausente nos adaptadores locais, que validam no cliente. */
  join?(code: string, name: string, table?: string, token?: string): Promise<JoinResult>;
  /** "Revelar agora" no servidor (RPC `reveal_now`, a mesma do Master). Ausente nos adaptadores locais, que aplicam a mesma regra no cliente. */
  revealNow?(eventId: string, reason?: string): Promise<void>;
  list(): Promise<MemoEvent[]>;
  /** Só os eventos que a pessoa criou ou em que entrou (no servidor; a RLS do Master veria todos com `list`). */
  listMine?(userId: string): Promise<MemoEvent[]>;
  get(id: string): Promise<MemoEvent | undefined>;
  getByCode(code: string): Promise<MemoEvent | undefined>;
  /** Devolve o evento como gravado (com a nova `version`). */
  save(event: MemoEvent, opts?: WriteOptions): Promise<MemoEvent>;
  remove(id: string): Promise<void>;
}
export interface ParticipantRepository {
  /** Moderação persistente, autorizada pelo anfitrião do evento. */
  setBlocked?(eventId: string, userId: string, blocked: boolean): Promise<void>;
  listByEvent(eventId: string): Promise<Participant[]>;
  count(eventId: string): Promise<number>;
  get(eventId: string, userId: string): Promise<Participant | undefined>;
  put(p: Participant): Promise<void>;
  remove(eventId: string, userId: string): Promise<void>;
  removeByEvent(eventId: string): Promise<void>;
}
export interface PhotoRepository {
  /** Denúncia dedicada; na nuvem chama report_photo, sem UPDATE genérico. */
  report?(photoId: string, reason?: string): Promise<void>;
  listByEvent(eventId: string): Promise<Photo[]>;
  get(id: string): Promise<Photo | undefined>;
  count(eventId: string, filter?: PhotoCountFilter): Promise<number>;
  /** Mais novas primeiro; `cursor` opaco devolvido em `nextCursor`. */
  page(eventId: string, opts: { limit: number; cursor?: string | null }): Promise<Page<Photo>>;
  /** Fase 1: cria a linha `enviando` (invisível nas listas, mas reserva o rolo). Idempotente por `id`. */
  begin(photo: Photo): Promise<Photo>;
  /** Fase 2: grava os bytes. Foto inexistente é `not-found`. */
  attach(id: string, data: PhotoData): Promise<void>;
  /** Fase 3: publica (`pronta`). Sem bytes é `invalid`. */
  finalize(id: string): Promise<Photo>;
  /** Envios que não terminaram (para retomar ou limpar). */
  pending(eventId: string): Promise<Photo[]>;
  /** Idempotente por `id`: reenvio da mesma foto não duplica nem sobrescreve. */
  add(photo: Photo, data: PhotoData): Promise<void>;
  /** URL de exibição; `thumb` cai para a imagem inteira quando não há miniatura. */
  getUrl(id: string, size: PhotoSize): Promise<PhotoUrl | undefined>;
  /** Versionado; foto inexistente é `not-found`. */
  update(photo: Photo, opts?: WriteOptions): Promise<Photo>;
  getData(id: string): Promise<PhotoData | undefined>;
  remove(id: string): Promise<void>;
  removeByEvent(eventId: string): Promise<void>;
}
export interface ReactionRepository {
  listByEvent(eventId: string): Promise<Reaction[]>;
  put(r: Reaction): Promise<void>;
  remove(photoId: string, authorId: string): Promise<void>;
  removeByPhoto(photoId: string): Promise<void>;
  removeByEvent(eventId: string): Promise<void>;
}
export interface InvitationRepository {
  listByEvent(eventId: string): Promise<Invitation[]>;
  put(i: Invitation): Promise<void>;
  remove(id: string): Promise<void>;
  removeByEvent(eventId: string): Promise<void>;
}
export interface UserRepository {
  current(): Promise<User | undefined>;
  /** Define a pessoa atual e a lembra na lista de identidades deste aparelho. */
  save(u: User): Promise<void>;
  /** Sai da pessoa atual, mas mantém as identidades conhecidas (o anfitrião volta ao painel). */
  clear(): Promise<void>;
  known(): Promise<User[]>;
  switchTo(id: string): Promise<User | undefined>;
}

export interface Repositories {
  events: EventRepository;
  participants: ParticipantRepository;
  photos: PhotoRepository;
  reactions: ReactionRepository;
  invitations: InvitationRepository;
  users: UserRepository;
}

/** Lançado quando o navegador não oferece IndexedDB (modo privado, cota, bloqueio). */
export class StorageUnavailableError extends RepositoryError {
  constructor(cause?: unknown) {
    super("unavailable", "Armazenamento local indisponível", cause);
    this.name = "StorageUnavailableError";
  }
}
