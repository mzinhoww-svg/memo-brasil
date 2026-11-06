// CORS da Edge Function: origem restrita a uma lista (nunca `*`). Módulo puro, testado no vitest.
const FIXED = [/^https:\/\/memoriesmt-v2\.vercel\.app$/, /^https:\/\/memoriesmt-v2-[a-z0-9-]+-mzinhoww-gmailcoms-projects\.vercel\.app$/, /^https:\/\/newmemocuiaba\.vercel\.app$/, /^https:\/\/newmemocuiaba-[a-z0-9-]+-mzinhoww-gmailcoms-projects\.vercel\.app$/, /^http:\/\/(localhost|127\.0\.0\.1):\d{2,5}$/];

/** `extra`: origens adicionais separadas por vírgula (ex.: domínio próprio), vindas da variável de ambiente ALLOWED_ORIGINS. */
export function isAllowedOrigin(origin: string | null | undefined, extra = ""): boolean {
  if (!origin) return false;
  if (FIXED.some((r) => r.test(origin))) return true;
  return extra.split(",").map((s) => s.trim()).filter(Boolean).includes(origin);
}

export function corsHeaders(origin: string | null | undefined, extra = ""): Record<string, string> {
  const h: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
  if (isAllowedOrigin(origin, extra)) h["Access-Control-Allow-Origin"] = origin as string;
  return h;
}
