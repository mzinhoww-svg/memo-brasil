"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/revela";
import { ScreenSkeleton } from "@/components/revela/ScreenSkeleton";
import { peekCode } from "@/features/billing/api";
import type { GiftView } from "@/features/billing/types";
import { savePendingCode } from "@/features/events/plan-catalog";

const UNAVAILABLE: Record<string, string> = {
  usado: "Este presente já foi aberto. Cada link vale para uma pessoa só.",
  expirado: "Este presente passou da validade.",
  revogado: "Este presente foi cancelado.",
  invalido: "Não encontramos este presente. Confira se o link veio completo.",
};

/**
 * Link de presente `/c/<código>`: mostra o plano que o código libera e leva ao assistente com tudo pronto.
 * O código fica guardado neste aparelho e só é gasto ao criar o evento (uso único).
 */
export default function CodigoLink() {
  const { code: raw } = useParams<{ code: string }>();
  const router = useRouter();
  const code = decodeURIComponent(raw ?? "");
  const [gift, setGift] = useState<GiftView | null | undefined>(undefined);

  useEffect(() => {
    let live = true;
    void peekCode(code).then((g) => {
      if (!live) return;
      // sem resposta (rede): guarda mesmo assim, o servidor decide ao criar o evento; códigos sem uso possível não ficam guardados
      if (!g || g.status === "ativo") savePendingCode(code);
      setGift(g);
    });
    return () => { live = false; };
  }, [code]);

  if (gift === undefined) return <main><ScreenSkeleton variant="camera" label="Abrindo o seu presente…" /></main>;

  const go = () => router.push("/criar");
  if (gift && gift.status !== "ativo") {
    return (
      <main className="app-screen app-stack" data-testid="presente-indisponivel">
        <h1 className="titulo-tela app-h1">Este presente não está disponível.</h1>
        <p className="app-p">{UNAVAILABLE[gift.status]}</p>
        <Button block onClick={go}>Criar um evento Grátis</Button>
        <Button href="/" variant="texto">Voltar ao início</Button>
      </main>
    );
  }

  const lines = gift
    ? [gift.maxGuests === null ? "convidados sem limite" : `até ${gift.maxGuests} convidados`, gift.maxShots === null ? "poses livres" : `${gift.maxShots} poses por pessoa`]
    : [];
  return (
    <main className="app-screen app-stack" data-testid="presente">
      <p className="rv-caption">Você recebeu um presente</p>
      <h1 className="titulo-tela app-h1">{gift?.planName ? `Plano ${gift.planName}, por conta da casa.` : "Um evento por conta da casa."}</h1>
      {lines.length > 0 && <p className="app-p" data-testid="presente-linhas">{lines.join(" · ")}</p>}
      <p className="app-p app-muted">Sem pagamento. Crie o seu evento em poucos passos e o plano já vem aplicado. Este link vale para um evento só.</p>
      <Button block onClick={go}>Criar meu evento</Button>
    </main>
  );
}
