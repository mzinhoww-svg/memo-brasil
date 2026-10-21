import { NextResponse } from "next/server";
import { serverSupabase } from "@/lib/supabase/server";
import { supabaseConfig } from "@/lib/supabase/env";

/** Retorno do OAuth (Google): troca o código PKCE por sessão e volta para o destino seguro (só caminhos do próprio site). */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/"; // evita open redirect
  if (!supabaseConfig() || !code) return NextResponse.redirect(`${origin}/?erro=login`);
  const sb = await serverSupabase();
  const { error } = await sb.auth.exchangeCodeForSession(code);
  return NextResponse.redirect(`${origin}${error ? "/?erro=login" : safeNext}`);
}
