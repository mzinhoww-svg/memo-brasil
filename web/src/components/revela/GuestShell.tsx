import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "./Icon";

/** Moldura das telas do convidado: fundo Noite, fechar no canto (opcional), conteúdo centralizado e ação fixa embaixo. */
export function GuestShell({ closeHref, top, children, action }: { closeHref?: string; top?: ReactNode; children: ReactNode; action?: ReactNode }) {
  return (
    <main className="rv-guest">
      <header className="rv-guest__top">
        {closeHref ? <Link href={closeHref} className="rv-icon-btn" aria-label="Fechar"><Icon name="fechar" decorative /></Link> : <span />}
        {top}
        <span className="rv-guest__spacer" />
      </header>
      <div className="rv-guest__body">{children}</div>
      {action && <div className="rv-guest__action">{action}</div>}
    </main>
  );
}

/** Foto impressa virada (verso hachurado), com carimbo opcional (ex.: VENCIDO). */
export function PrintBack({ stamp, tilt = 4, className }: { stamp?: string; tilt?: number; className?: string }) {
  return (
    <div className={`rv-printback ${className ?? ""}`} style={{ transform: `rotate(${tilt}deg)` }} aria-hidden="true">
      <span className="rv-print rv-print--back rv-printback__paper" />
      {stamp && <span className="rv-printback__stamp">{stamp}</span>}
    </div>
  );
}
