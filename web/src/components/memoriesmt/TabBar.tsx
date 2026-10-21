import Link from "next/link";
import { Button } from "./Button";
import { Icon, type IconName } from "./Icon";

export interface TabBarItem {
  href: string;
  label: string;
  icon: IconName;
  current?: boolean;
}

/** Rodapé fixo do convidado: CTA "Postar daqui" acima das abas. Sem CTA, 4 abas (painel). */
export function TabBar({ items, cta, label = "Navegação principal" }: { items: TabBarItem[]; cta?: { href: string; label: string }; label?: string }) {
  return (
    <div className="mm-tabbar">
      {cta && <Button variant="cta" href={cta.href} icon="camera" block>{cta.label}</Button>}
      <nav className={items.length === 4 ? "mm-tabbar-nav mm-tabbar-nav--4" : "mm-tabbar-nav"} aria-label={label}>
        {items.map((i) => (
          <Link key={i.href} className="mm-tabbar-item" href={i.href} aria-current={i.current ? "page" : undefined}>
            <Icon name={i.icon} decorative size={22} strokeWidth={i.current ? 2.2 : 2} />
            <span>{i.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
