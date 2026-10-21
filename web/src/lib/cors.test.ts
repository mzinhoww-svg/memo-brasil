import { describe, expect, it } from "vitest";
import { corsHeaders, isAllowedOrigin } from "../../../supabase/functions/_shared/cors";

describe("CORS da Edge Function", () => {
  const extra = "https://app.exemplo.com";
  it("permite só origens da lista (produção, previews do projeto, localhost) e nunca *", () => {
    for (const o of ["https://newmemocuiaba.vercel.app", "https://newmemocuiaba-ae1cqm5gn-mzinhoww-gmailcoms-projects.vercel.app", "http://localhost:3187", "http://127.0.0.1:3187", extra]) expect(isAllowedOrigin(o, extra), o).toBe(true);
    for (const o of ["https://evil.example", "https://newmemocuiaba.vercel.app.evil.com", "http://localhost.evil.com", "https://other-mzinhoww-gmailcoms-projects.vercel.app", "null", "", undefined]) expect(isAllowedOrigin(o as string, extra), String(o)).toBe(false);
  });
  it("preflight devolve os cabeçalhos do cliente do Supabase para origem permitida", () => {
    const h = corsHeaders("https://newmemocuiaba.vercel.app");
    expect(h["Access-Control-Allow-Origin"]).toBe("https://newmemocuiaba.vercel.app");
    expect(h["Access-Control-Allow-Headers"]).toMatch(/authorization/);
    expect(h["Access-Control-Allow-Headers"]).toMatch(/apikey/);
    expect(h["Access-Control-Allow-Headers"]).toMatch(/x-client-info/);
    expect(h["Access-Control-Allow-Headers"]).toMatch(/content-type/);
    expect(h["Access-Control-Allow-Methods"]).toBe("POST, OPTIONS");
    expect(h["Vary"]).toBe("Origin");
  });
  it("origem não permitida não recebe Allow-Origin", () => {
    expect(corsHeaders("https://evil.example")["Access-Control-Allow-Origin"]).toBeUndefined();
  });
});
