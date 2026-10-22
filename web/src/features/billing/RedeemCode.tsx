"use client";

import { useState } from "react";
import { Button, Field, Sheet } from "@/components/memoriesmt";
import { normalizeCode, redeemCode, type RedeemResult } from "./api";
import { joinGuests } from "./flow";
import type { PublicPlan } from "./types";

export const REDEEM_TEXT = {
  invalido: "Esse código não existe, expirou ou já foi usado. Confira as letras e tente de novo.",
  muitas_tentativas: "Muitas tentativas. Tente de novo em 10 minutos.",
  ja_incluido: "Seu evento já tem este plano ou um maior. O código continua livre para outra festa.",
  evento_encerrado: "Este evento já terminou. O código continua livre para outra festa.",
  falha: "Não foi possível aplicar o código agora. Tente de novo em instantes.",
} as const;

/** Motivo de recusa -> texto. Qualquer motivo desconhecido vira a mensagem neutra de código inválido. */
export function redeemMessage(reason: string): string {
  if (reason === "ja_incluido" || reason === "muitas_tentativas" || reason === "evento_encerrado") return REDEEM_TEXT[reason];
  return REDEEM_TEXT.invalido;
}

/** B8: cartão "Tenho um código". Letras maiúsculas automáticas; espaços e hífens são ignorados na conferência. */
export type RedeemCodeProps = { eventId: string; onApplied: (r: RedeemResult & { code: string }) => void; onClose?: () => void };
export function RedeemCode({ eventId, onApplied, onClose }: RedeemCodeProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  async function apply(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !value.trim()) return;
    setBusy(true);
    setError(undefined);
    try {
      const code = normalizeCode(value);
      const r = await redeemCode(eventId, code);
      if (r.applied && r.reason === "ok") onApplied({ ...r, code });
      else setError(r.reason === "ok" ? REDEEM_TEXT.falha : redeemMessage(r.reason));
    } catch {
      setError(REDEEM_TEXT.falha);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="plano-codigo" onSubmit={apply} aria-labelledby="codigo-titulo" data-testid="cartao-codigo">
      <div className="plano-codigo-topo">
        <h2 id="codigo-titulo" className="titulo-card app-h1">Tenho um código</h2>
        {onClose && <button type="button" className="plano-fechar" onClick={onClose} aria-label="Fechar">×</button>}
      </div>
      <p className="app-p app-muted">Ganhou um código de presente ou de teste? Ele libera o plano sem pagar.</p>
      <div className="plano-codigo-linha">
        <Field label="Código" value={value} onChange={(e) => setValue(e.target.value.toUpperCase())} error={error} placeholder="MMT-XXXX-XXXX" autoCapitalize="characters" autoComplete="off" spellCheck={false} code />
        <Button type="submit" disabled={busy || !value.trim()}>{busy ? "Aplicando…" : "Aplicar"}</Button>
      </div>
    </form>
  );
}

/** Mesmo cartão em folha (Ajustes › Código de presente; /c/<código>). */
export function RedeemCodeSheet({ eventId, onApplied, onClose }: { eventId: string; onApplied: (r: RedeemResult & { code: string }) => void; onClose: () => void }) {
  return (
    <Sheet title="Código de presente" onClose={onClose}>
      <RedeemCode eventId={eventId} onApplied={onApplied} />
    </Sheet>
  );
}

/** B9: código aplicado. */
export function CodeApplied({ plan, code, eventTitle, backHref, printHref }: { plan: PublicPlan | undefined; code: string; eventTitle: string; backHref: string; printHref: string }) {
  const name = plan?.name ?? "";
  return (
    <div className="plano-estado" data-testid="codigo-aplicado">
      <span className="plano-selo" aria-hidden="true">✓</span>
      <p className="plano-eyebrow">Código aplicado</p>
      <h1 className="titulo-tela app-h1" aria-live="polite">{name ? `Plano ${name} liberado.` : "Plano liberado."}</h1>
      {plan && <p className="app-p app-muted">{joinGuests(plan.maxGuests, plan.maxShots).replace(/\.$/, "")}, sem pagar nada. Presente de MemoriesMT.</p>}
      <dl className="plano-recibo">
        <div><dt>Código</dt><dd>{code}</dd></div>
        <div><dt>Valor</dt><dd>R$ 0,00</dd></div>
        <div><dt>Vale para</dt><dd>{eventTitle} · este evento</dd></div>
      </dl>
      <p className="app-p app-muted plano-nota">Cada código vale para um evento. Ele não vira dinheiro nem desconto em outro plano.</p>
      <div className="app-stack-sm plano-acoes">
        <Button href={backHref} block>Voltar ao painel</Button>
        <Button href={printHref} variant="secundario" block>Imprimir os cards das mesas</Button>
      </div>
    </div>
  );
}
