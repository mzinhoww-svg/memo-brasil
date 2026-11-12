"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { PainelFrame, type PainelTab } from "@/components/revela";
import { PlanPicker } from "@/features/billing/PlanPicker";
import type { PosePack, PublicPlan, PublicSettings } from "@/features/billing/types";
import { SECTIONS } from "@/app/painel/[id]/PainelShell";

const P = (code: string, name: string, g: number | null, s: number | null, cents: number, free = false): PublicPlan => ({ code, name, maxGuests: g, maxShots: s, priceCents: cents, isFree: free, features: [] });
const PLANS = [P("gratis", "Grátis", 10, 10, 0, true), P("festa", "Festa", 30, 24, 2900), P("celebracao", "Celebração", 100, 24, 8900), P("casamento", "Casamento", 250, 36, 18900), P("grande", "Grande", 500, null, 34900)];
/** Pacotes "Mais poses" de exemplo (+R$ 19,90 sobre o plano-base), como `list_public_pose_packs` devolveria. */
const PACKS: PosePack[] = [
  { code: "festa_36", baseCode: "festa", name: "Festa + Mais poses", maxGuests: 30, maxShots: 36, baseMaxShots: 24, priceCents: 4890, extraCents: 1990, available: true },
  { code: "celebracao_36", baseCode: "celebracao", name: "Celebração + Mais poses", maxGuests: 100, maxShots: 36, baseMaxShots: 24, priceCents: 10890, extraCents: 1990, available: true },
];
const SETTINGS: PublicSettings = { supportEmail: "oi@memoriesmt.test", supportPhone: null, companyLegalName: null, companyCnpj: null, paymentsEnv: "sandbox", capacityGracePct: 10 };
const LONG = "Não foi possível abrir o pagamento agora. O provedor demorou para responder e nada foi cobrado. Confira a conexão, espere um instante e toque de novo no botão abaixo; se o problema continuar, fale com a gente pelo e-mail de suporte informando o horário.";
const base = "/dev/plano-painel";

/**
 * `?erro=longo` mostra um texto de erro comprido; `?ocupado=1` deixa o botão no estado de carregamento.
 * `?atual=festa|celebracao|festa_36` simula o plano atual do evento (festa_36 = Festa com o pacote Mais poses); sem pacotes com `?pacotes=0`.
 * O código do último plano que o botão mandou pagar fica em `[data-testid=pago]` (oculto), sem cobrança nenhuma.
 */
export function PlanoPainelHarness() {
  const q = useSearchParams();
  const [paid, setPaid] = useState("");
  const tabs: PainelTab[] = SECTIONS.map((s) => ({ href: `${base}#${s.slug || "geral"}`, label: s.short, current: s.slug === "plano" }));
  const atual = q?.get("atual") ?? "gratis";
  const pack = PACKS.find((k) => k.code === atual);
  const packs = q?.get("pacotes") === "0" ? [] : PACKS;
  return (
    <PainelFrame title="Plano" eventName="Nosso casamento" backHref={base} tabs={tabs}>
      <div className="plano-pagina pf-pad">
        <PlanPicker
          eventId="harness" plans={PLANS} currentCode={pack?.baseCode ?? atual} packs={packs} hasPack={!!pack} settings={SETTINGS} busy={q?.get("ocupado") === "1"}
          error={q?.get("erro") === "longo" ? LONG : null} usage={{ guests: 8, shots: pack ? 36 : atual === "gratis" ? 10 : 24 }}
          onPay={(c) => setPaid(c)} onRedeemed={() => undefined}
        />
        <output data-testid="pago" hidden>{paid}</output>
      </div>
    </PainelFrame>
  );
}
