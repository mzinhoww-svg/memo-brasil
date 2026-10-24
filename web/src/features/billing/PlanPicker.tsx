"use client";

import { contactFrom } from "@/components/memoriesmt/SiteFooter";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/memoriesmt";
import { formatBRL, quote } from "./api";
import { PLAN_TEXT, QUOTE_BLOCK, planRank } from "./flow";
import { PlanCard } from "./PlanCard";
import { RedeemCode, type RedeemCodeProps } from "./RedeemCode";
import { TrustBlock } from "./TrustBlock";
import type { PublicPlan, PublicSettings, Quote } from "./types";

const RECOMMENDED = "casamento";

type Props = {
  eventId: string;
  plans: PublicPlan[];
  currentCode: string;
  settings: PublicSettings;
  busy: boolean;
  error?: string | null;
  onPay: (planCode: string) => void;
  onRedeemed: RedeemCodeProps["onApplied"];
  /** Plano vindo de `?plano=<code>` (assistente): pré-seleciona se for maior que o atual. */
  initialPlan?: string | null;
};

/** B1 (escolha) e B7 (pagamentos desligados). Preços e valor a pagar vêm do servidor. */
export function PlanPicker({ eventId, plans, currentCode, settings, busy, error, onPay, onRedeemed, initialPlan }: Props) {
  const rank = planRank(plans, currentCode);
  const higher = useMemo(() => plans.filter((_, i) => i > rank), [plans, rank]);
  const paidOff = plans.every((p) => p.isFree);
  const [selected, setSelected] = useState<string>("");
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [q, setQ] = useState<{ code: string; quote: Quote | "erro" } | null>(null);

  const chosen = selected || higher.find((p) => p.code === initialPlan)?.code || (higher.find((p) => p.code === RECOMMENDED) ?? higher[0])?.code || "";
  const plan = plans.find((p) => p.code === chosen);

  useEffect(() => {
    if (!chosen || paidOff) return;
    let cancelled = false;
    quote(eventId, chosen).then((r) => { if (!cancelled) setQ({ code: chosen, quote: r }); }, () => { if (!cancelled) setQ({ code: chosen, quote: "erro" }); });
    return () => { cancelled = true; };
  }, [eventId, chosen, paidOff]);

  const support = contactFrom(settings);
  const mail = (subject: string) => `mailto:${support}?subject=${encodeURIComponent(subject)}`;

  if (paidOff) {
    const talk = mail("Plano maior para o meu evento");
    return (
      <div className="plano-escolha" data-testid="pagamentos-desligados">
        <h1 className="titulo-tela app-h1">{PLAN_TEXT.titulo}</h1>
        <div className="plano-lista" role="radiogroup" aria-label="Planos">
          {plans.map((p) => <PlanCard key={p.code} plan={p} name="plano" selected={false} badge={p.code === currentCode ? "Seu plano" : undefined} onSelect={() => undefined} />)}
        </div>
        <section className="plano-cartao">
          <h2 className="titulo-card app-h1">Evento maior?</h2>
          <p className="app-p app-muted">Os planos pagos voltam em breve. Enquanto isso, fale com a gente e liberamos o seu evento.</p>
          <Button href={talk} variant="secundario" block>Falar com a gente</Button>
        </section>
        <RedeemCode eventId={eventId} onApplied={onRedeemed} />
      </div>
    );
  }

  const cur = q && q.code === chosen ? q.quote : null;
  const blocked = cur && cur !== "erro" && !cur.payable ? (QUOTE_BLOCK[cur.reason] ?? "Este plano não pode ser comprado agora.") : null;
  const pay = cur && cur !== "erro" ? cur.amountCents : plan?.priceCents;
  const diff = cur && cur !== "erro" && plan && cur.payable && cur.amountCents !== plan.priceCents;
  const biggest = plans[plans.length - 1];
  const more = mail("Evento com mais convidados");

  return (
    <div className="plano-escolha">
      <h1 className="titulo-tela app-h1">{PLAN_TEXT.titulo}</h1>
      <p className="app-p app-muted">{PLAN_TEXT.sub}</p>
      <div className="plano-colunas">
        <div className="app-stack">
          <div className="plano-lista" role="radiogroup" aria-label="Planos">
            {plans.map((p, i) => {
              const isCurrent = p.code === currentCode;
              const included = i <= rank;
              return <PlanCard key={p.code} plan={p} name="plano" selected={p.code === chosen && !included} disabled={included} badge={isCurrent ? "Seu plano" : included ? "Incluído" : undefined} onSelect={() => setSelected(p.code)} />;
            })}
          </div>
          <div className="plano-links">
            {more && biggest && <a href={more}>Mais de {biggest.maxGuests ?? 500} convidados? Fale com a gente</a>}
            <button type="button" className="plano-link" aria-expanded={redeemOpen} onClick={() => setRedeemOpen((v) => !v)}>Tenho um código</button>
          </div>
          {redeemOpen && <RedeemCode eventId={eventId} onApplied={onRedeemed} onClose={() => setRedeemOpen(false)} />}
        </div>
        <div className="app-stack plano-resumo">
          {plan && <TrustBlock plan={plan} gracePct={settings.capacityGracePct} />}
          {diff && <p className="app-p app-muted" data-testid="diferenca">Você paga só a diferença do seu plano atual: {formatBRL(pay ?? 0)}.</p>}
          {blocked && <p className="app-p" role="status">{blocked}</p>}
          {error && <p className="plano-erro" role="alert">{error}</p>}
          {plan && (
            <dl className="plano-resumo-pedido" data-testid="resumo-pedido">
              <div><dt>Plano</dt><dd>{plan.name}</dd></div>
              <div><dt>Total</dt><dd>{pay !== undefined ? formatBRL(pay) : "—"}</dd></div>
              <div><dt>Como paga</dt><dd>Pagamento único por evento, sem assinatura</dd></div>
            </dl>
          )}
          <div className="plano-pagar">
            <Button variant="cta" block disabled={busy || !plan || !!blocked} aria-busy={busy} onClick={() => onPay(chosen)}>
              {busy ? "Abrindo o Mercado Pago…" : pay !== undefined ? <>Pagar com Mercado Pago · <span className="nowrap">{formatBRL(pay)}</span></> : "Pagar com Mercado Pago"}
            </Button>
          </div>
          <p className="app-p app-muted plano-nota">Você conclui o pagamento no Mercado Pago, com as formas disponíveis para você (cartão e, quando houver, Pix), e volta para cá. O plano libera assim que o pagamento for confirmado.</p>
        </div>
      </div>
    </div>
  );
}
