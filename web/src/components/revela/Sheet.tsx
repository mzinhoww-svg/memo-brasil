"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { useOpen } from "@/lib/motion/use-motion";

/** Toques que começam aqui nunca arrastam a folha (campos, controles deslizantes). */
const DRAG_BLOCK = 'input, textarea, select, [role="slider"], [contenteditable="true"]';

/** Visível de fato: `checkVisibility` onde existe (esconde display:none/visibility), senão o atributo `hidden` em algum ancestral. */
const visible = (el: HTMLElement) => (typeof el.checkVisibility === "function" ? el.checkVisibility({ visibilityProperty: true }) : !el.closest("[hidden]"));
const focusables = (panel: HTMLElement) => Array.from(panel.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter((el) => !el.hasAttribute("disabled") && visible(el));

/** O toque começou dentro de algo que rola por conta própria (lista, carrossel)? Então o gesto é desse conteúdo e não da folha. */
function scrollsOnItsOwn(from: HTMLElement, panel: HTMLElement): boolean {
  for (let el: HTMLElement | null = from; el && el !== panel; el = el.parentElement) {
    const cs = window.getComputedStyle(el);
    const y = /(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight;
    const x = /(auto|scroll)/.test(cs.overflowX) && el.scrollWidth > el.clientWidth;
    if (x || (y && el.scrollTop > 0)) return true;
  }
  return false;
}

/** Folhas abertas, da mais antiga à mais nova: só a de cima responde a Esc e Tab, e só ela fecha com o botão voltar. */
const stack: { id: symbol; close: () => void; history: boolean }[] = [];

/* Rolagem do fundo: travada enquanto houver folha aberta (contador, para folhas empilhadas). */
let locks = 0;
let savedOverflow = "";
let pinned: { y: number; position: string; top: string; width: string } | null = null;
function lockScroll() {
  if (locks++ !== 0) return;
  savedOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  // iOS Safari ignora overflow:hidden no body: em tela de toque o fundo é fixado no lugar e a posição volta ao fechar
  if (typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches) {
    const b = document.body.style;
    pinned = { y: window.scrollY, position: b.position, top: b.top, width: b.width };
    b.position = "fixed"; b.top = `-${pinned.y}px`; b.width = "100%";
  }
}
function unlockScroll() {
  if (--locks !== 0) return;
  document.body.style.overflow = savedOverflow;
  if (pinned) {
    const b = document.body.style;
    const { y, position, top, width } = pinned;
    pinned = null;
    b.position = position; b.top = top; b.width = width;
    window.scrollTo(0, y);
  }
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
 * Folha modal: foco entra ao abrir e volta ao fechar; Esc, toque fora e arrastar para baixo fecham; Tab fica dentro; rola por dentro,
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
      if (!el || !vv || vv.scale > 1.01) return; // zoom por pinça também encolhe a área visível: não é teclado
      el.style.setProperty("--sheet-vh", `${vv.height}px`);
      el.style.setProperty("--sheet-top", `${vv.offsetTop}px`);
      // área visível muito curta (teclado em tela pequena ou paisagem): a folha ocupa tudo e o rodapé deixa de ser fixo
      if (vv.height < 420) el.setAttribute("data-compact", ""); else el.removeAttribute("data-compact");
    };
    fit();
    vv?.addEventListener("resize", fit);
    vv?.addEventListener("scroll", fit);
    let focusTimer: ReturnType<typeof setTimeout> | undefined;
    const onFocusIn = (e: FocusEvent) => {
      const t = e.target as HTMLElement;
      clearTimeout(focusTimer);
      if (t.matches("input, textarea, select")) focusTimer = setTimeout(() => t.scrollIntoView?.({ block: "nearest", behavior: "auto" }), 300);
    };
    panel.addEventListener("focusin", onFocusIn);
    // arrastar para baixo fecha: pela alça e pelo título sempre; pelo corpo só com a folha no topo da rolagem e fora de campos
    let drag: { x0: number; y0: number; t0: number; on: boolean; ok: boolean; grip: boolean } | null = null;
    const reduced = () => typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) { drag = null; return; }
      const t = e.target as HTMLElement;
      const grip = !!t.closest(".app-sheet-handle, h2");
      drag = { x0: e.touches[0].clientX, y0: e.touches[0].clientY, t0: e.timeStamp, on: false, grip, ok: grip || (panel.scrollTop <= 0 && !t.closest(DRAG_BLOCK) && !scrollsOnItsOwn(t, panel)) };
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!drag || !drag.ok) return;
      const dy = e.touches[0].clientY - drag.y0;
      if (!drag.on) {
        if (dy < -4) { drag.ok = false; return; }
        if (dy <= 8 || (!drag.grip && panel.scrollTop > 0)) return;
        if (Math.abs(e.touches[0].clientX - drag.x0) > dy) { drag.ok = false; return; } // gesto mais lateral que vertical: não é da folha
        drag.on = true;
        panel.style.transition = "none";
      }
      if (e.cancelable) e.preventDefault();
      panel.style.transform = `translateY(${Math.max(0, dy)}px)`;
    };
    const onTouchEnd = (e: TouchEvent) => {
      const d = drag;
      drag = null;
      if (!d?.on) return;
      const dy = (e.changedTouches[0]?.clientY ?? d.y0) - d.y0;
      const velocity = dy / Math.max(1, e.timeStamp - d.t0);
      const dismiss = e.type === "touchend" && (dy > 100 || (dy > 40 && velocity > 0.5));
      const ms = reduced() ? 0 : 180;
      panel.style.transition = ms ? `transform ${ms}ms ease-out` : "none";
      panel.style.transform = dismiss ? "translateY(105%)" : "";
      const reset = () => { if (panel.isConnected) { panel.style.transform = ""; panel.style.transition = ""; } };
      if (dismiss) {
        setTimeout(() => { closeRef.current(); setTimeout(reset, 30); }, ms); // recusa de quem fecha (ex.: gravando): a folha volta ao lugar
      } else {
        setTimeout(reset, ms + 20);
      }
    };
    panel.addEventListener("touchstart", onTouchStart, { passive: true });
    panel.addEventListener("touchmove", onTouchMove, { passive: false });
    panel.addEventListener("touchend", onTouchEnd);
    panel.addEventListener("touchcancel", onTouchEnd);
    return () => {
      panel.removeEventListener("touchstart", onTouchStart);
      panel.removeEventListener("touchmove", onTouchMove);
      panel.removeEventListener("touchend", onTouchEnd);
      panel.removeEventListener("touchcancel", onTouchEnd);
      document.removeEventListener("keydown", onKey);
      vv?.removeEventListener("resize", fit);
      vv?.removeEventListener("scroll", fit);
      panel.removeEventListener("focusin", onFocusIn);
      clearTimeout(focusTimer);
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
