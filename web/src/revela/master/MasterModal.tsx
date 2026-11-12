"use client";
/* Casca das folhas do Master (`.mmodal` + `.mmodal-card` do desenho): fundo escuro, cartão, rótulo para leitor de tela, Esc fecha e o foco entra na folha.
   Por padrão sobe para o <body> (vale no console e no painel do anfitrião, em qualquer tela); `inline` deixa a folha onde está
   (telas de comparação /dev/revela e testes). */
import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

export interface MasterModalProps {
  /** Nome da folha para leitor de tela (o mesmo título do desenho). */
  label: string;
  width?: number;
  /** Esc chama isto (some se a folha estiver ocupada). */
  onClose?: () => void;
  inline?: boolean;
  children: ReactNode;
}

export function MasterModal({ label, width = 480, onClose, inline = false, children }: MasterModalProps) {
  const card = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (inline) return;
    const prev = document.activeElement as HTMLElement | null;
    const first = card.current?.querySelector<HTMLElement>("[data-autofocus], textarea, input, button:not([disabled])");
    (first ?? card.current)?.focus();
    return () => prev?.focus?.();
  }, [inline]);
  const node = (
    <div className="mmodal" style={inline ? undefined : { position: "fixed", zIndex: 1000, overflowY: "auto", padding: "16px", fontFamily: "var(--font-sans)", color: "var(--ink)" }}
      onKeyDown={(e) => { if (e.key === "Escape" && onClose) { e.stopPropagation(); onClose(); } }}>
      <div ref={card} className="mmodal-card" role="dialog" aria-modal={inline ? undefined : true} aria-label={label} tabIndex={-1}
        style={inline ? { width: `${width}px` } : { width: `${width}px`, maxWidth: "100%", maxHeight: "100%", overflowY: "auto" }}>
        {children}
      </div>
    </div>
  );
  return inline || typeof document === "undefined" ? node : createPortal(node, document.body);
}

/** Linha de botões da folha (`flex: 1` cada, como no desenho). */
export function ModalButtons({ children }: { children: ReactNode }) {
  return <div className="row" style={{ gap: "8px", marginTop: "20px" }}>{children}</div>;
}
