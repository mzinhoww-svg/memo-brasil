"use client";
import { useRef } from "react";
import { useFlipSrc, useTilt } from "@/lib/motion/use-motion";

/** Imagem 3D da câmera com o movimento do kit: entra com `rv-cam-in`, flutua parada com `rv-float`, inclina com o dedo (`tilt`)
 *  e, com `flip`, gira na troca de embalagem (`flipWrap`). Camadas separadas, para as transformações não se atropelarem. */
export function Cam3D({ src, alt, width, flip = false }: { src: string; alt: string; width: number; flip?: boolean }) {
  const img = useRef<HTMLImageElement>(null);
  useTilt(img);
  const flipped = useFlipSrc(img, src);
  return (
    <div className="rv-cam3d rv-cam-in" data-testid="cam3d">
      <div className="rv-float">
        {/* eslint-disable-next-line @next/next/no-img-element -- render 3D do kit, WebP responsivo */}
        <img ref={img} src={flip ? flipped : src} alt={alt} style={{ width: `${width}px` }} />
      </div>
    </div>
  );
}
