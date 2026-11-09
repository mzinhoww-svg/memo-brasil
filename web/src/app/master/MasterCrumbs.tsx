"use client";

import { usePathname } from "next/navigation";
import { Breadcrumbs, type Crumb } from "@/components/revela";
import { MODULES } from "./modules";

/** Início › Console › módulo atual (o dashboard é a própria página "Console"). */
export function MasterCrumbs() {
  const path = usePathname().replace(/\/$/, "");
  const atual = MODULES.find((m) => m.rota && path === `/master/${m.rota}`);
  const items: Crumb[] = [{ label: "Início", href: "/" }, atual ? { label: "Console", href: "/master" } : { label: "Console" }];
  if (atual) items.push({ label: atual.rotulo });
  return <Breadcrumbs items={items} />;
}
