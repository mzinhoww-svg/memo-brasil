import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ exchange: vi.fn() }));
vi.mock("@/lib/supabase/env", () => ({ supabaseConfig: () => ({}) }));
vi.mock("@/lib/supabase/server", () => ({ serverSupabase: async () => ({ auth: { exchangeCodeForSession: m.exchange } }) }));
import { GET } from "@/app/auth/callback/route";
beforeEach(() => { m.exchange.mockReset(); });
describe("OAuth recovery", () => {
 it("falha preserva destino interno para repetir login", async () => { const r = await GET(new Request("https://memories.test/auth/callback?next=%2Feventos")); const dest = new URL(r.headers.get("location")!); expect(dest.searchParams.get("erro")).toBe("login"); expect(dest.searchParams.get("next")).toBe("/eventos"); });
 it.each(["//evil.test", "/\\evil.test", "https://evil.test", "/%5cevil.test", "/%2fevil.test"])("recusa destino perigoso %s", async (next) => { m.exchange.mockResolvedValue({ error: null }); const r = await GET(new Request(`https://memories.test/auth/callback?code=x&next=${encodeURIComponent(next)}`)); expect(r.headers.get("location")).toBe("https://memories.test/"); });
 it("rejeição de troca mantém recuperação", async () => { m.exchange.mockRejectedValue(new Error("offline")); const r = await GET(new Request("https://memories.test/auth/callback?code=x&next=%2Feventos")); expect(new URL(r.headers.get("location")!).searchParams.get("next")).toBe("/eventos"); });
 it("sucesso volta ao caminho e query originais", async () => { m.exchange.mockResolvedValue({ error: null }); const r = await GET(new Request("https://memories.test/auth/callback?code=x&next=%2Feventos%3Fpagina%3D2")); expect(r.headers.get("location")).toBe("https://memories.test/eventos?pagina=2"); });
});
