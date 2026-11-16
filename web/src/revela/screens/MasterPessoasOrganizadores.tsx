/* Master-pessoas-organizadores.html (M16): markup e classes da referência; dados por props (o padrão é o desenho). */
import type { ReactNode } from "react";
import { Ico, MasterFrame } from "../master-kit";
import { FilterBar, Pager, PessoasList, REF_COUNTS, Status, fmt, type PessoasQuery, type TabCounts } from "./MasterPessoasKit";
import type { OrganizerRow } from "@/lib/master/people";

export const ORGANIZADORES_REF: OrganizerRow[] = [
  { id: "u1", name: "Ana Ribeiro", email: "ana.ribeiro@email.com", provider: "Google", events: "1", active: "1", photos: "418", last: "14 mar 2027", spend: "R$ 189,00", deletion: false },
  { id: "u2", name: "Comissão Medicina 2026", email: "formatura.med@email.com", provider: "Google", events: "1", active: "0", photos: "5.920", last: "07 nov 2026", spend: "R$ 349,00", deletion: false },
  { id: "u3", name: "Rafael Lima", email: "rafa.lima@email.com", provider: "E-mail", events: "2", active: "1", photos: "210", last: "09 nov 2026", spend: "R$ 29,00", deletion: true },
  { id: "u4", name: "Júlia Alves", email: "julia.alves@email.com", provider: "Google", events: "3", active: "1", photos: "1.204", last: "11 nov 2026", spend: "R$ 207,00", deletion: false },
  { id: "u5", name: "Lu Prado", email: "lu.prado@email.com", provider: "Google", events: "4", active: "0", photos: "312", last: "30 out 2026", spend: "R$ 0,00", deletion: false },
  { id: "u6", name: "Sônia Prado", email: "sonia.prado@email.com", provider: "E-mail", events: "1", active: "0", photos: "0", last: "14 nov 2026", spend: "R$ 0,00", deletion: false },
];

export interface OrganizadoresViewProps {
  counts?: TabCounts;
  query?: PessoasQuery;
  rows?: OrganizerRow[];
  /** Total da busca atual (a legenda "198 organizadores") e quantos pediram exclusão (LGPD). */
  total?: number;
  deletionPending?: number;
  page?: number;
  live?: boolean;
  exportAction?: ReactNode;
}

export function MasterPessoasOrganizadoresView({ counts = REF_COUNTS, query, rows = ORGANIZADORES_REF, total = 198, deletionPending = 2, page = 1, live, exportAction }: OrganizadoresViewProps) {
  const caption = `${fmt(total)} ${total === 1 ? "organizador" : "organizadores"}${deletionPending ? ` · ${fmt(deletionPending)} com exclusão pedida` : ""}`;
  return (
    <PessoasList aba="organizadores" counts={counts} live={live} exportAction={exportAction} caption="Quem criou pelo menos um evento"
      bar={<FilterBar aba="organizadores" caption={caption} placeholder="Buscar por nome ou e-mail" q={query?.q} live={live} />}
      cols="1.5fr 1.5fr .7fr .5fr .5fr .6fr .9fr .8fr .2fr" head={["Nome", "E-mail", "Entrou com", "Eventos", "Ativos", "Fotos", "Último evento", "Gasto total", ""]}
      rows={rows.map((r) => ({
        key: r.id,
        cells: [
          r.deletion ? <>{r.name} <Status tone="bad">exclusão pedida</Status></> : r.name,
          r.email, r.provider, r.events, r.active, r.photos, r.last, r.spend,
          live ? <a href={`/master/eventos?organizador=${encodeURIComponent(r.id)}`} aria-label={`Ver os eventos de ${r.name}`}><Ico n="chevron" /></a> : <Ico n="chevron" />,
        ],
      }))}
      pager={<Pager aba="organizadores" page={page} total={total} query={query} live={live} />} />
  );
}

export function MasterPessoasOrganizadores(props: OrganizadoresViewProps = {}) {
  return <MasterFrame current="pessoas"><MasterPessoasOrganizadoresView {...props} /></MasterFrame>;
}
