"use client";
/* Carrossel de rolagem nativa com encaixe (scroll-snap). Os filhos diretos do trilho são os slides.
   O índice ativo vem da rolagem (nunca de um transform); rolar por código é marcado para não gerar laço. */
import {
  forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState,
  type KeyboardEvent, type ReactNode,
} from "react";

export interface CarouselHandle {
  /** Leva o slide `index` ao centro. `smooth: false` posiciona sem animação. */
  scrollToIndex: (index: number, opts?: { smooth?: boolean }) => void;
}

export interface CarouselProps {
  children: ReactNode;
  /** Quantidade de slides (filhos diretos do trilho). */
  count: number;
  /** Slide pedido por quem usa; se mudar, o trilho rola até ele. Sem ele, o carrossel guarda o índice sozinho. */
  index?: number;
  /** Chamado quando a pessoa chega a outro slide (rolando, pelas setas, bolinhas ou teclado). */
  onIndexChange?: (index: number) => void;
  /** Nome do carrossel (grupo "carrossel" para leitores de tela). */
  label?: string;
  trackRole?: string;
  trackLabel?: string;
  /** Trilho focável (setas do teclado). Desligue quando os slides já são focáveis. */
  trackFocusable?: boolean;
  showArrows?: boolean;
  showDots?: boolean;
  /** Texto da bolinha `position` (1 a count). */
  dotLabel?: (position: number, count: number) => string;
  /** `always`: um slide por gesto. `normal`: permite passar vários de uma vez (cartões pequenos). */
  snapStop?: "always" | "normal";
  className?: string;
}

const EDGE = 2;
const LOCK_MS = 900;

const reduceMotion = (): boolean => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Rolagem em que o slide fica centralizado no trilho. */
const centeredLeft = (track: HTMLElement, slide: HTMLElement): number => slide.offsetLeft + slide.offsetWidth / 2 - track.clientWidth / 2;

const defaultDotLabel = (i: number, n: number) => `Modelo ${i} de ${n}`;

