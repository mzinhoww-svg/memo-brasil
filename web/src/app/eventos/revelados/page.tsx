"use client";

import { Gallery } from "@/features/revelados/Gallery";
import { GoHome, HostNote, LoadingNote, useRevealedEvents } from "@/features/revelados/use-revealed";
import { useApp } from "@/features/app/provider";
import Link from "next/link";

/** 18 · Revelados: a galeria do evento revelado mais recente do anfitrião. */
export default function Revelados() {
  const { ready } = useApp();
  const { events, failed, signedIn } = useRevealedEvents();
  if (!ready || (signedIn && !events && !failed)) return <LoadingNote />;
  if (!signedIn) return <HostNote title="Entre para ver o que foi revelado." text="Use a conta com que você criou suas câmeras." action={<Link href="/eventos" className="rv-btn rv-btn--block rv-btn--primary">Entrar</Link>} />;
  if (failed) return <HostNote title="Não deu para carregar." text="Confira a conexão e abra de novo." action={<GoHome />} />;
  if (!events?.length) return <HostNote title="Nada revelado ainda." text="Quando uma das suas câmeras revelar, as fotos aparecem aqui." action={<GoHome />} />;
  return <Gallery id={events[0].id} />;
}
