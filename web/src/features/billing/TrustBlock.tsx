import { trustTitle } from "./flow";
import type { PublicPlan } from "./types";

function Check() {
  return <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="plano-check"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
}

/** Confiança sem depoimento: só fatos do produto. `gracePct` vem de `capacity_grace_pct` (padrão 10). */
export function TrustBlock({ plan, gracePct = 10 }: { plan: PublicPlan; gracePct?: number }) {
  const title = trustTitle(plan);
  return (
    <section className="plano-trust" aria-label="Por que confiar">
      {title && <p className="plano-trust-titulo">{title}</p>}
      <ul className="plano-trust-lista">
        <li><Check /><span>Pague só depois de testar: o evento já nasce no ar, grátis.</span></li>
        <li><Check /><span>Pix único, sem assinatura. Se expirar, nada é cobrado.</span></li>
        <li><Check /><span>{gracePct > 0 ? `Ninguém é barrado na festa: ${gracePct}% de folga e aviso antes de lotar.` : "Ninguém é barrado na festa: aviso antes de lotar."}</span></li>
      </ul>
    </section>
  );
}
