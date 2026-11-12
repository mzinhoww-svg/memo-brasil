"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { MemoEvent } from "@/domain/event";
import type { Photo, Reaction, Viewer } from "@/domain/photo";
import type { RevealStatus } from "@/domain/reveal";
import type { Participant, User } from "@/repositories";

export interface GuestCtx {
  event: MemoEvent;
  user: User;
  participant: Participant | undefined;
  isHost: boolean;
  viewer: Viewer;
  now: number;
  photos: Photo[];
  reactions: Reaction[];
  participants: Participant[];
  /** Contagens sem conteúdo (rolo e espera): valem mesmo quando as fotos ainda estão bloqueadas. */
  counts: { mine: number; total: number };
  refresh: () => Promise<void>;
  /** pendente enquanto a revelação não chegou (convidado não vê fotos); desativada = fotos na hora */
  revealStatus: RevealStatus;
  /** true depois que a revelação aconteceu com a pessoa dentro do app: as fotos "se revelam" com animação */
  developed: boolean;
  /** a tela "Revelou." está aberta por cima do feed */
  celebrating?: boolean;
}
const Ctx = createContext<GuestCtx | null>(null);
export const GuestProvider = ({ value, children }: { value: GuestCtx; children: ReactNode }) => <Ctx.Provider value={value}>{children}</Ctx.Provider>;
export function useGuest(): GuestCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useGuest fora do layout do convidado");
  return v;
}

/** Contexto do convidado quando existe (telas de desenho também rodam fora do layout, sem ele). */
export function useGuestOptional(): GuestCtx | null {
  return useContext(Ctx);
}

/** Atalhos do anfitrião dentro da área do convidado: de volta ao painel e à lista de eventos. `null` para quem não é anfitrião. */
export interface HostNav { panelHref: string; eventsHref: string }
export function useHostNav(): HostNav | null {
  const g = useContext(Ctx);
  return g?.isHost ? { panelHref: `/painel/${g.event.id}`, eventsHref: "/eventos" } : null;
}
