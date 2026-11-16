/* Master-visao-atividade.html (M20) e Master-visao-atividade--tabela.html (M20-t): Visão geral com "Atividade por dia".
   Markup e classes da referência via master-kit; dados por props (padrão = desenho). Substitui a M01 (receita por dia, vendas por plano, últimos pagamentos). */
import type { ReactNode } from "react";
import { MCard, MHead, MTable, MasterFrame, St, Tiles, type MRow } from "../master-kit";

export interface AtividadeBar { pct: number; label?: string; on?: boolean }
export interface AtividadeSerie { label: string; total: string; bars: AtividadeBar[]; warn?: boolean }
export interface AtividadeRow { key: string; cells: [string, string, string, string, string]; /** Falhas do dia acima do normal: destaca a célula (`.st--bad`). */ failuresBad?: boolean }
export interface VisaoAtividadeProps {
  caption?: string;
  tiles?: { label: string; value: string; note?: string }[];
  days?: 7 | 30;
  mode?: "barras" | "tabela";
  /** Links dos controles "7 dias | 30 dias" e "Barras | Tabela" (sem eles ficam como no desenho, sem ação). */
  periodHref?: (d: 7 | 30) => string;
  modeHref?: (m: "barras" | "tabela") => string;
  series?: AtividadeSerie[];
  rows?: AtividadeRow[];
  /** Botão de exportação real (abre a folha Exportar); `null` = sem botão (papel que não exporta); sem a prop, o botão do desenho. */
  exportAction?: ReactNode;
  /** Aviso quando algum bloco não carregou. */
  notice?: ReactNode;
  /** Bloco "Atividade por dia" no lugar do gráfico (estado de erro ou sem permissão desse bloco). */
  activityState?: ReactNode;
}

/** Alturas (%) das 30 barras de cada série no desenho; o rótulo aparece a cada 5 dias e a maior barra fica destacada. */
const REF_PCT = {
  eventos: [17, 33, 0, 50, 33, 17, 67, 83, 33, 17, 33, 50, 67, 33, 17, 33, 50, 83, 33, 17, 17, 50, 67, 33, 17, 33, 50, 100, 33, 17],
  entradas: [17, 29, 10, 33, 47, 23, 50, 67, 39, 27, 34, 56, 78, 50, 34, 44, 62, 83, 51, 39, 33, 67, 89, 55, 44, 51, 72, 100, 62, 50],
  fotos: [17, 28, 11, 33, 44, 22, 50, 67, 39, 28, 33, 56, 78, 50, 33, 44, 61, 83, 50, 39, 33, 67, 89, 56, 44, 50, 72, 100, 61, 50],
  falhas: [10, 14, 5, 10, 43, 14, 19, 29, 14, 10, 10, 24, 67, 19, 14, 14, 24, 33, 19, 14, 10, 29, 38, 24, 14, 19, 29, 100, 24, 19],
};
const toBars = (pcts: number[]): AtividadeBar[] => pcts.map((pct, i) => ({ pct, label: (i + 1) % 5 === 0 ? String(i + 1) : undefined, on: pct === 100 }));
const REF_SERIES: AtividadeSerie[] = [
  { label: "Eventos criados", total: "63", bars: toBars(REF_PCT.eventos) },
  { label: "Entradas de convidados", total: "2.118", bars: toBars(REF_PCT.entradas) },
  { label: "Fotos", total: "61.402", bars: toBars(REF_PCT.fotos) },
  { label: "Falhas de upload", total: "212", bars: toBars(REF_PCT.falhas), warn: true },
];
const REF_ROWS: AtividadeRow[] = [
  { key: "10", cells: ["ter, 10 nov", "1", "90", "2.710", "4"] },
  { key: "09", cells: ["seg, 09 nov", "2", "111", "3.300", "5"] },
  { key: "08", cells: ["dom, 08 nov", "6", "180", "5.412", "21"], failuresBad: true },
  { key: "07", cells: ["sáb, 07 nov", "3", "130", "3.905", "6"] },
  { key: "06", cells: ["sex, 06 nov", "2", "91", "2.702", "4"] },
  { key: "05", cells: ["qui, 05 nov", "1", "80", "2.401", "3"] },
  { key: "04", cells: ["qua, 04 nov", "2", "99", "3.018", "5"] },
];

