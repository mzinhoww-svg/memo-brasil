/* Master-evento-detalhe.html (M21): detalhe do evento. Markup e classes da referência via master-kit; dados por props (padrão = desenho).
   As ações do cabeçalho (voltar, marcar como teste, revelar agora) chegam prontas em `actions`; sem elas ficam os botões do desenho. */
import type { ReactNode } from "react";
import { Gauge, Ico, MCard, MHead, MTable, MasterFrame, St, type MRow, type Tone } from "../master-kit";

export interface EventoDetalheProps {
  title?: string;
  caption?: string;
  actions?: ReactNode;
  plan?: string;
  photos?: string;
  createdAt?: string;
  guests?: { value: string; pct: number };
  reveal?: { label: string; value: string }[];
  reasons?: { label: string; count: number; pct: number }[];
  /** Pedidos de impressão; `null` esconde o cartão (chave `printed_album` desligada ou papel sem acesso). */
  prints?: { key: string; code: string; product: string; tone: Tone; status: string }[] | null;
  timeline?: { key: string; tone?: "ok" | "bad"; title: string; meta: string }[];
  /** Linha extra no cartão Evento (ex.: situação "evento de teste"). */
  notice?: ReactNode;
}

const REF_REVEAL = [
  { label: "Prevista", value: "dom, 15 mar 2027 12:00" }, { label: "Situação", value: "na fila" }, { label: "Avisos por e-mail", value: "21 inscritos" },
  { label: "Enviados", value: "0" }, { label: "Falhas", value: "0" }, { label: "Na fila", value: "21" },
];
const REF_REASONS = [
  { label: "Não quero aparecer", count: 2, pct: 100 }, { label: "Foto constrangedora", count: 1, pct: 50 }, { label: "Conteúdo impróprio", count: 0, pct: 0 }, { label: "Outro motivo", count: 0, pct: 0 },
];
const REF_PRINTS: NonNullable<EventoDetalheProps["prints"]> = [
  { key: "1", code: "IMP-7K2Q", product: "Álbum · 1", tone: "wait", status: "solicitado" },
  { key: "2", code: "IMP-3F9D", product: "Caixa · 2", tone: "info", status: "em produção" },
];
const REF_TIMELINE = [
  { key: "1", title: "Plano Casamento liberado", meta: "hoje 08:42 · sistema · Pix #RV-2041" },
  { key: "2", title: "Convite “Link antigo do WhatsApp” revogado", meta: "08 nov 19:20 · Ana Ribeiro" },
  { key: "3", title: "Revelação marcada para 15 mar 12:00", meta: "03 nov 09:20 · Ana Ribeiro" },
  { key: "4", title: "Evento criado", meta: "03 nov 09:14 · Ana Ribeiro" },
];

/** Bandeira do botão "Marcar como teste" (o desenho usa a mesma do item Moderação do menu). */
export const FlagIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M5 21V4M5 4h11l-2 4 2 4H5" /></svg>;

/** Botões do cabeçalho como no desenho (sem ação), para a tela de comparação. */
export function EventoDetalheRefActions() {
  return (
    <>
      <button className="rv-btn rv-btn--sm"><Ico n="back" />Voltar</button>
      <button className="rv-btn rv-btn--sm"><FlagIcon />Marcar como teste</button>
      <button className="rv-btn rv-btn--sm rv-btn--primary"><Ico n="spark" />Revelar agora</button>
    </>
  );
}

export function MasterEventoDetalheView({
  title = "Ana & Leo", caption = "Casamento · Ana Ribeiro · sáb, 14 mar 2027 16:30 → dom 02:00", actions, plan = "Casamento · R$ 189,00 pago por Pix", photos = "418", createdAt = "03 nov 2026 09:14",
  guests = { value: "32 de 250", pct: 13 }, reveal = REF_REVEAL, reasons = REF_REASONS, prints = REF_PRINTS, timeline = REF_TIMELINE, notice,
}: EventoDetalheProps = {}) {
  const prow: MRow[] = (prints ?? []).map((o) => ({ key: o.key, cells: [<code key="c">{o.code}</code>, o.product, <St key="s" tone={o.tone}>{o.status}</St>] }));
  return (
    <>
      <MHead title={title} caption={caption}>{actions ?? <EventoDetalheRefActions />}</MHead>
      <div className="mgrid3">
        <div className="stack" style={{ gap: "14px" }}>
          <MCard>
            <h2 className="rv-title" style={{ fontSize: "18px" }}>Evento</h2>
            <div className="kv">
              <div><span>Plano</span><b>{plan}</b></div>
              <div><span>Fotos</span><b>{photos}</b></div>
              <div><span>Criado em</span><b>{createdAt}</b></div>
            </div>
            <div style={{ marginTop: "14px" }}><Gauge label="Convidados / capacidade" value={guests.value} pct={guests.pct} /></div>
            {notice}
          </MCard>
          <MCard index={1}>
            <h2 className="rv-title" style={{ fontSize: "18px" }}>Revelação</h2>
            <div className="kv">{reveal.map((r) => <div key={r.label}><span>{r.label}</span><b>{r.value}</b></div>)}</div>
          </MCard>
        </div>
        <div className="stack" style={{ gap: "14px" }}>
          <MCard index={2}>
            <h2 className="rv-title" style={{ fontSize: "18px" }}>Denúncias por motivo</h2>
            <div className="stack" style={{ marginTop: "14px", gap: "10px" }}>
              {reasons.map((r) => (
                <div className="hbar" key={r.label}>
                  <div className="row between"><span>{r.label}</span><b>{r.count}</b></div>
                  <i><s style={{ width: `${r.pct}%` }} /></i>
                </div>
              ))}
            </div>
          </MCard>
          {prints && (
            <MCard index={3} style={{ paddingBottom: "8px" }}>
              <h2 className="rv-title" style={{ fontSize: "18px" }}>Pedidos de impressão</h2>
              <MTable cols=".9fr .8fr 1.3fr" head={["Pedido", "Produto", "Status"]} rows={prow} empty="Nenhum pedido de impressão." />
            </MCard>
          )}
        </div>
        <MCard index={4}>
          <h2 className="rv-title" style={{ fontSize: "18px" }}>Auditoria do evento</h2>
          <div className="tls">
            {timeline.map((t) => (
              <div className={t.tone === "bad" ? "tl tl--bad" : "tl tl--ok"} key={t.key}>
                <i />
                <div><b>{t.title}</b><span className="rv-caption">{t.meta}</span></div>
              </div>
            ))}
            {!timeline.length && <p className="rv-caption">Nenhum registro para este evento.</p>}
          </div>
        </MCard>
      </div>
    </>
  );
}

export function MasterEventoDetalhe(props: EventoDetalheProps = {}) {
  return <MasterFrame current="eventos"><MasterEventoDetalheView {...props} /></MasterFrame>;
}
