"use client";

/* eslint-disable @next/next/no-img-element -- QR vem como data URI do servidor; next/image não agrega nada aqui */
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/memoriesmt";
import { formatBRL, orderStatus } from "./api";
import { PLAN_TEXT, countdown, formatDateTime, joinGuests, orderQrSrc, screenFor } from "./flow";
import type { OrderView, PublicPlan } from "./types";

const POLL_MS = 3000;

function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

/** Polling de status a cada 3 s só com a aba visível; em segundo plano pausa e, ao voltar, consulta na hora. */
function useOrderPolling(order: OrderView, enabled: boolean, onOrder: (o: OrderView) => void) {
  const inflight = useRef(false);
  const cb = useRef(onOrder);
  useEffect(() => { cb.current = onOrder; });
  const id = order.orderId;
  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    const tick = async () => {
      if (stopped || inflight.current || document.visibilityState !== "visible") return;
      inflight.current = true;
      try {
        const o = await orderStatus(id);
        if (!stopped) cb.current(o);
      } catch { /* próxima volta tenta de novo */ } finally { inflight.current = false; }
    };
    const iv = setInterval(() => void tick(), POLL_MS);
    const onVis = () => { if (document.visibilityState === "visible") void tick(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { stopped = true; clearInterval(iv); document.removeEventListener("visibilitychange", onVis); };
  }, [id, enabled]);
}

function Header({ plan, order }: { plan?: PublicPlan; order: OrderView }) {
  return <p className="plano-eyebrow">Plano {plan?.name ?? order.planCode} · {formatBRL(order.amountCents)}</p>;
}

function CopyPix({ code }: { code: string }) {
  const [state, setState] = useState<"idle" | "ok" | "falhou">("idle");
  const input = useRef<HTMLInputElement>(null);
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setState("ok");
    } catch {
      input.current?.focus();
      input.current?.select();
      let ok = false;
      try { ok = document.execCommand("copy"); } catch { /* sem suporte */ }
      setState(ok ? "ok" : "falhou");
    }
  }
  return (
    <div className="app-stack-sm">
      <Button variant="secundario" block onClick={() => void copy()}>Copiar código Pix</Button>
      <p className="app-p app-muted" role="status">{state === "ok" ? "Código copiado." : state === "falhou" ? "Não deu para copiar. Selecione o código abaixo e copie." : ""}</p>
      <input ref={input} readOnly value={code} aria-label="Código Pix copia e cola" className={state === "falhou" ? "plano-copia" : "plano-copia plano-copia--oculta"} onFocus={(e) => e.currentTarget.select()} tabIndex={state === "falhou" ? 0 : -1} />
    </div>
  );
}

