import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Botão das páginas públicas do funil, nas classes do kit Revela 2 (`revela2.css`): fora do painel, as variantes antigas do
 * `Button` perdem para a base nova de `.rv-btn`. `href` vira link; sem `href`, botão de ação.
 */
export function FunilButton({ kind = "primary", href, onClick, disabled, children }: {
  kind?: "primary" | "line" | "text"; href?: string; onClick?: () => void; disabled?: boolean; children: ReactNode;
}) {
  const cls = `rv-btn rv-btn--block rv-btn--${kind}`;
  if (href !== undefined) return <Link className={cls} href={href} onClick={onClick}>{children}</Link>;
  return <button type="button" className={cls} onClick={onClick} disabled={disabled}>{children}</button>;
}
