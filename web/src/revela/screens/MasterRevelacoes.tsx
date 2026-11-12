/* Master-revelacoes.html (M08): markup e classes da referência via master-kit; dados por props (padrão = desenho). */
import type { ReactNode } from "react";
import { Ico, MHead, MNote, MRow, MTable, MasterFrame, St, type Tone } from "../master-kit";

export interface RevelacaoRow { key: string; when: string; event: string; photos: string; phone: string; email: string; tone: Tone; status: string; action?: ReactNode }
export interface RevelacoesProps { caption?: string; rows?: RevelacaoRow[]; note?: ReactNode; empty?: string; pager?: ReactNode }

const resend = <button className="rv-btn rv-btn--sm"><Ico n="refresh" />Reenviar falhas</button>;
const now = <button className="rv-btn rv-btn--sm">Revelar agora</button>;
const REF_ROWS: RevelacaoRow[] = [
  { key: "1", when: "hoje 12:00", event: "Ana & Leo", photos: "418", phone: "29 inscritos", email: "21 e-mails", tone: "wait", status: "Na fila", action: now },
  { key: "2", when: "hoje 10:00", event: "Formatura Medicina UFMT", photos: "5.920", phone: "388 enviados", email: "301 enviados · 4 falharam", tone: "ok", status: "Revelado", action: resend },
  { key: "3", when: "hoje 09:00", event: "Happy hour time Produto", photos: "86", phone: "9 enviados", email: "6 enviados", tone: "ok", status: "Revelado" },
  { key: "4", when: "amanhã 18:00", event: "Chá da Maria", photos: "377", phone: "35 inscritos", email: "30 e-mails", tone: "wait", status: "Na fila", action: now },
  { key: "5", when: "seg 10:00", event: "30 anos do Rafa", photos: "210", phone: "22 inscritos", email: "18 e-mails", tone: "wait", status: "Na fila", action: now },
];

export function MasterRevelacoesView({
  caption = "Fila do relógio do servidor. Cada evento revela uma vez só.", rows = REF_ROWS,
  note = "Quem não instalou o app recebe o aviso por e-mail, se deixou o endereço ao entrar. O e-mail sai pela Brevo.", empty, pager,
}: RevelacoesProps = {}) {
  const mrows: MRow[] = rows.map((r) => ({ key: r.key, cells: [r.when, r.event, r.photos, r.phone, r.email, <St key="s" tone={r.tone}>{r.status}</St>, r.action] }));
  return (
    <>
      <MHead title="Revelações" caption={caption} />
      <MTable cols="0.9fr 1.5fr .6fr 1fr 1.3fr .8fr 1fr" head={["Revela", "Evento", "Fotos", "Avisos no celular", "Avisos por e-mail", "Situação", ""]} rows={mrows} empty={empty ?? "Nenhuma revelação na fila."} />
      {pager}
      <MNote icon="bell" style={{ marginTop: "16px" }}>{note}</MNote>
    </>
  );
}

export function MasterRevelacoes(props: RevelacoesProps = {}) {
  return <MasterFrame current="revelacoes"><MasterRevelacoesView {...props} /></MasterFrame>;
}
