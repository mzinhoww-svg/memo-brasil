/* Master-pessoas-convidados.html (M17): markup e classes da referência; dados por props (o padrão é o desenho). */
import type { ReactNode } from "react";
import { MasterFrame } from "../master-kit";
import { FilterBar, Pager, PessoasList, REF_COUNTS, Status, type ChipItem, type PessoasQuery, type TabCounts } from "./MasterPessoasKit";
import { SITUATION_TONE, type GuestRow } from "@/lib/master/people";

export const CONVIDADOS_REF: GuestRow[] = [
  { name: "Bia Moraes", event: "Ana & Leo", joined: "14 mar 16:42", photos: "27", situation: "ativo" },
  { name: "Leo Ribeiro", event: "Ana & Leo", joined: "14 mar 16:31", photos: "19", situation: "organizador" },
  { name: "Primo Jorge", event: "Chá da Maria", joined: "09 nov 18:05", photos: "11", situation: "bloqueado" },
  { name: "Rafa Lima", event: "30 anos do Rafa", joined: "09 nov 20:10", photos: "24", situation: "organizador" },
  { name: "Lu Prado", event: "Ana & Leo", joined: "14 mar 17:02", photos: "25", situation: "ativo" },
  { name: "Convidado sem nome", event: "Chá da Maria", joined: "09 nov 18:40", photos: "3", situation: "ativo" },
  { name: "Tia Vera", event: "Bodas de prata", joined: "—", photos: "0", situation: "ativo" },
];
export const CONVIDADOS_CHIPS_REF: ChipItem[] = [
  { label: "Todos", n: 7412, on: true }, { label: "Ativos", n: 7371 }, { label: "Bloqueados", n: 6 }, { label: "Organizadores", n: 35 },
];

export interface ConvidadosViewProps {
  counts?: TabCounts;
  chips?: ChipItem[];
  query?: PessoasQuery;
  rows?: GuestRow[];
  page?: number;
  total?: number;
  live?: boolean;
  exportAction?: ReactNode;
}

export function MasterPessoasConvidadosView({ counts = REF_COUNTS, chips = CONVIDADOS_CHIPS_REF, query, rows = CONVIDADOS_REF, page = 1, total = 7412, live, exportAction }: ConvidadosViewProps) {
  return (
    <PessoasList aba="convidados" counts={counts} live={live} exportAction={exportAction} caption="Participações em eventos"
      bar={<FilterBar aba="convidados" chips={chips} placeholder="Buscar por nome ou evento" q={query?.q} f={query?.f} live={live} />}
      cols="1.3fr 1.4fr 1fr .6fr .8fr" head={["Nome", "Evento", "Entrou em", "Fotos", "Situação"]}
      rows={rows.map((r, i) => ({ key: `${i}-${r.name}-${r.event}`, cells: [r.name, r.event, r.joined, r.photos, <Status key="s" tone={SITUATION_TONE[r.situation]}>{r.situation}</Status>] }))}
      pager={<Pager aba="convidados" page={page} total={total} query={query} live={live} />} />
  );
}

export function MasterPessoasConvidados(props: ConvidadosViewProps = {}) {
  return <MasterFrame current="pessoas"><MasterPessoasConvidadosView {...props} /></MasterFrame>;
}
