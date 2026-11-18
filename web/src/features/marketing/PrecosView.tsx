"use client";

import { useRouter } from "next/navigation";
import { validapayCheckoutEnabled } from "@/features/billing/checkout-provider";
import type { PublicPlan } from "@/features/billing/types";
import { hasPaidPlans } from "@/features/events/plan-catalog";
import { contactFrom } from "@/components/revela/SiteFooter";
import { salesContactHref } from "@/lib/contact";
import { tiersFromPlans } from "./pricing";
import { ApoioPrecos, type PrecoView } from "@/revela/screens/ApoioPrecos";
import { usePublicCatalog } from "./usePublicCatalog";


const shotsLine = (plans: PublicPlan[] | null, code: string) => {
  const s = plans?.find((p) => p.code === code)?.maxShots;
  return s == null ? "poses livres" : `${s} poses por convidado`;
};

/** 30 · Preços: tudo vem do catálogo (`listPublicPlans`); sem planos pagos ativos, só o Grátis e o aviso de que voltam em breve. */
export function PrecosView() {
  const { plans, settings, failed } = usePublicCatalog();
  const router = useRouter();
  const paid = plans ? hasPaidPlans(plans) : false;
  const views: PrecoView[] = tiersFromPlans(plans ?? []).map((t) => ({ code: t.code, name: t.label, line: shotsLine(plans, t.code), price: t.price, on: paid && t.highlighted }));
  const vp = validapayCheckoutEnabled();
  const payNote = failed ? "Não deu para carregar os preços agora" : plans && !paid ? "Os planos pagos voltam em breve" : vp ? "Pix ou cartão, sem sair do app" : "Pix ou cartão, pelo Mercado Pago";
  return <ApoioPrecos plans={views} payNote={payNote} payProvider={vp ? "ValidaPay" : "Mercado Pago"} salesHref={paid ? salesContactHref(undefined, contactFrom(settings)) : undefined} onBack={() => router.back()} onNext={() => router.push("/criar")} />;
}
