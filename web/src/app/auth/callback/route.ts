import { NextResponse } from "next/server";
import { serverSupabase } from "@/lib/supabase/server";
import { supabaseConfig } from "@/lib/supabase/env";
import { safeNextPath } from "@/features/auth/safe-next";

/** Retorno do OAuth (Google): troca o código PKCE por sessão e volta para o destino seguro (só caminhos do próprio site). */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));
  const failure = new URL("/", origin);
  failure.searchParams.set("erro", "login");
  failure.searchParams.set("next", next);
  if (!supabaseConfig() || !code) return NextResponse.redirect(failure);
  try {
    const sb = await serverSupabase();
    const { error } = await sb.auth.exchangeCodeForSession(code);
    return NextResponse.redirect(error ? failure : `${origin}${next}`);
  } catch {
    return NextResponse.redirect(failure);
  }
}
