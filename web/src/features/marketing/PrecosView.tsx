"use client";

import { useRouter } from "next/navigation";
import { formatBRL } from "@/features/billing/api";
import { validapayCheckoutEnabled } from "@/features/billing/checkout-provider";
import type { PublicPlan } from "@/features/billing/types";
import { hasPaidPlans } from "@/features/events/plan-catalog";
import { ApoioPrecos, type PrecoView } from "@/revela/screens/ApoioPrecos";
import { usePublicCatalog } from "./usePublicCatalog";

const HIGHLIGHT = "casamento";
const money = (cents: number) => (cents % 100 === 0 ? `R$ ${cents / 100}` : formatBRL(cents));

const line = (p: PublicPlan) =>
  `${p.maxGuests === null ? "convidados sem limite" : `${p.maxGuests} convidados`} · ${p.maxShots === null ? "poses livres" : `${p.maxShots} poses cada`}`;

/** 30 · Preços: tudo vem do catálogo (`listPublicPlans`); sem planos pagos ativos, só o Grátis e o aviso de que voltam em breve. */
export function PrecosView() {
  const { plans, failed } = usePublicCatalog();
  const router = useRouter();
  const paid = plans ? hasPaidPlans(plans) : false;
  const featured = plans?.find((p) => p.highlighted) ?? plans?.find((p) => p.code === HIGHLIGHT) ?? plans?.filter((p) => !p.isFree).at(-1);
  const views: PrecoView[] = (plans ?? []).map((p) => ({ code: p.code, name: p.name, line: line(p), price: p.isFree ? "R$ 0" : money(p.priceCents), on: paid && p.code === featured?.code }));
  const vp = validapayCheckoutEnabled();
  const payNote = failed ? "Não deu para carregar os preços agora" : plans && !paid ? "Os planos pagos voltam em breve" : vp ? "Pix ou cartão, sem sair do app" : "Pix ou cartão, pelo Mercado Pago";
  return <ApoioPrecos plans={views} payNote={payNote} payProvider={vp ? "ValidaPay" : "Mercado Pago"} onBack={() => router.back()} onNext={() => router.push("/criar")} />;
}
