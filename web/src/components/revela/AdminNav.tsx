import Link from "next/link";
import { CountBadge } from "./CountBadge";
import { Logo } from "./Logo";

export interface AdminNavItem {
  href: string;
  label: string;
  current?: boolean;
  count?: number;
}

export function AdminNav({ eventName, eventState, items, switchHref }: { eventName: string; eventState: string; items: AdminNavItem[]; switchHref: string }) {
  return (
    <aside className="rv-admin-nav">
      <div className="rv-admin-logo"><Logo variant="wordmark" size={120} /></div>
      <Link className="rv-event-switch" href={switchHref} style={{ textDecoration: "none" }}>
        <strong>{eventName}</strong>
        <span>{eventState}</span>
      </Link>
      <nav className="rv-nav-list" aria-label="Administração do evento">
        {items.map((i) => (
          <Link key={i.href} className="rv-nav-item" href={i.href} aria-current={i.current ? "page" : undefined}>
            <span>{i.label}</span>
            {i.count ? <CountBadge count={i.count} /> : null}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
