import type { MemoEvent } from "./event";

/**
 * Papéis e política de acesso (CONTRATO). Isto NÃO é segurança: no cliente qualquer um pode alterar o código.
 * Serve para a interface esconder o que não cabe a cada papel e para o backend futuro (RLS + claims) implementar
 * a mesma tabela. O papel `master` nunca vem de senha fixa, URL ou estado do navegador: só de uma claim emitida
 * pelo servidor de autenticação (`app_metadata.role = 'master'`), que não existe nesta fase.
 */
export type Role = "convidado" | "organizador" | "master";
export interface Actor {
  userId: string | null;
  /** Só o backend pode conceder `master`; o cliente local nunca produz esse valor. */
  role: Role;
}
export type Action = "event.view" | "event.configure" | "reveal.configure" | "photo.moderate" | "event.delete" | "platform.supervise";

export const LOCAL_ACTOR = (userId: string | null): Actor => ({ userId, role: "organizador" });

export function can(actor: Actor, action: Action, event?: Pick<MemoEvent, "hostId">): boolean {
  if (actor.role === "master") return true; // supervisão de plataforma (auditada no backend)
  const owns = Boolean(event && actor.userId && event.hostId === actor.userId);
  switch (action) {
    case "platform.supervise":
      return false;
    case "event.view":
      return owns || actor.role === "convidado"; // convidado vê a área pública do evento; o dono vê o painel
    case "event.configure":
    case "reveal.configure":
    case "photo.moderate":
    case "event.delete":
      return actor.role === "organizador" && owns;
  }
}

/** Contrato para o painel master (implementado só com o backend; aqui apenas a forma). */
export interface MasterRepository {
  listEvents(filter?: { status?: "ativo" | "encerrado"; hostId?: string }): Promise<MemoEvent[]>;
  /** Reabre/ajusta revelação em nome do organizador, com registro em audit_logs. */
  overrideReveal(eventId: string, input: { enabled: boolean; at: number | null }, reason: string): Promise<void>;
  suspendEvent(eventId: string, reason: string): Promise<void>;
}
export class BackendRequiredError extends Error {
  constructor(what = "Administração da plataforma") {
    super(`${what} depende do backend`);
    this.name = "BackendRequiredError";
  }
}
export const unavailableMasterRepository: MasterRepository = {
  listEvents: async () => { throw new BackendRequiredError(); },
  overrideReveal: async () => { throw new BackendRequiredError(); },
  suspendEvent: async () => { throw new BackendRequiredError(); },
};
