/** Layouts de colagem do REA (F-33): 2 lado a lado, 2 empilhadas, 3 fotos, 4 fotos. */
export type CollageLayout = "lado-a-lado" | "empilhadas" | "trio" | "quatro";
export const COLLAGE_LABEL: Record<CollageLayout, string> = { "lado-a-lado": "2 lado a lado", empilhadas: "2 empilhadas", trio: "3 fotos", quatro: "4 fotos" };
export const COLLAGE_SLOTS: Record<CollageLayout, number> = { "lado-a-lado": 2, empilhadas: 2, trio: 3, quatro: 4 };

export interface Rect { x: number; y: number; w: number; h: number }

/** Retângulos dos espaços numa tela w×h, com `gap` entre eles e nas bordas. */
export function collageSlots(layout: CollageLayout, w: number, h: number, gap = 8): Rect[] {
  const iw = w - gap * 3;
  const ih = h - gap * 3;
  const halfW = iw / 2;
  const halfH = ih / 2;
  switch (layout) {
    case "lado-a-lado":
      return [{ x: gap, y: gap, w: halfW, h: h - gap * 2 }, { x: gap * 2 + halfW, y: gap, w: halfW, h: h - gap * 2 }];
    case "empilhadas":
      return [{ x: gap, y: gap, w: w - gap * 2, h: halfH }, { x: gap, y: gap * 2 + halfH, w: w - gap * 2, h: halfH }];
    case "trio":
      return [{ x: gap, y: gap, w: w - gap * 2, h: halfH }, { x: gap, y: gap * 2 + halfH, w: halfW, h: halfH }, { x: gap * 2 + halfW, y: gap * 2 + halfH, w: halfW, h: halfH }];
    case "quatro":
      return [{ x: gap, y: gap, w: halfW, h: halfH }, { x: gap * 2 + halfW, y: gap, w: halfW, h: halfH }, { x: gap, y: gap * 2 + halfH, w: halfW, h: halfH }, { x: gap * 2 + halfW, y: gap * 2 + halfH, w: halfW, h: halfH }];
  }
}

/** Recorte "cover" da origem sw×sh dentro do destino: devolve o retângulo da origem a desenhar. */
export function coverCrop(sw: number, sh: number, dw: number, dh: number): Rect {
  const s = Math.max(dw / sw, dh / sh);
  const w = dw / s;
  const h = dh / s;
  return { x: (sw - w) / 2, y: (sh - h) / 2, w, h };
}
