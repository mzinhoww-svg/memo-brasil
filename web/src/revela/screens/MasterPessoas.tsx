/* Master-pessoas.html (M10): markup e classes da referência via master-kit; dados por props (padrão = desenho). */
import type { ReactNode } from "react";
import { BtnLink, Ico, MHead, MTable, MasterFrame, Seg, type MRow } from "../master-kit";

export interface PessoasProps {
  caption?: string;
  tabs?: { label: string; href?: string; on?: boolean }[];
  /** Colunas da tabela da aba atual (`cols` = gridTemplateColumns). */
  cols?: string;
  head?: string[];
  rows?: MRow[];
  exportHref?: string | null;
  empty?: string;
  pager?: ReactNode;
}

const chev = <Ico n="chevron" />;
const REF_ROWS: MRow[] = [
  { key: "1", cells: ["Ana Ribeiro", "ana.ribeiro@email.com", "Google", "1", "R$ 189,00", "nov 2026", chev] },
  { key: "2", cells: ["Comissão Medicina 2026", "formatura.med@email.com", "Google", "1", "R$ 349,00", "out 2026", chev] },
  { key: "3", cells: ["Rafael Lima", "rafa.lima@email.com", "Link por e-mail", "2", "R$ 29,00", "out 2026", chev] },
  { key: "4", cells: ["Júlia Alves", "julia.alves@email.com", "Google", "3", "R$ 207,00", "set 2026", chev] },
  { key: "5", cells: ["Lu Prado", "lu.prado@email.com", "Google", "4", "R$ 0,00", "set 2026", chev] },
];
const REF_TABS = [{ label: "Organizadores 198", on: true }, { label: "Convidados 7.412" }, { label: "Equipe 3" }];

export function MasterPessoasView({
  caption = "Organizadores, convidados e contas da equipe", tabs = REF_TABS, cols = "1.3fr 1.6fr 1fr .6fr .8fr .7fr .2fr", head = ["Nome", "E-mail", "Entrou com", "Eventos", "Gasto total", "Desde", ""], rows = REF_ROWS, exportHref, empty, pager,
}: PessoasProps = {}) {
  return (
    <>
      <MHead title="Pessoas" caption={caption}>
        {exportHref === null ? null : exportHref ? <BtnLink href={exportHref} icon="download">Exportar</BtnLink> : <button className="rv-btn rv-btn--sm"><Ico n="download" />Exportar</button>}
      </MHead>
      <div style={{ marginBottom: "14px", width: "460px" }}>
        <Seg items={tabs} />
      </div>
      <MTable cols={cols} head={head} rows={rows} empty={empty ?? "Ninguém por aqui ainda."} />
      {pager}
    </>
  );
}

export function MasterPessoas(props: PessoasProps = {}) {
  return <MasterFrame current="pessoas"><MasterPessoasView {...props} /></MasterFrame>;
}
