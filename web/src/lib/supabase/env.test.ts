import { afterEach, describe, expect, it, vi } from "vitest";
import { backendMode, backendStatus } from "./env";

afterEach(() => vi.unstubAllEnvs());

describe("backendStatus", () => {
  it("pedido supabase sem configuração pública é erro explícito, nunca modo local silencioso", () => {
    vi.stubEnv("NEXT_PUBLIC_MM_BACKEND", "supabase");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    expect(backendStatus()).toBe("misconfigured");
  });
  it("supabase configurado e local explícito", () => {
    vi.stubEnv("NEXT_PUBLIC_MM_BACKEND", "supabase");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "pk");
    expect(backendStatus()).toBe("supabase");
    expect(backendMode()).toBe("supabase");
    vi.stubEnv("NEXT_PUBLIC_MM_BACKEND", "");
    expect(backendStatus()).toBe("local");
  });
});
