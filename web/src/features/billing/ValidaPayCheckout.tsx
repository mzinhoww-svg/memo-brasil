"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Button, ConfirmSheet, Field, Skeleton } from "@/components/memoriesmt";
import { browserSupabase } from "@/lib/supabase/client";
import { formatBRL, quote } from "./api";
import { prepareCard } from "./validapay-card";
import { ValidaPayEnvironmentConflictError, validateReceiptEnvironment, recoverSandbox, sandboxCall, sandboxConfig, sandboxRefund, type SandboxConfig, type SandboxReceipt } from "./validapay-client";

/** Native checkout. The Edge Function and database authorize payment operations. */
export function ValidaPayCheckout({ eventId, planCode }: { eventId: string; planCode: string }) {
  const [config, setConfig] = useState<SandboxConfig | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [order, setOrder] = useState<SandboxReceipt | null>(null);
  const [method, setMethod] = useState<"pix" | "card">("pix");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [askRefund, setAskRefund] = useState(false);
  const refundRequest = useRef<string | null>(null);
  const submitting = useRef(false);
  const key = useRef<string | null>(null);

  const fail = useCallback((cause: unknown, fallback: string) => {
    if (cause instanceof ValidaPayEnvironmentConflictError) { setConfig(null); setError(cause.message); }
    else setError(fallback);
  }, []);

  useEffect(() => {
    let stopped = false;
    async function load() {
      try {
        const cfg = await sandboxConfig();
        if (stopped) return;
        if (cfg.environment !== "sandbox" && cfg.environment !== "production") throw new Error("invalid_environment");
        setConfig(cfg);
        if (!cfg.enabled) return;
        const [previous, user] = await Promise.all([recoverSandbox(eventId), browserSupabase().auth.getUser()]);
        if (stopped) return;
        if (previous) validateReceiptEnvironment(previous, cfg.environment);
        const restore = previous && (previous.planCode === planCode || ["pendente", "criado"].includes(previous.status)) ? previous : null;
        setOrder(restore); setEmail(user.data.user?.email ?? "");
        if (restore?.paymentMethod === "card") setMethod("card");
        if (!restore || !["pago", "pendente", "criado"].includes(restore.status)) {
          const quoted = await quote(eventId, planCode);
          if (!stopped) { if (!quoted.payable) throw new Error("Este plano não está disponível para compra."); setAmount(quoted.amountCents); }
        } else setAmount(restore.amountCents);
      } catch (cause) { if (!stopped) fail(cause, "Não foi possível abrir o checkout."); }
      finally { if (!stopped) setLoading(false); }
    }
    void load();
    return () => { stopped = true; };
  }, [eventId, planCode, fail]);

  const refresh = useCallback(async () => {
    if (!order || !config || submitting.current) return;
    try { const next = await sandboxCall<SandboxReceipt>({ action: "status", orderId: order.orderId }); setOrder(validateReceiptEnvironment(next, config.environment)); setError(null); }
    catch (cause) { fail(cause, "A confirmação está demorando. Você pode consultar novamente sem criar outro pagamento."); }
  }, [order, config, fail]);
  const pollingId = order?.orderId;
  const pollingStatus = order?.status;
  useEffect(() => {
    if (!config || !pollingId || !pollingStatus || !["pendente", "expirado"].includes(pollingStatus)) return;
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
  }, [pollingId, pollingStatus, config, fail]);

  useEffect(() => {
    let stopped = false;
    if (order?.emv) void import("qrcode").then((lib) => lib.toDataURL(order.emv!, { width: 256, margin: 2 })).then((url) => { if (!stopped) setQr(url); }).catch(() => undefined);
    return () => { stopped = true; };
  }, [order?.emv]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting.current || !config?.enabled || amount === null) return;
    submitting.current = true; setBusy(true); setError(null);
    const form = e.currentTarget;
    const values = new FormData(form);
    const text = (name: string) => String(values.get(name) ?? "").trim();
    const digits = (name: string) => text(name).replace(/\D/g, "");
    let submittedOrderId: string | null = null;
    try {
      const storageKey = `validapay:${config.environment}:${eventId}:${planCode}:${method}`;
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
      const reserved = await sandboxCall<SandboxReceipt>({ action: "reserve", eventId, planCode, method, idempotencyKey: key.current });
      validateReceiptEnvironment(reserved, config.environment);
      setOrder(reserved);
      if (reserved.status !== "criado") { setOrder(reserved); return; }
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
      const next = await sandboxCall<SandboxReceipt>({ action: "submit", eventId, planCode, method, idempotencyKey: key.current, customer: buyer, ...token });
      setOrder(validateReceiptEnvironment(next, config.environment));
    } catch (cause) {
      // A failed response can follow a successful provider POST. Only the server may release this order.
      let failure = cause;
      if (submittedOrderId && !(cause instanceof ValidaPayEnvironmentConflictError)) {
        try { setOrder(validateReceiptEnvironment(await sandboxCall<SandboxReceipt>({ action: "status", orderId: submittedOrderId }), config.environment)); }
        catch (readbackError) { if (readbackError instanceof ValidaPayEnvironmentConflictError) failure = readbackError; }
      }
      fail(failure, "Não foi possível concluir. Confira os dados e tente novamente; o mesmo pedido será reutilizado.");
    }
    finally {
      for (const name of ["cardNumber", "cvv", "expiration", "holderName"]) { const input = form.elements.namedItem(name); if (input instanceof HTMLInputElement) input.value = ""; }
      submitting.current = false; setBusy(false);
    }
  }

  if (loading) return <Skeleton label="Abrindo pagamento…" />;
  if (!config?.enabled) return <div className="plano-estado"><h1 className="titulo-tela app-h1">Checkout indisponível</h1><p className="app-p">Esta forma de pagamento ainda não está disponível.</p>{error && <p role="alert">{error}</p>}</div>;
  if (order?.status === "estornado") return <div className="plano-estado"><h1 className="titulo-tela app-h1">Pagamento estornado</h1><p className="app-p">A devolução foi confirmada e o benefício deste pagamento foi revogado.</p><Button href={`/painel/${eventId}`}>Ir para o painel</Button></div>;
  if (order?.status === "pago") return <div className="plano-estado app-stack">
    <h1 className="titulo-tela app-h1">Pagamento confirmado</h1><p className="app-p">O pagamento foi confirmado pelo servidor.</p>
    <Button href={`/painel/${eventId}`}>Ir para o painel</Button>
    {config.environment === "sandbox" && <Button variant="texto" disabled={busy} onClick={() => setAskRefund(true)}>Solicitar estorno de teste</Button>}
    {error && <p role="alert" className="app-p">{error}</p>}
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
  </div>;
  if (order && ["pendente", "expirado"].includes(order.status)) return (
    <div className="plano-estado app-stack" aria-busy={busy}>
      <h1 className="titulo-tela app-h1">{order.status === "expirado" ? "Pagamento expirado" : "Aguardando pagamento"}</h1>
      <p className="app-p">Plano {order.planCode} · {formatBRL(order.amountCents)}</p>
      {order.expiresAt && <p className="app-p">Válido até {new Date(order.expiresAt).toLocaleString("pt-BR")}</p>}
      {qr && <Image src={qr} alt="QR Code Pix" width={256} height={256} unoptimized style={{ maxWidth: "100%", height: "auto", alignSelf: "center" }} />}
      {order.emv && <><label className="mm-field-label" htmlFor="validapay-emv">Pix copia e cola</label><textarea id="validapay-emv" className="mm-field-input" readOnly value={order.emv} style={{ width: "100%", minHeight: 100, overflowWrap: "anywhere" }} /><Button onClick={() => { void navigator.clipboard.writeText(order.emv!).then(() => setCopied(true)).catch(() => setError("Selecione e copie o código Pix manualmente.")); }}>{copied ? "Código copiado" : "Copiar código Pix"}</Button></>}
      {error && <p role="alert" className="app-p">{error}</p>}
      <p role="status" className="app-p">A confirmação será atualizada automaticamente.</p>
      <Button variant="secundario" onClick={() => void refresh()}>Consultar pagamento</Button>
      {order.status === "pendente" && <Button variant="texto" disabled={busy} onClick={() => {
        if (submitting.current) return;
        submitting.current = true; setBusy(true);
        void sandboxCall<SandboxReceipt>({ action: "cancel", orderId: order.orderId }).then((next) => setOrder(validateReceiptEnvironment(next, config.environment)))
          .catch((cause) => fail(cause, "Não foi possível cancelar. Consulte o estado do pagamento antes de tentar novamente."))
          .finally(() => { submitting.current = false; setBusy(false); });
      }}>Cancelar pagamento</Button>}
      {order.status === "expirado" && <Button onClick={() => {
        key.current = null;
        for (const chosen of ["pix", "card"]) { try { sessionStorage.removeItem(`validapay:${config.environment}:${eventId}:${planCode}:${chosen}`); } catch { /* in-memory fallback */ } }
        setOrder(null); setQr(null); setCopied(false);
      }}>Tentar novo pagamento</Button>}
    </div>
  );
  return <div className="plano-estado app-stack">
    <h1 className="titulo-tela app-h1">Pagar plano {planCode}</h1>
    <p className="app-p">{amount !== null ? formatBRL(amount) : "Valor indisponível"} · Pagamento único</p>
    {order?.canAbandon === true && <Button variant="texto" disabled={busy} onClick={async () => {
      if (submitting.current) return;
      submitting.current = true; setBusy(true); setError(null);
      try {
        const result = await sandboxCall<{ abandoned: boolean }>({ action: "abandon", orderId: order.orderId });
        if (result.abandoned !== true) throw new Error("not_abandoned");
        key.current = null;
        for (const chosen of ["pix", "card"]) { try { sessionStorage.removeItem(`validapay:${config.environment}:${eventId}:${planCode}:${chosen}`); } catch { /* in-memory fallback */ } }
        // Do not offer a fresh intention until its price is available.
        setAmount(null); setOrder(null); setQr(null); setCopied(false);
        const quoted = await quote(eventId, planCode);
        if (!quoted.payable) throw new Error("not_payable");
        setAmount(quoted.amountCents);
      } catch (cause) { fail(cause, "Não foi possível trocar a forma de pagamento. Consulte o pagamento e tente novamente."); }
      finally { submitting.current = false; setBusy(false); }
    }}>Trocar forma de pagamento</Button>}
    {order && <p role="status" className="app-p">O pagamento anterior não foi concluído. Você pode tentar novamente.</p>}
    <form className="app-stack" onSubmit={(e) => void submit(e)} aria-busy={busy}>
      <fieldset disabled={busy} style={{ border: 0, padding: 0, minWidth: 0 }} className="app-stack">
        <legend className="mm-field-label">Forma de pagamento</legend>
        <label><input type="radio" name="method" checked={method === "pix"} disabled={!!order && ["criado", "pendente"].includes(order.status) && method !== "pix"} onChange={() => { setMethod("pix"); key.current = null; }} /> Pix</label>
        <label><input type="radio" name="method" checked={method === "card"} disabled={!config.publicId || (!!order && ["criado", "pendente"].includes(order.status) && method !== "card")} onChange={() => { setMethod("card"); key.current = null; }} /> Cartão</label>
        <Field label="Nome completo" name="name" autoComplete="name" required minLength={2} maxLength={200} />
        <Field label="CPF ou CNPJ" name="document" inputMode="numeric" required maxLength={18} />
        {method === "card" && <>
          <Field label="Nome do titular" name="holderName" autoComplete="cc-name" required />
          <Field label="Número do cartão" name="cardNumber" autoComplete="cc-number" inputMode="numeric" required maxLength={23} />
          <Field label="Validade (MM/AAAA)" name="expiration" autoComplete="cc-exp" placeholder="12/2030" inputMode="numeric" required pattern="(0[1-9]|1[0-2])/20[0-9]{2}" />
          <Field label="Código de segurança" name="cvv" type="password" autoComplete="cc-csc" inputMode="numeric" required minLength={3} maxLength={4} />
          <Field label="Telefone" name="phone" autoComplete="tel" inputMode="tel" required />
          <Field label="CEP" name="zipCode" autoComplete="postal-code" inputMode="numeric" required />
          <Field label="Rua" name="street" autoComplete="address-line1" required />
          <Field label="Número do endereço" name="addressNumber" required />
          <Field label="Bairro" name="neighborhood" required />
          <Field label="Cidade" name="city" autoComplete="address-level2" required />
          <Field label="Estado (UF)" name="state" autoComplete="address-level1" required maxLength={2} />
        </>}
        {error && <p role="alert" className="app-p">{error}</p>}
        <Button type="submit" block disabled={amount === null || busy}>{busy ? "Processando…" : method === "pix" ? "Gerar Pix" : "Confirmar pagamento"}</Button>
      </fieldset>
    </form>
  </div>;
}
