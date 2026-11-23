"use client";

/** Painel do evento: lembra a oferta do funil enquanto ela vale (prazo e relógio do servidor) e leva direto ao Pix. Some ao vencer. */
import { useEffect, useState } from "react";
import { Button } from "@/components/revela/Button";
import { validapayCheckoutEnabled } from "@/features/billing/checkout-provider";
import { brl, eventFunnelOffer, formatRemaining, type EventFunnelOffer } from "./api";
import { useCountdown } from "./useCountdown";

export function FunnelOfferBanner({ eventId, load = eventFunnelOffer }: { eventId: string; load?: typeof eventFunnelOffer }) {
  const [offer, setOffer] = useState<EventFunnelOffer | null>(null);
  useEffect(() => {
    let live = true;
    load(eventId).then((o) => { if (live) setOffer(o); }, () => undefined);
    return () => { live = false; };
  }, [eventId, load]);
  const left = useCountdown(offer ? offer.expiresAtMs : null, offer?.clockOffsetMs ?? 0);
  if (!offer || left <= 0 || !validapayCheckoutEnabled()) return null;
  return (
    <section className="app-card stack upgrade-aviso" aria-labelledby="funil-aviso-titulo" data-testid="funil-aviso">
      <h2 id="funil-aviso-titulo" className="titulo-card app-h1">Sua oferta ainda vale</h2>
      <p className="app-p">Até {offer.maxGuests} convidados por <strong>{brl(offer.priceCents)}</strong> no Pix. Acaba em <strong role="timer">{formatRemaining(left)}</strong>.</p>
      <Button href={`/painel/${encodeURIComponent(eventId)}/checkout-validapay?plano=${encodeURIComponent(offer.planCode)}`} variant="cta" block>Pagar {brl(offer.priceCents)} no Pix</Button>
    </section>
  );
}
