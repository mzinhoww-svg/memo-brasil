/**
 * Linha de preço da home. Hoje só a frase grátis; quando o catálogo de planos existir
 * (`list_public_plans()`), receba `fromPrice` aqui e acrescente "Planos a partir de {fromPrice}, pagos uma vez por evento.".
 */
export function PricingLine({ fromPrice }: { fromPrice?: string }) {
  return (
    <p className="meta app-muted" style={{ textAlign: "center" }} data-testid="linha-preco">
      Grátis até 10 convidados.{fromPrice ? ` Planos a partir de ${fromPrice}, pagos uma vez por evento.` : ""}
    </p>
  );
}
