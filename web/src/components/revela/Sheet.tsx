"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { useOpen } from "@/lib/motion/use-motion";

const focusables = (panel: HTMLElement) => Array.from(panel.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter((el) => !el.hasAttribute("disabled"));

/** Folhas abertas, da mais antiga à mais nova: só a de cima responde a Esc e Tab, e só ela fecha com o botão voltar. */
const stack: { id: symbol; close: () => void; history: boolean }[] = [];

/* Rolagem do fundo: travada enquanto houver folha aberta (contador, para folhas empilhadas). */
let locks = 0;
let savedOverflow = "";
function lockScroll() {
  if (locks++ === 0) { savedOverflow = document.body.style.overflow; document.body.style.overflow = "hidden"; }
}
function unlockScroll() {
  if (--locks === 0) document.body.style.overflow = savedOverflow;
}

/**
 * Botão voltar do navegador fecha a folha em vez de sair da tela. Uma única entrada de histórico para todas as folhas
 * abertas (empilhadas ou trocadas na hora): entra ao abrir a primeira e sai quando a última fecha. Só com `history`.
 * A entrada guarda o estado do Next (`__NA` e a árvore) para o roteador tratar a volta como sua.
 */
const hist = { pushed: false, popping: false, timer: undefined as ReturnType<typeof setTimeout> | undefined };
function pushEntry() {
  if (hist.pushed) return;
  const run = () => { window.history.pushState({ ...(window.history.state as object | null), mmSheet: true }, ""); hist.pushed = true; };
  if (hist.popping) window.addEventListener("popstate", () => { hist.popping = false; if (stack.some((s) => s.history)) run(); }, { once: true });
  else run();
}
function settleEntry() {
  clearTimeout(hist.timer);
  // espera um instante: trocar uma folha por outra (Sheet → ConfirmSheet) não deve mexer no histórico
  hist.timer = setTimeout(() => {
    const wants = stack.some((s) => s.history);
    if (wants && !hist.pushed) pushEntry();
    else if (!wants && hist.pushed) {
      hist.pushed = false;
      const mine = (window.history.state as { mmSheet?: boolean } | null)?.mmSheet === true;
      if (mine) { hist.popping = true; window.addEventListener("popstate", () => { hist.popping = false; }, { once: true }); window.history.back(); }
    }
  }, 60);
}
function onPop() {
  if (!hist.pushed) return; // volta que nós mesmos pedimos ao fechar: nada a fechar
  hist.pushed = false; // a entrada já saiu do histórico
  const top = [...stack].reverse().find((s) => s.history);
  top?.close();
  settleEntry(); // sobrou folha com histórico? ganha uma nova entrada
}

/**
 * Folha modal: foco entra ao abrir e volta ao fechar; Esc e toque fora fecham; Tab fica dentro; rola por dentro,
 * trava a rolagem do fundo e acompanha o teclado virtual. `footer` fica fixo embaixo (ações sempre à vista).
 */
export function Sheet({ title, onClose, children, footer, history = false }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; history?: boolean }) {
  const id = useId();
  const open = useOpen();
  const backdrop = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const panel = ref.current!;
    const me = { id: Symbol("sheet"), close: () => closeRef.current(), history };
    stack.push(me);
    lockScroll();
    if (history) { if (stack.filter((s) => s.history).length === 1 && !hist.pushed) pushEntry(); window.addEventListener("popstate", onPop); }
    (focusables(panel)[0] ?? panel).focus();
    const onKey = (e: KeyboardEvent) => {
      if (stack[stack.length - 1] !== me) return;
      if (e.key === "Escape") closeRef.current();
      if (e.key !== "Tab") return;
      const f = focusables(panel);
      if (!f.length) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = f[0];
      const last = f[f.length - 1];
      if (!f.some((el) => el === document.activeElement)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    // teclado virtual: a folha acompanha a área visível (no iOS o teclado não redimensiona a página) e o campo focado não fica por baixo
    const vv = window.visualViewport;
    const fit = () => {
      const el = backdrop.current;
      if (!el || !vv) return;
      el.style.setProperty("--sheet-vh", `${vv.height}px`);
      el.style.setProperty("--sheet-top", `${vv.offsetTop}px`);
    };
    fit();
    vv?.addEventListener("resize", fit);
    vv?.addEventListener("scroll", fit);
    const onFocusIn = (e: FocusEvent) => {
      const t = e.target as HTMLElement;
      if (t.matches("input, textarea, select")) setTimeout(() => t.scrollIntoView?.({ block: "center", behavior: "auto" }), 300);
    };
    panel.addEventListener("focusin", onFocusIn);
    return () => {
      document.removeEventListener("keydown", onKey);
      vv?.removeEventListener("resize", fit);
      vv?.removeEventListener("scroll", fit);
      panel.removeEventListener("focusin", onFocusIn);
      const i = stack.indexOf(me);
      if (i >= 0) stack.splice(i, 1);
      unlockScroll();
      if (history) { if (!stack.some((s) => s.history)) window.removeEventListener("popstate", onPop); settleEntry(); }
      previous?.focus();
    };
  }, [history]); // onClose vem por ref: re-render do pai não devolve o foco ao gatilho
  useEffect(() => {
    const panel = ref.current;
    if (panel && !focusables(panel).length) panel.focus();
  });
  return (
    <div ref={backdrop} className="app-dialog rv-backdrop" data-open={open} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className="app-dialog-panel rv-sheet-motion" data-open={open} data-footer={footer ? "" : undefined} role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1}>
        <div className="app-sheet-handle" aria-hidden="true" />
        <h2 id={id} className="titulo-card app-h1">{title}</h2>
        {children}
        {footer && <div className="app-dialog-foot">{footer}</div>}
      </div>
    </div>
  );
}
