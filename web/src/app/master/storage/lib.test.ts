import { describe, expect, it } from "vitest";
import { cumulativeGrowth, daysToQuota, fromBreakdown, fromLegacyMetrics, QUOTA_BYTES, segments } from "./lib";

const nova = {
  originals: { n: 10, bytes: 1000 }, derived: { n: 10, bytes: 100 }, orphans: { n: 2, bytes: 50 }, branding: { n: 1, bytes: 20 },
  avgPhotoBytes: 100, totalBytes: 1170, growth: [{ day: "2026-10-02", bytes: 30 }, { day: "2026-10-01", bytes: 40 }],
};

describe("fromBreakdown", () => {
  it("lê as quatro classes, a média e o crescimento", () => {
    const b = fromBreakdown(nova);
    expect(b.classified).toBe(true);
    expect(b.orphans).toEqual({ n: 2, bytes: 50 });
    expect(b.totalBytes).toBe(1170);
    expect(b.avgPhotoBytes).toBe(100);
    expect(b.growth).toHaveLength(2);
  });
  it("sem originais não há média; sem total soma as classes", () => {
    const b = fromBreakdown({ ...nova, originals: { n: 0, bytes: 0 }, totalBytes: undefined });
    expect(b.avgPhotoBytes).toBeNull();
    expect(b.totalBytes).toBe(170);
  });
  it("tolera nulo", () => expect(fromBreakdown(null).totalBytes).toBe(0));
});

describe("fromLegacyMetrics", () => {
  it("marca as fotos como sem classificação e estima a média pelas fotos prontas", () => {
    const b = fromLegacyMetrics({ storage: { photosBytes: 900, photosObjects: 20, brandingBytes: 100, brandingObjects: 2 }, photos: { total: 3 } });
    expect(b.classified).toBe(false);
    expect(b.unclassified).toEqual({ n: 20, bytes: 900 });
    expect(b.totalBytes).toBe(1000);
    expect(b.avgPhotoBytes).toBe(300);
    expect(b.growth).toEqual([]);
    expect(segments(b).map((s) => s.label)).toEqual(["Fotos (sem classificação)", "Identidade"]);
  });
  it("sem fotos prontas não estima média", () => expect(fromLegacyMetrics({ storage: {}, photos: { total: 0 } }).avgPhotoBytes).toBeNull());
});

describe("curva e cota", () => {
  it("acumula a partir da base anterior ao período", () => {
    expect(cumulativeGrowth([{ day: "2026-10-02", bytes: 30 }, { day: "2026-10-01", bytes: 40 }], 1170)).toEqual([
      { day: "2026-10-01", bytes: 1140 }, { day: "2026-10-02", bytes: 1170 },
    ]);
  });
  it("base nunca negativa", () => expect(cumulativeGrowth([{ day: "a", bytes: 50 }], 10)[0].bytes).toBe(50));
  it("dias até a cota pelo ritmo médio", () => {
    expect(daysToQuota([{ bytes: 100 }, { bytes: 100 }], QUOTA_BYTES - 1000)).toBe(10);
    expect(daysToQuota([{ bytes: 0 }], 10)).toBeNull();
    expect(daysToQuota([], 10)).toBeNull();
    expect(daysToQuota([{ bytes: 1 }], QUOTA_BYTES)).toBe(0);
  });
  it("cota documentada de 1 GB", () => expect(QUOTA_BYTES).toBe(1073741824));
  it("segmentos classificados na ordem original, derivado, órfão, identidade", () => {
    expect(segments(fromBreakdown(nova)).map((s) => s.key)).toEqual(["original", "derivado", "orfao", "identidade"]);
  });
});
