"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { MasterFrame, type AppNavId, type MasterUser } from "@/revela/master-kit";


/** Rota → item do menu. Rotas que não têm item próprio acendem o grupo a que pertencem. */
export function currentOf(path: string): AppNavId {
  const seg = path.replace(/\/$/, "").split("/")[2] ?? "";
  const map: Record<string, AppNavId> = {
    "": "visao", analytics: "visao", busca: "visao", eventos: "eventos", pessoas: "pessoas", usuarios: "pessoas", organizadores: "pessoas", participantes: "pessoas",
    planos: "planos", pagamentos: "pagamentos", impressoes: "pagamentos", codigos: "cortesias", revelacoes: "revelacoes", moderacao: "moderacao", saude: "saude", storage: "saude",
    lgpd: "lgpd", auditoria: "auditoria", configuracoes: "configuracoes",
  };
  return map[seg] ?? "visao";
}

/** Moldura do Master (menu lateral + barra de cima) em volta de cada página; o item atual vem da URL. */
export function MasterShell({ user, env, children }: { user: MasterUser; env: string; children: ReactNode }) {
  const path = usePathname() ?? "/master";
  return <MasterFrame links current={currentOf(path)} user={user} env={env}>{children}</MasterFrame>;
}
