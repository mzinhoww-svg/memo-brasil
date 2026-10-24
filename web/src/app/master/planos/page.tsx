import { num, requireMaster, rpc } from "../data";
import { Badge, StateBox } from "../ui";
import { brl, envLabel, lastChange } from "../billing";
import { PlanEditButton, type PlanRow } from "../billing-actions";
import { CsvButton } from "../kit/CsvButton";
import { SortableTable } from "../kit/SortableTable";
import { parseSort, sortRows } from "../kit/url";
import type { SearchParams } from "../data";
import { revenueByPlan, type OrderLite } from "../pagamentos/lib";
import { planViews } from "./lib";

type Plan = PlanRow & { updatedAt: string; sort: number };

const PATH = "/master/planos";
const day = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Cuiaba" }) : "—");

export default async function Planos({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sb = await requireMaster();
  const sp = await searchParams;
  const [plans, settings, payments] = await Promise.all([
    rpc<Plan[]>(sb, "admin_list_plans"),
    rpc<{ payments_env: string }>(sb, "get_public_settings"),
    rpc<OrderLite[]>(sb, "admin_list_payments", { p_limit: 500 }),
  ]);
  const env = settings.state === "ok" ? settings.data.payments_env : "desligado";
  const last = plans.state === "ok" ? lastChange(plans.data) : null;
  const hasSales = payments.state === "ok";
  const views = plans.state === "ok" ? planViews(plans.data, hasSales ? revenueByPlan(payments.data) : []) : [];
  const { ord, dir } = parseSort(sp, ["name", "maxGuests", "priceCents", "perGuestCents", "sales", "revenueCents"], { ord: "priceCents", dir: "asc" });
  const rows = sortRows(views, ord, dir);
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
        {plans.state === "ok" && (
          <CsvButton filename="planos" rows={rows.map((p) => ({
            plano: p.name, convidados: p.maxGuests ?? "sem limite", fotos: p.maxShots ?? "sem limite", preco: p.priceCents / 100,
            porConvidado: p.perGuestCents == null ? "" : p.perGuestCents / 100, vendas: hasSales ? p.sales : "", receita: hasSales ? p.revenueCents / 100 : "",
            sandbox: p.sandboxActive ? "sim" : "não", producao: p.productionActive ? "sim" : "não",
          }))} cols={[
            { key: "plano", label: "Plano" }, { key: "convidados", label: "Convidados" }, { key: "fotos", label: "Fotos por pessoa" }, { key: "preco", label: "Preço (R$)" },
            { key: "porConvidado", label: "R$ por convidado" }, { key: "vendas", label: "Vendas" }, { key: "receita", label: "Receita (R$)" },
            { key: "sandbox", label: "Sandbox" }, { key: "producao", label: "Produção" },
          ]} />
        )}
      </header>
      {plans.state === "ok" ? (
        <>
          <SortableTable
            caption="Planos e preços"
            path={PATH}
            params={sp}
            ord={ord}
            dir={dir}
            rowKey={(p) => p.code}
            rows={rows}
            empty={{ title: "Nenhum plano cadastrado", text: "Os planos vêm do catálogo do banco. Sem eles o checkout não tem o que vender." }}
            cols={[
              { key: "name", label: "Plano" },
              { key: "maxGuests", label: "Convidados", num: true, render: (p) => (p.maxGuests == null ? "sem limite" : num(p.maxGuests)) },
              { key: "maxShots", label: "Fotos/pessoa", num: true, sortable: false, render: (p) => (p.maxShots == null ? "sem limite" : num(p.maxShots)) },
              { key: "priceCents", label: "Preço", num: true, render: (p) => brl(p.priceCents) },
              { key: "perGuestCents", label: "R$ por convidado", num: true, render: (p) => (p.perGuestCents == null ? "—" : brl(p.perGuestCents)) },
              ...(hasSales ? [
                { key: "sales", label: "Vendas", num: true, render: (p: (typeof rows)[number]) => num(p.sales) },
                { key: "revenueCents", label: "Receita", num: true, render: (p: (typeof rows)[number]) => brl(p.revenueCents) },
              ] : []),
              { key: "sandboxActive", label: "Sandbox", sortable: false, render: (p) => (p.sandboxActive ? "sim" : <Badge s="info">não</Badge>) },
              { key: "productionActive", label: "Produção", sortable: false, render: (p) => (p.productionActive ? "sim" : <Badge s="info">não</Badge>) },
              { key: "updatedAt", label: "Alterado em", sortable: false, render: (p) => (p.isFree ? "—" : day(p.updatedAt)) },
              { key: "actions", label: "Ações", sortable: false, render: (p) => <PlanEditButton plan={p} /> },
            ]}
          />
          {hasSales
            ? <p className="adm-nota" style={{ marginTop: 12, fontSize: 14 }}>Vendas e receita: pedidos pagos entre os últimos {num(payments.data.length)} listados. Estornos não entram.</p>
            : <p className="adm-nota" style={{ marginTop: 12, fontSize: 14 }}>Vendas e receita indisponíveis agora (pagamentos não carregaram).</p>}
        </>
      ) : <StateBox load={plans} />}
      <p className="adm-nota" style={{ marginTop: 16, fontSize: 14 }}>
        Limites de convidados e fotos mudam só por migration (afetam direitos já vendidos). Aqui: preço e ativação.
      </p>
    </>
  );
}
