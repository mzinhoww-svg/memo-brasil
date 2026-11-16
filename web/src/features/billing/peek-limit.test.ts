import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => { vi.resetModules(); vi.doUnmock("@/lib/supabase/client"); vi.doUnmock("@/lib/supabase/env"); });

describe("peekCode · limite de tentativas", () => {
  it("'muitas_tentativas' vira null (a tela segue sem o presente) e nunca inventa um plano", async () => {
    vi.resetModules();
    vi.doMock("@/lib/supabase/client", () => ({ browserSupabase: () => ({ rpc: async () => ({ data: { status: "muitas_tentativas" }, error: null }) }) }));
    vi.doMock("@/lib/supabase/env", () => ({ backendMode: () => "supabase" }));
    const api = await import("./api");
    expect(await api.peekCode("MMT-AAAA-AAAA")).toBeNull();
  });
});
