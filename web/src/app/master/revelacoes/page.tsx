import { MState } from "@/revela/master-kit";
import { MasterRevelacoesView, type RevelacaoRow } from "@/revela/screens/MasterRevelacoes";
import { requireMaster, rpc } from "../data";
import { nf, relWhen } from "../format";
import { RevealNow } from "./RevealNow";

interface Rev { id: string; title: string; revealAt: string | null; revealedAt: string | null; photos: number; emailOptIns: number; emailsSent: number; emailsFailed: number; emailsQueued: number }

/** M08 · Revelações: a fila do relógio do servidor, com o aviso por e-mail de cada evento (só números). */
export default async function Revelacoes() {
  const sb = await requireMaster();
  const r = await rpc<{ items: Rev[] }>(sb, "admin_reveals_board", { p_limit: 100 });
  if (r.state !== "ok") return <MState kind={r.state === "denied" ? "denied" : "error"} text={r.state === "error" ? `Não foi possível carregar: ${r.message}` : undefined} />;
  const now = Date.now();
  const rows: RevelacaoRow[] = r.data.items.map((e) => {
    const done = e.revealedAt != null;
    const late = !done && e.revealAt != null && Date.parse(e.revealAt) < now;
    const email = done
      ? `${nf(e.emailsSent)} enviados${e.emailsFailed ? ` · ${nf(e.emailsFailed)} ${e.emailsFailed === 1 ? "falhou" : "falharam"}` : ""}${e.emailsQueued ? ` · ${nf(e.emailsQueued)} na fila` : ""}`
      : `${nf(e.emailOptIns)} ${e.emailOptIns === 1 ? "e-mail" : "e-mails"}`;
    return {
      key: e.id, when: relWhen(done ? e.revealedAt : e.revealAt), event: e.title, photos: nf(e.photos),
      phone: "—", email, tone: done ? "ok" : late ? "bad" : "wait", status: done ? "Revelado" : late ? "Atrasada" : "Na fila",
      action: done ? undefined : <RevealNow event={{ id: e.id, title: e.title }} />,
    };
  });
  return <MasterRevelacoesView rows={rows} note="Quem não instalou o app recebe o aviso por e-mail, se deixou o endereço ao entrar. O e-mail sai pela Brevo; o aviso no celular ainda não está ativo." />;
}
