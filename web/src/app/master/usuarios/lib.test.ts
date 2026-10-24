import { describe, expect, it } from "vitest";
import { fromLegacy, isOrphan, kindOf, matchesQuery, pageCount, parseKind, parsePage, parseQuery, summarize, type UserItem } from "./lib";

const u = (o: Partial<UserItem>): UserItem => ({ userId: "id-1", isAnonymous: false, provider: "google", email: "a@x.com", createdAt: "2026-10-01", lastSignInAt: null, platformRole: null, ...o });

describe("usuarios/lib", () => {
  it("kindOf", () => {
    expect(kindOf(u({ isAnonymous: true, provider: "anonymous" }))).toBe("anon");
    expect(kindOf(u({}))).toBe("google");
    expect(kindOf(u({ provider: "email" }))).toBe("email");
  });
  it("parse de parâmetros", () => {
    expect(parseKind({ tipo: "anon" })).toBe("anon");
    expect(parseKind({ tipo: "x" })).toBeNull();
    expect(parsePage({ p: "3" })).toBe(3);
    expect(parsePage({ p: "-1" })).toBe(1);
    expect(parsePage({})).toBe(1);
    expect(parseQuery({ q: ["  Abc  "] })).toBe("Abc");
    expect(parseQuery({ q: "x".repeat(200) })).toHaveLength(80);
  });
  it("summarize não inventa órfãs", () => {
    expect(summarize([u({}), u({ provider: "email" }), u({ isAnonymous: true })])).toEqual({ google: 1, email: 1, anon: 1, orphanAnon: null });
  });
  it("matchesQuery por id exato ou e-mail parcial", () => {
    expect(matchesQuery(u({ userId: "ABC" }), "abc")).toBe(true);
    expect(matchesQuery(u({ userId: "ABCD" }), "abc")).toBe(false);
    expect(matchesQuery(u({ email: "Maria@x.com" }), "maria")).toBe(true);
    expect(matchesQuery(u({ email: null }), "maria")).toBe(false);
    expect(matchesQuery(u({}), "")).toBe(true);
  });
  it("fromLegacy filtra, pagina e zera campos novos", () => {
    const items = Array.from({ length: 120 }, (_, i) => u({ userId: `u${i}`, isAnonymous: i % 2 === 0, provider: i % 2 === 0 ? "anonymous" : "google", eventsLinked: 9, orphanAnon: true }));
    const all = fromLegacy({ items }, { kind: null, q: "" }, 1);
    expect(all.total).toBe(120); expect(all.items).toHaveLength(50);
    expect(all.items[0].eventsLinked).toBeUndefined();
    expect(all.summary.anon).toBe(60);
    const anon = fromLegacy({ items }, { kind: "anon", q: "" }, 2);
    expect(anon.total).toBe(60); expect(anon.items).toHaveLength(10);
    expect(fromLegacy({ items }, { kind: null, q: "u7" }, 1).items.map((x) => x.userId)).toEqual(["u7"]);
    expect(fromLegacy(null, { kind: null, q: "" }, 1).total).toBe(0);
  });
  it("isOrphan e pageCount", () => {
    expect(isOrphan(u({ orphanAnon: true }))).toBe(true);
    expect(isOrphan(u({}))).toBe(false);
    expect(pageCount(0)).toBe(1); expect(pageCount(101)).toBe(3);
  });
});
