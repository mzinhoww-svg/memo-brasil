/* Gerado de design-system/revela/html/Camera-pronta.html por scripts/html-to-tsx.mjs. Markup, classes, textos e estilos inline = referência. */
"use client";
import Link from "next/link";
import { Cam3D } from "@/components/revela/Cam3D";
import { useRef } from "react";
import { confetti } from "@/lib/motion/revela-motion";
import { useMomentOnce } from "@/lib/motion/use-moments";

export interface CameraProntaProps { name?: string; cam?: string; shareLabel?: string; printHref?: string; onShare?: () => void }

export function CameraPronta({ name = "Ana & Leo", cam = "/revela/ref/cam-casamento.webp", shareLabel = "Compartilhar convite", printHref = "#", onShare }: CameraProntaProps = {}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  // câmera pronta: o confete estoura uma vez ao abrir a tela
  useMomentOnce(true, () => { if (canvas.current) void confetti(canvas.current, { mode: "burst", origin: { x: 0.5, y: 0.5 } }); });
  return (
    <>
    <div className="scr">
      <canvas ref={canvas} className="rvm-fx" aria-hidden="true" data-testid="confete" />
      <div className="safe" style={{ "textAlign": "center", "alignItems": "center", "position": "relative" }}>
        <div className="grow" style={{ "display": "flex", "alignItems": "center", "justifyContent": "center", "margin": "0 -30px" }}>
          <div className="rv-stagebox" style={{  }}>
            <Cam3D src={cam} alt="Câmera do evento pronta" width={380} />
          </div>
        </div>
        <h1 className="rv-title-lg">
          {`A câmera de ${name}`}
          <br />
          está pronta
        </h1>
        <p className="rv-body muted" style={{ "margin": "12px 0 24px", "maxWidth": "300px" }}>
          Mande o link para os convidados ou imprima o QR para as mesas.
        </p>
        <div className="stack" style={{ "alignSelf": "stretch" }}>
          <button type="button" className="rv-btn rv-btn--block rv-btn--primary" onClick={onShare}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v13M7 8l5-5 5 5" />
              <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
            </svg>
            {shareLabel}
          </button>
          <Link href={printHref} className="rv-btn rv-btn--block">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9V3h12v6M6 18H4v-7h16v7h-2M7 14h10v7H7z" />
            </svg>
            Baixar QR code
          </Link>
        </div>
      </div>
      <div className="home-ind" />
      <div className="grain" />
    </div>
    </>
  );
}