export function PixCheckout({ order, plans, warning, eventId, onOrder, onNewPix, onChoosePlan, busy }: {
  order: OrderView; plans: PublicPlan[]; warning?: string | null; eventId: string;
  onOrder: (o: OrderView) => void; onNewPix: () => void; onChoosePlan: () => void; busy?: boolean;
}) {
  const open = order.status === "criado" || order.status === "pendente";
  const now = useNow(open);
  const screen = screenFor(order, now);
  const plan = plans.find((p) => p.code === order.planCode);
  useOrderPolling(order, screen === "pendente", onOrder);

  // vencido localmente: uma última consulta, porque o Pix pode ter sido pago no último instante
  const lastCheck = useRef<string | null>(null);
  const recheck = useCallback(async () => {
    try { onOrder(await orderStatus(order.orderId)); } catch { /* mantém a tela de expirado */ }
  }, [order.orderId, onOrder]);
  useEffect(() => {
    if (open && screen === "expirado" && lastCheck.current !== order.orderId) { lastCheck.current = order.orderId; void recheck(); }
  }, [open, screen, order.orderId, recheck]);

  const painel = `/painel/${eventId}`;
  const announce = screen === "pago" ? `Pagamento confirmado. Plano ${plan?.name ?? ""} ativo.` : screen === "expirado" ? "Este Pix expirou." : screen === "falhou" ? "Não conseguimos gerar o Pix." : "";
  const banner = warning ? <div className="plano-aviso" role="status" data-testid="aviso-outro-plano">{warning}</div> : null;
  const live = <p className="sr-only" role="status" aria-live="polite">{announce}</p>;

  if (screen === "pendente") {
    const qr = orderQrSrc(order.brCodeBase64);
    const left = countdown(order.expiresAt, now);
    return (
      <div className="plano-estado" data-testid="pix-pendente">
        {live}
        <Header plan={plan} order={order} />
        <h1 className="titulo-tela app-h1">Pague no app do seu banco</h1>
        {banner}
        <div className="plano-pix">
          <div className="plano-qr">
            {qr ? <img src={qr} alt={`QR Code Pix de ${formatBRL(order.amountCents)}`} width={240} height={240} /> : <span className="app-p app-muted">Gerando o Pix…</span>}
          </div>
          <div className="app-stack">
            {order.brCode && <CopyPix code={order.brCode} />}
            <div className="plano-espera">
              <p className="plano-aguardando" aria-live="polite" role="status"><span aria-hidden="true" className="plano-ponto" />Aguardando pagamento…</p>
              {left && <p className="plano-timer">Expira em <time>{left}</time></p>}
            </div>
            <section className="plano-como" aria-labelledby="como-pagar">
              <h2 id="como-pagar" className="titulo-card app-h1">Como pagar</h2>
              <p className="app-p app-muted">No app do banco: Pix › Ler QR Code, ou Pix Copia e Cola com o código copiado.</p>
            </section>
            <p className="app-p app-muted">Pode fechar esta tela. O pedido fica guardado no painel e o plano libera sozinho quando o pagamento cair.</p>
            <p className="app-p app-muted">Pagamento processado pela AbacatePay.</p>
          </div>
        </div>
      </div>
    );
  }

  if (screen === "pago") {
    const rows = [["Valor", `${formatBRL(order.amountCents)} · Pix`], ["Pago em", formatDateTime(order.paidAt) || "—"], ["Pedido", `#${order.orderId.replace(/-/g, "").slice(0, 8).toUpperCase().replace(/^(.{4})/, "$1-")}`]];
    return (
      <div className="plano-estado" data-testid="pix-pago">
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
      <div className="plano-estado" data-testid="pix-expirado">
        {live}
        <Header plan={plan} order={order} />
        <span className="plano-selo" aria-hidden="true">◷</span>
        <h1 className="titulo-tela app-h1">Este Pix expirou.</h1>
        <p className="app-p app-muted">{PLAN_TEXT.expirado}</p>
        <section className="plano-cartao"><h2 className="titulo-card app-h1">Pagou agora há pouco?</h2><p className="app-p app-muted">Se o banco confirmou, o plano libera sozinho em alguns minutos. Não pague de novo.</p></section>
        <div className="app-stack-sm plano-acoes">
          <Button block onClick={onNewPix} disabled={busy}>Gerar novo Pix</Button>
          <Button variant="texto" block onClick={onChoosePlan}>Escolher outro plano</Button>
        </div>
      </div>
    );
  }

  if (screen === "falhou") {
    return (
      <div className="plano-estado" data-testid="pix-falhou">
        {live}
        <Header plan={plan} order={order} />
        <span className="plano-selo plano-selo--erro" aria-hidden="true">×</span>
        <h1 className="titulo-tela app-h1">Não conseguimos gerar o Pix.</h1>
        <p className="app-p app-muted">Nada foi cobrado. Tente de novo em instantes.</p>
        <div className="app-stack-sm plano-acoes">
          <Button block onClick={onNewPix} disabled={busy}>Tentar de novo</Button>
          <Button variant="texto" block onClick={onChoosePlan}>Escolher outro plano</Button>
        </div>
      </div>
    );
  }

  if (screen === "estornado") {
    return (
      <div className="plano-estado" data-testid="pix-estornado">
        <Header plan={plan} order={order} />
        <h1 className="titulo-tela app-h1" aria-live="polite">Pagamento devolvido.</h1>
        <p className="app-p app-muted">O valor voltou para a conta que pagou. O evento segue com os limites do plano que ele tem agora.</p>
        <div className="app-stack-sm plano-acoes">
          <Button block onClick={onChoosePlan}>Escolher um plano</Button>
          <Button href={painel} variant="texto" block>Voltar ao painel</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="plano-estado" data-testid="pix-em-disputa">
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
        <p className="app-p app-muted">Nada foi cobrado. Se aparecer um Pix, é o mesmo pedido.</p>
      </div>
    </div>
  );
}
