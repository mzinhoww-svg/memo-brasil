import { MState } from "@/revela/master-kit";
import { MasterCortesiasView, type CortesiaRow } from "@/revela/screens/MasterCortesias";
import { CourtesyButton } from "../billing-actions";
import { RevokeCodeButton } from "../codes-actions";
import { hintText, usesText } from "../codes";
import { requireRole, rpc } from "../data";
import { fullDay } from "../format";
import { CodeForm } from "./CodeForm";

interface Code {
  id: string; hint: string; planCode: string; planName: string | null; maxUses: number; uses: number; expiresAt: string;
  note: string; createdAt: string; revokedAt: string | null; status: string;
}
interface Plan { code: string; name: string; isFree: boolean; sort: number }
interface EventsPage { items: { id: string; title: string; hostName: string | null }[] }

const STATUS: Record<string, { label: string; tone: "ok" | "info" | "bad" }> = {
  ativo: { label: "Ativo", tone: "ok" }, usado: { label: "Esgotado", tone: "info" }, expirado: { label: "Vencido", tone: "bad" }, revogado: { label: "Revogado", tone: "bad" },
};

/** M07 · Cortesias: códigos que liberam um plano sem pagamento (e a cortesia direta para um evento, que antes ficava em Pagamentos). */
export default async function Codigos() {
  const gate = await requireRole("cortesias");
  if ("denied" in gate) return gate.denied;
  const { sb } = gate;
  const [codes, plans, evs] = await Promise.all([
    rpc<Code[]>(sb, "admin_list_codes"), rpc<Plan[]>(sb, "admin_list_plans"), rpc<EventsPage>(sb, "admin_list_events", { p_limit: 100, p_status: "ativo" }),
  ]);
  if (codes.state !== "ok") return <MState kind={codes.state === "denied" ? "denied" : "error"} text={codes.state === "error" ? `Não foi possível carregar: ${codes.message}` : undefined} />;
  const paid = plans.state === "ok" ? plans.data.filter((p) => !p.isFree).sort((a, b) => a.sort - b.sort).map((p) => ({ code: p.code, name: p.name })) : [];
  const events = evs.state === "ok" ? evs.data.items.map((e) => ({ id: e.id, label: `${e.title}${e.hostName ? ` · ${e.hostName}` : ""}` })) : [];
  const rows: CortesiaRow[] = codes.data.map((c) => {
    const st = STATUS[c.status] ?? { label: c.status, tone: "info" as const };
    return { key: c.id, code: hintText(c.hint), plan: c.planName ?? c.planCode, uses: usesText(c.uses, c.maxUses), validity: fullDay(c.expiresAt), tone: st.tone, status: st.label, action: c.status === "ativo" ? <RevokeCodeButton code={c} /> : null };
  });
  return (
    <MasterCortesiasView
      caption="Códigos que liberam um plano sem pagamento, para teste ou presente. Cada resgate vira um direito de cortesia auditado no evento."
      rows={rows} form={<CodeForm plans={paid} />} actions={<CourtesyButton events={events} plans={paid} />}
    />
  );
}
