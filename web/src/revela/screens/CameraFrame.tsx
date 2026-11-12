"use client";
/* Moldura da câmera do convidado (21, 22, 23 e fundo da 20d): mesma árvore e classes de Convidado-camera.html.
   Não é uma tela: as telas Convidado-camera/-flash/-permissao/-consentimento a compõem. */
import Link from "next/link";
import { useImperativeHandle, useRef, type ReactNode, type Ref } from "react";
import { Odo } from "../Odo";

const CLOSE = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
);
const BOLT = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L4 14h7l-1 8 9-12h-7z" /></svg>
);
const FLIP = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><path d="M9 13a3 3 0 0 1 5-2l1 1M15 13a3 3 0 0 1-5 2l-1-1" /></svg>
);

/** Peças da câmera que o disparo do kit anima (`shoot`). Lidas só na hora do disparo. */
export interface CameraFx {
  flash: HTMLElement;
  shutter: HTMLElement;
  button: HTMLElement;
  wheel: HTMLElement;
  counter: HTMLElement | null;
  viewfinder: HTMLElement;
  roll: HTMLElement;
}

export interface CameraFrameProps {
  /** Recebe as peças para o disparo (camadas de clarão e obturador, botão, roda e contador). */
  fx?: Ref<CameraFx | null>;
  /** Nome do evento no topo do visor. */
  title?: string;
  /** Embalagem da câmera (cor e textura do corpo). */
  wrap?: "festa" | "casamento" | "aniversario" | "noite";
  /** Poses restantes; `null` = rolo livre. */
  left?: number | null;
  /** O que aparece no visor (vídeo ao vivo no app); sem isso, a foto do desenho. */
  viewfinder?: ReactNode;
  /** Escurece o visor (aviso por cima). */
  dim?: boolean;
  /** Clarão do disparo (22). */
  flash?: boolean;
  closeHref?: string;
  closeLabel?: string;
  onClose?: () => void;
  /** Flash ligado/desligado; sem valor = sem estado (desenho). */
  flashOn?: boolean;
  onFlash?: () => void;
  onShoot?: () => void;
  shootDisabled?: boolean;
  rollLabel?: string;
  onRoll?: () => void;
  onFlip?: () => void;
  flipDisabled?: boolean;
  /** Carimbo de data sobre o visor (filme 35 mm). */
  stamp?: string;
  /** Faixa no pé da câmera com os dados do evento (nome, poses, data); sem isso, a do desenho. */
  band?: string;
  /** Mensagem no corpo da câmera (enviando, erro). */
  status?: string;
  statusRole?: "status" | "alert";
  /** Aviso/folha por cima do visor (`notice-wrap`). */
  overlay?: ReactNode;
  /** Fase da câmera, para quem precisa ler o estado (testes, estilos). */
  fase?: string;
  /** Elementos sem aparência própria (campos de arquivo, contador para leitores de tela). */
  children?: ReactNode;
}

export function CameraFrame({
  title = "Ana & Leo", wrap = "casamento", left = 24, viewfinder, dim, flash, closeHref, closeLabel = "Fechar", onClose,
  flashOn, onFlash, onShoot, shootDisabled, rollLabel = "Minhas fotos", onRoll, onFlip, flipDisabled, stamp, band, status, statusRole = "status", overlay, fase, children, fx,
}: CameraFrameProps = {}) {
  const vf = useRef<HTMLDivElement>(null);
  const flashLayer = useRef<HTMLDivElement>(null);
  const shutterLayer = useRef<HTMLDivElement>(null);
  const shutterBtn = useRef<HTMLButtonElement>(null);
  const wheel = useRef<HTMLDivElement>(null);
  const counter = useRef<HTMLDivElement>(null);
  const roll = useRef<HTMLButtonElement>(null);
  useImperativeHandle(fx, () => ({
    get flash() { return flashLayer.current!; },
    get shutter() { return shutterLayer.current!; },
    get button() { return shutterBtn.current!; },
    get wheel() { return wheel.current!; },
    get counter() { return counter.current?.querySelector<HTMLElement>(".rvm-odo") ?? null; },
    get viewfinder() { return vf.current!; },
    get roll() { return roll.current!; },
  }), []);
  return (
    <div className="scr camscr" data-wrap={wrap} data-fase={fase}>
      <div className="vf" ref={vf}>
        {viewfinder ?? <img src="/revela/ref/sc-pista.jpg" alt="Visor da câmera" />}
        {flash && <div className="flashfx" />}
        <div className="rv-shutter-layer" ref={shutterLayer} aria-hidden="true" />
        <div className="rv-flash-layer" ref={flashLayer} aria-hidden="true" />
        {dim && <div className="vfdim" />}
        <div className="vf-top">
          {closeHref ? (
            <Link href={closeHref} className="glass" aria-label={closeLabel}>{CLOSE}</Link>
          ) : (
            <button type="button" className="glass" aria-label={closeLabel} onClick={onClose}>{CLOSE}</button>
          )}
          <div className="vf-title">{title}</div>
          <button type="button" className="glass" aria-label="Flash" aria-pressed={flashOn} onClick={onFlash}>{BOLT}</button>
        </div>
        <div className="vf-corners">
          <i />
          <i />
          <i />
          <i />
        </div>
        {stamp && <span className="rv-cam__date" aria-hidden="true">{stamp}</span>}
      </div>
      {overlay}
      <div className={`body body--${wrap}`}>
        <div className="body-shade" />
        <div className="body-row">
          <div className="rv-counter" ref={counter}>
            <Odo value={left} minDigits={2} />
            <span>poses restantes</span>
          </div>
          <button type="button" className="shutter" ref={shutterBtn} aria-label="Tirar foto" disabled={shootDisabled} onClick={onShoot}>
            <i />
          </button>
          <div className="wheel" ref={wheel} aria-hidden="true" />
        </div>
        <div className="body-foot">
          <button type="button" className="filmstack" ref={roll} aria-label={rollLabel} onClick={onRoll}>
            <i />
            <i />
          </button>
          <span />
          <button type="button" className="rv-icon-btn" style={{ background: "var(--k-00000022)", color: `var(--wrap-${wrap}-ink)` }} aria-label="Virar câmera" disabled={flipDisabled} onClick={onFlip}>{FLIP}</button>
        </div>
        {band && <div className="rv-cam__band body-band" aria-hidden="true">{band}</div>}
        {status && <p className="body-status" role={statusRole}>{status}</p>}
      </div>
      <div className="grain" />
      {children}
    </div>
  );
}
