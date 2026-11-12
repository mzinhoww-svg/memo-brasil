"use client";
import type { ReactNode } from "react";

/* Master-lgpd.html (M12): markup e classes da referência via master-kit; dados por props (padrão = desenho). */
import { GroupRow, MCard, MHead, MRow, MTable, MasterFrame, St, Ico, type IconName, type Tone } from "../master-kit";

export interface LgpdRow { key: string; when: string; who: string; kind: string; due: string; tone: Tone; status: string }
export interface RetencaoRow { key: string; icon: IconName; label: string; value: string }
export interface LgpdProps { caption?: string; rows?: LgpdRow[]; retention?: RetencaoRow[]; editable?: boolean; onRetention?: (row: RetencaoRow) => void; empty?: string; pager?: ReactNode }

const REF_ROWS: LgpdRow[] = [
  { key: "1", when: "08 nov", who: "rafa.lima@email.com", kind: "Excluir conta", due: "8 dez", tone: "wait", status: "Em andamento" },
  { key: "2", when: "06 nov", who: "Convidado de Ana & Leo", kind: "Apagar meus dados", due: "6 dez", tone: "ok", status: "Concluído" },
  { key: "3", when: "02 nov", who: "julia.alves@email.com", kind: "Exportar dados", due: "2 dez", tone: "ok", status: "Concluído" },
];
const REF_RETENTION: RetencaoRow[] = [
  { key: "1", icon: "clock", label: "Fotos depois da revelação", value: "365 dias" },
  { key: "2", icon: "clock", label: "Evento que nunca revelou", value: "180 dias" },
  { key: "3", icon: "clock", label: "Hash de IP nos logs", value: "30 dias" },
  { key: "4", icon: "clock", label: "Backups", value: "30 dias" },
];

export function MasterLgpdView({ caption = "Pedidos de exclusão e prazos de retenção", rows = REF_ROWS, retention = REF_RETENTION, editable = true, empty, onRetention, pager }: LgpdProps = {}) {
  const mrows: MRow[] = rows.map((r) => ({ key: r.key, cells: [r.when, r.who, r.kind, r.due, <St key="s" tone={r.tone}>{r.status}</St>] }));
  return (
    <>
      <MHead title="LGPD" caption={caption} />
      <div className="mgrid2" style={{ gridTemplateColumns: "1.6fr 1fr" }}>
        <MCard style={{ padding: "0" }}>
          <MTable cols="0.7fr 1.6fr 1fr .7fr 1fr" head={["Pedido", "Quem", "Tipo", "Prazo", "Situação"]} rows={mrows} empty={empty ?? "Nenhum pedido."} />
          {pager}
        </MCard>
        <MCard>
          <h2 className="rv-title" style={{ fontSize: "18px" }}>Retenção</h2>
          <div className="rv-group" style={{ marginTop: "14px" }}>
            {retention.map((r) => (
              <GroupRow key={r.key} icon={r.icon} end={editable ? <button type="button" className="rv-row__end" aria-label={`Ver política: ${r.label}`} onClick={()=>onRetention?.(r)} style={{border:0,padding:0,background:"transparent",color:"var(--ink-muted)"}}><Ico n="chevron" /></button> : undefined}
                title={<><span className="rv-row__meta">{r.label}</span>{r.value}</>} />
            ))}
          </div>
        </MCard>
      </div>
    </>
  );
}

export function MasterLgpd(props: LgpdProps = {}) {
  return <MasterFrame current="lgpd"><MasterLgpdView {...props} /></MasterFrame>;
}
