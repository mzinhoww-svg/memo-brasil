// Worker de envio (puro): retira um lote pequeno da fila, envia pelo gateway e registra o resultado.
// Regras: só quem tem opt-in (a fila já filtra), 409 NO_OPT_IN nunca é reenviado, erros passageiros reagendam com espera crescente,
// 429/401 param o lote, e os envios são espaçados (o gateway ainda aplica a fila de 4 a 9 s e o teto de 60/h).
import { WaGatewayError } from "./wa-gateway.ts";

export type ClaimedItem = { event_id: string; user_id: string; kind: string; phone: string | null; title: string; code: string; attempts: number };
export type MarkStatus = "enviado" | "pendente" | "revogado" | "falhou";
export type DispatchDeps = {
  enabled: () => Promise<boolean>;
  claim: (limit: number, hourlyCap: number) => Promise<ClaimedItem[]>;
  send: (i: { phone: string; text: string }) => Promise<{ id: string }>;
  mark: (item: ClaimedItem, status: MarkStatus, extra: { gatewayId?: string; error?: string; retryInS?: number }) => Promise<void>;
  /** registra a saída (optin.revoked) quando o gateway diz que a pessoa não tem opt-in */
  revoke: (item: ClaimedItem) => Promise<void>;
  sleep: (ms: number) => Promise<void>;
  siteOrigin: string;
  batch: number;
  hourlyCap: number;
  maxAttempts: number;
};
export type DispatchReport = { sent: number; retried: number; failed: number; revoked: number; stoppedEarly: boolean; skipped?: "desligado" };

const SPACING_MS = 1500;

const clean = (s: string, max: number) => s.replace(/\s+/g, " ").trim().slice(0, max);

export function buildMessage(i: ClaimedItem, origin = ""): string | null {
  if (i.kind !== "revealed") return null;
  return `Suas fotos de "${clean(i.title, 60)}" foram reveladas no Revela! 🎉\nVeja o álbum: ${origin}/e/${i.code}/agora\n\nPara parar de receber avisos, responda SAIR.`;
}

export async function runDispatch(d: DispatchDeps): Promise<DispatchReport> {
  const r: DispatchReport = { sent: 0, retried: 0, failed: 0, revoked: 0, stoppedEarly: false };
  if (!(await d.enabled())) return { ...r, skipped: "desligado" };
  const items = await d.claim(d.batch, d.hourlyCap);

  for (let n = 0; n < items.length; n++) {
    const it = items[n];
    if (!it.phone) { await d.mark(it, "revogado", { error: "sem_telefone" }); r.revoked++; continue; }
    const text = buildMessage(it, d.siteOrigin);
    if (!text) { await d.mark(it, "falhou", { error: "tipo_desconhecido" }); r.failed++; continue; }
    if (n > 0) await d.sleep(SPACING_MS);
    try {
      const res = await d.send({ phone: it.phone, text });
      await d.mark(it, "enviado", { gatewayId: res.id });
      r.sent++;
    } catch (e) {
      const code = e instanceof WaGatewayError ? e.code : "unavailable";
      if (code === "no_optin") {
        await d.mark(it, "revogado", { error: "no_optin" });
        await d.revoke(it);
        r.revoked++;
        continue;
      }
      if (it.attempts >= d.maxAttempts) { await d.mark(it, "falhou", { error: code }); r.failed++; }
      else { await d.mark(it, "pendente", { error: code, retryInS: Math.min(it.attempts * 300, 3600) }); r.retried++; }
      if (code === "rate_limited" || code === "unauthorized") { r.stoppedEarly = true; break; }
    }
  }
  return r;
}
