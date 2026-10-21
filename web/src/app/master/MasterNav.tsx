"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MODULES } from "./modules";

export function MasterNav() {
  const path = usePathname().replace(/\/$/, "");
  return (
    <nav className="adm-nav" aria-label="Módulos do console">
      {MODULES.map((m) => {
        const href = m.rota ? `/master/${m.rota}` : "/master";
        return <Link key={href} href={href} aria-current={path === href ? "page" : undefined}>{m.rotulo}</Link>;
      })}
    </nav>
  );
}
