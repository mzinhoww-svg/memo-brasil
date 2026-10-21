import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseConfig } from "./env";

/** Cliente de servidor (Route Handlers / Server Components) com a sessão dos cookies. */
export async function serverSupabase() {
  const cfg = supabaseConfig();
  if (!cfg) throw new Error("Supabase não configurado");
  const store = await cookies();
  return createServerClient(cfg.url, cfg.key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          /* chamado de Server Component: o middleware/route handler renova a sessão */
        }
      },
    },
  });
}
