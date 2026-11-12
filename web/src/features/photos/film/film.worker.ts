/// <reference lib="webworker" />
/** Worker do Filme 35mm: recebe o quadro já reduzido (ImageBitmap), roda `renderFilm` num OffscreenCanvas e devolve o JPEG. */
import { renderFilm, type RenderOptions } from "./film-canvas";

type Job = { id: number; bitmap: ImageBitmap; w: number; h: number; opts: RenderOptions; quality: number };

self.onmessage = async (e: MessageEvent<Job>) => {
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
