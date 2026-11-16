"use client";
/* Convidado-permissao.html (23): aviso "Libere a câmera" sobre o visor escurecido. Os outros estados da câmera
   (negada, sem câmera, ocupada, interrompida) usam o mesmo aviso, com os mesmos botões de antes. */
import { useEffect, useRef, type ReactNode } from "react";
import { useOpen } from "@/lib/motion/use-motion";
import { CameraFrame, type CameraFrameProps } from "./CameraFrame";

export type PermissaoEstado = "pedir" | "negada" | "sem-camera" | "ocupada" | "interrompida";

export interface ConvidadoPermissaoProps extends Omit<CameraFrameProps, "overlay" | "dim"> {
  estado?: PermissaoEstado;
  /** Passos do navegador para liberar a câmera (estado "negada"). */
  help?: { browser: string; steps: string[] };
  /** Aberto dentro do Instagram/WhatsApp: mostra como abrir no navegador. */
  embedded?: boolean;
  onLater?: () => void;
  onAllow?: () => void;
  onGallery?: () => void;
  onDeviceCamera?: () => void;
}

const TITLE: Record<PermissaoEstado, string> = {
  pedir: "Libere a câmera",
  negada: "Tudo bem, use a galeria",
  "sem-camera": "Sem câmera por aqui",
  ocupada: "A câmera está ocupada",
  interrompida: "A câmera não iniciou desta vez",
};

export function ConvidadoPermissao({ estado = "pedir", left = 27, help, embedded, onLater, onAllow, onGallery, onDeviceCamera, ...frame }: ConvidadoPermissaoProps = {}) {
  const panel = useRef<HTMLDivElement>(null);
  const open = useOpen();
  useEffect(() => { panel.current?.focus({ preventScroll: true }); }, [estado]);
  const pedir = estado === "pedir";
  const body: ReactNode = pedir
    ? (left === null ? "As poses que o anfitrião liberou ficam guardadas até a revelação. Ninguém vê antes, nem você." : `As ${left} poses que o anfitrião liberou ficam guardadas até a revelação. Ninguém vê antes, nem você.`)
    : estado === "negada"
      ? "Escolha fotos que você tirou hoje na festa. Elas contam nas suas poses como as da câmera."
      : "Este aparelho ou navegador não abriu a câmera ao vivo. Use a câmera do aparelho ou escolha uma foto da galeria.";
  return (
    <CameraFrame
      left={left}
      {...frame}
      dim
      overlay={
        <div className="notice-wrap">
          <div className="rv-notice rv-sheet-motion" data-open={open} ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="perm-h">
            <div className="rv-notice__body">
              <h3 id="perm-h">{TITLE[estado]}</h3>
              <p>{body}</p>
              {estado === "negada" && help && (
                <div data-testid="ajuda-camera">
                  <h4>Quer usar a câmera?</h4>
                  <ol className="app-passos">{help.steps.map((t) => <li key={t}>{t}</li>)}</ol>
                  <p className="rv-caption">Passos para {help.browser}.</p>
                </div>
              )}
              {!pedir && embedded && <p style={{ fontSize: "13px" }}>Abriu pelo Instagram ou WhatsApp? Toque em ⋯ e escolha <strong>Abrir no navegador</strong>.</p>}
            </div>
            {pedir ? (
              <div className="rv-notice__actions">
                <button type="button" onClick={onLater}>Agora não</button>
                <button type="button" className="go" onClick={onAllow}>Liberar</button>
              </div>
            ) : (
              <div className="rv-notice__actions rv-notice__actions--stack">
                {estado === "negada"
                  ? <button type="button" className="go" onClick={onGallery}>Escolher da galeria</button>
                  : <><button type="button" className="go" onClick={onDeviceCamera}>Abrir a câmera do aparelho</button><button type="button" onClick={onGallery}>Escolher da galeria</button></>}
                {estado !== "sem-camera" && <button type="button" onClick={onAllow}>Tentar a câmera de novo</button>}
              </div>
            )}
          </div>
        </div>
      }
    />
  );
}
