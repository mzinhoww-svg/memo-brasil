import { afterEach, describe, expect, it, vi } from "vitest";
import { getCheckoutBridge, goToCheckout, setCheckoutBridge, webCheckoutBridge, type CheckoutBridge } from "./checkout-nav";

afterEach(() => setCheckoutBridge(webCheckoutBridge));

describe("CheckoutBridge", () => {
  it("goToCheckout delega a open da ponte atual", () => {
    const open = vi.fn();
    setCheckoutBridge({ open, resumeEvents: () => () => undefined });
    goToCheckout("https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=abc");
    expect(open).toHaveBeenCalledWith("https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=abc");
  });

  it("setCheckoutBridge substitui a implementação (app nativo)", () => {
    const nativa: CheckoutBridge = { open: vi.fn(), resumeEvents: () => () => undefined };
    setCheckoutBridge(nativa);
    expect(getCheckoutBridge()).toBe(nativa);
  });

  it("web: resumeEvents chama em pageshow persistido e ao ficar visível; para após a limpeza", () => {
    const cb = vi.fn();
    const stop = webCheckoutBridge.resumeEvents(cb);
    window.dispatchEvent(Object.assign(new Event("pageshow"), { persisted: true }));
    expect(cb).toHaveBeenCalledTimes(1);
    window.dispatchEvent(Object.assign(new Event("pageshow"), { persisted: false }));
    expect(cb).toHaveBeenCalledTimes(1);
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(cb).toHaveBeenCalledTimes(2);
    stop();
    window.dispatchEvent(Object.assign(new Event("pageshow"), { persisted: true }));
    document.dispatchEvent(new Event("visibilitychange"));
    expect(cb).toHaveBeenCalledTimes(2);
  });
});
