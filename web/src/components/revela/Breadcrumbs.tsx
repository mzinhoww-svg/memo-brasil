import Link from "next/link";
import { Fragment } from "react";

export interface Crumb { label: string; href?: string }

/** Trilha de navegação. O último item é a página atual (sem link, `aria-current="page"`); os anteriores levam para cima na hierarquia. */
export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  const last = items.length - 1;
  return (
    <nav className={["rv-crumbs", className].filter(Boolean).join(" ")} aria-label="Trilha de navegação">
      <ol>
        {items.map((c, i) => (
          <Fragment key={`${i}-${c.label}`}>
            <li>
              {i === last || !c.href ? <span aria-current={i === last ? "page" : undefined}>{c.label}</span> : <Link href={c.href}>{c.label}</Link>}
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}
