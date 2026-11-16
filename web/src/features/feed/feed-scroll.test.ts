import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearFeedScroll, feedScrollKey, readFeedScroll, saveFeedScroll } from "./feed-scroll";

beforeEach(() => { clearFeedScroll("AAAA1111"); clearFeedScroll("BBBB2222"); window.sessionStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); });

describe("feed-scroll", () => {
  it("salva e restaura top, limit e autor do evento", () => {
    saveFeedScroll("AAAA1111", { top: 1234.6, limit: 40, author: "u2" });
    expect(readFeedScroll("AAAA1111")).toEqual({ top: 1235, limit: 40, author: "u2" });
  });
  it("ignora o estado de outro evento", () => {
    saveFeedScroll("AAAA1111", { top: 900, limit: 40, author: "t" });
    expect(readFeedScroll("BBBB2222")).toBeUndefined();
  });
  it("restaura da cópia no sessionStorage depois de uma recarga (memória vazia)", () => {
    saveFeedScroll("AAAA1111", { top: 300, limit: 20, author: "t" });
    const raw = window.sessionStorage.getItem(feedScrollKey("AAAA1111"));
    clearFeedScroll("AAAA1111");
    window.sessionStorage.setItem(feedScrollKey("AAAA1111"), raw ?? "");
    expect(readFeedScroll("AAAA1111")).toEqual({ top: 300, limit: 20, author: "t" });
  });
  it("descarta conteúdo inválido", () => {
    window.sessionStorage.setItem(feedScrollKey("AAAA1111"), JSON.stringify({ top: "x" }));
    expect(readFeedScroll("AAAA1111")).toBeUndefined();
    window.sessionStorage.setItem(feedScrollKey("AAAA1111"), "{nao-json");
    expect(readFeedScroll("AAAA1111")).toBeUndefined();
  });
  it("tolera sessionStorage indisponível (memória continua valendo)", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(() => saveFeedScroll("AAAA1111", { top: 50, limit: 20, author: "t" })).not.toThrow();
    expect(readFeedScroll("AAAA1111")).toEqual({ top: 50, limit: 20, author: "t" });
    clearFeedScroll("AAAA1111");
    expect(readFeedScroll("AAAA1111")).toBeUndefined();
  });
});
