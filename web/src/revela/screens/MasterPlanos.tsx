"use client";
/* Master-planos.html (M03): markup e classes da referência via master-kit. Sem handlers = tela do desenho; com handlers = editor real
   (app/master/planos/PricesEditor.tsx guarda o rascunho e passa tudo por props). */
import type { ReactNode } from "react";
import { BtnLink, Ico, MHead, MNote, MasterFrame, St } from "../master-kit";

export interface PlanoRow {
  code: string; name: string; price: string; was?: string; guests: string; shots: string; sandbox: boolean; production: boolean;
  highlighted: boolean; free?: boolean; changed?: boolean; isNew?: boolean;
}
export interface PreviewPlan { code: string; tier: string; price: string; note: [string, string]; on?: boolean; gold?: boolean }
export interface PlanosHandlers {
  /** Devolve `false` quando o texto não é um preço válido (o campo volta ao valor anterior). */
  onPrice?: (code: string, text: string) => boolean | void;
  onGuests?: (code: string, text: string) => void;
  onShots?: (code: string, text: string) => void;
  onToggle?: (code: string, env: "sandbox" | "production") => void;
  onHighlight?: (code: string) => void;
  onName?: (code: string, text: string) => void;
  onAdd?: () => void;
}

const REF_ROWS: PlanoRow[] = [
  { code: "gratis", name: "Grátis", price: "0,00", guests: "10", shots: "10", sandbox: true, production: true, highlighted: false, free: true },
  { code: "festa", name: "Festa", price: "29,00", guests: "30", shots: "24", sandbox: true, production: true, highlighted: false },
  { code: "celebracao", name: "Celebração", price: "89,00", guests: "100", shots: "24", sandbox: true, production: true, highlighted: false },
  { code: "casamento", name: "Casamento", price: "199,00", was: "R$ 189,00", guests: "250", shots: "36", sandbox: true, production: true, highlighted: true, changed: true },
  { code: "grande", name: "Grande", price: "349,00", guests: "500", shots: "livre", sandbox: true, production: true, highlighted: false },
];
export const REF_PREVIEW: PreviewPlan[] = [
  { code: "gratis", tier: "Grátis", price: "Grátis", note: ["10 convidados", "10 poses cada"] },
  { code: "festa", tier: "Festa", price: "R$ 29", note: ["30 convidados", "24 poses cada"] },
  { code: "celebracao", tier: "Celebração", price: "R$ 89", note: ["100 convidados", "24 poses cada"] },
  { code: "casamento", tier: "Casamento", price: "R$ 199", note: ["250 convidados", "36 poses cada"], on: true },
  { code: "grande", tier: "Grande", price: "R$ 349", note: ["500 convidados", "poses livres"], gold: true },
];

function Toggle({ on, label, onClick, disabled }: { on: boolean; label: string; onClick?: () => void; disabled?: boolean }) {
  const cls = `rv-toggle${on ? " rv-toggle--on" : ""}`;
  if (!onClick) return <i className={cls} />;
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className={cls} disabled={disabled} onClick={onClick} style={{ border: 0, padding: 0, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : undefined }} />;
}

