"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { MemoEvent } from "@/domain/event";
import type { Photo, Reaction } from "@/domain/photo";
import type { Participant } from "@/repositories";

export interface AdminCtx {
  event: MemoEvent;
  now: number;
  photos: Photo[];
  reactions: Reaction[];
  participants: Participant[];
  refresh: () => Promise<void>;
}
const Ctx = createContext<AdminCtx | null>(null);
export const AdminProvider = ({ value, children }: { value: AdminCtx; children: ReactNode }) => <Ctx.Provider value={value}>{children}</Ctx.Provider>;
export function useAdmin(): AdminCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAdmin fora do painel");
  return v;
}
