// Confirma o envio de logo/capa DEPOIS de inspecionar o arquivo real (assinatura, tipo e dimensões). O cliente não consegue finalizar sozinho:
// `finalize_asset` foi revogado e `mark_asset_validated` só é executável pelo service_role (esta função).
import { createClient } from "npm:@supabase/supabase-js@2";
import { sniffImage, validateSniffed, type AssetKind } from "../_shared/image-sniff.ts";
import { corsHeaders } from "../_shared/cors.ts";

const extraOrigins = Deno.env.get("ALLOWED_ORIGINS") ?? "";
const reply = (req: Request) => (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(req.headers.get("origin"), extraOrigins), "content-type": "application/json", "x-content-type-options": "nosniff" } });

Deno.serve(async (req) => {
  const json = reply(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req.headers.get("origin"), extraOrigins) }); // preflight do navegador
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const url = Deno.env.get("SUPABASE_URL")!, anon = Deno.env.get("SUPABASE_ANON_KEY")!, service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

  // quem chama: sessão real do Supabase Auth (nada vem do corpo da requisição além do id do ativo)
  const user = createClient(url, anon, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: u, error: ue } = await user.auth.getUser();
  if (ue || !u.user || u.user.is_anonymous) return json({ error: "unauthorized" }, 401);
  let assetId = "";
  try { assetId = String(((await req.json()) as { assetId?: string }).assetId ?? ""); } catch { return json({ error: "invalid" }, 400); }
  if (!/^[0-9a-f-]{36}$/i.test(assetId)) return json({ error: "invalid" }, 400);

  const admin = createClient(url, service, { auth: { persistSession: false } });
  const { data: a } = await admin.from("event_assets").select("id,event_id,kind,mime,storage_path,created_by,upload_status").eq("id", assetId).maybeSingle();
  if (!a || a.created_by !== u.user.id) return json({ error: "forbidden" }, 403);
  if (a.upload_status === "pronta") return json({ ok: true });
  // trava o ativo: enquanto valida, o cliente não consegue trocar nem apagar o objeto (fecha o TOCTOU)
  const lock = await admin.rpc("begin_asset_validation", { p_id: a.id, p_user: u.user.id });
  if (lock.error) return json({ error: lock.error.code === "MM009" ? "busy" : "forbidden" }, lock.error.code === "MM009" ? 409 : 403);
  if (lock.data === false) return json({ ok: true });

  const dl = await admin.storage.from("event-branding").download(a.storage_path);
  if (dl.error || !dl.data) return json({ error: "missing" }, 422);
  const bytes = new Uint8Array(await dl.data.arrayBuffer());
  const verdict = validateSniffed(a.kind as AssetKind, bytes.length, sniffImage(bytes), a.mime);
  if (!verdict.ok) {
    // arquivo recusado: remove o objeto e a linha (nada de lixo no Storage)
    await admin.storage.from("event-branding").remove([a.storage_path]);
    await admin.from("event_assets").delete().eq("id", a.id);
    return json({ error: "rejected", reason: verdict.reason }, 422);
  }
  const r = await admin.rpc("mark_asset_validated", { p_id: a.id, p_user: u.user.id, p_width: verdict.width, p_height: verdict.height, p_bytes: bytes.length, p_mime: verdict.mime });
  if (r.error) return json({ error: "state" }, 409); // sem repassar texto do Postgres
  return json({ ok: true, width: verdict.width, height: verdict.height });
});
