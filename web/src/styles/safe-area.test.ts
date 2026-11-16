import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(__dirname, "revela2.css"), "utf8");
const rule = (sel: string) => css.split("\n").find((l) => l.startsWith(`${sel} {`)) ?? "";

describe("área segura do iPhone (viewport-fit=cover)", () => {
  it(".safe e .sheet-full respeitam o topo e a barra home", () => {
    expect(rule(".safe")).toContain("env(safe-area-inset-top)");
    expect(rule(".safe")).toContain("env(safe-area-inset-bottom)");
    expect(rule(".sheet-full")).toContain("env(safe-area-inset-bottom)");
  });
  it(".sheet-full rola por dentro (campo e barra de ação alcançáveis com o teclado aberto)", () => {
    expect(rule(".sheet-full")).toContain("overflow-y: auto");
  });
});
