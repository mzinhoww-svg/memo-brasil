"use client";
/* Gerado de design-system/revela/html/Pagamento-cartao.html por scripts/html-to-tsx.mjs. Markup, classes, textos e estilos inline = referência. */
export interface CardValues { number: string; exp: string; cvv: string; holder: string; doc: string }
export const CARD_REF: CardValues = { number: "5234 8812 0093 4417", exp: "08/29", cvv: "•••", holder: "Bia Moraes", doc: "123.456.789-09" };
const maskNumber = (n: string) => { const d = n.replace(/\D/g, ""); return d.length >= 8 ? `${d.slice(0, 4)} •••• •••• ${d.slice(-4)}` : "•••• •••• •••• ••••"; };

export interface PagamentoCartaoProps {
  amount?: string; values?: CardValues; busy?: boolean; error?: string;
  /** Campos que o provedor exige além dos do desenho (telefone e endereço de cobrança). */
  extra?: React.ReactNode;
  onField?: (field: keyof CardValues, value: string) => void; onBack?: () => void; onPay?: () => void;
}

export function PagamentoCartao({ amount = "R$ 189", values = CARD_REF, busy, error, extra, onField, onBack, onPay }: PagamentoCartaoProps = {}) {
  const set = (f: keyof CardValues) => (e: React.ChangeEvent<HTMLInputElement>) => onField?.(f, e.target.value);
  return (
    <>
    <div className="scr">
      <div className="safe">
        <div className="row between">
          <button type="button" className="rv-icon-btn" aria-label="Voltar" onClick={onBack}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <span className="rv-title" style={{ "fontSize": "18px" }}>
            Cartão de crédito
          </span>
          <span style={{ "width": "44px" }} />
        </div>
        <div className="ccard">
          <div className="row between">
            <span className="ccard-chip" />
            <span className="rv-stamp" style={{ "color": "var(--carimbo)", "textShadow": "none", "fontSize": "12px" }}>
              {amount}
            </span>
          </div>
          <div className="ccard-n">
            {maskNumber(values.number)}
          </div>
          <div className="row between">
            <span>
              {values.holder.toUpperCase()}
            </span>
            <span>
              {values.exp}
            </span>
          </div>
        </div>
        <label className="rv-field rv-field--focus" style={{ "marginTop": "18px" }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
            <path d="M2.5 10h19M6 15h4" />
          </svg>
          <input value={values.number} onChange={set("number")} aria-label="Número do cartão" inputMode="numeric" autoComplete="cc-number" />
        </label>
        <div className="row" style={{ "gap": "8px", "marginTop": "10px" }}>
          <label className="rv-field" style={{ "flex": "1" }}>
            <input value={values.exp} onChange={set("exp")} aria-label="Validade" inputMode="numeric" autoComplete="cc-exp" />
          </label>
          <label className="rv-field" style={{ "flex": "1" }}>
            <input value={values.cvv} onChange={set("cvv")} aria-label="CVV" inputMode="numeric" autoComplete="cc-csc" type={onField ? "password" : "text"} />
          </label>
        </div>
        <label className="rv-field" style={{ "marginTop": "10px" }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
          </svg>
          <input value={values.holder} onChange={set("holder")} aria-label="Nome no cartão" autoComplete="cc-name" />
        </label>
        <label className="rv-field" style={{ "marginTop": "10px" }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
          </svg>
          <input value={values.doc} onChange={set("doc")} aria-label="CPF" inputMode="numeric" />
        </label>
        {extra}
        {error && <p className="rv-caption" role="alert" style={{ color: "var(--danger)", marginTop: "10px" }}>{error}</p>}
        <div className="grow" />
        <p className="secure">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
          O número vira um token no seu aparelho. Seu banco pode pedir uma confirmação.
        </p>
        <button type="button" className="rv-btn rv-btn--block rv-btn--primary" onClick={onPay} disabled={busy}>
          {busy ? "Processando…" : `Pagar ${amount}`}
        </button>
      </div>
      <div className="home-ind" />
      <div className="grain" />
    </div>
    </>
  );
}
