/** Configuração pública do Supabase. Só as duas variáveis públicas; segredos administrativos nunca entram no app. */
export interface SupabaseConfig { url: string; key: string }

export function supabaseConfig(): SupabaseConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // publishable (preferida); anon só por compatibilidade com projetos antigos
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? { url, key } : null;
}

/** `supabase` só quando pedido E configurado; qualquer outra coisa mantém o modo local (IndexedDB). */
export function backendMode(): "local" | "supabase" {
  return process.env.NEXT_PUBLIC_MM_BACKEND === "supabase" && supabaseConfig() ? "supabase" : "local";
}
