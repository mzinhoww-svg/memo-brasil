// Worker agendado do Smart Album. Só o service_role chama (mesmo padrão do purge-storage); o corpo não escolhe job, caminho nem motor.
// DESLIGADO: sem motor aprovado, `SMART_ALBUM_ENGINE` não está definido e a função responde 503 sem tocar na fila.
// Ligar exige (doc 07-release-gates.md): gate jurídico + motor com licença/DPA + benchmark + implementação do adaptador abaixo.
import { createClient } from "npm:@supabase/supabase-js@2";
import { DisabledFaceEngine, type FaceEngine } from "../_shared/face-engine.ts";
import { runBatch } from "../_shared/smart-album-worker.ts";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "x-content-type-options": "nosniff" } });

function iguais(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/** Ponto único de escolha do motor. Nenhum adaptador real existe nesta entrega: qualquer valor cai no motor desligado. */
function engineFromEnv(): FaceEngine | null {
  const name = Deno.env.get("SMART_ALBUM_ENGINE");
  if (!name) return null;
  return new DisabledFaceEngine();
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const url = Deno.env.get("SUPABASE_URL")!, service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer /, "");
  if (!token || !iguais(token, service)) return json({ error: "forbidden" }, 403);
  const engine = engineFromEnv();
  if (!engine || engine.version === "disabled") return json({ error: "face_engine_disabled" }, 503);

  const admin = createClient(url, service, { auth: { persistSession: false } });
  const outcomes = await runBatch({
    rpc: async (fn, args) => {
      const { data, error } = await admin.rpc(fn, args);
      return { data, error: error ? { code: error.code, message: error.message } : null };
    },
    download: async (bucket, path) => {
      const { data, error } = await admin.storage.from(bucket).download(path);
      if (error || !data) return null;
      return new Uint8Array(await data.arrayBuffer());
    },
    engine,
    log: (l) => console.log(l),
    maxPhotos: 3000,
    deadlineMs: 120_000,
  }, 3);
  return json({ ok: true, jobs: outcomes.map((o) => ({ status: o.status, matches: o.matches, processed: o.processed })) });
});
