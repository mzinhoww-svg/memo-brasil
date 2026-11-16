"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/revela";
import { cameraFailure } from "@/features/photos/capture";

/**
 * Câmera frontal só para a referência (não usa a câmera do evento, a fila de envio nem o filme). Se o navegador não tiver WebRTC ou a
 * permissão for negada, cai para o seletor nativo com `capture="user"` (iOS Safari/PWA e Android Chrome abrem a câmera do sistema).
 * A imagem capturada fica só na memória e segue para o mesmo preparo da galeria (recompressão sem EXIF).
 */
export function CameraCapture({ onShot, onCancel, onFallback }: { onShot: (b: Blob) => void; onCancel: () => void; onFallback: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [state, setState] = useState<"abrindo" | "pronta" | "negada" | "sem-camera" | "erro">("abrindo");

  useEffect(() => {
    let live = true;
    const md = typeof navigator === "undefined" ? undefined : navigator.mediaDevices;
    if (!md?.getUserMedia) {
      queueMicrotask(() => live && setState("sem-camera"));
      return () => { live = false; };
    }
    md.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 1280 } }, audio: false })
      .then((s) => {
        if (!live) { s.getTracks().forEach((t) => t.stop()); return; }
        stream.current = s;
        if (video.current) { video.current.srcObject = s; void video.current.play().catch(() => {}); }
        // "pronta" só quando o vídeo tem dimensões (onLoadedData): antes disso o clique não teria quadro para capturar
      })
      .catch((e) => {
        if (!live) return;
        const f = cameraFailure(e);
        setState(f === "negada" ? "negada" : f === "sem-camera" ? "sem-camera" : "erro");
      });
    return () => {
      live = false;
      stream.current?.getTracks().forEach((t) => t.stop());
      stream.current = null;
    };
  }, []);

  function shoot() {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const g = c.getContext("2d");
    if (!g) return;
    g.translate(c.width, 0); // espelho, como a pessoa se vê
    g.scale(-1, 1);
    g.drawImage(v, 0, 0);
    c.toBlob((b) => {
      stream.current?.getTracks().forEach((t) => t.stop());
      if (b) onShot(b);
    }, "image/jpeg", 0.92);
  }

  if (state === "negada" || state === "sem-camera" || state === "erro") {
    return (
      <div className="sa-stack" role="alert">
        <p className="rv-caption">
          {state === "negada" ? "A câmera foi bloqueada para este site. Você pode liberar nas permissões do navegador ou usar a câmera do aparelho." : state === "sem-camera" ? "Este navegador não abre a câmera aqui. Use a câmera do aparelho." : "Não deu para abrir a câmera. Use a câmera do aparelho."}
        </p>
        <Button block onClick={onFallback}>Usar a câmera do aparelho</Button>
        <Button variant="texto" onClick={onCancel}>Voltar</Button>
      </div>
    );
  }
  return (
    <div className="sa-stack">
      <div className="sa-camera">
        <video ref={video} playsInline muted aria-label="Prévia da câmera frontal" onLoadedData={() => setState((st) => (st === "abrindo" ? "pronta" : st))} />
        <span className="sa-camera__guide" aria-hidden="true" />
      </div>
      <p className="rv-caption" role="status">{state === "abrindo" ? "Abrindo a câmera…" : "Centralize o rosto no oval, com boa luz."}</p>
      <Button block onClick={shoot} disabled={state !== "pronta"}>Tirar a foto</Button>
      <Button variant="texto" onClick={onCancel}>Voltar</Button>
    </div>
  );
}
