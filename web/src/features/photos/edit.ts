import type { FilmId } from "@/revela/screens/ConvidadoEditar";
import { renderFilm, stampText, type RenderOptions } from "./film/film-canvas";

/** Filmes do editor (23e) → `renderFilm`. "Filme 400", "Quente" e "Vintage" usam o Filme 35mm; "Preto e branco" usa o LUT p&b; "Sem filme" não aplica nada. */
export const FILM_LOOK: Record<FilmId, Pick<RenderOptions, "look" | "halation">> = {
  none: { look: "natural" },
  filme400: { look: "filme35" },
  pb: { look: "pb" },
  quente: { look: "filme35", halation: 1.3 },
  vintage: { look: "filme35" },
};

export interface EditState { film: FilmId; rotate: number; square: boolean; date: boolean }

/** Desenha a foto girada e cortada num canvas (sem filme). */
function baseCanvas(img: CanvasImageSource & { width: number; height: number }, s: Pick<EditState, "rotate" | "square">): HTMLCanvasElement {
  const rot = ((s.rotate % 360) + 360) % 360;
  const swap = rot === 90 || rot === 270;
  const iw = swap ? img.height : img.width, ih = swap ? img.width : img.height;
  const side = Math.min(iw, ih);
  const cw = s.square ? side : iw, ch = s.square ? side : ih;
  const canvas = document.createElement("canvas");
  canvas.width = cw; canvas.height = ch;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas indisponivel");
  ctx.translate(cw / 2, ch / 2);
  ctx.rotate((rot * Math.PI) / 180);
  ctx.drawImage(img, -img.width / 2, -img.height / 2);
  return canvas;
}

/** Aplica rotação, corte quadrado, filme (renderFilm) e data numa cópia JPEG. */
export async function renderEdit(img: CanvasImageSource & { width: number; height: number }, s: EditState, takenAt: Date): Promise<Blob> {
  const base = baseCanvas(img, s);
  const out = document.createElement("canvas");
  out.width = base.width; out.height = base.height;
  renderFilm(out, base, base.width, base.height, { ...FILM_LOOK[s.film], seed: takenAt.getTime(), stamp: s.date ? stampText(takenAt) : undefined });
  return new Promise((res, rej) => out.toBlob((b) => (b ? res(b) : rej(new Error("toBlob"))), "image/jpeg", 0.9));
}

/** Prévia do filme escolhido (sem giro nem corte, lado maior 640 px): é o mesmo `renderFilm` da foto salva. */
export async function renderFilmPreview(img: CanvasImageSource & { width: number; height: number }, film: FilmId, takenAt: Date): Promise<Blob> {
  const k = Math.min(1, 640 / Math.max(img.width, img.height));
  const out = document.createElement("canvas");
  out.width = Math.round(img.width * k); out.height = Math.round(img.height * k);
  renderFilm(out, img, img.width, img.height, { ...FILM_LOOK[film], seed: takenAt.getTime() });
  return new Promise((res, rej) => out.toBlob((b) => (b ? res(b) : rej(new Error("toBlob"))), "image/jpeg", 0.85));
}
