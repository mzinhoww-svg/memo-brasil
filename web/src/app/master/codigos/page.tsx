import { MState } from "@/revela/master-kit";
import { MasterCortesiasView, type CortesiaRow } from "@/revela/screens/MasterCortesias";
import { RevokeCodeButton } from "../codes-actions";
import { hintText, usesText } from "../codes";
import { requireMaster, rpc } from "../data";
import { fullDay } from "../format";
import { CodeForm } from "./CodeForm";
import { MasterPager } from "../MasterPager";
import { pageNumber, PAGE_SIZE, type ListSearch } from "../pagination";

interface Code {
  id: string; hint: string; planCode: string; planName: string | null; maxUses: number; uses: number; expiresAt: string;
  note: string; createdAt: string; revokedAt: string | null; status: string;
}
interface Plan { code: string; name: string; isFree: boolean; sort: number; maxGuests:number|null }

const STATUS: Record<string, { label: string; tone: "ok" | "info" | "bad" }> = {
  ativo: { label: "Ativo", tone: "ok" }, usado: { label: "Esgotado", tone: "info" }, expirado: { label: "Vencido", tone: "bad" }, revogado: { label: "Revogado", tone: "bad" },
};

/** M07 · Cortesias: códigos que liberam um plano sem pagamento (e a cortesia direta para um evento, que antes ficava em Pagamentos). */
export default async function Codigos({searchParams}:{searchParams?:Promise<ListSearch>}) {
  const sb = await requireMaster();
  const sp=await searchParams??{},p=pageNumber(sp.p),q=sp.q?.trim().slice(0,80)||"";
  const [codes, plans] = await Promise.all([
    rpc<{items:Code[];total:number}>(sb, "admin_master_list",{p_kind:"codigos",p_search:q||null,p_offset:(p-1)*PAGE_SIZE}), rpc<Plan[]>(sb, "admin_list_plans"),
  ]);
  if (codes.state !== "ok") return <MState kind={codes.state === "denied" ? "denied" : "error"} text={codes.state === "error" ? `Não foi possível carregar: ${codes.message}` : undefined} />;
  const paid = plans.state === "ok" ? plans.data.filter((p) => !p.isFree).sort((a, b) => a.sort - b.sort).map((p) => ({ code: p.code, name: `${p.name} · ${p.maxGuests===null?"convidados livres":`${p.maxGuests} convidados`}` })) : [];
  const rows: CortesiaRow[] = codes.data.items.map((c) => {
    const st = STATUS[c.status] ?? { label: c.status, tone: "info" as const };
    return { key: c.id, code: c.status === "ativo" ? <RevokeCodeButton inline code={c} /> : hintText(c.hint), plan: c.planName ?? c.planCode, uses: usesText(c.uses, c.maxUses), validity: fullDay(c.expiresAt), tone: st.tone, status: st.label };
  });
  return (
    <MasterCortesiasView
      rows={rows} form={<CodeForm plans={paid} />}
      pager={<MasterPager total={codes.data.total} page={p} path="/master/codigos" query={{q}}/>}
    />
  );
}
