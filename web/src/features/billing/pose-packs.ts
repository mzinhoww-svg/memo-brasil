/** Funções puras do pacote "Mais poses". Preços, limites e disponibilidade vêm do servidor (`list_public_pose_packs`). */
import type { PosePack, PublicPlan } from "./types";

/** Pacote à venda para o plano-base (Festa/Celebração). `undefined` = nenhum (desligado, plano sem pacote ou catálogo sem pacotes). */
export const packForBase = (packs: PosePack[], baseCode: string | null | undefined): PosePack | undefined =>
  packs.find((k) => k.available && k.baseCode === baseCode);

/** O código é o de uma variante "Mais poses" (mesmo desligada)? */
export const packByCode = (packs: PosePack[], code: string | null | undefined): PosePack | undefined => packs.find((k) => k.code === code);

/** Plano-base de um código de direito: a variante vira o base; qualquer outro código volta igual. */
export const basePlanCode = (packs: PosePack[], code: string): string => packByCode(packs, code)?.baseCode ?? code;

/** A variante como plano "comprável" (nome, limites e preço total), para pedidos e telas que procuram o plano pelo código. */
export const packAsPlan = (k: PosePack): PublicPlan => ({
  code: k.code, name: k.name, maxGuests: k.maxGuests, maxShots: k.maxShots, priceCents: k.priceCents, isFree: false, features: [],
});

/** Catálogo para BUSCAR plano por código (nome, limites): os visíveis mais as variantes. Nunca use para listar no seletor. */
export const lookupPlans = (plans: PublicPlan[], packs: PosePack[]): PublicPlan[] => [...plans, ...packs.map(packAsPlan)];

/** O plano atual do evento com o pacote aplicado (nome, poses e preço pagos), para medidor e cartão "Plano atual". */
export function planWithPack(base: PublicPlan, pack: PosePack | undefined): PublicPlan {
  return pack ? { ...base, name: `${base.name} + Mais poses`, maxShots: pack.maxShots, priceCents: pack.priceCents } : base;
}

/** "+12" — quantas poses a mais por pessoa o pacote dá. */
export const packExtraShots = (k: PosePack): number => k.maxShots - k.baseMaxShots;
