import { describe, expect, it } from "vitest";
import { FREE_LIMITS, PLAN_HINTS, planHintForShots, shotsOptionHint } from "./plan-hint";

describe("plan-hint (limites aprovados, a ser trocado pelo catálogo real)", () => {
  it("espelha Festa 30/24/R$ 29, Celebração 100/24/R$ 89, Casamento 250/36/R$ 189, Grande 500/ilimitado/R$ 349", () => {
    expect(PLAN_HINTS.map((p) => [p.code, p.guests, p.shots, p.priceBrl])).toEqual([
      ["festa", 30, 24, 29],
      ["celebracao", 100, 24, 89],
      ["casamento", 250, 36, 189],
      ["grande", 500, null, 349],
    ]);
    expect(FREE_LIMITS).toEqual({ guests: 10, shots: 10 });
  });
  it("até 10 fotos cabe no Grátis: sem selo", () => {
    expect(planHintForShots(10)).toBeUndefined();
    expect(shotsOptionHint(10)).toBeUndefined();
  });
  it("devolve o plano mais barato que comporta as fotos", () => {
    expect(planHintForShots(16)?.code).toBe("festa");
    expect(planHintForShots(24)?.code).toBe("festa");
    expect(planHintForShots(36)?.code).toBe("casamento");
    expect(planHintForShots(null)?.code).toBe("grande");
  });
  it("selo curto com o nome do plano", () => {
    expect(shotsOptionHint(36)).toBe("Casamento");
  });
});
