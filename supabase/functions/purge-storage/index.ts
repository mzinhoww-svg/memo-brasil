// Worker de purga: esvazia `storage_purge_queue` removendo os objetos do bucket certo e só então apagando a linha da fila.
// Só o service_role (agendador) chama; o corpo da requisição não escolhe caminho nem bucket.
import { createClient } from "npm:@supabase/supabase-js@2";

const BUCKETS = new Set(["event-photos", "event-branding"]);
const LOTE = 100;
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

  const admin = createClient(url, service, { auth: { persistSession: false } });
  const { data: fila, error } = await admin.from("storage_purge_queue").select("path,bucket").order("queued_at").limit(LOTE);
  if (error) return json({ error: "queue" }, 500);

  let removidos = 0, falhas = 0;
  for (const bucket of BUCKETS) {
    const paths = (fila ?? []).filter((r) => r.bucket === bucket).map((r) => r.path as string);
    if (!paths.length) continue;
    const rm = await admin.storage.from(bucket).remove(paths); // remover objeto inexistente não é erro
    if (rm.error) { falhas += paths.length; continue; } // mantém na fila para a próxima rodada
    const del = await admin.from("storage_purge_queue").delete().eq("bucket", bucket).in("path", paths);
    if (del.error) falhas += paths.length; else removidos += paths.length;
  }
  return json({ ok: falhas === 0, removidos, falhas, restante: Math.max(0, (fila?.length ?? 0) - removidos) });
});