const REF_TILES = [
  { label: "Receita do mês", value: "R$ 12.430", note: "+18% sobre outubro" },
  { label: "Eventos ativos", value: "41", note: "6 revelam hoje" },
  { label: "Fotos hoje", value: "8.912", note: "pico às 22:40" },
  { label: "Pedidos pendentes", value: "3", note: "Pix aguardando" },
];

export function MasterVisaoAtividadeView({
  caption = "Novembro de 2026 · atualizado às 08:42", tiles = REF_TILES, days, mode = "barras", periodHref, modeHref, series = REF_SERIES, rows = REF_ROWS, exportAction, notice, activityState,
}: VisaoAtividadeProps = {}) {
  const d = days ?? (mode === "tabela" ? 7 : 30);
  const seg = <T extends string | number>(items: { value: T; label: string; href?: string }[], on: T) => (
    <div className="seg">
      {items.map((s) => (s.href ? <a key={s.label} className={s.value === on ? "on" : ""} href={s.href}>{s.label}</a> : <span key={s.label} className={s.value === on ? "on" : ""}>{s.label}</span>))}
    </div>
  );
  const trows: MRow[] = rows.map((r) => ({
    key: r.key,
    cells: [r.cells[0], r.cells[1], r.cells[2], r.cells[3], r.failuresBad ? <St key="f" tone="bad">{r.cells[4]}</St> : r.cells[4]],
  }));
  return (
    <>
      <MHead title="Visão geral" caption={caption}>
        {exportAction !== undefined ? exportAction : (
          <button className="rv-btn rv-btn--sm"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></svg>Exportar</button>
        )}
      </MHead>
      {notice}
      <Tiles items={tiles} />
      <MCard style={mode === "tabela" ? { paddingBottom: "6px" } : undefined}>
        <div className="row between">
          <h2 className="rv-title" style={{ fontSize: "18px" }}>Atividade por dia</h2>
          <div className="row" style={{ gap: "8px" }}>
            <div style={{ width: "170px" }}>{seg([{ value: 7 as 7 | 30, label: "7 dias", href: periodHref?.(7) }, { value: 30 as 7 | 30, label: "30 dias", href: periodHref?.(30) }], d)}</div>
            <div style={{ width: "170px" }}>{seg([{ value: "barras" as const, label: "Barras", href: modeHref?.("barras") }, { value: "tabela" as const, label: "Tabela", href: modeHref?.("tabela") }], mode)}</div>
          </div>
        </div>
        {activityState ?? (mode === "tabela" ? (
          <MTable cols="1.2fr 1fr 1.2fr 1fr 1fr" head={["Dia", "Eventos criados", "Entradas de convidados", "Fotos", "Falhas de upload"]} rows={trows} empty="Sem atividade no período." />
        ) : (
          <div className="mminis">
            {series.map((s) => (
              <div className={s.warn ? "mmini mmini--warn" : "mmini"} key={s.label}>
                <div className="row between"><span>{s.label}</span><b>{s.total}</b></div>
                <div className="bars">
                  {s.bars.map((b, i) => (
                    <div key={i}>
                      <i style={{ height: `${b.pct}%` }} className={b.on ? "on" : undefined} />
                      <span>{b.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </MCard>
    </>
  );
}

export function MasterVisaoAtividade(props: VisaoAtividadeProps = {}) {
  return <MasterFrame current="visao"><MasterVisaoAtividadeView {...props} /></MasterFrame>;
}
export function MasterVisaoAtividadeTabela(props: VisaoAtividadeProps = {}) {
  return <MasterFrame current="visao"><MasterVisaoAtividadeView mode="tabela" days={7} {...props} /></MasterFrame>;
}
