import { MState } from "@/revela/master-kit";
import { MasterLgpdView, type LgpdRow } from "@/revela/screens/MasterLgpd";
import { requireMaster, rpc } from "../data";
import { shortDay } from "../format";

interface L { slaDays: number; summary: { pending: number; processed: number; overdue: number }; items: { userId: string; requestedAt: string; processedAt: string | null; status: string; daysOpen: number | null; overdue: boolean }[] }

/** M12 · LGPD: pedidos de exclusão de conta (prazo de resposta de 15 dias) e a retenção em vigor (política 2026-10-22-v1, só leitura). */
export default async function Lgpd() {
  const sb = await requireMaster();
  const r = await rpc<L>(sb, "admin_lgpd_requests");
  if (r.state !== "ok") return <MState kind={r.state === "denied" ? "denied" : "error"} text={r.state === "error" ? `Não foi possível carregar: ${r.message}` : undefined} />;
  const sla = r.data.slaDays;
  const rows: LgpdRow[] = r.data.items.map((i) => ({
    key: `${i.userId}-${i.requestedAt}`, when: shortDay(i.requestedAt), who: `conta ${i.userId.slice(0, 8)}…`, kind: "Excluir conta",
    due: shortDay(new Date(Date.parse(i.requestedAt) + sla * 86_400_000).toISOString()),
    tone: i.processedAt ? "ok" : i.overdue ? "bad" : "wait", status: i.processedAt ? "Concluído" : i.overdue ? "Atrasado" : "Em andamento",
  }));
  return (
    <MasterLgpdView
      caption={`Pedidos de exclusão de conta · ${r.data.summary.pending} pendentes, ${r.data.summary.overdue} atrasados, ${r.data.summary.processed} concluídos · prazo de ${sla} dias`}
      rows={rows} editable={false}
      retention={[
        { key: "1", icon: "photo", label: "Fotos depois do encerramento do evento", value: "90 dias" },
        { key: "2", icon: "trash", label: "Exclusão do armazenamento ativo", value: "até 30 dias" },
        { key: "3", icon: "clock", label: "Prazo para responder ao titular", value: `${sla} dias` },
        { key: "4", icon: "shield", label: "Pagamentos", value: "guardados como exige a lei" },
      ]}
    />
  );
}
