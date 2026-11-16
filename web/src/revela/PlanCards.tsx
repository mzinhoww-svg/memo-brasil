"use client";
/* Cartões de plano (radiogroup) em carrossel de rolagem nativa. Rolar nunca seleciona: só toque ou teclado. */
import { useCallback, useEffect, useRef, type KeyboardEvent } from "react";
import { Carousel, type CarouselHandle } from "./Carousel";
import type { PlanView } from "./screens/CameraPublicar";

export interface PlanCardsProps {
  plans: PlanView[];
  /** Código do plano marcado. */
  selected: string;
  onSelect?: (code: string) => void;
  label?: string;
}

export function PlanCards({ plans, selected, onSelect, label = "Plano do evento" }: PlanCardsProps) {
  const carousel = useRef<CarouselHandle>(null);
  const cards = useRef<(HTMLDivElement | null)[]>([]);
  const idx = Math.max(0, plans.findIndex((p) => p.code === selected));
  const first = useRef(true);

  // o plano marcado fica à vista: sem animação na abertura, suave quando muda
  useEffect(() => {
    carousel.current?.scrollToIndex(idx, { smooth: !first.current });
    first.current = false;
  }, [idx]);

  const move = useCallback((e: KeyboardEvent<HTMLDivElement>, i: number, code: string) => {
    if (e.key === " " || e.key === "Enter") { e.preventDefault(); onSelect?.(code); return; }
    let to: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") to = (i + 1) % plans.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") to = (i - 1 + plans.length) % plans.length;
    else if (e.key === "Home") to = 0;
    else if (e.key === "End") to = plans.length - 1;
    if (to === null) return;
    e.preventDefault();
    cards.current[to]?.focus({ preventScroll: true });
    onSelect?.(plans[to].code);
  }, [onSelect, plans]);

  return (
    <Carousel
      ref={carousel} count={plans.length} className="cx--plans" trackRole="radiogroup" trackLabel={label}
      trackFocusable={false} showDots={false} snapStop="normal"
    >
      {plans.map((p, i) => (
        <div
          key={p.code} ref={(el) => { cards.current[i] = el; }} role="radio" aria-checked={p.code === selected} aria-label={`${p.tier}, ${p.price}`}
          tabIndex={i === idx ? 0 : -1} className={`rv-plan${p.code === selected ? " rv-plan--on" : ""}${p.gold ? " rv-plan--gold" : ""}`}
          onClick={() => onSelect?.(p.code)} onKeyDown={(e) => move(e, i, p.code)}
        >
          <span className="rv-plan__tier">{p.tier}</span>
          <span className="rv-plan__price">{p.price}</span>
          <span className="rv-plan__note">{p.lines[0]}<br />{p.lines[1]}</span>
        </div>
      ))}
    </Carousel>
  );
}
