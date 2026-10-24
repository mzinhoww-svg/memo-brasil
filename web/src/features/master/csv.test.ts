import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

type R = { nome: string; n: number | null };
const cols = [{ key: "nome", label: "Nome" }, { key: "n", label: "Qtd" }] as const;

describe("toCsv", () => {
  it("BOM, separador ; e CRLF", () => {
    expect(toCsv<R>([{ nome: "Ana", n: 3 }, { nome: "Bia", n: null }], cols)).toBe("﻿Nome;Qtd\r\nAna;3\r\nBia;");
  });
  it("cita células com ; aspas e quebras de linha", () => {
    const out = toCsv<R>([{ nome: 'a;b "c"\nd', n: 1 }], cols);
    expect(out).toBe('﻿Nome;Qtd\r\n"a;b ""c""\nd";1');
  });
  it.each(["=SOMA(A1)", "+1", "-1", "@cmd"])("neutraliza fórmula %j", (v) => {
    const line = toCsv<R>([{ nome: v, n: 0 }], cols).split("\r\n")[1];
    expect(line).toBe(`'${v};0`);
  });
  it("neutraliza tab inicial", () => expect(toCsv<R>([{ nome: "\tx", n: 0 }], cols).split("\r\n")[1]).toBe("'\tx;0"));
  it("número negativo real não leva apóstrofo", () => expect(toCsv<R>([{ nome: "x", n: -5 }], cols)).toContain("x;-5"));
  it("sem linhas: só o cabeçalho", () => expect(toCsv<R>([], cols)).toBe("﻿Nome;Qtd"));
});