/** Prévia do paywall no celular (a mesma do app do anfitrião), com os valores ainda não publicados. */
export function PhonePreview({ plans = REF_PREVIEW, cta = "Continuar · R$ 199", payNote = "Pix ou cartão", provider = "ValidaPay", shift = 150 }: { plans?: PreviewPlan[]; cta?: string; payNote?: string; provider?: string; shift?: number }) {
  return (
    <div className="phonepv" role="group" aria-label="Prévia do paywall no celular">
      <div className="phonepv-in">
        <div className="rv-sheet__grab" />
        <h3 className="rv-title" style={{ fontSize: "18px" }}>Escolha o plano</h3>
        <p className="rv-caption" style={{ margin: "2px 0 12px" }}>Pague uma vez por evento.</p>
        <div className="planscroll">
          <div className="rv-plans rv-plans--scroll" style={{ transform: `translateX(-${shift}px)` }}>
            {plans.map((p) => (
              <div key={p.code} className={`rv-plan${p.on ? " rv-plan--on" : ""}${p.gold ? " rv-plan--gold" : ""}`}>
                <span className="rv-plan__tier">{p.tier}</span>
                <span className="rv-plan__price">{p.price}</span>
                <span className="rv-plan__note">{p.note[0]}<br />{p.note[1]}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="paynote">
          <Ico n="pix" />
          <span>{payNote}</span>
          <Ico n="lock" />
          <span>{provider}</span>
        </div>
        <span className="rv-btn rv-btn--primary rv-btn--block" style={{ height: "48px" }}>{cta}</span>
      </div>
    </div>
  );
}

export interface PlanosViewProps extends PlanosHandlers {
  caption?: string;
  rows?: PlanoRow[];
  preview?: PreviewPlan[];
  previewCta?: string;
  previewShift?: number;
  payNote?: string;
  provider?: string;
  /** Barra "N alteração não publicada" (`null` = sem alterações). */
  dirty?: { title: string; summary: string; blocked?: boolean; onDiscard?: () => void; onPublish?: () => void } | null;
  /** Erros de validação do rascunho. */
  errors?: string[];
  /** Ambiente da prévia (chips) quando editável. */
  historyHref?: string;
  /** Modal M04, por cima da tela. */
  modal?: ReactNode;
}

const COLS = "1.2fr 1fr .8fr .8fr .7fr .7fr .9fr .3fr";

export function MasterPlanosView({
  caption = "Altere o valor direto na tabela. A prévia mostra o paywall como o anfitrião vai ver.", rows = REF_ROWS, preview = REF_PREVIEW, previewCta, previewShift, payNote, provider, historyHref,
  dirty = { title: "1 alteração não publicada", summary: "Casamento: R$ 189,00 → R$ 199,00" }, errors = [], modal,
  onPrice, onGuests, onShots, onToggle, onHighlight, onName, onAdd,
}: PlanosViewProps = {}) {
  const live = Boolean(onPrice);
  const field = (value: string, onChange: ((v: string) => void) | undefined, label: string, placeholder: string, disabled?: boolean) => (
    <input aria-label={label} disabled={disabled} placeholder={onChange ? placeholder : undefined} {...(onChange ? { value, onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value), inputMode: "numeric" as const } : { defaultValue: value })} />
  );
  return (
    <>
      <MHead title="Planos e preços" caption={caption}>
        {historyHref ? <BtnLink href={historyHref} icon="history">Histórico de preços</BtnLink> : <button className="rv-btn rv-btn--sm"><Ico n="history" />Histórico de preços</button>}
      </MHead>
      <div className="mgrid-plans">
        <section className="mcard" style={{ padding: "0", overflow: "hidden" }}>
          <div className="mtable" style={{ margin: "0" }}>
            <div className="mtr mth" style={{ gridTemplateColumns: COLS }}>
              <span>Plano</span><span>Preço</span><span>Convidados</span><span>Poses</span><span>Sandbox</span><span>Produção</span><span>Paywall</span><span />
            </div>
            {rows.map((r) => (
              <div key={r.code} className={`mtr prow${r.changed ? " changed" : ""}`} style={{ gridTemplateColumns: COLS }}>
                <span>
                  {r.isNew && onName ? <input className="mfield" aria-label={`Nome do plano ${r.code}`} value={r.name} onChange={(e) => onName(r.code, e.target.value)} style={{ maxWidth: "none" }} /> : <b>{r.name}</b>}
                  <small className="rv-caption">{r.code}</small>
                </span>
                <span>
                  <label className={`mfield${r.changed ? " mfield--on" : ""}`}>
                    <i>R$</i>
                    <input key={live ? `${r.code}-${r.price}` : undefined} aria-label={`Preço ${r.name}`} disabled={r.free} defaultValue={r.price} {...(live ? { inputMode: "decimal" as const, onBlur: (e: React.FocusEvent<HTMLInputElement>) => { if (onPrice?.(r.code, e.target.value) === false) e.target.value = r.price; } } : {})} />
                  </label>
                  {r.was && <small className="was">era {r.was}</small>}
                </span>
                <span><label className="mfield">{field(r.guests, onGuests ? (v) => onGuests(r.code, v) : undefined, `Convidados ${r.name}`, "sem limite")}</label></span>
                <span><label className="mfield">{field(r.shots, onShots ? (v) => onShots(r.code, v) : undefined, `Poses ${r.name}`, "livre")}</label></span>
                <span><Toggle on={r.sandbox} label={`Sandbox de ${r.name}`} disabled={r.free} onClick={onToggle ? () => onToggle(r.code, "sandbox") : undefined} /></span>
                <span><Toggle on={r.production} label={`Produção de ${r.name}`} disabled={r.free} onClick={onToggle ? () => onToggle(r.code, "production") : undefined} /></span>
                <span>
                  {r.highlighted ? <St tone="info">Destaque</St> : r.free ? null : (
                    <a className="link" role={onHighlight ? "button" : undefined} tabIndex={onHighlight ? 0 : undefined} style={onHighlight ? { cursor: "pointer" } : undefined} aria-label={`Destacar ${r.name}`}
                      onClick={onHighlight ? () => onHighlight(r.code) : undefined} onKeyDown={onHighlight ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onHighlight(r.code); } } : undefined}>Destacar</a>
                  )}
                </span>
                <span><Ico n="dots" /></span>
              </div>
            ))}
          </div>
          {errors.map((e) => <p key={e} className="rv-caption" role="alert" style={{ color: "var(--danger)", margin: "10px 16px 0" }}>{e}</p>)}
          <MNote icon="shield">Preço novo vale só para compras novas. Quem já pagou mantém o plano e os limites que comprou. Pedido Pix aberto mantém o valor cotado.</MNote>
          <button className="rv-btn rv-btn--text" style={{ margin: "4px 16px 14px" }} onClick={onAdd} type="button"><Ico n="plus" /> Novo plano</button>
        </section>
        <aside>
          <p className="rv-caption" style={{ marginBottom: "10px" }}>Prévia no celular</p>
          <PhonePreview plans={preview} cta={previewCta} payNote={payNote} provider={provider} shift={previewShift} />
        </aside>
      </div>
      {dirty && (
        <div className="mpublish">
          <span>
            <Ico n="edit" />
            <b>{dirty.title}</b>
            <span className="rv-caption">{dirty.summary}</span>
          </span>
          <div className="row" style={{ gap: "8px" }}>
            <button className="rv-btn rv-btn--sm" type="button" onClick={dirty.onDiscard}>Descartar</button>
            <button className="rv-btn rv-btn--sm rv-btn--primary" type="button" disabled={dirty.blocked} onClick={dirty.onPublish}><Ico n="check" />Publicar preços</button>
          </div>
        </div>
      )}
      {modal}
    </>
  );
}

export function MasterPlanos(props: PlanosViewProps = {}) {
  return <MasterFrame current="planos"><MasterPlanosView {...props} /></MasterFrame>;
}
