import { MasterStatePage } from "@/revela/master/MasterState";
import { MasterRevelacoesView, type RevelacaoRow } from "@/revela/screens/MasterRevelacoes";
import { requireRole, rpc } from "../data";
import { nf, nowMs, plannedWhen, relWhen } from "../format";
import { RevealNow } from "./RevealNow";

interface Rev { id: string; title: string; revealAt: string | null; revealedAt: string | null; photos: number; emailOptIns: number; emailsSent: number; emailsFailed: number; emailsQueued: number }

/** M08 · Revelações: a fila do relógio do servidor, com o aviso por e-mail de cada evento (só números).
 *  Master, support e auditor leem; "Revelar agora" (folha única M25, a mesma do painel do anfitrião) é só do master. */
export default async function Revelacoes() {
  const gate = await requireRole("revelacoes");
  if ("denied" in gate) return gate.denied;
  const { sb, role } = gate;
  const r = await rpc<{ items: Rev[] }>(sb, "admin_reveals_board", { p_limit: 100 });
  if (r.state !== "ok") return <MasterStatePage area="Revelações" variant={r.state === "denied" ? "denied" : "error"} />;
  const now = nowMs();
  const rows: RevelacaoRow[] = r.data.items.map((e) => {
    const done = e.revealedAt != null;
    const late = !done && e.revealAt != null && Date.parse(e.revealAt) < now;
    const email = done
      ? `${nf(e.emailsSent)} enviados${e.emailsFailed ? ` · ${nf(e.emailsFailed)} ${e.emailsFailed === 1 ? "falhou" : "falharam"}` : ""}${e.emailsQueued ? ` · ${nf(e.emailsQueued)} na fila` : ""}`
      : `${nf(e.emailOptIns)} ${e.emailOptIns === 1 ? "e-mail" : "e-mails"}`;
    return {
      key: e.id, when: relWhen(done ? e.revealedAt : e.revealAt), event: e.title, photos: nf(e.photos),
      phone: "—", email, tone: done ? "ok" : late ? "bad" : "wait", status: done ? "Revelado" : late ? "Atrasada" : "Na fila",
      action: done || role !== "master" ? undefined : <RevealNow event={{ id: e.id, title: e.title, plannedAt: plannedWhen(e.revealAt), notices: `${nf(e.emailOptIns)} ${e.emailOptIns === 1 ? "e-mail" : "e-mails"}, de uma vez` }} />,
    };
  });
  return <MasterRevelacoesView rows={rows} note="Quem não instalou o app recebe o aviso por e-mail, se deixou o endereço ao entrar. O e-mail sai pela Brevo; o aviso no celular ainda não está ativo." />;
}