export const Carousel = forwardRef<CarouselHandle, CarouselProps>(function Carousel({
  children, count, index, onIndexChange, label, trackRole, trackLabel, trackFocusable = true,
  showArrows = true, showDots = true, dotLabel = defaultDotLabel, snapStop = "always", className,
}, ref) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dotsRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(() => Math.min(Math.max(index ?? 0, 0), Math.max(count - 1, 0)));
  const [edges, setEdges] = useState({ start: true, end: count <= 1 });
  const activeRef = useRef(active);
  const frame = useRef(0);
  const lock = useRef<{ left: number; timer: number } | null>(null);
  const onChangeRef = useRef(onIndexChange);
  useEffect(() => { onChangeRef.current = onIndexChange; });

  const clamp = useCallback((i: number) => Math.min(Math.max(i, 0), Math.max(count - 1, 0)), [count]);

  const commit = useCallback((i: number) => {
    if (i === activeRef.current) return;
    activeRef.current = i;
    setActive(i);
    onChangeRef.current?.(i);
  }, []);

  const releaseLock = useCallback(() => {
    if (lock.current) { window.clearTimeout(lock.current.timer); lock.current = null; }
  }, []);

  const measure = useCallback(() => {
    frame.current = 0;
    const track = trackRef.current;
    if (!track) return;
    const slides = Array.from(track.children) as HTMLElement[];
    const scrollable = track.scrollWidth > track.clientWidth + EDGE;
    const start = !scrollable || track.scrollLeft <= EDGE;
    const end = !scrollable || track.scrollLeft + track.clientWidth >= track.scrollWidth - EDGE;
    setEdges((e) => (e.start === start && e.end === end ? e : { start, end }));
    if (!scrollable || slides.length === 0) return;
    if (lock.current) {
      // rolagem iniciada por código: só volta a valer quando chega ao destino
      if (Math.abs(track.scrollLeft - lock.current.left) <= EDGE) releaseLock();
      else return;
    }
    let next = 0;
    if (start) next = 0;
    else if (end) next = slides.length - 1;
    else {
      const mid = track.scrollLeft + track.clientWidth / 2;
      let best = Infinity;
      slides.forEach((s, i) => {
        const d = Math.abs(s.offsetLeft + s.offsetWidth / 2 - mid);
        if (d < best) { best = d; next = i; }
      });
    }
    commit(next);
  }, [commit, releaseLock]);

  const schedule = useCallback(() => {
    if (frame.current) return;
    frame.current = window.requestAnimationFrame(measure);
  }, [measure]);

  const scrollToIndex = useCallback((i: number, opts?: { smooth?: boolean }) => {
    const track = trackRef.current;
    const slide = track?.children[clamp(i)] as HTMLElement | undefined;
    if (!track || !slide) return;
    const smooth = (opts?.smooth ?? true) && !reduceMotion();
    const left = Math.max(0, Math.min(centeredLeft(track, slide), track.scrollWidth - track.clientWidth));
    releaseLock();
    if (smooth && typeof slide.scrollIntoView === "function") {
      lock.current = { left, timer: window.setTimeout(() => { lock.current = null; schedule(); }, LOCK_MS) };
      slide.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    } else {
      track.scrollLeft = left;
    }
  }, [clamp, releaseLock, schedule]);

  const goTo = useCallback((i: number) => {
    const target = clamp(i);
    commit(target);
    scrollToIndex(target);
  }, [clamp, commit, scrollToIndex]);

  useImperativeHandle(ref, () => ({ scrollToIndex }), [scrollToIndex]);

  // posição inicial antes do primeiro paint, sem animação
  useLayoutEffect(() => {
    scrollToIndex(activeRef.current, { smooth: false });
    measure();
  }, [scrollToIndex, measure]);

  // índice pedido de fora
  useEffect(() => {
    if (index === undefined) return;
    const target = clamp(index);
    if (target === activeRef.current) return;
    activeRef.current = target;
    setActive(target);
    scrollToIndex(target);
  }, [index, clamp, scrollToIndex]);

  useEffect(() => {
    const track = trackRef.current;
    const onEnd = () => { releaseLock(); schedule(); };
    const onResize = () => { scrollToIndex(activeRef.current, { smooth: false }); schedule(); };
    track?.addEventListener("scrollend", onEnd);
    window.addEventListener("resize", onResize);
    return () => {
      track?.removeEventListener("scrollend", onEnd);
      window.removeEventListener("resize", onResize);
      if (frame.current) window.cancelAnimationFrame(frame.current);
      releaseLock();
    };
  }, [releaseLock, schedule, scrollToIndex]);

  const onKey = useCallback((e: KeyboardEvent<HTMLElement>) => {
    const from = activeRef.current;
    let to: number | null = null;
    if (e.key === "ArrowRight") to = from + 1;
    else if (e.key === "ArrowLeft") to = from - 1;
    else if (e.key === "Home") to = 0;
    else if (e.key === "End") to = count - 1;
    if (to === null) return;
    e.preventDefault();
    const target = clamp(to);
    goTo(target);
    if (e.currentTarget === dotsRef.current) (dotsRef.current?.children[target] as HTMLElement | undefined)?.focus();
  }, [clamp, count, goTo]);

  const atFirst = active <= 0 || edges.start;
  const atLast = active >= count - 1 || edges.end;
  const group = label ? { role: "group", "aria-roledescription": "carrossel", "aria-label": label } : {};

  return (
    <div className={`cx${className ? ` ${className}` : ""}`} {...group}>
      <div
        ref={trackRef} className={`cx-track${snapStop === "normal" ? " cx-track--free" : ""}`} role={trackRole} aria-label={trackLabel}
        tabIndex={trackFocusable ? 0 : undefined} onScroll={schedule}
        onKeyDown={trackFocusable ? (e) => { if (e.target === e.currentTarget) onKey(e); } : undefined}
      >
        {children}
      </div>
      {(showArrows || showDots) && (
        <div className="cx-controls">
          {showArrows && (
            <button type="button" className="rv-icon-btn cx-arrow" aria-label="Anterior" disabled={atFirst} onClick={() => goTo(active - 1)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
          )}
          {showDots && (
            <div ref={dotsRef} className="cx-dots" onKeyDown={onKey}>
              {Array.from({ length: count }, (_, i) => (
                <button key={i} type="button" className="cx-dot" aria-label={dotLabel(i + 1, count)} aria-current={i === active ? "true" : undefined} onClick={() => goTo(i)} />
              ))}
            </div>
          )}
          {showArrows && (
            <button type="button" className="rv-icon-btn cx-arrow" aria-label="Próximo" disabled={atLast} onClick={() => goTo(active + 1)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
});
