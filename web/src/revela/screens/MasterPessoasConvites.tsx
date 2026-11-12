/* Master-pessoas-convites.html (M18): markup e classes da referência; dados por props (o padrão é o desenho).
   Nunca há token nem hash de convite nesta tela, nem nos dados que chegam a ela. */
import type { ReactNode } from "react";
import { MasterFrame } from "../master-kit";
import { FilterBar, Pager, PessoasList, REF_COUNTS, Status, type ChipItem, type PessoasQuery, type TabCounts } from "./MasterPessoasKit";
import { INVITE_TONE, type InviteRow } from "@/lib/master/people";

export const CONVITES_REF: InviteRow[] = [
  { event: "Ana & Leo", label: "Geral (link e convite A5)", uses: "14 / sem limite", expires: "15 mar 2027 02:00", state: "ativo" },
  { event: "Ana & Leo", label: "Mesa 1 · Família da noiva", uses: "6 / 10", expires: "15 mar 2027 02:00", state: "ativo" },
  { event: "Ana & Leo", label: "Link antigo do WhatsApp", uses: "0 / sem limite", expires: "—", state: "revogado" },
  { event: "30 anos do Rafa", label: "Geral", uses: "28 / 30", expires: "10 nov 2026 04:00", state: "ativo" },
  { event: "Chá da Maria", label: "Mesa 3", uses: "8 / 8", expires: "10 nov 2026 23:00", state: "esgotado" },
  { event: "Formatura Medicina UFMT", label: "Turma A", uses: "212 / 250", expires: "08 nov 2026 06:00", state: "expirado" },
  { event: "Happy hour time Produto", label: "Geral", uses: "9 / 10", expires: "31 out 2026 02:00", state: "expirado" },
];
export const CONVITES_CHIPS_REF: ChipItem[] = [
  { label: "Todos", n: 1284, on: true }, { label: "Ativos", n: 911 }, { label: "Expirados", n: 302 }, { label: "Esgotados", n: 48 }, { label: "Revogados", n: 23 },
];

export interface ConvitesViewProps {
  counts?: TabCounts;
  chips?: ChipItem[];
  query?: PessoasQuery;
  rows?: InviteRow[];
  page?: number;
  total?: number;
  live?: boolean;
  exportAction?: ReactNode;
}

export function MasterPessoasConvitesView({ counts = REF_COUNTS, chips = CONVITES_CHIPS_REF, query, rows = CONVITES_REF, page = 1, total = 1284, live, exportAction }: ConvitesViewProps) {
  return (
    <PessoasList aba="convites" counts={counts} live={live} exportAction={exportAction} caption="Links e QR de entrada dos eventos. O token nunca aparece aqui."
      bar={<FilterBar aba="convites" chips={chips} placeholder="Buscar por rótulo ou evento" q={query?.q} f={query?.f} live={live} />}
      cols="1.4fr 1.6fr .9fr 1.1fr .7fr" head={["Evento", "Rótulo", "Usos", "Expira", "Estado"]}
      rows={rows.map((r, i) => ({ key: `${i}-${r.label}`, cells: [r.event, r.label, r.uses, r.expires, <Status key="s" tone={INVITE_TONE[r.state]}>{r.state}</Status>] }))}
      pager={<Pager aba="convites" page={page} total={total} query={query} live={live} />} />
  );
}

export function MasterPessoasConvites(props: ConvitesViewProps = {}) {
  return <MasterFrame current="pessoas"><MasterPessoasConvitesView {...props} /></MasterFrame>;
}
