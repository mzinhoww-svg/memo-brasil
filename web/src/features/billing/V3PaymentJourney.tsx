"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAdmin } from "@/features/admin/context";
import { BillingUnavailableError, formatBRL, getPublicSettings, listPublicPlans, openOrder, quote } from "./api";
import { currentPlanCode } from "./entitlement";
import { parseReturn, QUOTE_BLOCK } from "./flow";
import { EmbeddedPaymentCheckout } from "./EmbeddedPaymentCheckout";
import { CodeApplied, RedeemCode } from "./RedeemCode";
import { guestsInput, isUpgrade, planSupports, recommendForGuests, salePlans } from "./v3-plan";
import type { OrderView, PublicPlan, PublicSettings, Quote } from "./types";
import styles from "./V3PaymentJourney.module.css";

type Phase = "capacity" | "offer" | "checkout";
type QuoteState = { code: string; quote: Quote | null; failed: boolean };
const OPEN = new Set(["criado", "pendente"]);
const cap = (p: PublicPlan) => p.maxGuests === null ? "Sem limite" : `${p.maxGuests} pessoas`;

export function V3PaymentJourney() {
  const { event, participants, refresh } = useAdmin();
  const search = useSearchParams();
  const eventId = event.id;
  const [guests, setGuests] = useState(() => guestsInput(search?.get("convidados") ?? null, Math.max(30, participants.length)));
  const [phase, setPhase] = useState<Phase>("capacity");
  const [plans, setPlans] = useState<PublicPlan[] | null>(null);
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [currentCode, setCurrentCode] = useState("gratis");
  const [q, setQ] = useState<QuoteState | null>(null);
  const [order, setOrder] = useState<OrderView | null>(null);
  const [applied, setApplied] = useState<{ code: string; planCode: string } | null>(null);
  // Old Checkout Pro callbacks can still arrive for existing pending purchases.
  // Query params are never accepted as proof of payment.
  const [returnHint] = useState(() => typeof window === "undefined" ? null : parseReturn(window.location.search));
  useEffect(() => {
    if (typeof window === "undefined" || !returnHint) return;
    if (window.location.search !== returnHint.search)
      window.history.replaceState(window.history.state, "", window.location.pathname + returnHint.search + window.location.hash);
  }, [returnHint]);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, s, c, existing] = await Promise.all([
        listPublicPlans(), getPublicSettings(), currentPlanCode(eventId),
        openOrder(eventId).catch(e => { if (e instanceof BillingUnavailableError) return null; throw e; }),
      ]);
      setPlans(p); setSettings(s); setCurrentCode(c);
      if (existing && (OPEN.has(existing.status) || returnHint?.hint)) setOrder(existing);
      setLoadError(false);
    } catch { setLoadError(true); }
  }, [eventId, returnHint]);
  useEffect(() => { void load(); }, [load]);

  const sale = useMemo(() => salePlans(plans ?? []), [plans]);
  const recommended = useMemo(() => recommendForGuests(sale, guests), [sale, guests]);
  const current = sale.find(p => p.code === currentCode);
  const covered = planSupports(current, guests);
  const target = covered ? current : recommended;
  const upgrade = !!target && isUpgrade(sale, currentCode, target.code);
  const paying = !!target && !target.isFree && upgrade;

  useEffect(() => {
    if (!target || !paying) return;
    let cancelled = false;
    quote(eventId, target.code).then(quote => {
      if (!cancelled) setQ({ code: target.code, quote, failed: false });
    }).catch(() => {
      if (!cancelled) setQ({ code: target.code, quote: null, failed: true });
    });
    return () => { cancelled = true; };
  }, [eventId, target, paying]);

  const qCurrent = q !== null && q.code === target?.code && !q.failed ? q.quote : null;
  const amount = paying ? qCurrent?.amountCents : 0;
  const blocked = qCurrent && !qCurrent.payable ? (QUOTE_BLOCK[qCurrent.reason] ?? "Este plano está indisponível.") : null;
  const canCheckout = paying && !!qCurrent?.payable && settings?.paymentsEnv !== "desligado";
  const label = target?.code === "grande" ? "Premium · Grande" : (target?.name ?? "Sob consulta");

  const onPaid = useCallback(() => {
    void currentPlanCode(eventId).then(setCurrentCode);
    void refresh();
  }, [eventId, refresh]);

  if (loadError) return <section className={styles.shell} role="alert"><h1>Não conseguimos carregar os planos.</h1><p>Seu evento continua salvo.</p><button className={styles.primary} onClick={() => void load()}>Tentar novamente</button></section>;
  if (!plans || !settings) return <section className={styles.shell} role="status">Preparando os planos…</section>;

  return (
    <div className={styles.shell} data-testid="payment-v3">
      <header className={styles.header}>
        <div className={styles.brand}><span aria-hidden="true">◉</span> memories<span>MT</span></div>
        <span>Um evento. Mil histórias.</span>
      </header>
      <nav className={styles.progress} aria-label="Etapas do pagamento">
        {(["capacity", "offer", "checkout"] as Phase[]).map((p, i) => (
          <span key={p} className={phase === p ? styles.active : ""} aria-current={phase === p ? "step" : undefined}>
            {i + 1}. {["Capacidade", "Seu plano", "Pagamento"][i]}
          </span>
        ))}
      </nav>
      <div className={styles.columns}>
        <section className={styles.panel}>
          {applied ? (
            <CodeApplied plan={plans.find(p => p.code === applied.planCode)}
              code={applied.code} eventTitle={event.title}
              backHref={`/painel/${eventId}`} printHref={`/painel/${eventId}/qr`}/>
          ) : order ? (
            <EmbeddedPaymentCheckout
              eventId={eventId} planCode={order.planCode || target?.code || ""}
              amountCents={order.amountCents} initialOrder={order} onPaid={onPaid}
            />
          ) : phase === "capacity" ? (
            <>
              <p className={styles.kicker}>Sua história começa aqui</p>
              <h1 className={styles.title}>Quantas pessoas vão <em>viver essa história?</em></h1>
              <p className={styles.description}>Seu evento e suas personalizações já estão salvos. Escolha a capacidade ideal para todos participarem.</p>
              <div className={styles.counter}>
                <label htmlFor="v3-guests">Participantes previstos</label>
                <div className={styles.number}><input id="v3-guests" type="number" inputMode="numeric" min={1} max={100000} value={guests}
                  onChange={e => { const n = Number(e.target.value); if (Number.isSafeInteger(n) && n >= 1 && n <= 100000) setGuests(n); }}/><span>pessoas</span></div>
                <input type="range" aria-label="Ajustar participantes" min={1} max={500} value={Math.min(guests, 500)} onChange={e => setGuests(Number(e.target.value))}/>
                <div className={styles.scale}><span>1</span><span>100</span><span>250</span><span>500</span></div>
                <p className={styles.caption}>Os limites são definidos por participantes que entram no evento, não por visualizações do convite.</p>
              </div>
              <div className={styles.tiers} aria-label="Planos disponíveis">
                {sale.map(p => <div key={p.code} className={`${styles.tier} ${p.code === target?.code ? styles.selected : ""}`}>
                  <strong>{p.maxGuests ?? "∞"}</strong><small>{p.isFree ? "Grátis" : formatBRL(p.priceCents)}</small>
                </div>)}
              </div>
              {target ? <div className={styles.recommend} data-testid="recommended-v3">
                <small>Plano indicado</small><strong>{label} · {cap(target)}</strong>
                <small>{covered ? "Seu plano atual já atende à previsão." : `${(target.maxGuests ?? guests) - guests} vagas acima da sua previsão.`}</small>
              </div> : <p className={styles.notice}>Seu evento exige uma capacidade acima dos planos atuais. Fale com a equipe.</p>}
              <div className={styles.buttons}>
                <Link className={styles.secondary} href={`/painel/${eventId}`}>Voltar ao painel</Link>
                {target ? <button className={styles.primary} type="button" onClick={() => setPhase("offer")}>Ver meu plano →</button> :
                  <a className={styles.primary} href={`mailto:${settings.supportEmail ?? "mazinhoww@gmail.com"}?subject=Evento%20maior`}>Pedir orçamento</a>}
              </div>
            </>
          ) : phase === "offer" ? (
            <>
              <p className={styles.kicker}>Uma experiência para {guests} pessoas</p>
              <h1 className={styles.title}>Mais do que fotos. <em>A história contada por todos.</em></h1>
              <p className={styles.description}>Pague uma única vez pelo evento. Seus convidados entram sem cobrança individual.</p>
              <div className={styles.benefits}>
                <div><b>↗</b><span><strong>QR Code para convidados</strong><small>Sem precisar instalar aplicativo.</small></span></div>
                <div><b>▣</b><span><strong>Câmera colaborativa</strong><small>Fotos reunidas em uma galeria coletiva.</small></span></div>
                <div><b>◷</b><span><strong>Revelação programada</strong><small>O organizador escolhe quando abrir a galeria.</small></span></div>
              </div>
              <div className={styles.priceBox}><div><small>Plano {label}</small><strong>{target ? cap(target) : "—"}</strong><small>Sem assinatura</small></div><strong className={styles.price}>{paying ? amount === undefined ? "Consultando…" : formatBRL(amount) : "Já incluído"}</strong></div>
              {!!qCurrent?.fromPlanCode && <p className={styles.caption}>Upgrade calculado pelo servidor: você paga somente a diferença.</p>}
              <details className="plano-codigo" style={{ marginTop: 20 }}>
                <summary style={{ cursor: "pointer", fontWeight: 750 }}>Tenho um código de presente</summary>
                <RedeemCode eventId={eventId} onApplied={(r) => {
                  setApplied({ code: r.code, planCode: r.planCode ?? "" });
                  void currentPlanCode(eventId).then(setCurrentCode);
                  void refresh();
                }}/>
              </details>
              {blocked && <p role="status" className={styles.notice}>{blocked}</p>}
              <div className={styles.buttons}>
                <button className={styles.secondary} onClick={() => setPhase("capacity")}>Alterar capacidade</button>
                {covered ? <Link className={styles.primary} href={`/painel/${eventId}/qr`}>Voltar ao QR Code →</Link> :
                  <button className={styles.primary} disabled={!canCheckout} onClick={() => setPhase("checkout")}>{settings.paymentsEnv === "desligado" ? "Venda indisponível" : "Continuar para pagamento →"}</button>}
              </div>
              <p className={styles.caption}>Preço exibido conforme cotação real do servidor. Nenhuma cobrança é feita antes da confirmação no Mercado Pago.</p>
            </>
          ) : (
            <EmbeddedPaymentCheckout
              eventId={eventId} planCode={target?.code ?? ""}
              amountCents={amount ?? 0} onPaid={onPaid}
            />
          )}
        </section>
        <aside className={styles.aside} aria-label="Resumo do evento">
          <div className={styles.art}>
            <span className={styles.glowOne}/><span className={styles.glowTwo}/>
            <div><span className={styles.artEyebrow}>Sua festa ganha vida</span><h2>{event.title}</h2>
              <small>{new Date(event.startAt).toLocaleDateString("pt-BR", {timeZone: event.timezone || "America/Cuiaba", dateStyle:"long"})}</small>
            </div>
          </div>
          <div className={styles.receipt}>
            <p className={styles.kicker}>Resumo da experiência</p>
            <h3>Uma festa para guardar.</h3>
            <dl>
              <div><dt>Convidados previstos</dt><dd>{guests}</dd></div>
              <div><dt>Plano</dt><dd>{label}</dd></div>
              <div><dt>Capacidade</dt><dd>{target ? cap(target) : "Sob consulta"}</dd></div>
              <div><dt>Convidados pagam?</dt><dd>Não</dd></div>
              <div className={styles.total}><dt>Total deste upgrade</dt><dd>{amount === undefined ? "—" : formatBRL(amount)}</dd></div>
            </dl>
            <p>✓ Pagamento único, sem renovação.<br/>✓ Capacidade liberada após confirmação.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
