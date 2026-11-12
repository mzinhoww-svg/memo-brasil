"use client";

import { useSearchParams } from "next/navigation";
import { PainelFrame, type PainelTab } from "@/components/revela";
import { PlanPicker } from "@/features/billing/PlanPicker";
import type { PublicPlan, PublicSettings } from "@/features/billing/types";
import { SECTIONS } from "@/app/painel/[id]/PainelShell";

const P = (code: string, name: string, g: number | null, s: number | null, cents: number, free = false): PublicPlan => ({ code, name, maxGuests: g, maxShots: s, priceCents: cents, isFree: free, features: [] });
const PLANS = [P("gratis", "Grátis", 10, 10, 0, true), P("festa", "Festa", 30, 24, 2900), P("celebracao", "Celebração", 100, 24, 8900), P("casamento", "Casamento", 250, 36, 18900), P("grande", "Grande", 500, null, 34900)];
const SETTINGS: PublicSettings = { supportEmail: "oi@memoriesmt.test", supportPhone: null, companyLegalName: null, companyCnpj: null, paymentsEnv: "sandbox", capacityGracePct: 10 };
const LONG = "Não foi possível abrir o pagamento agora. O provedor demorou para responder e nada foi cobrado. Confira a conexão, espere um instante e toque de novo no botão abaixo; se o problema continuar, fale com a gente pelo e-mail de suporte informando o horário.";
const base = "/dev/plano-painel";

/** `?erro=longo` mostra um texto de erro comprido; `?ocupado=1` deixa o botão no estado de carregamento. */
export function PlanoPainelHarness() {
  const q = useSearchParams();
  const tabs: PainelTab[] = SECTIONS.map((s) => ({ href: `${base}#${s.slug || "geral"}`, label: s.short, current: s.slug === "plano" }));
  return (
    <PainelFrame title="Plano" eventName="Nosso casamento" backHref={base} tabs={tabs}>
      <div className="plano-pagina pf-pad">
        <PlanPicker
          eventId="harness" plans={PLANS} currentCode="gratis" settings={SETTINGS} busy={q?.get("ocupado") === "1"}
          error={q?.get("erro") === "longo" ? LONG : null} usage={{ guests: 8, shots: 10 }}
          onPay={() => undefined} onRedeemed={() => undefined}
        />
      </div>
    </PainelFrame>
  );
}
