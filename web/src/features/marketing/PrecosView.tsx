"use client";

import { Breadcrumbs, Button, Logo, Skeleton } from "@/components/revela";
import { formatBRL } from "@/features/billing/api";
import { TrustBlock } from "@/features/billing/TrustBlock";
import type { PublicPlan } from "@/features/billing/types";
import { hasPaidPlans } from "@/features/events/plan-catalog";
import { contactFrom } from "@/components/revela/SiteFooter";
import { usePublicCatalog } from "./usePublicCatalog";
import { publicPaymentMethod } from "./payment-copy";

const HIGHLIGHT = "casamento";

function PlanSummary({ plan, highlight }: { plan: PublicPlan; highlight: boolean }) {
  return (
    <li className="plano-card" data-selected={highlight || undefined} data-testid={`preco-${plan.code}`} style={{ listStyle: "none" }}>
      <span className="plano-card-corpo">
        <span className="plano-card-titulo">{plan.maxGuests === null ? "Sem limite" : `Até ${plan.maxGuests}`} · {plan.isFree ? "Grátis" : formatBRL(plan.priceCents)}</span>
        <span className="plano-card-sub">{plan.name} · {plan.maxShots === null ? "fotos sem limite" : `${plan.maxShots} fotos por pessoa`}</span>
      </span>
      {highlight && <span className="plano-badge">Recomendado</span>}
    </li>
  );
}

/** S1: preços só leitura. Tudo vem do catálogo; sem pagos ativos, só o Grátis e "Fale com a gente". */
export function PrecosView() {
  const { plans, settings, failed } = usePublicCatalog();
  const mail = contactFrom(settings);
  const paid = plans ? hasPaidPlans(plans) : false;
  const featured = plans?.find((p) => p.code === HIGHLIGHT) ?? plans?.filter((p) => !p.isFree).at(-1) ?? plans?.[0];
  const grace = settings?.capacityGracePct ?? 0;
  return (
    <main className="app-col app-col--card app-fluid">
      <div className="app-topbar"><Logo variant="wordmark" size={128} /></div>
      <div className="app-screen">
        <Breadcrumbs items={[{ label: "Início", href: "/" }, { label: "Preços" }]} />
        <div className="app-stack-sm">
          <h1 className="titulo-tela app-h1">Um preço por festa. Sem assinatura.</h1>
          <p className="app-p app-muted">Comece grátis. Só pague se a festa passar de 10 convidados.</p>
        </div>
        {!plans && !failed && <Skeleton label="Carregando os preços…" />}
        {failed && <p className="app-p app-muted" role="status">Não deu para carregar os preços agora. Tente de novo em instantes.</p>}
        {plans && (
          <ul className="plano-lista" aria-label="Planos" style={{ padding: 0, margin: 0 }}>
            {plans.map((p) => <PlanSummary key={p.code} plan={p} highlight={paid && p.code === featured?.code} />)}
          </ul>
        )}
        {plans && !paid && (
          <section className="app-card" aria-labelledby="fale">
            <h2 id="fale" className="titulo-card app-h1">Evento maior?</h2>
            <p className="app-p app-muted">Os planos pagos voltam em breve. Fale com a gente e liberamos o seu evento.</p>
            <Button href={`mailto:${mail}?subject=${encodeURIComponent("Evento com mais convidados")}`} variant="secundario" block>Fale com a gente</Button>
          </section>
        )}
        {featured && <TrustBlock plan={featured} gracePct={grace > 0 ? grace : undefined} />}
        <Button href="/criar" variant="cta" block>Criar meu evento grátis</Button>

        <section className="app-stack-sm" aria-labelledby="q-pago">
          <h2 id="q-pago" className="titulo-card app-h1">Como pago?</h2>
          {paid
            ? <p className="app-p">Pagamento único por evento, {publicPaymentMethod()}. Você cria o evento grátis e só paga na tela seguinte, se escolher um plano maior. O plano libera assim que o pagamento for confirmado.</p>
            : <p className="app-p">Os planos pagos ainda não estão abertos. Quando abrirem, o pagamento será único por evento, {publicPaymentMethod()}. Por enquanto o evento grátis já nasce no ar.</p>}
        </section>
        <section className="app-stack-sm" aria-labelledby="q-limite">
          <h2 id="q-limite" className="titulo-card app-h1">E se passar do limite?</h2>
          <p className="app-p">{grace > 0 ? `Ninguém é barrado na festa: o evento aceita até ${grace}% de convidados além do limite do plano, e o painel avisa antes de lotar.` : "Ninguém é barrado na festa: o painel avisa antes de lotar."} Para ter mais folga, é só aumentar o plano no painel.</p>
        </section>
        <section className="app-stack-sm" aria-labelledby="q-reembolso">
          <h2 id="q-reembolso" className="titulo-card app-h1">Posso pedir reembolso?</h2>
          <p className="app-p">Fale com a gente pelo <a href={`mailto:${mail}`} style={{ textDecoration: "underline" }}>{mail}</a>. A equipe analisa cada pedido e, quando houver reembolso, ele é integral. As regras completas de pagamento serão publicadas nos Termos de uso.</p>
        </section>
      </div>
    </main>
  );
}
