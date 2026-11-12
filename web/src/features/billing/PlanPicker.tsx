"use client";

import { contactFrom } from "@/components/revela/SiteFooter";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/revela";
import { formatBRL, quote } from "./api";
import { PLAN_TEXT, QUOTE_BLOCK, planRank } from "./flow";
import { PlanCard } from "./PlanCard";
import { RedeemCode, type RedeemCodeProps } from "./RedeemCode";
import { validapayCheckoutEnabled } from "./checkout-provider";
import { TrustBlock } from "./TrustBlock";
import type { PublicPlan, PublicSettings, Quote } from "./types";
import { PlanoConteudo, type Gauge } from "@/revela/screens/PlanoConteudo";
import { PainelFoot, ScreenH1 } from "@/revela/painel-ui";
import type { PlanView } from "@/revela/screens/CameraPublicar";

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
  /** Uso atual do evento, para os medidores do plano (convidados dentro e poses por pessoa). */
  usage?: { guests: number; shots: number | null };
};

const money = (cents: number) => (cents % 100 === 0 ? `R$ ${cents / 100}` : formatBRL(cents));
const planView = (p: PublicPlan, last: boolean, n: number): PlanView => ({
  code: p.code, tier: p.name, price: p.isFree ? "Grátis" : money(p.priceCents),
  lines: [p.maxGuests === null ? "convidados sem limite" : `${p.maxGuests} convidados`, p.maxShots === null ? "poses livres" : `${p.maxShots} poses cada`],
  gold: !p.isFree && last && n > 2,
});

/**
 * B1 (escolha) e B7 (pagamentos desligados). Preços e valor a pagar vêm do servidor.
 * Roda dentro do quadro do painel: o título é da rota, o botão de pagar vai para o rodapé fixo (`PainelFoot`) e o texto de
 * pagamento e os avisos ficam no fluxo, acima dele.
 */
export function PlanPicker({ eventId, plans, currentCode, settings, busy, error, onPay, onRedeemed, initialPlan, usage }: Props) {
  const native = validapayCheckoutEnabled();
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
        <ScreenH1 className="titulo-tela app-h1">{PLAN_TEXT.titulo}</ScreenH1>
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
  if (native) {
    const current = plans[rank] ?? plans[0];
    const gauges: Gauge[] = [];
    if (usage && current) {
      if (current.maxGuests !== null) gauges.push({ label: "Convidados", text: `${usage.guests} de ${current.maxGuests}`, pct: Math.min(100, Math.round((usage.guests / current.maxGuests) * 100)), warn: usage.guests >= current.maxGuests * 0.9 });
      if (current.maxShots !== null && usage.shots !== null) gauges.push({ label: "Poses por pessoa", text: `${usage.shots} de ${current.maxShots}`, pct: Math.min(100, Math.round((usage.shots / current.maxShots) * 100)) });
    }
    const left = usage && current?.maxGuests != null ? Math.max(0, current.maxGuests - usage.guests) : null;
    const nowPay = cur && cur !== "erro" && cur.payable ? cur.amountCents : plan?.priceCents;
    const blockedText = cur && cur !== "erro" && !cur.payable ? (QUOTE_BLOCK[cur.reason] ?? "Este plano não pode ser comprado agora.") : null;
    const confirm = () => { if (plan && !blockedText) onPay(chosen); };
    return (
      <div className="plano-nat">
        <PlanoConteudo
          current={current ? `${current.name} · ${current.isFree ? "Grátis" : money(current.priceCents)}` : "Grátis"}
          gauges={gauges}
          warning={left !== null && left <= 5 ? `Faltam ${left} lugares. Quem chegar depois vê "câmera lotada".` : null}
          plans={plans.map((p, i) => planView(p, i === plans.length - 1, plans.length))}
          selected={chosen} error={blockedText ?? error ?? undefined}
          onSelect={(code) => { const i = plans.findIndex((p) => p.code === code); if (i > rank) setSelected(code); }}
        />
        <PainelFoot>
          <button type="button" className="rv-btn rv-btn--block rv-btn--primary" onClick={confirm} disabled={busy || !plan || !!blockedText} aria-busy={busy || undefined}>
            {busy ? "Abrindo pagamento…" : plan && nowPay !== undefined ? `${rank >= 0 && current && !current.isFree ? "Trocar" : "Escolher"} para ${plan.name} · ${money(nowPay)}` : "Escolha um plano"}
          </button>
        </PainelFoot>
      </div>
    );
  }
  const blocked = cur && cur !== "erro" && !cur.payable ? (QUOTE_BLOCK[cur.reason] ?? "Este plano não pode ser comprado agora.") : null;
  const pay = cur && cur !== "erro" ? cur.amountCents : plan?.priceCents;
  const diff = cur && cur !== "erro" && plan && cur.payable && cur.amountCents !== plan.priceCents;
  const biggest = plans[plans.length - 1];
  const more = mail("Evento com mais convidados");

  return (
    <div className="plano-escolha">
      <ScreenH1 className="titulo-tela app-h1">{PLAN_TEXT.titulo}</ScreenH1>
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
          <p className="app-p app-muted plano-nota">Você conclui o pagamento no Mercado Pago, com as formas disponíveis para você (cartão e, quando houver, Pix), e volta para cá. O plano libera assim que o pagamento for confirmado.</p>
          <PainelFoot>
            <Button variant="cta" block disabled={busy || !plan || !!blocked} aria-busy={busy} onClick={() => onPay(chosen)}>
              {busy ? "Abrindo o Mercado Pago…" : pay !== undefined ? <>Pagar com Mercado Pago · <span className="nowrap">{formatBRL(pay)}</span></> : "Pagar com Mercado Pago"}
            </Button>
          </PainelFoot>
        </div>
      </div>
    </div>
  );
}
