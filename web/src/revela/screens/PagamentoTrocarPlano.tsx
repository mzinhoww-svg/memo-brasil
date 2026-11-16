"use client";
/* Origem: design-system/revela/html/Pagamento-trocar-plano.html (scripts/html-to-tsx.mjs não roda em nenhum script npm nem no CI; este arquivo é editado à mão).
   Tela inteira do desenho (`.scr` com cabeçalho e botão); o miolo é o `PlanoConteudo`, que o painel usa sem `.scr`. */
import { PlanoConteudo, type Gauge, type PlanoConteudoProps } from "./PlanoConteudo";

export type { Gauge };
export interface PagamentoTrocarPlanoProps extends Omit<PlanoConteudoProps, "children"> {
  cta?: string; busy?: boolean;
  onBack?: () => void; onConfirm?: () => void;
}

export function PagamentoTrocarPlano({ cta = "Trocar para Celebração · R$ 89", busy, onBack, onConfirm, ...conteudo }: PagamentoTrocarPlanoProps = {}) {
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
            Plano do evento
          </span>
          <span style={{ "width": "44px" }} />
        </div>
        <PlanoConteudo {...conteudo}>
          <button type="button" className="rv-btn rv-btn--block rv-btn--primary" onClick={onConfirm} disabled={busy}>
            {cta}
          </button>
        </PlanoConteudo>
      </div>
      <div className="home-ind" />
      <div className="grain" />
    </div>
    </>
  );
}
