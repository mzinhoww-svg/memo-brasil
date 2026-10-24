import Link from "next/link";

/** Estado vazio que explica o porquê e, quando houver, oferece a próxima ação. */
export function EmptyState({ title, text, action }: { title: string; text?: string; action?: { href: string; label: string } }) {
  return (
    <div className="adm-state">
      <strong>{title}</strong>
      {text && <span>{text}</span>}
      {action && <div className="adm-state-action"><Link className="adm-btn" href={action.href}>{action.label}</Link></div>}
    </div>
  );
}
