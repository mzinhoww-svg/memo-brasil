"use client";

/**
 * Aviso de upgrade no painel quando o evento grátis chega perto do limite (80% dos convidados) ou alguém já usou todas as poses.
 * Texto da Coordenação (textos-app-conversao.md, seção 4). Quando o banco criou a oferta do evento, mostra o desconto e o prazo
 * reais (vêm do servidor; a cotação do checkout aplica o mesmo desconto). Não mostra nada sobre convidados além da contagem.
 */
import { useEffect, useState } from "react";
import { Button } from "@/components/revela/Button";
import { upgradeOffer, type UpgradeOffer } from "./api";

export type UpgradeBannerProps = {
  eventId: string;
  /** Só aparece no plano grátis. */
  isFree: boolean;
  guests: number;
  capacity: number | null;
  /** Alguém já usou todas as poses do grátis. */
  posesFull: boolean;
  /** Evento já terminou: o checkout não vende mais, então não há o que oferecer. */
  ended: boolean;
  loadOffer?: (eventId: string) => Promise<UpgradeOffer | null>;
};

const fmtPrazo = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).replace(",", " às");

export function limitState(guests: number, capacity: number | null, posesFull: boolean): "cheio" | "quase" | null {
  if (capacity !== null && guests >= capacity) return "cheio";
  if (posesFull) return "cheio";
  if (capacity !== null && guests >= Math.ceil(capacity * 0.8)) return "quase";
  return null;
}

export function UpgradeBanner({ eventId, isFree, guests, capacity, posesFull, ended, loadOffer = upgradeOffer }: UpgradeBannerProps) {
  const state = isFree && !ended ? limitState(guests, capacity, posesFull) : null;
  const [offer, setOffer] = useState<UpgradeOffer | null>(null);
  useEffect(() => {
    if (!state) return;
    let live = true;
    loadOffer(eventId).then((o) => { if (live) setOffer(o && new Date(o.expiresAt).getTime() > Date.now() ? o : null); }, () => undefined);
    return () => { live = false; };
  }, [eventId, state, loadOffer]);

  if (!state) return null;
  const href = `/painel/${encodeURIComponent(eventId)}/plano?utm_source=app&utm_medium=aviso_limite&utm_campaign=${state}`;
  return (
    <section className="app-card stack upgrade-aviso" aria-labelledby="upgrade-aviso-titulo" data-testid="upgrade-aviso">
      <h2 id="upgrade-aviso-titulo" className="titulo-card app-h1">Sua festa está bombando! 🎉</h2>
      <p className="app-p">
        {state === "cheio"
          ? "O plano grátis chegou ao limite."
          : `O plano grátis está quase no limite: ${guests} de ${capacity} convidados.`}{" "}
        Libere mais convidados e mais poses para guardar tudo.
      </p>
      {offer && (
        <p className="app-p upgrade-aviso-oferta" data-testid="upgrade-oferta">
          <strong>{offer.percent}% de desconto</strong> até {fmtPrazo(offer.expiresAt)}.
        </p>
      )}
      <Button href={href} variant="cta" block>Liberar mais convidados</Button>
    </section>
  );
}
