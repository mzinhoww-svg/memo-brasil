import { MasterStatePage } from "@/revela/master/MasterState";
import { requireRole, rpc } from "../data";
import { relWhen } from "../format";
import { ConfigPanel } from "./ConfigPanel";
import { viewOf, type ConfigOverview } from "./config";

/** M31 · Configurações (só master). Ambiente do pagamento somente leitura; chaves, validade do Pix, suporte, empresa e folga gravam pela RPC com motivo e auditoria. */
export default async function Configuracoes() {
  const gate = await requireRole("configuracoes");
  if ("denied" in gate) return gate.denied;
  const r = await rpc<ConfigOverview | null>(gate.sb, "admin_config_overview");
  if (r.state === "denied") return <MasterStatePage area="Configurações" variant="denied" />;
  if (r.state === "error") return <MasterStatePage area="Configurações" variant="error" />;
  if (!r.data) return <MasterStatePage area="Configurações" variant="empty" caption="Cada alteração pede motivo e entra na auditoria" title="Configurações indisponíveis" text="Nenhum valor foi lido do servidor." />;
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  const url = `${base}/functions/v1/payments-validapay-webhook`;
  return <ConfigPanel overview={r.data} view={viewOf(r.data, url, (iso) => relWhen(iso))} />;
}
