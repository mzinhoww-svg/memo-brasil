"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { pushModal } from "@/components/memoriesmt/modal-stack";

const FOCUSAVEL = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Painel lateral dirigido pela URL: a página só o renderiza quando `?ev=<id>` existe e passa
 * `closeHref` (a mesma URL sem `ev`). Esc, botão e fundo fecham navegando para `closeHref`.
 */
export function Drawer({ title, closeHref, children }: { title: string; closeHref: string; children: ReactNode }) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    const el = ref.current;
    el?.querySelector<HTMLElement>(FOCUSAVEL)?.focus();
    const modal = pushModal(el);
    const onKey = (e: KeyboardEvent) => {
      // ⌘K ou uma folha de confirmação aberta por cima: o teclado é dela (Esc não fecha o drawer, Tab não volta para cá)
      if (!modal.isTop() || e.defaultPrevented) return;
      if (e.key === "Escape") { e.preventDefault(); router.push(closeHref); return; }
      if (e.key !== "Tab" || !el) return;
      const itens = Array.from(el.querySelectorAll<HTMLElement>(FOCUSAVEL));
      if (!itens.length) { e.preventDefault(); return; }
      const a = itens[0], z = itens[itens.length - 1];
      if (e.shiftKey && (document.activeElement === a || !el.contains(document.activeElement))) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && (document.activeElement === z || !el.contains(document.activeElement))) { e.preventDefault(); a.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); modal.release(); anterior?.focus?.(); };
  }, [closeHref, router]);

  return (
    <>
      <Link href={closeHref} className="adm-drawer-backdrop" aria-label="Fechar painel" tabIndex={-1} />
      <div ref={ref} className="adm-drawer" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="adm-drawer-head">
          <h2 id={titleId}>{title}</h2>
          <Link href={closeHref} className="adm-btn">Fechar</Link>
        </div>
        <div className="adm-drawer-body">{children}</div>
      </div>
    </>
  );
}
