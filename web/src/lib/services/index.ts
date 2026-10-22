import type { PlannedNotification } from "@/domain/notifications";
import type { User } from "@/repositories";

/**
 * Contratos de serviços locais. Cobrança não mora aqui: preço, plano e pedido vêm do servidor
 * (ver `@/features/billing/api`).
 */
export interface AuthService {
  current(): Promise<User | undefined>;
  /** Identidade local (neste navegador). Autenticação real depende do backend. */
  signIn(name: string): Promise<User>;
  signOut(): Promise<void>;
}

export interface NotificationScheduler {
  schedule(eventId: string, plan: PlannedNotification[]): void;
  cancel(eventId: string): void;
}

/** Sincronização entre aparelhos: inexistente até o backend. */
export interface SyncService {
  readonly mode: "somente-local";
}
export const localSync: SyncService = { mode: "somente-local" };
