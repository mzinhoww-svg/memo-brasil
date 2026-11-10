"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { startFilmPreview } from "./film-gl";

/**
 * Prévia ao vivo do Filme 35mm: canvas WebGL sobre o `<video>` com a mesma LUT da foto.
 * Decorativo (aria-hidden, sem foco, sem eventos de ponteiro): o clique passa para o visor. Sem WebGL, avisa por `onFallback`
 * e o chamador mantém o filtro CSS no vídeo.
 */
export function FilmCanvas({ video, active, mirror, onReady }: { video: RefObject<HTMLVideoElement | null>; active: boolean; mirror: boolean; onReady: (ok: boolean) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const mirrorRef = useRef(mirror);
  const [failed, setFailed] = useState(false);
  useEffect(() => { mirrorRef.current = mirror; }, [mirror]);
  useEffect(() => {
    const v = video.current, c = canvas.current;
    if (!active || !v || !c || failed) { onReady(false); return; }
    const preview = startFilmPreview(v, c, () => mirrorRef.current);
    if (!preview) { setFailed(true); onReady(false); return; }
    onReady(true);
    return () => { preview.stop(); onReady(false); };
  }, [active, failed, video, onReady]);
  if (!active || failed) return null;
  return <canvas ref={canvas} aria-hidden="true" tabIndex={-1} className="rv-cam__lut" />;
}
