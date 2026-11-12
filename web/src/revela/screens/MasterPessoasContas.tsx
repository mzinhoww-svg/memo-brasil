/* Master-pessoas-contas.html (M15): markup e classes da referência; dados por props (o padrão é o desenho). */
import type { ReactNode } from "react";
import { MasterFrame } from "../master-kit";
import { Status, FilterBar, Pager, PessoasList, REF_COUNTS, fmt, type ChipItem, type PessoasQuery, type TabCounts } from "./MasterPessoasKit";
import { roleTone, type ContaRow } from "@/lib/master/people";

export const CONTAS_REF: ContaRow[] = [
  { id: "3f9a1c2e", kind: "Google", kindTone: "info", email: "marcos@revela.app", created: "02 set 2026", last: "hoje 08:31", role: "master" },
  { id: "91be6f04", kind: "Google", kindTone: "info", email: "suporte@revela.app", created: "10 set 2026", last: "hoje 08:02", role: "support" },
  { id: "e8032c5d", kind: "E-mail", kindTone: "mute", email: "auditoria@revela.app", created: "15 set 2026", last: "05 nov 17:20", role: "auditor" },
  { id: "a41b77d0", kind: "Google", kindTone: "info", email: "ana.ribeiro@email.com", created: "03 nov 2026", last: "hoje 07:58", role: null },
  { id: "c0e2194b", kind: "E-mail", kindTone: "mute", email: "rafa.lima@email.com", created: "21 out 2026", last: "ontem 22:10", role: null },
  { id: "7d55e0a3", kind: "Convidado", kindTone: "mute", email: "—", created: "08 nov 2026", last: "08 nov 23:41", role: null },
  { id: "5b7c9a11", kind: "Convidado", kindTone: "mute", email: "—", created: "08 nov 2026", last: "08 nov 22:15", role: null },
  { id: "2f60d3c8", kind: "Google", kindTone: "info", email: "julia.alves@email.com", created: "12 set 2026", last: "09 nov 19:03", role: null },
];
export const CONTAS_CHIPS_REF: ChipItem[] = [
  { label: "Todas", n: 7613, on: true }, { label: "Equipe", n: 3 }, { label: "Google", n: 171 }, { label: "E-mail", n: 27 }, { label: "Convidados", n: 7412 },
];

export interface ContasViewProps {
  counts?: TabCounts;
  chips?: ChipItem[];
  query?: PessoasQuery;
  rows?: ContaRow[];
  /** "38 convidados órfãos (conta sem participação em nenhum evento)." — nulo = sem a linha. */
  orphans?: number | null;
  page?: number;
  total?: number;
  live?: boolean;
  exportAction?: ReactNode;
}

export function MasterPessoasContasView({ counts = REF_COUNTS, chips = CONTAS_CHIPS_REF, query, rows = CONTAS_REF, orphans = 38, page = 1, total = 7613, live, exportAction }: ContasViewProps) {
  return (
    <PessoasList aba="contas" counts={counts} live={live} exportAction={exportAction} caption="Todas as contas de autenticação da plataforma"
      bar={<FilterBar aba="contas" chips={chips} placeholder="Buscar por e-mail ou ID" q={query?.q} f={query?.f} live={live} />}
      cols=".8fr .8fr 1.8fr 1fr 1fr .8fr" head={["ID", "Tipo", "E-mail", "Criado em", "Último acesso", "Papel"]}
      rows={rows.map((r, i) => ({
        key: `${r.id}-${i}`,
        cells: [<code key="id">{r.id}</code>, <Status key="k" tone={r.kindTone}>{r.kind}</Status>, r.email, r.created, r.last,
          r.role ? <Status key="r" tone={roleTone(r.role)}>{r.role}</Status> : "—"],
      }))}
      note={orphans ? <p className="rv-caption" style={{ marginTop: "10px" }}>{`${fmt(orphans)} convidados órfãos (conta sem participação em nenhum evento).`}</p> : undefined}
      pager={<Pager aba="contas" page={page} total={total} query={query} live={live} />} />
  );
}

export function MasterPessoasContas(props: ContasViewProps = {}) {
  return <MasterFrame current="pessoas"><MasterPessoasContasView {...props} /></MasterFrame>;
}
