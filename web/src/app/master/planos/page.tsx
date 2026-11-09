import { requireMaster, rpc } from "../data";
import { Badge, StateBox } from "../ui";
import { envLabel, lastChange } from "../billing";
import { PricesEditor } from "./PricesEditor";
import type { PlanRow } from "../prices";

type Plan = PlanRow & { updatedAt: string; history: { at: string }[] };

const day = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Cuiaba" }) : "—");

export default async function Planos() {
  const sb = await requireMaster();
  const [plans, settings] = await Promise.all([
    rpc<Plan[]>(sb, "admin_list_plans"),
    rpc<{ payments_env: string }>(sb, "get_public_settings"),
  ]);
  const env = settings.state === "ok" ? settings.data.payments_env : "desligado";
  const last = plans.state === "ok" ? lastChange(plans.data) : null;
  return (
    <>
      <header className="adm-head">
        <div>
          <div className="adm-head-title">
            <h1>Planos e preços</h1>
            <Badge s={env === "production" ? "ok" : env === "sandbox" ? "aviso" : "info"}>Pagamentos: {envLabel(env)}</Badge>
          </div>
          <p>{last ? `Última alteração em ${day(last)}. ` : ""}Mudanças valem para pedidos novos; um pagamento já iniciado mantém o valor dele.</p>
        </div>
      </header>
      {plans.state === "ok" ? (
        <PricesEditor plans={plans.data.map(({ updatedAt: _u, ...p }) => { void _u; return p; })} env={env} />
      ) : <StateBox load={plans} />}
      <p className="adm-nota" style={{ marginTop: 16, fontSize: 14 }}>
        Publicar grava em <code>plans</code> e registra <code>plan.price_changed</code> na auditoria. Direitos já concedidos e Pix abertos não mudam.
      </p>
    </>
  );
}
