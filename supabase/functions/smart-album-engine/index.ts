// Ponto de contato do motor facial em modo pull (POST /claim, /complete, /fail). Autenticação: Bearer cujo SHA-256 = ENGINE_TOKEN_SHA256.
// verify_jwt desligado no deploy: quem chama é o motor (sem JWT do Supabase); a checagem é o token próprio abaixo.
import { createClient } from "npm:@supabase/supabase-js@2";
import { claim, complete, fail, tokenOk, type PullDeps } from "../_shared/smart-album-pull.ts";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store", "x-content-type-options": "nosniff" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer /, "");
  if (!(await tokenOk(token))) return json({ error: "forbidden" }, 403);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const deps: PullDeps = {
    rpc: async (fn, args) => {
      const { data, error } = await admin.rpc(fn, args);
      return { data, error: error ? { code: error.code } : null };
    },
    sign: async (bucket, paths, ttl) => {
      const { data, error } = await admin.storage.from(bucket).createSignedUrls(paths, ttl);
      if (error) throw new Error("sign");
      const out: Record<string, string> = {};
      for (const r of data ?? []) if (r.path && r.signedUrl && !r.error) out[r.path] = r.signedUrl;
      return out;
    },
  };
  const action = new URL(req.url).pathname.split("/").pop();
  try {
    if (action === "claim") return json({ job: await claim(deps) });
    const body = await req.json().catch(() => null);
    if (action === "complete") return json({ matches: await complete(deps, body) });
    if (action === "fail") return json({ status: await fail(deps, body) });
    return json({ error: "not_found" }, 404);
  } catch (e) {
    const m = e instanceof Error ? e.message : "erro";
    console.log(`smart-album-engine ${action} erro=${m}`);
    return json({ error: m === "invalid" ? "invalid" : "unavailable" }, m === "invalid" ? 400 : 503);
  }
});
