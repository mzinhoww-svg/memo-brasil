import { describe, expect, it } from "vitest";
import { COLLAGE_SLOTS, collageSlots, coverCrop, type CollageLayout } from "./collage";

describe("colagem", () => {
  const W = 1000, H = 1250;
  it.each(Object.keys(COLLAGE_SLOTS) as CollageLayout[])("%s: número de espaços, dentro da tela e sem sobreposição", (layout) => {
    const slots = collageSlots(layout, W, H, 8);
    expect(slots).toHaveLength(COLLAGE_SLOTS[layout]);
    for (const r of slots) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w).toBeLessThanOrEqual(W + 1e-6);
      expect(r.y + r.h).toBeLessThanOrEqual(H + 1e-6);
    }
    for (let i = 0; i < slots.length; i++) for (let j = i + 1; j < slots.length; j++) {
      const a = slots[i], b = slots[j];
      const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
      expect(overlap, `${layout}: ${i} x ${j}`).toBe(false);
    }
  });
  it("coverCrop preenche o destino sem distorcer", () => {
    const c = coverCrop(1600, 900, 500, 500);
    expect(c.w / c.h).toBeCloseTo(1, 5);
    expect(c.h).toBe(900);
    expect(c.x).toBeCloseTo((1600 - 900) / 2, 5);
  });
});
