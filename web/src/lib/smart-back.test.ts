import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearNav, navKey, readNav, recordNav, smartBack, startNav } from "./smart-back";

const router = () => ({ back: vi.fn(), replace: vi.fn() });
const A = "ABCD2345";
const B = "ZXCV6789";

beforeEach(() => { clearNav(A); clearNav(B); window.sessionStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); });

/** Simula a recarga: a memória do módulo some, o sessionStorage fica. */
function reloadTab() {
  const raw = window.sessionStorage.getItem(navKey(A));
  clearNav(A);
  if (raw) window.sessionStorage.setItem(navKey(A), raw);
}

describe("smartBack", () => {
  it("com rota interna anterior (profundidade > 1) volta pelo histórico", () => {
    recordNav(A, `/e/${A}/agora`);
    recordNav(A, `/e/${A}/retrospectiva`);
    expect(readNav(A)).toEqual({ depth: 2, prev: `/e/${A}/agora` });
    const r = router();
    expect(smartBack(A, r, `/e/${A}/agora`, `/e/${A}/retrospectiva`)).toBe("back");
    expect(r.back).toHaveBeenCalledTimes(1);
    expect(r.replace).not.toHaveBeenCalled();
  });
  it("sem histórico (link direto) troca a entrada pelo fallback, uma vez, sem router.back()", () => {
    recordNav(A, `/e/${A}/retrospectiva`);
    const r = router();
    expect(smartBack(A, r, `/e/${A}/agora`, `/e/${A}/retrospectiva`)).toBe("fallback");
    expect(r.back).not.toHaveBeenCalled();
    expect(r.replace).toHaveBeenCalledTimes(1);
    expect(r.replace).toHaveBeenCalledWith(`/e/${A}/agora`);
    // a troca não vira profundidade 2: o próximo voltar continua sem sair do app
    recordNav(A, `/e/${A}/agora`);
    expect(readNav(A).depth).toBe(1);
  });
  it("já no destino do fallback e sem histórico: não faz nada (sem loop)", () => {
    recordNav(A, `/e/${A}/agora`);
    const r = router();
    expect(smartBack(A, r, `/e/${A}/agora`, `/e/${A}/agora`)).toBe("stay");
    expect(r.back).not.toHaveBeenCalled();
    expect(r.replace).not.toHaveBeenCalled();
  });
  it("o marcador é por código de evento", () => {
    recordNav(A, `/e/${A}/agora`);
    recordNav(A, `/e/${A}/voce`);
    recordNav(B, `/e/${B}/retrospectiva`);
    expect(readNav(A).depth).toBe(2);
    expect(readNav(B).depth).toBe(1);
    const r = router();
    smartBack(B, r, `/e/${B}/agora`, `/e/${B}/retrospectiva`);
    expect(r.replace).toHaveBeenCalledWith(`/e/${B}/agora`);
    expect(window.sessionStorage.getItem(navKey(A))).toContain(`/e/${A}/voce`);
  });
  it("voltar pelo histórico desempilha e a mesma rota não empilha", () => {
    recordNav(A, `/e/${A}/agora`);
    recordNav(A, `/e/${A}/retrospectiva`);
    expect(recordNav(A, `/e/${A}/agora`, true)).toEqual({ depth: 1, prev: null });
    recordNav(A, `/e/${A}/minhas`);
    expect(recordNav(A, `/e/${A}/minhas`).depth).toBe(2);
  });
  it("recarregar a aba recupera a pilha do sessionStorage", () => {
    recordNav(A, `/e/${A}/agora`);
    recordNav(A, `/e/${A}/retrospectiva`);
    reloadTab();
    expect(readNav(A).depth).toBe(2);
  });
  it("carga nova do documento (navigate) descarta a pilha antiga; reload e back_forward mantêm", () => {
    recordNav(A, `/e/${A}/agora`);
    recordNav(A, `/e/${A}/voce`);
    startNav(A, "reload");
    startNav(A, "back_forward");
    expect(readNav(A).depth).toBe(2);
    startNav(A, "navigate");
    expect(readNav(A).depth).toBe(0);
    recordNav(A, `/e/${A}/retrospectiva`);
    const r = router();
    expect(smartBack(A, r, `/e/${A}/agora`, `/e/${A}/retrospectiva`)).toBe("fallback");
  });
  it("sessionStorage indisponível: segue só na memória, sem lançar", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(() => recordNav(A, `/e/${A}/agora`)).not.toThrow();
    recordNav(A, `/e/${A}/voce`);
    const r = router();
    expect(smartBack(A, r, `/e/${A}/agora`, `/e/${A}/voce`)).toBe("back");
    expect(() => clearNav(A)).not.toThrow();
    expect(readNav(A).depth).toBe(0);
  });
});
