import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ rpc: vi.fn(async (..._args: unknown[]) => ({ data: true, error: null })) }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ rpc: m.rpc }) }));

import { POST, visitorHash } from "./route";

const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const call = (body: unknown, headers: Record<string, string> = {}) =>
  POST(new Request("https://fotosdocasamento.online/api/acesso", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body), headers: { "user-agent": UA, host: "fotosdocasamento.online", "x-forwarded-for": "203.0.113.9, 10.0.0.1", "x-vercel-ip-country": "br", ...headers } }));

beforeEach(() => {
  m.rpc.mockClear();
  vi.stubEnv("NEXT_PUBLIC_MM_BACKEND", "supabase"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_x");
  vi.stubEnv("ACCESS_SALT", "sal-de-teste");
});

describe("POST /api/acesso", () => {
  it("responde 204 e grava com caminho normalizado, origem, aparelho, país e visitante em hash (sem IP)", async () => {
    const r = await call({ path: "/e/ABCD2345/agora?x=1", entry: true, ref: "https://l.instagram.com/", utm_campaign: "lancamento" });
    expect(r.status).toBe(204);
    expect(m.rpc).toHaveBeenCalledTimes(1);
    const [fn, args] = m.rpc.mock.calls[0] as [string, Record<string, unknown>];
    expect(fn).toBe("record_access");
    expect(args).toMatchObject({ p_path: "/e/:codigo/agora", p_entry: true, p_source: "Instagram", p_medium: "social", p_campaign: "lancamento", p_ref_host: "l.instagram.com", p_device: "celular", p_browser: "Safari", p_os: "iOS", p_country: "BR" });
    expect(String(args.p_visitor)).toMatch(/^[0-9a-f]{32}$/);
    expect(JSON.stringify(args)).not.toMatch(/203\.0\.113|Mozilla/); // nem IP nem user-agent saem daqui
  });
  it("página interna não leva origem", async () => {
    await call({ path: "/precos", entry: false, ref: "https://www.google.com/" });
    expect(m.rpc.mock.calls[0][1]).toMatchObject({ p_entry: false, p_source: null, p_medium: null, p_ref_host: null });
  });
  it("não mede: Não rastrear, Global Privacy Control, robô, Master/dev, corpo inválido ou grande, modo local", async () => {
    await call({ path: "/" }, { dnt: "1" });
    await call({ path: "/" }, { "sec-gpc": "1" });
    await call({ path: "/" }, { "user-agent": "Googlebot/2.1" });
    await call({ path: "/master/pessoas" });
    await call({ path: "/dev/seed" });
    await call("isto não é json");
    await call({ path: "/" + "a".repeat(3000) });
    vi.stubEnv("NEXT_PUBLIC_MM_BACKEND", "local");
    await call({ path: "/" });
    expect(m.rpc).not.toHaveBeenCalled();
  });
  it("falha do banco nunca vira erro para a página", async () => {
    m.rpc.mockRejectedValueOnce(new Error("fora do ar"));
    expect((await call({ path: "/" })).status).toBe(204);
  });
});

describe("visitorHash", () => {
  it("é estável no mesmo dia e muda no dia seguinte, com outro IP ou outro aparelho; o sal entra na conta", () => {
    const d1 = new Date("2026-11-17T10:00:00Z"), d2 = new Date("2026-11-18T10:00:00Z");
    const a = visitorHash("1.2.3.4", "ua", d1);
    expect(a).toBe(visitorHash("1.2.3.4", "ua", new Date("2026-11-17T23:00:00Z")));
    expect(a).not.toBe(visitorHash("1.2.3.4", "ua", d2));
    expect(a).not.toBe(visitorHash("1.2.3.5", "ua", d1));
    expect(a).not.toBe(visitorHash("1.2.3.4", "outro", d1));
    vi.stubEnv("ACCESS_SALT", "outro-sal");
    expect(a).not.toBe(visitorHash("1.2.3.4", "ua", d1));
  });
});
