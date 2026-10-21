import type { PlannedNotification } from "@/domain/notifications";
import type { Capacity } from "@/domain/options";
import type { User } from "@/repositories";

/**
 * Contratos que a fase Supabase vai implementar. Nesta fase só existem implementações locais
 * ou de demonstração, sem rede e sem cobrança.
 */
export interface AuthService {
  current(): Promise<User | undefined>;
  /** Identidade local (neste navegador). Autenticação real depende do backend. */
  signIn(name: string): Promise<User>;
  signOut(): Promise<void>;
}

export type PurchaseRequest = { kind: "evento"; capacity: Capacity } | { kind: "memo-plus"; plan: "mensal" | "anual" };
export interface BillingService {
  readonly mode: "demo";
  plusActive(): Promise<boolean>;
  purchase(req: PurchaseRequest): Promise<never>;
}
export class DemoOnlyError extends Error {
  constructor() {
    super("Pagamento indisponível nesta versão");
    this.name = "DemoOnlyError";
  }
}
/** Nunca cobra e nunca finge cobrar. */
export const localBilling: BillingService = {
  mode: "demo",
  plusActive: async () => false,
  purchase: async () => {
    throw new DemoOnlyError();
  },
};

export interface NotificationScheduler {
  schedule(eventId: string, plan: PlannedNotification[]): void;
  cancel(eventId: string): void;
}

/** Sincronização entre aparelhos: inexistente até o backend. */
export interface SyncService {
  readonly mode: "somente-local";
}
export const localSync: SyncService = { mode: "somente-local" };
