"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseConfig } from "./env";
import { timedFetch } from "./timed-fetch";

let client: SupabaseClient | undefined;

/** Cliente do navegador (sessão em cookies, para o servidor conseguir trocar o código do OAuth). Toda chamada tem tempo limite (`timedFetch`). */
export function browserSupabase(): SupabaseClient {
  const cfg = supabaseConfig();
  if (!cfg) throw new Error("Supabase não configurado");
  return (client ??= createBrowserClient(cfg.url, cfg.key, { global: { fetch: timedFetch() } }));
}
