/* Master-pagamento-detalhe.html (M06): markup e classes da referência via master-kit; dados por props (padrão = desenho). */
import type { ReactNode } from "react";
import { BtnLink, MCard, MHead, MNote, MasterFrame } from "../master-kit";

export interface TimelineItem { key: string; tone: "ok" | "bad"; title: string; meta: string }
export interface PagamentoDetalheProps {
  title?: string; caption?: string;
  timeline?: TimelineItem[];
  /** Linhas de "Dados" (rótulo + valor). */
  data?: { label: string; value: string }[];
  note?: string | null;
  /** Botões da ficha (Estornar, Consultar). O desenho traz os dois. */
  actions?: ReactNode;
  backHref?: string;
}

const REF_TIMELINE: TimelineItem[] = [
  { key: "1", tone: "ok", title: "Pedido criado", meta: "ontem 17:58 · R$ 189,00 cotado no banco" },
  { key: "2", tone: "ok", title: "Cobrança Pix criada na ValidaPay", meta: "ontem 17:58 · cha_8f2…a91 · expira em 15 min" },
  { key: "3", tone: "ok", title: "Webhook payment.success recebido", meta: "ontem 18:02 · assinatura válida" },
  { key: "4", tone: "ok", title: "Plano Casamento liberado", meta: "ontem 18:02 · 250 convidados, 36 poses" },
  { key: "5", tone: "bad", title: "Segundo Pix pago para o mesmo pedido", meta: "ontem 18:05 · cha_1c0…77e" },
];
const REF_DATA = [
  { label: "Valor", value: "R$ 189,00 · pagamento único" }, { label: "Método", value: "Pix" }, { label: "Ambiente", value: "Produção" },
  { label: "Cobrança ValidaPay", value: "cha_1c0…77e" }, { label: "externalTxid", value: "5b1e…c2d0 (= pedido)" },
];

export function MasterPagamentoDetalheView({
  title = "Pedido #RV-2037", caption = "Bodas de prata · Sônia Prado · Casamento", timeline = REF_TIMELINE, data = REF_DATA,
  note = "Pago duas vezes. O plano já está liberado pela primeira cobrança. Estorne a segunda.", actions, backHref,
}: PagamentoDetalheProps = {}) {
  return (
    <>
      <MHead title={title} caption={caption}>
        {backHref ? <BtnLink href={backHref} icon="back">Voltar</BtnLink> : <button className="rv-btn rv-btn--sm"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>Voltar</button>}
      </MHead>
      <div className="mgrid2">
        <MCard>
          <h2 className="rv-title" style={{ fontSize: "18px" }}>Linha do tempo</h2>
          <div className="tls">
            {timeline.map((t) => (
              <div className={`tl tl--${t.tone}`} key={t.key}>
                <i />
                <div>
                  <b>{t.title}</b>
                  <span className="rv-caption">{t.meta}</span>
                </div>
              </div>
            ))}
          </div>
        </MCard>
        <MCard>
          <h2 className="rv-title" style={{ fontSize: "18px" }}>Dados</h2>
          <div className="rv-group" style={{ marginTop: "14px" }}>
            {data.map((d) => (
              <div className="rv-row" key={d.label}>
                <div className="rv-row__text"><span className="rv-row__meta">{d.label}</span>{d.value}</div>
              </div>
            ))}
          </div>
          {note && <MNote style={{ margin: "16px 0 0" }}>{note}</MNote>}
          <div className="row" style={{ gap: "8px", marginTop: "16px" }}>
            {actions ?? (
              <>
                <button className="rv-btn rv-btn--sm rv-btn--primary"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M20 11a8 8 0 0 0-14.3-4.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16M20 20v-4h-4" /></svg>Estornar</button>
                <button className="rv-btn rv-btn--sm"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>Consultar</button>
              </>
            )}
          </div>
        </MCard>
      </div>
    </>
  );
}

export function MasterPagamentoDetalhe(props: PagamentoDetalheProps = {}) {
  return <MasterFrame current="pagamentos"><MasterPagamentoDetalheView {...props} /></MasterFrame>;
}
