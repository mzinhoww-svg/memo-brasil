/* Master-eventos.html (M02): markup e classes da referência via master-kit; dados por props (padrão = desenho). */
import { BtnLink, Chips, MHead, MRow, MTable, MasterFrame, St, type Tone } from "../master-kit";

export interface EventoRow { key: string; title: string; host: string; category: string; plan: string; guests: string; photos: string; reveal: string; tone: Tone; status: string; href?: string }
export interface EventosProps {
  caption?: string;
  filter?: string;
  chips?: { label: string; href: string; on?: boolean }[];
  rows?: EventoRow[];
  /** Paginação já montada (links Anterior/Próxima). */
  pager?: React.ReactNode;
  exportHref?: string | null;
  /** Botão de exportação real (cliente); tem precedência sobre `exportHref`. */
  exportAction?: React.ReactNode;
}

const REF_ROWS: EventoRow[] = [
  { key: "1", title: "Ana & Leo", host: "Ana Ribeiro", category: "Casamento", plan: "Casamento", guests: "32 / 250", photos: "418", reveal: "dom 12:00", tone: "ok", status: "Rolando" },
  { key: "2", title: "30 anos do Rafa", host: "Rafael Lima", category: "Aniversário", plan: "Festa", guests: "28 / 30", photos: "210", reveal: "seg 10:00", tone: "wait", status: "Quase cheio" },
  { key: "3", title: "Formatura Medicina UFMT", host: "Comissão 2026", category: "Formatura", plan: "Grande", guests: "412 / 500", photos: "5.920", reveal: "revelado", tone: "info", status: "Revelado" },
  { key: "4", title: "Happy hour time Produto", host: "Lu Prado", category: "Corporativo", plan: "Grátis", guests: "9 / 10", photos: "86", reveal: "revelado", tone: "info", status: "Revelado" },
  { key: "5", title: "Chá da Maria", host: "Júlia Alves", category: "Outro", plan: "Celebração", guests: "41 / 100", photos: "377", reveal: "amanhã 18:00", tone: "bad", status: "2 denúncias" },
  { key: "6", title: "Bodas de prata", host: "Sônia Prado", category: "Casamento", plan: "Casamento", guests: "0 / 250", photos: "0", reveal: "sáb 23:00", tone: "wait", status: "Pagamento pendente" },
];
const REF_CHIPS = ["Todos", "Rolando", "Aguardando revelação", "Revelados", "Com denúncias", "Excluídos"].map((label, i) => ({ label, href: "#", on: i === 0 }));

export function MasterEventosView({ caption = "263 eventos · 41 rolando agora", chips = REF_CHIPS, rows = REF_ROWS, pager, exportHref, exportAction }: EventosProps = {}) {
  const mrows: MRow[] = rows.map((r) => ({
    key: r.key,
    cells: [r.href ? <a key="t" href={r.href}>{r.title}</a> : r.title, r.host, r.category, r.plan, r.guests, r.photos, r.reveal, <St key="s" tone={r.tone}>{r.status}</St>],
  }));
  return (
    <>
      <MHead title="Eventos" caption={caption}>
        {exportAction ? exportAction : exportHref === null ? null : exportHref ? <BtnLink href={exportHref} icon="download">Exportar CSV</BtnLink> : <button className="rv-btn rv-btn--sm"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></svg>Exportar CSV</button>}
      </MHead>
      <Chips items={chips} />
      <MTable cols="1.6fr 1.1fr 0.9fr 0.9fr 0.8fr 0.6fr 0.9fr 1fr" head={["Evento", "Organizador", "Categoria", "Plano", "Convidados", "Fotos", "Revela", "Situação"]} rows={mrows} empty="Nenhum evento neste filtro." />
      {pager}
    </>
  );
}

export function MasterEventos(props: EventosProps = {}) {
  return <MasterFrame current="eventos"><MasterEventosView {...props} /></MasterFrame>;
}
