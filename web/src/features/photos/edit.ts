import type { FilmId } from "@/revela/screens/ConvidadoEditar";
import { stampText } from "./capture";

/** Filmes do editor (23e). O editor trabalha na cópia do celular; a foto original continua no feed. */
export const FILM_CSS: Record<FilmId, string> = {
  none: "none",
  filme400: "sepia(.35) saturate(1.25) contrast(1.08) brightness(1.05)",
  pb: "grayscale(1) contrast(1.1)",
  quente: "sepia(.5) saturate(1.3) hue-rotate(-8deg) brightness(1.04)",
  vintage: "sepia(.55) contrast(.92) saturate(.8) brightness(1.06)",
};

export interface EditState { film: FilmId; rotate: number; square: boolean; date: boolean }

/** Aplica rotação, corte quadrado, filme e data numa cópia JPEG. */
export async function renderEdit(img: CanvasImageSource & { width: number; height: number }, s: EditState, takenAt: Date): Promise<Blob> {
  const rot = ((s.rotate % 360) + 360) % 360;
  const swap = rot === 90 || rot === 270;
  const iw = swap ? img.height : img.width, ih = swap ? img.width : img.height;
  const side = Math.min(iw, ih);
  const cw = s.square ? side : iw, ch = s.square ? side : ih;
  const canvas = document.createElement("canvas");
  canvas.width = cw; canvas.height = ch;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas indisponivel");
  ctx.filter = FILM_CSS[s.film];
  ctx.translate(cw / 2, ch / 2);
  ctx.rotate((rot * Math.PI) / 180);
  ctx.drawImage(img, -img.width / 2, -img.height / 2);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.filter = "none";
  if (s.date) {
    const size = Math.max(14, Math.round(Math.min(cw, ch) * 0.035));
    const stamp = getComputedStyle(document.documentElement).getPropertyValue("--carimbo").trim() || "orange";
    ctx.font = `${size}px "Share Tech Mono", ui-monospace, monospace`;
    ctx.textAlign = "right"; ctx.shadowColor = stamp; ctx.shadowBlur = size * 0.6; ctx.fillStyle = stamp;
    ctx.fillText(stampText(takenAt), cw - size, ch - size);
  }
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("toBlob"))), "image/jpeg", 0.9));
}
