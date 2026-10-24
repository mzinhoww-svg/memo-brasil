import { describe, expect, it } from "vitest";
import { includeTests, isMissingRpc, periodDays } from "./params";

describe("includeTests", () => {
  it("só com testes=1", () => {
    expect(includeTests({ testes: "1" })).toBe(true);
    expect(includeTests({})).toBe(false);
    expect(includeTests({ testes: "0" })).toBe(false);
    expect(includeTests({ testes: "true" })).toBe(false);
    expect(includeTests({ testes: ["1", "0"] })).toBe(true);
  });
});
describe("periodDays", () => {
  it("aceita 7, 30, 90 e cai em 30", () => {
    expect(periodDays({ dias: "7" })).toBe(7);
    expect(periodDays({ periodo: "90" })).toBe(90);
    expect(periodDays({ dias: "15" })).toBe(30);
    expect(periodDays({})).toBe(30);
  });
});
describe("isMissingRpc", () => {
  it("classifica função inexistente", () => {
    expect(isMissingRpc({ code: "PGRST202", message: "x" })).toBe(true);
    expect(isMissingRpc({ code: "42883", message: "x" })).toBe(true);
    expect(isMissingRpc({ code: "", message: "Could not find the function public.admin_overview in the schema cache" })).toBe(true);
  });
  it("não confunde outros erros", () => {
    expect(isMissingRpc(null)).toBe(false);
    expect(isMissingRpc({ code: "MM004", message: "forbidden" })).toBe(false);
    expect(isMissingRpc({ code: "42501", message: "permission denied" })).toBe(false);
  });
});
