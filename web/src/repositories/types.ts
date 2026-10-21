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

export interface EventRepository {
  list(): Promise<MemoEvent[]>;
  get(id: string): Promise<MemoEvent | undefined>;
  getByCode(code: string): Promise<MemoEvent | undefined>;
  save(event: MemoEvent): Promise<void>;
  remove(id: string): Promise<void>;
}
export interface ParticipantRepository {
  listByEvent(eventId: string): Promise<Participant[]>;
  get(eventId: string, userId: string): Promise<Participant | undefined>;
  put(p: Participant): Promise<void>;
  remove(eventId: string, userId: string): Promise<void>;
  removeByEvent(eventId: string): Promise<void>;
}
export interface PhotoRepository {
  listByEvent(eventId: string): Promise<Photo[]>;
  get(id: string): Promise<Photo | undefined>;
  add(photo: Photo, data: PhotoData): Promise<void>;
  update(photo: Photo): Promise<void>;
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
export class StorageUnavailableError extends Error {
  constructor(cause?: unknown) {
    super("Armazenamento local indisponível");
    this.name = "StorageUnavailableError";
    this.cause = cause;
  }
}
