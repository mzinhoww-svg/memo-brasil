import Link from "next/link";
import { Pill, type Tone } from "./Pill";

export interface AlertItem { id?: string; severity: "crit" | "warn" | "info"; title: string; text?: string; href: string; cta: string }
const LABEL: Record<AlertItem["severity"], string> = { crit: "Crítico", warn: "Atenção", info: "Aviso" };

/** Lista de alertas acionáveis; sem alertas não renderiza nada. */
export function AlertBar({ alerts }: { alerts: readonly AlertItem[] }) {
  if (!alerts.length) return null;
  return (
    <ul className="adm-alertbar" aria-label="Alertas">
      {alerts.map((a, i) => (
        <li key={a.id ?? i} data-severity={a.severity}>
          <Pill tone={a.severity as Tone}>{LABEL[a.severity]}</Pill>
          <strong>{a.title}</strong>
          {a.text && <span>{a.text}</span>}
          <Link href={a.href}>{a.cta}</Link>
        </li>
      ))}
    </ul>
  );
}
