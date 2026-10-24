"use client";

import Link from "next/link";
import Script from "next/script";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { formatBRL, orderStatus } from "./api";
import { embeddedConfig, EmbeddedCheckoutError, recoverEmbeddedPayment, submitEmbeddedPayment, type EmbeddedConfig, type EmbeddedReceipt } from "./embedded";
import { clearIdempotencyKey, idempotencyKeyFor } from "./flow";
import type { OrderView } from "./types";
import styles from "./V3PaymentJourney.module.css";

type BrickController = { unmount: () => void };
type BrickBuilder = { create: (name: string, id: string, settings: unknown) => Promise<BrickController> };
declare global {
  interface Window {
    MercadoPago?: new (key: string, config: { locale: string }) => { bricks: () => BrickBuilder };
  }
}

function Status({ eventId, orderId, receipt, onPaid, onRetry }: {
  eventId: string; orderId: string; receipt: EmbeddedReceipt | null;
  onPaid: () => void; onRetry: () => void;
}) {
  const [order, setOrder] = useState<OrderView | null>(null);
  const [pix, setPix] = useState<EmbeddedReceipt | null>(receipt);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);
  const notified = useRef(false);
  const refresh = useCallback(async () => {
    try {
      const next = await orderStatus(orderId);
      setOrder(next);
      setError(false);
      if (next.status === "pago" && !notified.current) {
        notified.current = true;
        onPaid();
      }
    } catch { setError(true); }
  }, [orderId, onPaid]);
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 5000);
    const visible = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", visible);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", visible); };
  }, [refresh]);
  useEffect(() => {
    if (pix?.qrCode || order?.status !== "pendente") return;
    let alive = true;
    void recoverEmbeddedPayment(orderId).then(result => { if (alive && result.qrCode) setPix(result); }).catch(() => {});
    return () => { alive = false; };
  }, [pix?.qrCode, order?.status, orderId]);
  const status = order?.status || "criado";
  if (status === "pago") return (
    <div className={styles.nativeStatus} role="status" data-testid="payment-v3-paid">
      <span className={styles.successIcon} aria-hidden="true">✓</span>
      <h2>Pagamento confirmado!</h2>
      <p>O plano do seu evento foi atualizado. Hora de compartilhar o convite.</p>
      <Link className={styles.primary} href={`/painel/${eventId}/qr`}>Compartilhar meu QR Code →</Link>
      <Link className={styles.secondary} href={`/painel/${eventId}`}>Voltar ao evento</Link>
    </div>
  );
  if (["falhou", "cancelado", "expirado"].includes(status)) return (
    <div className={styles.nativeStatus} role="alert" data-testid="payment-v3-failed">
      <h2>Este pagamento não foi concluído.</h2>
      <p>Se pagou agora há pouco, confirme o status antes de iniciar outra tentativa.</p>
      <button className={styles.secondary} type="button" onClick={() => void refresh()}>Verificar status</button>
      <button className={styles.primary} type="button" onClick={onRetry}>Tentar novo pagamento</button>
    </div>
  );
  return (
    <div className={styles.nativeStatus} role="status" data-testid="payment-v3-pending">
      <span className={styles.pendingIcon} aria-hidden="true">◷</span>
      <h2>Aguardando confirmação</h2>
      <p>O pagamento ainda não foi confirmado pelo banco. A capacidade será liberada automaticamente.</p>
      {pix?.qrCode && (
        <div className={styles.pixCard}>
          {pix.qrCodeBase64 && <img width={208} height={208} alt="QR Code Pix do seu pedido" src={`data:image/png;base64,${pix.qrCodeBase64}`}/>}
          <label htmlFor="mm-pix-code">Pix copia e cola</label>
          <textarea id="mm-pix-code" value={pix.qrCode} readOnly rows={3} spellCheck={false}/>
          <button type="button" className={styles.secondary} onClick={() => {
            void navigator.clipboard?.writeText(pix.qrCode ?? "").then(() => setCopied(true)).catch(() => setCopied(false));
          }}>{copied ? "Código copiado ✓" : "Copiar código Pix"}</button>
          <p className={styles.caption}>Pague pelo aplicativo do seu banco. Não precisa sair do MemoriesMT.</p>
        </div>
      )}
      {error && <p className={styles.notice}>Não conseguimos atualizar agora. Seu pedido foi preservado.</p>}
      <button className={styles.secondary} type="button" onClick={() => void refresh()}>Atualizar status</button>
      <Link className={styles.secondary} href={`/painel/${eventId}`}>Voltar ao evento</Link>
    </div>
  );
}

