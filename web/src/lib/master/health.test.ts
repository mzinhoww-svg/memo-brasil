import { describe, expect, it } from "vitest";
import { gaugeRows, growthBars, growthTotal, jobLabel, jobRows, runDots, type StorageData } from "./health";

const S: StorageData = {
  originals: { n: 97214, bytes: 410 * 2 ** 30 }, derived: { n: 0, bytes: 2 * 2 ** 30 }, orphans: { n: 312, bytes: 0.9 * 2 ** 30 }, branding: { n: 1108, bytes: 2.1 * 2 ** 30 },
  totalBytes: 415 * 2 ** 30, growth: [], uploads: { inProgress: 14, failed24h: 21, photosReady: 90000 }, quotaBytes: 1024 * 2 ** 30, purgeQueue: { size: 0, oldestAgeSeconds: 0 },
};
describe("storage e saúde (M27)", () => {
  it("medidores: fotos com cota, identidade, em andamento, falha e órfãos (os dois últimos em alerta)", () => {
    const g = gaugeRows(S);
    expect(g.map((x) => x.label)).toEqual(["Fotos · 97.214 arquivos", "Identidade visual · 1.108 arquivos", "Uploads em andamento", "Uploads com falha (24 h)", "Órfãos"]);
    expect(g[0]).toMatchObject({ value: "412 GB de 1,0 TB", pct: 40 });
    expect(g[3]).toMatchObject({ value: "21", warn: true });
    expect(g[4]).toMatchObject({ value: "312 arquivos · 922 MB", warn: true });
    expect(g.find((x) => x.key === "fila")).toBeUndefined();
  });
  it("sem cota definida só mostra o tamanho", () => {
    expect(gaugeRows({ ...S, quotaBytes: null })[0]).toMatchObject({ value: "412 GB", pct: 0 });
  });
  it("sem falhas nem órfãos os medidores não ficam em alerta; a fila de exclusão só aparece quando tem item", () => {
    const g = gaugeRows({ ...S, uploads: { ...S.uploads, failed24h: 0 }, orphans: { n: 0, bytes: 0 }, purgeQueue: { size: 3, oldestAgeSeconds: 60 } });
    expect(g.find((x) => x.key === "falha")?.warn).toBe(false);
    expect(g.find((x) => x.key === "orfaos")?.warn).toBe(false);
    expect(g.find((x) => x.key === "fila")).toMatchObject({ label: "Fila de exclusão", value: "3 itens" });
  });
  it("crescimento: barras relativas ao maior dia, o último destacado e rótulo a cada 5", () => {
    const growth = Array.from({ length: 30 }, (_, i) => ({ day: `2026-11-${String(i + 1).padStart(2, "0")}`, bytes: i === 29 ? 4e9 : i * 1e8 }));
    const bars = growthBars(growth);
    expect(bars).toHaveLength(30);
    expect(bars[29]).toMatchObject({ height: 100, on: true, label: "30" });
    expect(bars[0].height).toBe(0);
    expect(bars[4].label).toBe("5");
    expect(bars.filter((b) => b.label)).toHaveLength(6);
    expect(growthBars([{ day: "2026-11-01", bytes: 0 }])[0].height).toBe(0);
    expect(growthTotal([{ bytes: 2 ** 30 }, { bytes: 2 ** 30 }])).toBe("+2,0 GB");
  });
  it("jobs: nome em português, última execução, falhas seguidas e as 8 últimas bolinhas (a mais nova à direita)", () => {
    expect(jobLabel("mm-reveal-due")).toBe("Revelar eventos na hora");
    expect(jobLabel("mm-outro-job")).toBe("outro job");
    const runs = (...s: string[]) => s.map((status, i) => ({ startedAt: `2026-11-11T12:${String(50 - i).padStart(2, "0")}:00Z`, durationMs: 1, status }));
    expect(runDots(runs("failed", "failed", "succeeded"))).toEqual([false, true, true]);
    const rows = jobRows([
      { name: "mm-purge-deleted", active: true, runs: runs("failed", "failed", "succeeded", "succeeded", "succeeded", "succeeded", "succeeded", "succeeded", "succeeded"), consecutiveFailures: 2 },
      { name: "mm-reveal-due", active: true, runs: runs("succeeded"), consecutiveFailures: 0 },
      { name: "mm-expire-assets", active: true, runs: [], consecutiveFailures: 0 },
      { name: "mm-audit-integrity", active: false, runs: runs("succeeded"), consecutiveFailures: 0 },
    ], (iso) => iso.slice(11, 16));
    expect(rows[0]).toMatchObject({ name: "Limpar excluídos", tone: "bad", label: "falhou", fails: 2, last: "12:50" });
    expect(rows[0].dots).toEqual([false, false, false, false, false, false, true, true]);
    expect(rows[1]).toMatchObject({ tone: "ok", label: "ok" });
    expect(rows[1].dots).toHaveLength(8);
    expect(rows[2]).toMatchObject({ label: "sem leitura", last: null });
    expect(rows[3]).toMatchObject({ tone: "wait", label: "parado" });
  });
});
