"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ConfirmSheet, Skeleton } from "@/components/revela";
import { PagamentoResumo } from "@/revela/screens/PagamentoResumo";
import { PagamentoPix } from "@/revela/screens/PagamentoPix";
import { PagamentoCartao, type CardValues } from "@/revela/screens/PagamentoCartao";
import { Pagamento3ds } from "@/revela/screens/Pagamento3ds";
import { PagamentoProcessando } from "@/revela/screens/PagamentoProcessando";
import { PagamentoAprovado } from "@/revela/screens/PagamentoAprovado";
import { PagamentoFalhou } from "@/revela/screens/PagamentoFalhou";
import { listPosePacks, listPublicPlans } from "./api";
import { lookupPlans } from "./pose-packs";
import type { PublicPlan } from "./types";
import { useRouter } from "next/navigation";
import { browserSupabase } from "@/lib/supabase/client";
import { formatBRL, quote } from "./api";
import { prepareCard } from "./validapay-card";
import { LOAD_TIMEOUT_MS, ValidaPayTimeoutError, withTimeout, ValidaPayOpenOrderError, ValidaPayEnvironmentConflictError, validateReceiptEnvironment, recoverSandbox, sandboxCall, sandboxConfig, sandboxRefund, type SandboxConfig, type SandboxReceipt } from "./validapay-client";

const SLOW_AFTER_MS = Math.min(8_000, LOAD_TIMEOUT_MS);

