"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useId, useRef, useState } from "react";
import type { NavBadge } from "@/features/master/alerts";
import { GROUPS, moduleHref } from "./modules";
import { withShellParams } from "./shell/params";

export type NavBadges = Partial<Record<string, NavBadge>>;

/**
 * Menu do console em 4 grupos. Cabeçalhos de grupo são rótulos (não clicáveis); badges vêm do shell.
 * Até 980 px vira barra no topo com botão "Menu" (disclosure). Links levam `testes`/`dias` adiante.
 */
export function MasterNav({ badges = {} }: { badges?: NavBadges }) {
  const path = usePathname().replace(/\/$/, "") || "/master";
  const sp = useSearchParams();
  const [open, setOpen] = useState(false);
  const listId = useId();
  const btn = useRef<HTMLButtonElement>(null);

  const isCurrent = (href: string) => path === href || (href !== "/master" && path.startsWith(`${href}/`));

  return (
    <nav className="adm-nav" aria-label="Módulos do console" data-open={open ? "true" : "false"}
      onKeyDown={(e) => { if (e.key === "Escape" && open) { setOpen(false); btn.current?.focus(); } }}>
      <button ref={btn} type="button" className="adm-btn adm-nav-toggle" aria-expanded={open} aria-controls={listId} onClick={() => setOpen((v) => !v)}>
        {open ? "Fechar menu" : "Menu"}
      </button>
      <div className="adm-nav-groups" id={listId}>
        {GROUPS.map((g) => {
          const headId = `${listId}-${g.id}`;
          return (
            <div key={g.id} className="adm-nav-group">
              <h2 className="adm-nav-heading" id={headId}>{g.rotulo}</h2>
              <ul aria-labelledby={headId}>
                {g.modules.map((m) => {
                  const href = moduleHref(m.rota);
                  const b = badges[m.rota || "visao-geral"];
                  return (
                    <li key={href}>
                      <Link href={withShellParams(href, sp)} aria-current={isCurrent(href) ? "page" : undefined} onClick={() => setOpen(false)}>
                        <span className="adm-nav-label">{m.rotulo}</span>
                        {b && (
                          <span className="adm-nav-badge" data-tone={b.severity}>
                            <span aria-hidden={b.label ? true : undefined}>{b.value}</span>
                            {b.label && <span className="adm-sr">{`: ${b.label}`}</span>}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
