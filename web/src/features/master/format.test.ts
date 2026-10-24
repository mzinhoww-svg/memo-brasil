import { describe, expect, it } from "vitest";
import { brl, bytes, countdown, num, pct } from "./format";

const sp = (s: string) => s.replace(/ /g, " ");
describe("format", () => {
  it("num", () => { expect(num(1234567)).toBe("1.234.567"); expect(num(null)).toBe("0"); });
  it("brl a partir de centavos", () => { expect(sp(brl(123456))).toBe("R$ 1.234,56"); expect(sp(brl(0))).toBe("R$ 0,00"); expect(sp(brl(null))).toBe("R$ 0,00"); });
  it("bytes", () => { expect(bytes(500)).toBe("500 B"); expect(bytes(1536)).toBe("1,5 KB"); expect(bytes(5 * 1024 ** 3)).toBe("5,0 GB"); expect(bytes(null)).toBe("0 B"); });
  it("pct", () => { expect(pct(1, 4)).toBe("25%"); expect(pct(1, 3, 1)).toBe("33,3%"); expect(pct(1, 0)).toBe("—"); });
});
describe("countdown", () => {
  const now = Date.parse("2026-10-23T12:00:00Z");
  const at = (min: number) => now + min * 60_000;
  it("dias e horas", () => expect(countdown(at(1440 + 11 * 60), now)).toBe("em 1 dia e 11 h"));
  it("plural e dia exato", () => { expect(countdown(at(2 * 1440), now)).toBe("em 2 dias"); expect(countdown(at(3 * 1440 + 60), now)).toBe("em 3 dias e 1 h"); });
  it("horas e minutos", () => { expect(countdown(at(125), now)).toBe("em 2 h e 5 min"); expect(countdown(at(120), now)).toBe("em 2 h"); });
  it("minutos", () => expect(countdown(at(25), now)).toBe("em 25 min"));
  it("passado", () => expect(countdown(at(-125), now)).toBe("há 2 h e 5 min"));
  it("agora e inválido", () => { expect(countdown(now + 20_000, now)).toBe("agora"); expect(countdown("x", now)).toBe("—"); });
  it("aceita ISO", () => expect(countdown("2026-10-24T23:00:00Z", now)).toBe("em 1 dia e 11 h"));
});
