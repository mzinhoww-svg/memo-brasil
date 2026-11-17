import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { classifyOrigin, normalizePath, parseAgent } from "@/lib/access/classify";
import { backendMode, supabaseConfig } from "@/lib/supabase/env";

/**
 * Coletor de acessos (sem cookies e sem guardar IP). Recebe do navegador só o caminho e a origem; o resto vem dos cabeçalhos da requisição.
 * O "visitante do dia" é um hash (sal secreto + dia + IP + user-agent) que muda todo dia: não dá para voltar ao IP nem seguir a pessoa entre dias.
 * Respeita "Não rastrear" (DNT) e Global Privacy Control, ignora robôs e responde sempre 204 (o coletor nunca atrapalha a página).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const done = () => new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });

/** Sal do hash: segredo da implantação (ACCESS_SALT). Sem ele cai no id do deploy, que já é imprevisível para quem só vê o site. */
const salt = () => process.env.ACCESS_SALT ?? process.env.VERCEL_DEPLOYMENT_ID ?? "dev";

export function visitorHash(ip: string, ua: string, now = new Date()): string {
  const day = now.toISOString().slice(0, 10);
  return createHash("sha256").update(`${salt()}|${day}|${ip}|${ua}`).digest("hex").slice(0, 32);
}

export async function POST(req: Request): Promise<Response> {
  try {
    const h = req.headers;
    if (h.get("dnt") === "1" || h.get("sec-gpc") === "1") return done();
    const cfg = supabaseConfig();
    if (!cfg || backendMode() !== "supabase") return done(); // modo local (testes e desenvolvimento) não mede
    const agent = parseAgent(h.get("user-agent"));
    if (agent.bot) return done();
    const raw = await req.text();
    if (raw.length > 2048) return done();
    const body = JSON.parse(raw) as Record<string, unknown>;
    const path = normalizePath(String(body.path ?? ""));
    if (!path) return done();
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
    const entry = body.entry === true;
    const o = entry ? classifyOrigin({ ref: body.ref, utm_source: body.utm_source, utm_medium: body.utm_medium, utm_campaign: body.utm_campaign }, host) : null;
    const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "0";
    const country = (h.get("x-vercel-ip-country") ?? "").toUpperCase();
    const sb = createClient(cfg.url, cfg.key, { auth: { persistSession: false, autoRefreshToken: false } });
    await sb.rpc("record_access", {
      p_visitor: visitorHash(ip, h.get("user-agent") ?? ""), p_path: path, p_entry: entry,
      p_source: o?.source ?? null, p_medium: o?.medium ?? null, p_campaign: o?.campaign ?? null, p_ref_host: o?.refHost ?? null,
      p_device: agent.device, p_browser: agent.browser, p_os: agent.os, p_country: /^[A-Z]{2}$/.test(country) ? country : null,
    });
  } catch {
    /* medir é secundário: qualquer falha é silenciosa */
  }
  return done();
}
