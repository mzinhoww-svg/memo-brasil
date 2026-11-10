import type { MemoEvent } from "@/domain/event";
import { computeRevealStatus } from "@/domain/reveal";
import { RepositoryError, type Repositories } from "@/repositories";
import { mutateEvent } from "./service";

export type RevealNowResult = { ok: true; event?: MemoEvent } | { ok: false; reason: "sem-permissao" | "ja-revelado" | "indisponivel" | "inexistente" | "erro" };

/** Texto para a pessoa, por motivo de recusa. */
export const REVEAL_NOW_MESSAGES: Record<Extract<RevealNowResult, { ok: false }>["reason"], string> = {
  "sem-permissao": "Só o anfitrião do evento pode revelar agora.",
  "ja-revelado": "Este evento já foi revelado.",
  indisponivel: "A revelação deste evento não está ligada ou o evento foi excluído.",
  inexistente: "Não achamos este evento.",
  erro: "Não foi possível revelar agora. Tente de novo.",
};

/**
 * "Revelar agora" do anfitrião (17c): UMA regra, a do servidor. Na nuvem chama a RPC `reveal_now` (a mesma do Master, M08), que revela na hora,
 * registra a auditoria e enfileira o e-mail uma vez só. Sem servidor (modo local) aplica a mesma regra pelo repositório: recusa evento já
 * revelado ou sem revelação ligada e grava `revealedAt` (o estado vira `revelada` e não volta).
 */
export async function revealNow(repos: Repositories, event: MemoEvent, now: number): Promise<RevealNowResult> {
  if (repos.events.revealNow) {
    try {
      await repos.events.revealNow(event.id);
      return { ok: true, event: await repos.events.get(event.id) };
    } catch (e) {
      if (e instanceof RepositoryError) {
        if (e.code === "forbidden") return { ok: false, reason: "sem-permissao" };
        if (e.code === "reveal-locked") return { ok: false, reason: "ja-revelado" };
        if (e.code === "invalid") return { ok: false, reason: "indisponivel" };
        if (e.code === "not-found") return { ok: false, reason: "inexistente" };
        return { ok: false, reason: "erro" };
      }
      throw e;
    }
  }
  return mutateEvent<RevealNowResult>(repos, event.id, { ok: false, reason: "inexistente" }, async (e) => {
    if (!e.revealEnabled) return { fail: { ok: false, reason: "indisponivel" } };
    if (computeRevealStatus(e, now) === "revelada") return { fail: { ok: false, reason: "ja-revelado" } };
    return { next: { ...e, revealedAt: now, revealStatus: "revelada" }, done: (saved) => ({ ok: true, event: saved }) };
  });
}
