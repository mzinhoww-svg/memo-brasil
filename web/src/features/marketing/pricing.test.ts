import { afterEach, describe, expect, it, vi } from "vitest";
import { PRICING_FALLBACK, loadPublicTiers, tiersFromPlans } from "./pricing";

const P = (code: string, name: string, g: number | null, s: number | null, cents: number, extra = {}) => ({ code, name, maxGuests: g, maxShots: s, priceCents: cents, isFree: cents === 0, features: [], ...extra });
const CATALOG = [P("gratis", "Grátis", 10, 10, 0), P("ate150", "Até 150 convidados", 150, 36, 14700, { highlighted: true }), P("ate300", "Até 300 convidados", 300, 36, 29700)];

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("faixas de preço da página pública", () => {
  it("tiersFromPlans: rótulo por convidados, preço redondo e destaque do catálogo", () => {
    const t = tiersFromPlans(CATALOG);
    expect(t.map((x) => x.label)).toEqual(["Até 10 convidados", "Até 150 convidados", "Até 300 convidados"]);
    expect(t.map((x) => x.price)).toEqual(["Grátis", "R$ 147", "R$ 297"]);
    expect(t.map((x) => x.highlighted)).toEqual([false, true, false]);
    expect(t.map((x) => x.priceCents)).toEqual([0, 14700, 29700]);
  });
  it("fallback fixo bate com o catálogo decidido", () => {
    expect(PRICING_FALLBACK.map((x) => [x.label, x.price, x.highlighted])).toEqual([
      ["Até 10 convidados", "Grátis", false], ["Até 150 convidados", "R$ 147", true], ["Até 300 convidados", "R$ 297", false],
    ]);
  });
  it("loadPublicTiers: catálogo fora do ar → fallback (a página nunca fica sem preço)", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "k");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await loadPublicTiers()).toEqual(PRICING_FALLBACK);
  });
  it("loadPublicTiers: sem Supabase configurado → fallback", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", ""); vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", ""); vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    expect(await loadPublicTiers()).toEqual(PRICING_FALLBACK);
  });
  it("loadPublicTiers: lê list_public_plans com a chave pública e revalida a cada hora", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "k");
    const f = vi.fn().mockResolvedValue(new Response(JSON.stringify(CATALOG), { status: 200 }));
    vi.stubGlobal("fetch", f);
    expect((await loadPublicTiers()).map((t) => t.price)).toEqual(["Grátis", "R$ 147", "R$ 297"]);
    const [url, init] = f.mock.calls[0];
    expect(url).toBe("https://x.supabase.co/rest/v1/rpc/list_public_plans");
    expect(init).toMatchObject({ method: "POST", headers: { apikey: "k" }, next: { revalidate: 3600 } });
  });
  it("loadPublicTiers: resposta sem plano pago → fallback (não anuncia só o Grátis no Google)", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "k");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify([CATALOG[0]]), { status: 200 })));
    expect(await loadPublicTiers()).toEqual(PRICING_FALLBACK);
  });
});
