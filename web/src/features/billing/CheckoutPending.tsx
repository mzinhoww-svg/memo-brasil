"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/memoriesmt";
import { formatBRL, orderStatus } from "./api";
import { PLAN_TEXT, countdown, formatDateTime, joinGuests, paymentLabel, screenFor, type ReturnHint } from "./flow";
import type { OrderView, PublicPlan } from "./types";

/** Pendente: 5 s. Expirado (o Pix pode ser confirmado depois do prazo): 15 s, no máximo 20 consultas. */
const POLL_PENDING_MS = 5000;
const POLL_EXPIRED_MS = 15000;
const POLL_EXPIRED_MAX = 20;

function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

/** Consulta o status só com a aba visível; em segundo plano pausa e, ao voltar, consulta na hora. Para quando `enabled` cai (pago/terminal). */
function useOrderPolling(orderId: string, enabled: boolean, intervalMs: number, maxTries: number, onOrder: (o: OrderView) => void) {
  const inflight = useRef(false);
  const cb = useRef(onOrder);
  useEffect(() => { cb.current = onOrder; });
  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let tries = 0;
    const tick = async () => {
      if (stopped || inflight.current || tries >= maxTries || document.visibilityState !== "visible") return;
      inflight.current = true;
      tries += 1;
      try {
        const o = await orderStatus(orderId);
        if (!stopped) cb.current(o);
      } catch { /* próxima volta tenta de novo */ } finally { inflight.current = false; }
    };
    const iv = setInterval(() => void tick(), intervalMs);
    const onVis = () => { if (document.visibilityState === "visible") void tick(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { stopped = true; clearInterval(iv); document.removeEventListener("visibilitychange", onVis); };
  }, [orderId, enabled, intervalMs, maxTries]);
}

function Header({ plan, order }: { plan?: PublicPlan; order: OrderView }) {
  return <p className="plano-eyebrow">Plano {plan?.name ?? order.planCode} · {formatBRL(order.amountCents)}</p>;
}

/**
 * Pedido do plano nas telas B2 a B5 (pendente, pago, expirado, falhou) e estornado/em disputa.
 * O estado vem sempre do servidor (`orderStatus`); `returnHint` (do `?retorno=` do Checkout Pro) só muda o texto de espera.
 */
