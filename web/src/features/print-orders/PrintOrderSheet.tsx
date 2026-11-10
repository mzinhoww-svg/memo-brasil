"use client";

import { useMemo, useRef, useState } from "react";
import { Button, Field, OptionGroup, Sheet } from "@/components/revela";
import { useApp } from "@/features/app/provider";
import type { Photo } from "@/domain/photo";
import { createPrintOrder, printErrorText } from "./api";
import { digits, emptyShipping, formatCep, formatPhone, orderSummary, PRODUCTS, QUANTITY_MAX, STATUS_LABEL, validateDraft, type DraftErrors, type PrintDraft, type PrintOrder, type PrintProduct } from "./model";

const GRID = { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "var(--space-2)" } as const;

/** Pedido de impressão a partir da 19b: fotos → contato e entrega → confirmação com o status. Sem pagamento: o valor e o prazo chegam por contato. */
export function PrintOrderSheet({ eventId, eventTitle, photos, urls, onClose, onDone }: {
  eventId: string; eventTitle: string; photos: Photo[]; urls: Record<string, string>; onClose: () => void; onDone?: (o: PrintOrder) => void;
}) {
  const { user, now } = useApp();
  const orderId = useRef(crypto.randomUUID()); // o mesmo id em cada tentativa: reenviar não duplica o pedido
  const [step, setStep] = useState<"fotos" | "dados" | "ok">("fotos");
  const [d, setD] = useState<PrintDraft>({ product: "album", quantity: 1, photoIds: [], allPhotos: false, contactName: user?.name ?? "", contactPhone: "", contactEmail: "", shipping: emptyShipping(), note: "" });
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | undefined>();
  const [order, setOrder] = useState<PrintOrder | undefined>();
  const errors: DraftErrors = useMemo(() => validateDraft(d), [d]);
  const max = PRODUCTS[d.product].max;
  const set = <K extends keyof PrintDraft>(k: K, v: PrintDraft[K]) => setD((x) => ({ ...x, [k]: v }));
  const setShip = (k: keyof PrintDraft["shipping"], v: string) => setD((x) => ({ ...x, shipping: { ...x.shipping, [k]: v } }));
  const toggle = (id: string) => setD((x) => ({ ...x, photoIds: x.photoIds.includes(id) ? x.photoIds.filter((p) => p !== id) : x.photoIds.length < PRODUCTS[x.product].max ? [...x.photoIds, id] : x.photoIds }));
  const pickProduct = (p: PrintProduct) => setD((x) => ({ ...x, product: p, photoIds: x.photoIds.slice(0, PRODUCTS[p].max) }));

  function toDados() {
    setTried(true);
    if (errors.photos || errors.quantity) return;
    setTried(false);
    setStep("dados");
  }
  async function send() {
    setTried(true);
    if (Object.keys(errors).length || !user) return;
    setBusy(true);
    setFailure(undefined);
    try {
      const o = await createPrintOrder({ id: orderId.current, eventId, eventTitle, userId: user.id, draft: d, now: now() });
      setOrder(o);
      setStep("ok");
      onDone?.(o);
    } catch (e) {
      setFailure(printErrorText(e));
    } finally {
      setBusy(false);
    }
  }

  if (step === "ok" && order) {
    return (
      <Sheet title="Pedido enviado" onClose={onClose}>
        <div className="app-stack-sm">
          <p className="app-p" role="status">Recebemos o seu pedido. Vamos falar com você pelo {order.contactPhone ? "telefone" : "e-mail"} informado para combinar valor, prazo e entrega.</p>
          <p className="rv-caption">{orderSummary(order)} · {eventTitle}</p>
          <p className="nome" data-testid="print-status">{STATUS_LABEL[order.status]}</p>
          <p className="rv-caption">Enquanto estiver como “{STATUS_LABEL.solicitado}”, dá para cancelar em Você · Álbuns impressos.</p>
          <Button href="/eventos/pedidos" block>Ver meus pedidos</Button>
          <Button variant="texto" block onClick={onClose}>Fechar</Button>
        </div>
      </Sheet>
    );
  }

  if (step === "dados") {
    return (
      <Sheet title="Contato e entrega" onClose={onClose}>
        <form className="app-stack-sm" noValidate onSubmit={(e) => { e.preventDefault(); void send(); }}>
          <p className="rv-caption">Sem cobrança agora: o valor e o prazo chegam por contato, antes de qualquer pagamento.</p>
          <Field label="Seu nome" value={d.contactName} maxLength={80} autoComplete="name" onChange={(e) => set("contactName", e.target.value)} error={tried ? errors.contactName : undefined} />
          <Field label="Telefone com DDD" inputMode="tel" autoComplete="tel" value={formatPhone(d.contactPhone)} onChange={(e) => set("contactPhone", digits(e.target.value).slice(0, 13))} error={tried ? errors.contact : undefined} />
          <Field label="E-mail (se preferir)" type="email" autoComplete="email" value={d.contactEmail} maxLength={254} onChange={(e) => set("contactEmail", e.target.value)} />
          <Field label="CEP" inputMode="numeric" autoComplete="postal-code" value={formatCep(d.shipping.cep)} onChange={(e) => setShip("cep", digits(e.target.value).slice(0, 8))} error={tried ? errors.cep : undefined} />
          <Field label="Rua" autoComplete="address-line1" value={d.shipping.street} maxLength={120} onChange={(e) => setShip("street", e.target.value)} error={tried ? errors.street : undefined} />
          <Field label="Número" value={d.shipping.number} maxLength={20} onChange={(e) => setShip("number", e.target.value)} error={tried ? errors.number : undefined} />
          <Field label="Complemento (opcional)" autoComplete="address-line2" value={d.shipping.complement ?? ""} maxLength={60} onChange={(e) => setShip("complement", e.target.value)} />
          <Field label="Bairro" value={d.shipping.neighborhood} maxLength={80} onChange={(e) => setShip("neighborhood", e.target.value)} error={tried ? errors.neighborhood : undefined} />
          <Field label="Cidade" autoComplete="address-level2" value={d.shipping.city} maxLength={80} onChange={(e) => setShip("city", e.target.value)} error={tried ? errors.city : undefined} />
          <Field label="UF" autoComplete="address-level1" value={d.shipping.state} maxLength={2} onChange={(e) => setShip("state", e.target.value.toUpperCase())} error={tried ? errors.state : undefined} />
          <Field label="Observação (opcional)" value={d.note} maxLength={500} onChange={(e) => set("note", e.target.value)} error={tried ? errors.note : undefined} />
          {failure && <p className="rv-field-erro" role="alert">{failure}</p>}
          <Button type="submit" block disabled={busy} aria-busy={busy}>Enviar pedido</Button>
          <Button variant="texto" block onClick={() => setStep("fotos")} disabled={busy}>Voltar</Button>
        </form>
      </Sheet>
    );
  }

  return (
    <Sheet title="Escolher as fotos" onClose={onClose}>
      <div className="app-stack-sm">
        <OptionGroup label="Produto" value={d.product} onChange={pickProduct} list options={(Object.keys(PRODUCTS) as PrintProduct[]).map((p) => ({ value: p, label: `${PRODUCTS[p].label} · ${PRODUCTS[p].meta}` }))} />
        <Field label={`Quantidade (até ${QUANTITY_MAX})`} type="number" inputMode="numeric" min={1} max={QUANTITY_MAX} value={String(d.quantity)} onChange={(e) => set("quantity", Number(e.target.value))} error={tried ? errors.quantity : undefined} />
        <OptionGroup label="Fotos" value={d.allPhotos} onChange={(v) => set("allPhotos", v)} options={[{ value: false, label: "Escolher" }, { value: true, label: "Todas as fotos" }]} />
        {!d.allPhotos && (
          <>
            <p className="rv-caption" role="status">{d.photoIds.length} de {max} fotos escolhidas</p>
            <div style={GRID}>
              {photos.map((p) => {
                const on = d.photoIds.includes(p.id);
                return (
                  <button key={p.id} type="button" aria-pressed={on} aria-label={`Foto de ${p.authorName}`} onClick={() => toggle(p.id)}
                    style={{ padding: 0, border: 0, borderRadius: "var(--radius-md)", overflow: "hidden", aspectRatio: "1", background: "var(--surface-2)", outline: on ? "3px solid var(--revela)" : "none", outlineOffset: "-3px", cursor: "pointer" }}>
                    {urls[p.id] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={urls[p.id]} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: on ? 1 : 0.85 }} />
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}
        {tried && errors.photos && <p className="rv-field-erro" role="alert">{errors.photos}</p>}
        <Button block onClick={toDados}>Continuar</Button>
        <Button variant="texto" block onClick={onClose}>Fechar</Button>
      </div>
    </Sheet>
  );
}
