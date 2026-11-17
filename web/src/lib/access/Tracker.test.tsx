// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ path: "/criar" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.path }));
import { AccessTracker } from "./Tracker";

let beacon: ReturnType<typeof vi.fn>;
const sent = () => beacon.mock.calls.map(([, blob]) => (blob as Blob).text());
beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("NEXT_PUBLIC_MM_BACKEND", "supabase");
  beacon = vi.fn(() => true);
  Object.defineProperty(navigator, "sendBeacon", { value: beacon, configurable: true });
  Object.defineProperty(navigator, "doNotTrack", { value: null, configurable: true });
  sessionStorage.clear(); nav.path = "/criar";
  window.history.replaceState({}, "", "/criar?utm_source=instagram&utm_medium=social&utm_campaign=lancamento");
});
afterEach(() => { cleanup(); vi.unstubAllEnvs(); });

describe("AccessTracker", () => {
  it("a primeira página da visita leva origem (referência e UTM); as seguintes só o caminho", async () => {
    Object.defineProperty(document, "referrer", { value: "https://l.instagram.com/", configurable: true });
    const { rerender } = render(<AccessTracker />);
    expect(beacon).toHaveBeenCalledTimes(1);
    expect(beacon.mock.calls[0][0]).toBe("/api/acesso");
    expect(JSON.parse(await sent()[0])).toEqual({ path: "/criar", entry: true, ref: "https://l.instagram.com/", utm_source: "instagram", utm_medium: "social", utm_campaign: "lancamento" });
    nav.path = "/precos";
    rerender(<AccessTracker />);
    expect(beacon).toHaveBeenCalledTimes(2);
    expect(JSON.parse(await sent()[1])).toEqual({ path: "/precos", entry: false });
  });
  it("não mede com 'Não rastrear', no Master, em /dev, nem fora de produção/nuvem", () => {
    Object.defineProperty(navigator, "doNotTrack", { value: "1", configurable: true });
    render(<AccessTracker />); expect(beacon).not.toHaveBeenCalled(); cleanup();
    Object.defineProperty(navigator, "doNotTrack", { value: null, configurable: true });
    for (const p of ["/master/pessoas", "/dev/seed"]) { nav.path = p; render(<AccessTracker />); cleanup(); }
    expect(beacon).not.toHaveBeenCalled();
    nav.path = "/criar"; vi.stubEnv("NEXT_PUBLIC_MM_BACKEND", "local"); render(<AccessTracker />); cleanup();
    vi.stubEnv("NEXT_PUBLIC_MM_BACKEND", "supabase"); vi.stubEnv("NODE_ENV", "development"); render(<AccessTracker />);
    expect(beacon).not.toHaveBeenCalled();
  });
  it("sem sendBeacon usa fetch com keepalive e nunca quebra a página", () => {
    Object.defineProperty(navigator, "sendBeacon", { value: undefined, configurable: true });
    const f = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
    vi.stubGlobal("fetch", f);
    expect(() => render(<AccessTracker />)).not.toThrow();
    expect(f).toHaveBeenCalledWith("/api/acesso", expect.objectContaining({ method: "POST", keepalive: true }));
    vi.unstubAllGlobals();
  });
});