export function CheckoutPending({ order, plans, warning, eventId, returnHint, onOrder, onNewCheckout, onChoosePlan, busy }: {
  order: OrderView; plans: PublicPlan[]; warning?: string | null; eventId: string; returnHint?: ReturnHint | null;
  onOrder: (o: OrderView) => void; onNewCheckout: () => void; onChoosePlan: () => void; busy?: boolean;
}) {
  const open = order.status === "criado" || order.status === "pendente";
  const now = useNow(open);
  const screen = screenFor(order, now);
  const plan = plans.find((p) => p.code === order.planCode);
  useOrderPolling(order.orderId, screen === "pendente", POLL_PENDING_MS, Infinity, onOrder);
  useOrderPolling(order.orderId, screen === "expirado", POLL_EXPIRED_MS, POLL_EXPIRED_MAX, onOrder);

  // vencido localmente: uma última consulta, porque o pagamento pode ter sido confirmado no último instante
  const lastCheck = useRef<string | null>(null);
  const recheck = useCallback(async () => {
    try { onOrder(await orderStatus(order.orderId)); } catch { /* mantém a tela de expirado */ }
  }, [order.orderId, onOrder]);
  useEffect(() => {
    if (open && screen === "expirado" && lastCheck.current !== order.orderId) { lastCheck.current = order.orderId; void recheck(); }
  }, [open, screen, order.orderId, recheck]);

  const painel = `/painel/${eventId}`;
  const announce = screen === "pago" ? `Pagamento confirmado. Plano ${plan?.name ?? ""} ativo.` : screen === "expirado" ? "Este pagamento expirou." : screen === "falhou" ? "O pagamento não foi concluído." : "";
  const banner = warning ? <div className="plano-aviso" role="status" data-testid="aviso-outro-plano">{warning}</div> : null;
  const live = <p className="sr-only" role="status" aria-live="polite">{announce}</p>;

  if (screen === "pendente") {
    const left = countdown(order.expiresAt, now);
    const confirming = returnHint === "sucesso" || returnHint === "pendente";
    return (
      <div className="plano-estado" data-testid="checkout-pendente">
        {live}
        <Header plan={plan} order={order} />
        <h1 className="titulo-tela app-h1">Pagamento em andamento</h1>
        {banner}
        {returnHint === "falha" && <p className="app-p">Você voltou sem concluir o pagamento. Se quiser, continue de onde parou.</p>}
        <div className="app-stack">
          {order.checkoutUrl ? (
            <a className="mm-btn mm-btn--cta mm-btn--bloco" href={order.checkoutUrl} rel="noopener">
              <span>Continuar para o Mercado Pago</span>
            </a>
          ) : (
            <p className="app-p app-muted">
              {order.provider === "abacatepay"
                ? "Este pedido foi criado antes da troca de provedor e não abre mais por aqui. Deixe expirar e comece um novo pagamento."
                : "Estamos preparando o link de pagamento. Atualize a página em instantes."}
            </p>
          )}
          <div className="plano-espera">
            <p className="plano-aguardando" aria-live="polite" role="status">
              <span aria-hidden="true" className="plano-ponto" />
              {confirming ? "Estamos confirmando seu pagamento…" : "Aguardando a confirmação do pagamento…"}
            </p>
            {left && <p className="plano-timer">Expira em <time>{left}</time></p>}
          </div>
          <section className="plano-como" aria-labelledby="como-pagar">
            <h2 id="como-pagar" className="titulo-card app-h1">Como pagar</h2>
            <p className="app-p app-muted">No Mercado Pago você escolhe a forma de pagamento (cartão e, quando houver, Pix). Quando terminar, volte para cá.</p>
          </section>
          <p className="app-p app-muted">Pode fechar esta tela. O pedido fica guardado no painel e o plano libera sozinho quando o pagamento for confirmado.</p>
          <p className="app-p app-muted">Pagamento processado pelo Mercado Pago.</p>
        </div>
      </div>
    );
  }

  if (screen === "pago") {
    const rows = [["Valor", `${formatBRL(order.amountCents)} · ${paymentLabel(order)}`], ["Pago em", formatDateTime(order.paidAt) || "—"], ["Pedido", `#${order.orderId.replace(/-/g, "").slice(0, 8).toUpperCase().replace(/^(.{4})/, "$1-")}`]];
    return (
      <div className="plano-estado" data-testid="checkout-pago">
        {live}
        <span className="plano-selo" aria-hidden="true">✓</span>
        <p className="plano-eyebrow">Pagamento confirmado</p>
        <h1 className="titulo-tela app-h1">Plano {plan?.name ?? ""} ativo.</h1>
        {plan && <p className="app-p app-muted">{joinGuests(plan.maxGuests, plan.maxShots)} Já vale para quem entrar agora.</p>}
        <dl className="plano-recibo">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
        <p className="app-p app-muted plano-nota">Guarde este comprovante. Ele também fica em Painel › Plano.</p>
        <div className="app-stack-sm plano-acoes">
          <Button href={painel} block>Voltar ao painel</Button>
          <Button href={`${painel}/qr`} variant="secundario" block>Imprimir os cards das mesas</Button>
          <Button variant="texto" block onClick={onChoosePlan}>Ver outros planos</Button>
        </div>
      </div>
    );
  }

  if (screen === "expirado") {
    return (
      <div className="plano-estado" data-testid="checkout-expirado">
        {live}
        <Header plan={plan} order={order} />
        <span className="plano-selo" aria-hidden="true">◷</span>
        <h1 className="titulo-tela app-h1">Este pagamento expirou.</h1>
        <p className="app-p app-muted">{PLAN_TEXT.expirado}</p>
        <section className="plano-cartao"><p className="app-p">Pagou agora há pouco? O plano libera sozinho. Não pague de novo.</p></section>
        <div className="app-stack-sm plano-acoes">
          <Button block onClick={onNewCheckout} disabled={busy}>Pagar de novo</Button>
          <Button variant="texto" block onClick={onChoosePlan}>Escolher outro plano</Button>
        </div>
      </div>
    );
  }

  if (screen === "falhou") {
    return (
      <div className="plano-estado" data-testid="checkout-falhou">
        {live}
        <Header plan={plan} order={order} />
        <span className="plano-selo plano-selo--erro" aria-hidden="true">×</span>
        <h1 className="titulo-tela app-h1">O pagamento não foi concluído.</h1>
        <p className="app-p app-muted">Nada foi cobrado. Tente de novo em instantes.</p>
        <div className="app-stack-sm plano-acoes">
          <Button block onClick={onNewCheckout} disabled={busy}>Tentar de novo</Button>
          <Button variant="texto" block onClick={onChoosePlan}>Escolher outro plano</Button>
        </div>
      </div>
    );
  }

  if (screen === "estornado") {
    return (
      <div className="plano-estado" data-testid="checkout-estornado">
        <Header plan={plan} order={order} />
        <h1 className="titulo-tela app-h1" aria-live="polite">Pagamento devolvido.</h1>
        <p className="app-p app-muted">O valor voltou para quem pagou. O evento segue com os limites do plano que ele tem agora.</p>
        <div className="app-stack-sm plano-acoes">
          <Button block onClick={onChoosePlan}>Escolher um plano</Button>
          <Button href={painel} variant="texto" block>Voltar ao painel</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="plano-estado" data-testid="checkout-em-disputa">
      <Header plan={plan} order={order} />
      <h1 className="titulo-tela app-h1" aria-live="polite">Pagamento em análise.</h1>
      <p className="app-p app-muted">Seus convidados continuam usando o evento.</p>
      <div className="app-stack-sm plano-acoes"><Button href={painel} block>Voltar ao painel</Button></div>
    </div>
  );
}

/** B6: provedor fora (502). O botão libera depois de 60 s e reusa a mesma chave (mesmo pedido). */
export function ProviderDown({ planName, amountLabel, onRetry, seconds = 60, busy }: { planName?: string; amountLabel?: string; onRetry: () => void; seconds?: number; busy?: boolean }) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    const t = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);
  const label = left > 0 ? `Tentar de novo em ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}` : "Tentar de novo";
  return (
    <div className="plano-estado" data-testid="provedor-fora">
      {planName && <p className="plano-eyebrow">Plano {planName}{amountLabel ? ` · ${amountLabel}` : ""}</p>}
      <span className="plano-selo plano-selo--aviso" aria-hidden="true">!</span>
      <h1 className="titulo-tela app-h1" aria-live="assertive">O sistema de pagamento não respondeu.</h1>
      <p className="app-p app-muted">{PLAN_TEXT.provedor}</p>
      <div className="app-stack-sm plano-acoes">
        <Button block disabled={left > 0 || busy} onClick={onRetry}>{label}</Button>
        <p className="app-p app-muted">Nada foi cobrado. Ao tentar de novo, é o mesmo pedido.</p>
      </div>
    </div>
  );
}
