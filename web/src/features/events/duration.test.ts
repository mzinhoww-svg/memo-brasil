import { describe, expect, it } from "vitest";
import { resolveDuration } from "./duration";

describe("resolveDuration", () => {
  const H = 3_600_000;
  it("preset não depende do relógio", () => {
    expect(resolveDuration({ presetHours: 6 }, 0)).toBe(6);
    expect(resolveDuration({ presetHours: 6 }, 10 * H)).toBe(6);
  });
  it("horário-alvo: o fim fica fixo mesmo que a criação aconteça minutos depois", () => {
    const target = 10 * H;
    const start = 2 * H + 20 * 60_000; // clique 20 min depois da escolha
    expect(start + resolveDuration({ untilMs: target, presetHours: 6 }, start) * H).toBe(target);
  });
  it("alvo no passado dá duração não positiva (barrado pela validação de 30 min)", () => {
    expect(resolveDuration({ untilMs: 0, presetHours: 6 }, H)).toBeLessThan(0);
  });
});