/** Native checkout. The Edge Function and database authorize payment operations. */
export function ValidaPayCheckout({ eventId, planCode, eventTitle = "sua festa", wrap = "festa" }: { eventId: string; planCode: string; eventTitle?: string; wrap?: string }) {
  const [config, setConfig] = useState<SandboxConfig | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [order, setOrder] = useState<SandboxReceipt | null>(null);
  const [method, setMethod] = useState<"pix" | "card">("pix");
  const [email, setEmail] = useState("");
  const [accountName, setAccountName] = useState("");
  const [doc, setDoc] = useState("");
  const [card, setCard] = useState<CardValues>({ number: "", exp: "", cvv: "", holder: "", doc: "" });
  const [extra, setExtra] = useState({ phone: "", zipCode: "", street: "", addressNumber: "", neighborhood: "", city: "", state: "" });
  const [step, setStep] = useState<"resumo" | "cartao">("resumo");
  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [tick, setTick] = useState(() => Date.now());
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadVersion, setLoadVersion] = useState(0);
  const [slow, setSlow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [askRefund, setAskRefund] = useState(false);
  const refundRequest = useRef<string | null>(null);
  const submitting = useRef(false);
  const key = useRef<string | null>(null);

  const fail = useCallback((cause: unknown, fallback: string) => {
    if (cause instanceof ValidaPayEnvironmentConflictError) { setConfig(null); setError(cause.message); }
    else if (cause instanceof ValidaPayTimeoutError) setError(cause.message);
    else setError(cause instanceof ValidaPayOpenOrderError ? cause.message : fallback);
  }, []);

  useEffect(() => {
    let stopped = false;
    async function load() {
      setLoading(true); setLoadFailed(false); setError(null); setSlow(false);
      try {
        const cfg = await withTimeout(sandboxConfig());
        if (stopped) return;
        if (cfg.environment !== "sandbox" && cfg.environment !== "production") throw new Error("invalid_environment");
        setConfig(cfg);
        if (!cfg.enabled) return;
        const [previous, user] = await Promise.all([withTimeout(recoverSandbox(eventId)), withTimeout(browserSupabase().auth.getUser())]);
        if (stopped) return;
        if (previous) validateReceiptEnvironment(previous, cfg.environment);
        const restore = previous && (previous.planCode === planCode || ["pendente", "criado"].includes(previous.status)) ? previous : null;
        setOrder(restore); setEmail(user.data.user?.email ?? "");
        const meta = user.data.user?.user_metadata as { full_name?: string; name?: string } | undefined;
        setAccountName(String(meta?.full_name ?? meta?.name ?? user.data.user?.email?.split("@")[0] ?? "").trim());
        setMethod(restore?.paymentMethod === "card" ? "card" : "pix");
        if (!restore || !["pago", "pendente", "criado"].includes(restore.status)) {
          const quoted = await withTimeout(quote(eventId, planCode));
          if (!stopped) {
            if (!quoted.payable) {
              const messages = { ja_incluido: "Este plano já está incluído no seu evento.", evento_encerrado: "O evento foi encerrado e não permite novas compras.", plano_inativo: "Este plano não está disponível para compra.", valor_minimo: "O valor disponível não permite esta compra.", ok: "Este plano não está disponível para compra." };
              setError(messages[quoted.reason] ?? messages.plano_inativo); setLoadFailed(true); return;
            }
            setAmount(quoted.amountCents);
          }
        } else setAmount(restore.amountCents);
      } catch (cause) { if (!stopped) { setLoadFailed(true); fail(cause, "Não foi possível abrir o checkout. Confira sua conexão e tente novamente."); } }
      finally { if (!stopped) setLoading(false); }
    }
    void load();
    return () => { stopped = true; };
  }, [eventId, planCode, fail, loadVersion]);

  // carregando há mais de ~8 s: avisa e oferece saída dentro do mesmo layout (cada chamada ainda vence em 12 s)
  useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => clearTimeout(t);
  }, [loading, loadVersion]);

  useEffect(() => { let on = true; void Promise.all([listPublicPlans(), listPosePacks()]).then(([p, k]) => { if (on) setPlans(lookupPlans(p, k)); }, () => undefined); return () => { on = false; }; }, []);
  useEffect(() => { const t = setInterval(() => setTick(Date.now()), 1000); return () => clearInterval(t); }, []);

  const refresh = useCallback(async (): Promise<string | undefined> => {
    if (!order || !config || submitting.current) return undefined;
    try { const next = validateReceiptEnvironment(await sandboxCall<SandboxReceipt>({ action: "status", orderId: order.orderId }), config.environment); setOrder(next); setError(null); return next.status; }
    catch (cause) { fail(cause, "A confirmação está demorando. Você pode consultar novamente sem criar outro pagamento."); return undefined; }
  }, [order, config, fail]);
  const uncertain = order?.status === "criado" && order.canAbandon !== true;
  const effectivePlan = order && ["criado", "pendente"].includes(order.status) ? order.planCode : planCode;
  const mismatch = order && order.planCode !== planCode && ["criado", "pendente"].includes(order.status);
  const conflictNotice = mismatch ? <p className="app-p">Você já iniciou o plano {order.planCode}. Continue este pedido antes de escolher {planCode}.{order.canAbandon === true ? " Para escolher outro plano, abandone esta reserva primeiro." : " Aguarde a verificação do pagamento."}</p> : null;
  const pollingId = order?.orderId;
  const pollingStatus = order?.status;
  useEffect(() => {
    if (!config || !pollingId || !pollingStatus || (!["pendente", "expirado"].includes(pollingStatus) && !uncertain)) return;
    let inFlight = false, stopped = false;
    const poll = async () => {
      if (inFlight || document.visibilityState !== "visible") return;
      inFlight = true;
      try {
        const next = await sandboxCall<SandboxReceipt>({ action: "status", orderId: pollingId });
        if (!stopped) { setOrder(validateReceiptEnvironment(next, config.environment)); setError(null); }
      } catch (cause) { if (!stopped) fail(cause, "Não foi possível atualizar o pagamento. Tente consultar novamente."); }
      finally { inFlight = false; }
    };
    const interval = setInterval(() => void poll(), pollingStatus === "expirado" ? 15000 : 5000);
    const resume = () => void poll();
    document.addEventListener("visibilitychange", resume); window.addEventListener("pageshow", resume);
    return () => { stopped = true; clearInterval(interval); document.removeEventListener("visibilitychange", resume); window.removeEventListener("pageshow", resume); };
  }, [pollingId, pollingStatus, config, fail, uncertain]);

  useEffect(() => {
    let stopped = false;
    if (order?.emv) void import("qrcode").then((lib) => lib.toDataURL(order.emv!, { width: 256, margin: 2 })).then((url) => { if (!stopped) setQr(url); }).catch(() => undefined);
    return () => { stopped = true; };
  }, [order?.emv]);

  async function submit() {
    if (submitting.current || !config?.enabled || amount === null || uncertain || loadFailed) return;
    submitting.current = true; setBusy(true); setError(null);
    const values: Record<string, string> = method === "card"
      ? { name: card.holder, document: card.doc, holderName: card.holder, cardNumber: card.number, expiration: card.exp.length === 5 ? `${card.exp.slice(0, 3)}20${card.exp.slice(3)}` : card.exp, cvv: card.cvv, ...extra }
      : { name: accountName || "Cliente Revela", document: doc };
    const text = (name: string) => String(values[name] ?? "").trim();
    const digits = (name: string) => text(name).replace(/\D/g, "");
    let submittedOrderId: string | null = null;
    try {
      const storageKey = `validapay:${config.environment}:${eventId}:${effectivePlan}:${method}`;
      if (order && ["falhou", "cancelado", "expirado"].includes(order.status)) {
        key.current = null;
        try { sessionStorage.removeItem(storageKey); } catch { /* in-memory fallback */ }
      }
      if (!key.current) {
        try { key.current = sessionStorage.getItem(storageKey); } catch { /* in-memory fallback */ }
        if (!key.current || !/^[0-9a-f-]{36}$/i.test(key.current)) key.current = crypto.randomUUID();
        try { sessionStorage.setItem(storageKey, key.current); } catch { /* only an opaque UUID is ever stored */ }
      }
      const buyer = { name: text("name"), documentNumber: digits("document") };
      if (buyer.name.length < 2 || !/^(\d{11}|\d{14})$/.test(buyer.documentNumber)) throw new Error("invalid_buyer");
      // Freeze the backend price BEFORE 3DS/tokenization, and obtain explicit consent if the quote changed.
      const reserved = await sandboxCall<SandboxReceipt>({ action: "reserve", eventId, planCode: effectivePlan, method, idempotencyKey: key.current });
      validateReceiptEnvironment(reserved, config.environment);
      setOrder(reserved);
      if (reserved.planCode !== effectivePlan || (reserved.paymentMethod && reserved.paymentMethod !== method)) {
        setAmount(reserved.amountCents); setMethod(reserved.paymentMethod === "card" ? "card" : "pix");
        setError("A reserva encontrada é de outro plano ou forma de pagamento. Confira o pedido antes de continuar."); return;
      }
      if (reserved.status !== "criado" || reserved.canAbandon !== true) { setOrder(reserved); return; }
      if (reserved.amountCents !== amount) { setAmount(reserved.amountCents); setOrder(reserved); setError("O valor foi atualizado. Confira o resumo e confirme novamente."); return; }
      let token = {};
      if (method === "card") {
        if (!config.publicId || config.requires3DS !== true) throw new Error("missing_card_configuration");
        token = await prepareCard({ publicId: config.publicId, environment: config.environment }, amount, {
          number: digits("cardNumber"), holderName: text("holderName"), cvv: digits("cvv"), expiration: text("expiration"),
        }, { name: buyer.name, document: buyer.documentNumber, email, phone: digits("phone"),
          address: { zipCode: digits("zipCode"), street: text("street"), number: text("addressNumber"), neighborhood: text("neighborhood"), city: text("city"), state: text("state").toUpperCase() },
        });
      }
      submittedOrderId = reserved.orderId;
      setOrder({ ...reserved, canAbandon: false });
      const next = await sandboxCall<SandboxReceipt>({ action: "submit", eventId, planCode: effectivePlan, method, idempotencyKey: key.current, customer: buyer, ...token });
      setOrder(validateReceiptEnvironment(next, config.environment));
    } catch (cause) {
      // A failed response can follow a successful provider POST. Only the server may release this order.
      let failure = cause;
      if (cause instanceof ValidaPayOpenOrderError) {
        try {
          const existing = await recoverSandbox(eventId);
          if (existing) {
            validateReceiptEnvironment(existing, config.environment);
            setOrder(existing); setAmount(existing.amountCents); setMethod(existing.paymentMethod === "card" ? "card" : "pix");
          }
        } catch (readbackError) { if (readbackError instanceof ValidaPayEnvironmentConflictError) failure = readbackError; }
      }
      if (submittedOrderId && !(cause instanceof ValidaPayEnvironmentConflictError)) {
        try {
          const recovered = validateReceiptEnvironment(await sandboxCall<SandboxReceipt>({ action: "status", orderId: submittedOrderId }), config.environment);
          setOrder(recovered);
          if (["pago", "estornado", "pendente", "expirado"].includes(recovered.status)) { setError(null); return; }
        }
        catch (readbackError) { if (readbackError instanceof ValidaPayEnvironmentConflictError) failure = readbackError; }
      }
      fail(failure, submittedOrderId
        ? "O pagamento está em verificação. Consulte o mesmo pedido antes de iniciar outro pagamento."
        : method === "card" ? "Não foi possível preparar o cartão ou concluir a autenticação do banco. Confira os dados e tente novamente; nenhuma nova cobrança será criada automaticamente."
        : "Não foi possível concluir. Confira os dados e tente novamente; o mesmo pedido será reutilizado.");
    }
    finally {
      setCard((c) => ({ ...c, number: "", exp: "", cvv: "" }));
      submitting.current = false; setBusy(false);
    }
  }

  const plan = plans.find((p) => p.code === (order?.planCode ?? effectivePlan));
  const money = (cents: number) => (cents % 100 === 0 ? `R$ ${cents / 100}` : formatBRL(cents));
  const exact = (cents: number) => `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
  const shown = order?.amountCents ?? amount ?? 0;
  const camSrc = `/revela/3d/cam-${wrap}-640.webp`;
  const planCaption = plan ? `${plan.maxGuests === null ? "convidados sem limite" : `${plan.maxGuests} convidados`} · ${plan.maxShots === null ? "poses livres" : `${plan.maxShots} poses cada`}` : undefined;
  const cardEnabled = !!config?.publicId;
  const methodLabel = order?.paymentMethod === "card" ? "Cartão" : "Pix";
  const back = () => router.push(`/painel/${eventId}/plano`);
  const abandon = async () => {
    if (!order) return;
    if (submitting.current) return;
    submitting.current = true; setBusy(true); setError(null);
    try {
      const result = await sandboxCall<{ abandoned: boolean }>({ action: "abandon", orderId: order.orderId });
      if (result.abandoned !== true) throw new Error("not_abandoned");
      key.current = null;
      for (const chosen of ["pix", "card"]) { try { sessionStorage.removeItem(`validapay:${config!.environment}:${eventId}:${order.planCode}:${chosen}`); } catch { /* in-memory fallback */ } }
      // Do not offer a fresh intention until its price is available.
      setAmount(null); setOrder(null); setQr(null); setCopied(false); setStep("resumo");
      const quoted = await quote(eventId, planCode);
      if (!quoted.payable) throw new Error("not_payable");
      setAmount(quoted.amountCents);
    } catch (cause) { setLoadFailed(true); fail(cause, "Não foi possível trocar a forma de pagamento. Consulte o pagamento e tente novamente."); }
    finally { submitting.current = false; setBusy(false); }
  };

  const abandonOrCancel = async () => {
    if (!order || submitting.current) return;
    submitting.current = true; setBusy(true);
    try {
      const next = await sandboxCall<SandboxReceipt>({ action: "cancel", orderId: order.orderId });
      setOrder(validateReceiptEnvironment(next, config!.environment));
      setMethod("pix"); setStep("resumo");
    } catch (cause) { fail(cause, "Não foi possível cancelar. Consulte o estado do pagamento antes de tentar novamente."); }
    finally { submitting.current = false; setBusy(false); }
  };

  if (loading && slow) {
    return (
      <div className="scr">
        <div className="safe">
          <Skeleton label="Abrindo pagamento…" />
          <h2 className="rv-title-lg" style={{ marginTop: "var(--space-5)" }}>Está demorando mais que o normal</h2>
          <p className="rv-body muted" role="status" style={{ margin: "8px 0 var(--space-5)" }}>A conexão com o pagamento está lenta. Você pode esperar mais um pouco ou tentar de novo; nada foi cobrado.</p>
          <button type="button" className="rv-btn rv-btn--block rv-btn--primary" onClick={() => setLoadVersion((version) => version + 1)}>Tentar de novo</button>
          <button type="button" className="rv-btn rv-btn--text rv-btn--block" onClick={back}>Voltar aos planos</button>
        </div>
      </div>
    );
  }
  if (loading) return <Skeleton label="Abrindo pagamento…" />;
  if (loadFailed) return <PagamentoFalhou title="Checkout indisponível" stamp="INDISPONÍVEL" message={error ?? "Não foi possível abrir o checkout."} primary="Tentar novamente" secondary="Voltar aos planos" onPrimary={() => setLoadVersion((version) => version + 1)} onSecondary={back} onClose={back} />;
  if (!config?.enabled) return <PagamentoFalhou title="Checkout indisponível" stamp="INDISPONÍVEL" message={error ?? "Esta forma de pagamento ainda não está disponível."} primary="Tentar de novo" secondary="Voltar aos planos" onPrimary={() => setLoadVersion((version) => version + 1)} onSecondary={back} onClose={back} />;
  if (order?.status === "estornado") return <PagamentoFalhou title="Pagamento estornado" stamp="ESTORNADO" message="A devolução foi confirmada e o benefício deste pagamento foi revogado." primary="Ir para o painel" secondary={null} onPrimary={() => router.push(`/painel/${eventId}`)} onClose={() => router.push(`/painel/${eventId}`)} />;
  if (order?.status === "pago") {
    const active = order.entitlementActive;
    const message = active === true
      ? `A câmera de ${eventTitle} está liberada${plan ? ` para ${plan.maxGuests ?? "muitos"} convidados, com ${plan.maxShots === null ? "poses livres" : `${plan.maxShots} poses cada`}` : ""}.`
      : `${active === false ? "O plano não foi liberado por este pagamento." : "A liberação do plano ainda não foi confirmada."} Consulte o suporte com a referência do pedido.${order.needsRefund === true ? " A devolução está em análise. Este recibo não confirma um reembolso concluído." : ""} Pedido: ${order.orderId}`;
    return (
      <>
        <PagamentoAprovado cam={camSrc} message={message} paid={`${methodLabel} · ${exact(order.amountCents)}`} when={`${new Date(tick).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} · pedido ${order.orderId.slice(0, 8)}`} onContinue={() => router.push(`/criar/pronto/${eventId}`)} />
        {config.environment === "sandbox" && (
          <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 30, display: "flex", justifyContent: "center", gap: 8, padding: 8 }}>
            <button type="button" className="rv-btn rv-btn--text" disabled={busy} onClick={() => setAskRefund(true)}>Solicitar estorno de teste</button>
          </div>
        )}
        {error && <p role="alert" className="rv-caption center" style={{ position: "fixed", left: 0, right: 0, top: 8, color: "var(--danger)" }}>{error}</p>}
        {config.environment === "sandbox" && askRefund && <ConfirmSheet title="Estornar este pagamento de teste?" body="A devolução integral só revoga o plano após confirmação do provedor." confirmLabel="Confirmar estorno integral" onCancel={() => setAskRefund(false)} onConfirm={async () => {
      if (submitting.current) return;
      submitting.current = true; setBusy(true);
      try {
        refundRequest.current ??= crypto.randomUUID();
        const result = await sandboxRefund(order.orderId, refundRequest.current);
        if (result.confirmed) setOrder({ ...order, status: "estornado" });
        else setError("A devolução está em processamento. Consulte novamente mais tarde; outra devolução não será criada.");
      } catch { setError("O estorno está em verificação. Aguarde a conciliação antes de solicitar outra devolução."); }
      finally { submitting.current = false; setBusy(false); setAskRefund(false); }
    }} />}
      </>
    );
  }
  if (order && (["pendente", "expirado"].includes(order.status) || uncertain)) {
    if (order.status === "expirado") {
      return <PagamentoFalhou title="Pagamento expirado" stamp="EXPIROU" message="O tempo para pagar acabou e nada foi cobrado. Gere um novo pagamento para continuar." primary="Tentar novo pagamento" secondary={null}
        onPrimary={() => {
          key.current = null;
          for (const chosen of ["pix", "card"]) { try { sessionStorage.removeItem(`validapay:${config.environment}:${eventId}:${order.planCode}:${chosen}`); } catch { /* in-memory fallback */ } }
          setOrder(null); setQr(null); setCopied(false);
        }} onClose={back} />;
    }
    if ((order.paymentMethod ?? "pix") === "pix" && order.emv && !uncertain) {
      const left = order.expiresAt ? Math.max(0, Math.floor((new Date(order.expiresAt).getTime() - tick) / 1000)) : null;
      const mmss = left === null ? "--:--" : `${String(Math.floor(left / 60)).padStart(2, "0")}:${String(left % 60).padStart(2, "0")}`;
      return (
        <>
          <PagamentoPix amount={money(order.amountCents)} expires={mmss} code={order.emv} qr={qr ?? undefined} copied={copied} onClose={back}
            onCopy={() => { void navigator.clipboard?.writeText(order.emv!).then(() => setCopied(true), () => setCopied(false)); }} />
          {error && <p role="alert" className="rv-caption center" style={{ position: "fixed", left: 0, right: 0, top: 8, color: "var(--danger)" }}>{error}</p>}
        </>
      );
    }
    if (order.paymentMethod === "card" && order.status === "pendente" && !uncertain) {
      return <Pagamento3ds amount={money(order.amountCents)} onBack={back} onApproved={() => void refresh()} onPix={() => void abandonOrCancel()} busy={busy} />;
    }
    return (
      <>
        <PagamentoProcessando cam={camSrc} onClose={() => void refresh().then((st) => { if (st === "pendente" || st === "criado") back(); })} />
        {error && <p role="alert" className="rv-caption center" style={{ position: "fixed", left: 0, right: 0, top: 8, color: "var(--danger)" }}>{error}</p>}
      </>
    );
  }
  if (order && ["falhou", "cancelado"].includes(order.status) && !busy) {
    const card = order.paymentMethod === "card";
    return <PagamentoFalhou title={card ? "O banco recusou" : "Não deu certo"} stamp={card ? "RECUSADO" : "NÃO PAGO"} message={card ? "O cartão não foi aprovado. Nada foi cobrado. Tente com Pix ou com outro cartão." : "O pagamento não foi concluído. Nada foi cobrado. Você pode tentar de novo."}
      primary="Pagar com Pix" secondary={card && cardEnabled ? "Usar outro cartão" : null} onClose={back}
      onPrimary={() => { setOrder(null); setMethod("pix"); setStep("resumo"); }} onSecondary={() => { setOrder(null); setMethod("card"); setStep("cartao"); }} />;
  }
  if (busy && method === "card" && step === "cartao") {
    return <Pagamento3ds amount={money(shown)} onBack={back} onApproved={() => void refresh()} onPix={() => { setMethod("pix"); setStep("resumo"); }} busy />;
  }
  if (step === "cartao" && method === "card" && cardEnabled) {
    const field = (label: string, key2: keyof typeof extra, auto: string) => (
      <label className="rv-field" style={{ marginTop: "10px" }}><input value={extra[key2]} onChange={(e) => setExtra((x) => ({ ...x, [key2]: e.target.value }))} aria-label={label} placeholder={label} autoComplete={auto} /></label>
    );
    return <>{order?.canAbandon === true && <button type="button" className="rv-btn rv-btn--text" disabled={busy} style={{ position: "fixed", right: 8, top: 8, zIndex: 30 }} onClick={() => void abandon()}>{mismatch ? "Abandonar reserva e escolher outro plano" : "Trocar forma de pagamento"}</button>}<PagamentoCartao amount={money(shown)} values={card} busy={busy} error={error ?? undefined}
      onField={(f, v) => setCard((c) => ({ ...c, [f]: v }))} onBack={() => setStep("resumo")} onPay={() => void submit()}
      extra={<>{field("Telefone", "phone", "tel")}{field("CEP", "zipCode", "postal-code")}{field("Rua", "street", "address-line1")}{field("Número do endereço", "addressNumber", "off")}{field("Bairro", "neighborhood", "off")}{field("Cidade", "city", "address-level2")}{field("UF", "state", "address-level1")}</>} /></>;
  }
  return (
    <>
      {conflictNotice}
      {order?.canAbandon === true && <button type="button" className="rv-btn rv-btn--text" disabled={busy} style={{ position: "fixed", right: 8, top: 8, zIndex: 30 }} onClick={() => void abandon()}>{mismatch ? "Abandonar reserva e escolher outro plano" : "Trocar forma de pagamento"}</button>}
      <PagamentoResumo cam={camSrc} planName={plan?.name ?? effectivePlan} caption={planCaption ?? ""} price={amount !== null ? money(amount) : "—"} priceExact={amount !== null ? exact(amount) : "—"} eventName={eventTitle}
        method={method} cardEnabled={cardEnabled} askDocument document={doc} busy={busy} error={error ?? (order ? "O pagamento anterior não foi concluído. Você pode tentar novamente." : undefined)}
        onMethod={(m) => { setMethod(m); setError(null); }} onDocument={setDoc} onBack={back}
        onPay={() => { if (method === "card") setStep("cartao"); else void submit(); }} />
    </>
  );
}
