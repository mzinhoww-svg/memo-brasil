"use client";

import { Button } from "@/components/revela";
import { formatBRL } from "./api";
import { packExtraShots } from "./pose-packs";
import type { PosePack } from "./types";

export const PACK_TEXT = {
  titulo: "Mais poses",
  nota: "Pagamento único por evento. Você paga só o pacote; o resto do plano já é seu.",
} as const;

const money = (cents: number) => (cents % 100 === 0 ? `R$ ${cents / 100}` : formatBRL(cents));

/** "+12 poses por pessoa (24 → 36)". */
export const packMeta = (pack: PosePack): string => `+${packExtraShots(pack)} poses por pessoa (${pack.baseMaxShots} → ${pack.maxShots})`;

/**
 * Cartão "Mais poses" do painel (Plano): para quem tem Festa/Celebração e ainda não tem o pacote. O valor a pagar vem da cotação do servidor
 * (`amountCents`); sem cotação usa a diferença do catálogo. O pagamento é o checkout normal do plano-variante.
 */
export function PackCard({ pack, amountCents, busy, native, onAdd }: { pack: PosePack; amountCents?: number; busy: boolean; native?: boolean; onAdd: () => void }) {
  const price = money(amountCents ?? pack.extraCents);
  return (
    <section className={native ? "hero-ev" : "plano-cartao"} style={native ? { marginTop: "14px" } : undefined} aria-labelledby="mais-poses-h" data-testid="cartao-mais-poses">
      <h2 id="mais-poses-h" className={native ? "rv-group-h" : "titulo-card app-h1"} style={native ? { marginTop: 0 } : undefined}>{PACK_TEXT.titulo}</h2>
      <p className="app-p">Cada convidado ganha {packExtraShots(pack)} poses a mais: de {pack.baseMaxShots} para {pack.maxShots} por pessoa.</p>
      <p className="app-p app-muted">{PACK_TEXT.nota}</p>
      <Button variant="secundario" block disabled={busy} aria-busy={busy || undefined} onClick={onAdd}>
        {busy ? "Abrindo pagamento…" : `Adicionar Mais poses · ${price}`}
      </Button>
    </section>
  );
}
