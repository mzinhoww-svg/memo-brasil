import { num, requireMaster, rpc } from "../data";
import { Badge, StateBox, Table } from "../ui";
import { brl, envLabel } from "../billing";
import { PlanEditButton, type PlanRow } from "../billing-actions";

type Plan = PlanRow & { updatedAt: string; sort: number };

const day = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Cuiaba" }) : "—");

export default async function Planos() {
  const sb = await requireMaster();
  const [plans, settings] = await Promise.all([
    rpc<Plan[]>(sb, "admin_list_plans"),
    rpc<{ payments_env: string }>(sb, "get_public_settings"),
  ]);
  const env = settings.state === "ok" ? settings.data.payments_env : "desligado";
  return (
    <>
      <header className="adm-head">
        <div>
          <div className="adm-head-title">
            <h1>Planos e preços</h1>
            <Badge s={env === "production" ? "ok" : env === "sandbox" ? "aviso" : "info"}>Pagamentos: {envLabel(env)}</Badge>
          </div>
          <p>Preços aprovados em 22/10/2026. Mudanças valem para pedidos novos; um Pix já gerado mantém o valor dele.</p>
        </div>
      </header>
      {plans.state === "ok" ? (
        <Table
          vazio="Nenhum plano cadastrado."
          cols={[{ k: "n", h: "Plano" }, { k: "g", h: "Convidados", num: true }, { k: "f", h: "Fotos/pessoa", num: true }, { k: "p", h: "Preço", num: true },
                 { k: "s", h: "Sandbox" }, { k: "r", h: "Produção" }, { k: "u", h: "Alterado em" }, { k: "a", h: "Ações" }]}
          rows={plans.data.map((p) => ({
            n: p.name,
            g: p.maxGuests == null ? "sem limite" : num(p.maxGuests),
            f: p.maxShots == null ? "sem limite" : num(p.maxShots),
            p: brl(p.priceCents),
            s: p.sandboxActive ? "sim" : <Badge s="info">não</Badge>,
            r: p.productionActive ? "sim" : <Badge s="info">não</Badge>,
            u: p.isFree ? "—" : day(p.updatedAt),
            a: <PlanEditButton plan={p} />,
          }))}
        />
      ) : <StateBox load={plans} />}
      <p className="adm-nota" style={{ marginTop: 16, fontSize: 14 }}>
        Limites de convidados e fotos mudam só por migration (afetam direitos já vendidos). Aqui: preço e ativação.
      </p>
    </>
  );
}
