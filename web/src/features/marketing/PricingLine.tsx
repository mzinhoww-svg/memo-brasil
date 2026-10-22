"use client";

import { formatBRL } from "@/features/billing/api";
import { lowestPaidPrice } from "@/features/events/plan-catalog";
import { usePublicCatalog } from "./usePublicCatalog";

/** Linha de preço da home. `fromPrice` (menor preço pago, vindo do catálogo) só existe com planos pagos ativos. */
export function PricingLine({ fromPrice }: { fromPrice?: string }) {
  return (
    <p className="meta app-muted" style={{ textAlign: "center" }} data-testid="linha-preco">
      Grátis até 10 convidados.{fromPrice ? ` Planos a partir de ${fromPrice}, pagos uma vez por evento.` : ""}
    </p>
  );
}

/** Versão da home: lê o catálogo e passa o menor preço pago; sem pagos ativos (ou sem catálogo), só a frase grátis. */
export function LivePricingLine() {
  const { plans } = usePublicCatalog();
  const cents = plans ? lowestPaidPrice(plans) : undefined;
  return <PricingLine fromPrice={cents === undefined ? undefined : formatBRL(cents)} />;
}