export function EmbeddedPaymentCheckout({ eventId, planCode, amountCents, initialOrder, onPaid }: {
  eventId: string; planCode: string; amountCents: number;
  initialOrder?: OrderView | null; onPaid: () => void;
}) {
  const [cfg, setCfg] = useState<EmbeddedConfig | null>(null);
  const [cfgError, setCfgError] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [brickReady, setBrickReady] = useState(false);
  const [brickError, setBrickError] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<EmbeddedReceipt | null>(null);
  const [orderId, setOrderId] = useState<string | null>(initialOrder?.orderId ?? null);
  const brickId = "mm-v3-" + useId().replace(/:/g, "");
  const submitting = useRef(false);

  useEffect(() => {
    let active = true;
    void embeddedConfig().then(c => { if (active) setCfg(c); }).catch(() => { if (active) setCfgError(true); });
    return () => { active = false; };
  }, []);

  const retry = () => {
    clearIdempotencyKey(eventId, planCode);
    setReceipt(null);
    setOrderId(null);
    setCheckoutError(null);
    setBrickReady(false);
  };

  useEffect(() => {
    if (!cfg?.enabled || !cfg.publicKey || !sdkReady || !window.MercadoPago || orderId || amountCents <= 0) return;
    let disposed = false;
    let controller: BrickController | undefined;
    try {
      const mp = new window.MercadoPago(cfg.publicKey, { locale: "pt-BR" });
      void mp.bricks().create("payment", brickId, {
        initialization: { amount: amountCents / 100 },
        customization: { paymentMethods: {
          bankTransfer: "all", creditCard: "all", debitCard: "all", prepaidCard: "all",
        } },
        callbacks: {
          onReady: () => { if (!disposed) setBrickReady(true); },
          onSubmit: async ({ formData }: { formData: Record<string, unknown> }) => {
            if (submitting.current) throw new Error("Pedido já em processamento");
            submitting.current = true;
            setCheckoutError(null);
            try {
              const result = await submitEmbeddedPayment(eventId, planCode, idempotencyKeyFor(eventId, planCode), formData);
              if (!disposed) { setReceipt(result); setOrderId(result.orderId); }
            } catch (err) {
              const e = err instanceof EmbeddedCheckoutError ? err : null;
              if (!disposed) {
                if (e?.orderId) setOrderId(e.orderId);
                setCheckoutError(e?.code === "cpf_invalido"
                  ? "Revise o CPF e tente novamente."
                  : e?.code === "pedido_checkout_antigo" || e?.code === "pedido_aberto"
                    ? "Já existe um pagamento em aberto; verifique seu status."
                    : "Não foi possível confirmar o envio. Verifique o pedido antes de tentar novamente.");
              }
              throw err;
            } finally { submitting.current = false; }
          },
          onError: () => { if (!disposed) setBrickError(true); },
        },
      }).then(c => { if (disposed) c.unmount(); else controller = c; })
        .catch(() => { if (!disposed) setBrickError(true); });
    } catch { setBrickError(true); }
    return () => { disposed = true; controller?.unmount(); };
  }, [amountCents, brickId, cfg, eventId, planCode, sdkReady, orderId]);

  if (orderId) {
    if (initialOrder?.checkoutUrl && initialOrder.status !== "pago") return (
      <div className={styles.nativeStatus} role="alert">
        <h2>Há um pagamento antigo aberto.</h2>
        <p>Para evitar uma cobrança duplicada, aguarde o pagamento anterior ser concluído ou expirar.</p>
        <Link className={styles.secondary} href={`/painel/${eventId}`}>Voltar ao evento</Link>
      </div>
    );
    return (
      <>
        {checkoutError && <p className={styles.notice} role="alert">{checkoutError}</p>}
        <Status eventId={eventId} orderId={orderId} receipt={receipt} onPaid={onPaid} onRetry={retry}/>
      </>
    );
  }
  return (
    <div className={styles.embedded} data-testid="checkout-embedded-v3">
      <h2>Pague sem sair do MemoriesMT.</h2>
      <p className={styles.description}>Escolha Pix ou cartão. O formulário seguro é fornecido diretamente pelo Mercado Pago.</p>
      <div className={styles.priceBox}><strong>Valor total</strong><strong className={styles.price}>{formatBRL(amountCents)}</strong></div>
      {cfgError || (cfg && !cfg.enabled) ? (
        <p className={styles.notice} role="status">Checkout incorporado ainda não habilitado neste ambiente. Nada foi cobrado e seu evento está salvo.</p>
      ) : (
        <>
          <Script src="https://sdk.mercadopago.com/js/v2" strategy="afterInteractive"
            onLoad={() => setSdkReady(true)} onError={() => setBrickError(true)}/>
          {!brickReady && !brickError && <p className={styles.caption} role="status">Carregando pagamento seguro…</p>}
          {brickError && <p className={styles.notice} role="alert">Não conseguimos carregar o formulário do Mercado Pago. Atualize a página.</p>}
          {checkoutError && <p className={styles.notice} role="alert">{checkoutError}</p>}
          <div id={brickId} className={styles.brickContainer} aria-label="Formulário de pagamento seguro"/>
        </>
      )}
      <p className={styles.caption}>A confirmação ocorre no servidor. O navegador nunca libera o plano por conta própria.</p>
    </div>
  );
}
