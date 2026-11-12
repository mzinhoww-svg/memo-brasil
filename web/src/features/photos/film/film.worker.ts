/// <reference lib="webworker" />
/** Worker do Filme 35mm: recebe o quadro já reduzido (ImageBitmap), roda `renderFilm` num OffscreenCanvas e devolve o JPEG. */
import { renderFilm, type RenderOptions } from "./film-canvas";
import { warmFilm, type FilmLook } from "./film35";

type Job = { id: number; bitmap: ImageBitmap; w: number; h: number; opts: RenderOptions; quality: number };
/** Pré-aquecimento ao abrir a câmera: decodifica o LUT e gera os ladrilhos de grão antes do primeiro disparo. */
type Warm = { warm: FilmLook; seeds: number[] };

self.onmessage = async (e: MessageEvent<Job | Warm>) => {
  if ("warm" in e.data) {
    try { warmFilm(e.data.warm, e.data.seeds); } catch { /* aquecer é opcional */ }
    return;
  }
  const { id, bitmap, w, h, opts, quality } = e.data;
  try {
    const canvas = new OffscreenCanvas(w, h);
    renderFilm(canvas, bitmap, bitmap.width, bitmap.height, opts);
    bitmap.close();
    const blob = await canvas.convertToBlob({ type: "image/jpeg", quality });
    const bytes = await blob.arrayBuffer();
    (self as unknown as Worker).postMessage({ id, bytes }, [bytes]);
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, error: String(err) });
  }
};
