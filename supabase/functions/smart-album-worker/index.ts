// Worker agendado do Smart Album. Só o service_role chama (mesmo padrão do purge-storage); o corpo não escolhe job, caminho nem motor.
// Motor: SMART_ALBUM_ENGINE=remote + SMART_ALBUM_ENGINE_URL + SMART_ALBUM_ENGINE_TOKEN (servidor próprio YuNet+SFace, services/face-engine).
// Sem essas variáveis responde 503 e não toca na fila. Os gates (chave, allowlist, parecer, versão, consentimento) continuam no banco.
import { createClient } from "npm:@supabase/supabase-js@2";
import { httpRemoteEngine, runBatch } from "../_shared/smart-album-worker.ts";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "x-content-type-options": "nosniff" } });

function iguais(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const url = Deno.env.get("SUPABASE_URL")!, service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer /, "");
  if (!token || !iguais(token, service)) return json({ error: "forbidden" }, 403);
  const mode = Deno.env.get("SMART_ALBUM_ENGINE"), engineUrl = Deno.env.get("SMART_ALBUM_ENGINE_URL"), engineToken = Deno.env.get("SMART_ALBUM_ENGINE_TOKEN");
  if (mode !== "remote" || !engineUrl?.startsWith("https://") || !engineToken || engineToken.length < 32) return json({ error: "face_engine_disabled" }, 503);

  const admin = createClient(url, service, { auth: { persistSession: false } });
  const outcomes = await runBatch({
    rpc: async (fn, args) => {
      const { data, error } = await admin.rpc(fn, args);
      return { data, error: error ? { code: error.code, message: error.message } : null };
    },
    sign: async (bucket, paths, ttl) => {
      const { data, error } = await admin.storage.from(bucket).createSignedUrls(paths, ttl);
      if (error) throw new Error("sign");
      const out: Record<string, string> = {};
      for (const r of data ?? []) if (r.path && r.signedUrl && !r.error) out[r.path] = r.signedUrl;
      return out;
    },
    remote: httpRemoteEngine(engineUrl, engineToken),
    log: (l) => console.log(l),
    maxPhotos: 3000,
    deadlineMs: 120_000,
    chunk: 40,
  }, 2);
  return json({ ok: true, jobs: outcomes.map((o) => ({ status: o.status, matches: o.matches, processed: o.processed })) });
});
