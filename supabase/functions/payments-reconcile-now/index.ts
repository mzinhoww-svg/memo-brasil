// "Conciliar agora" do Master (M05). verify_jwt=true; quem decide é o BANCO: admin_request_reconcile exige Master + aal2 e limita a
// uma por minuto, e grava a auditoria. Só depois esta função chama payments-validapay-reconcile com o token que existe apenas no servidor
// (nunca vai ao navegador). Sem o token (ou com a ValidaPay desligada) devolve "indisponivel": a rotina do agendador segue conciliando.
import { caller, log, preflight, responder } from "../_shared/payments-runtime.ts";
import { validapaySecret } from "../_shared/validapay-runtime.ts";

const FN = "payments-reconcile-now";

Deno.serve(async (req) => {
  const json = responder(req, true);
  if (req.method === "OPTIONS") return preflight(req);
  if (req.method !== "POST") return json({ error: "method" }, 405);

  const who = await caller(req);
  if (!who.ok) return json({ error: who.status === 401 ? "unauthorized" : "forbidden" }, who.status);
  const asked = await who.client.rpc("admin_request_reconcile");
  if (asked.error) {
    const code = asked.error.code;
    if (code === "MM016") return json({ error: "stepup" }, 403);
    if (code === "MM006") return json({ error: "ratelimited" }, 429);
    return json({ error: code === "MM004" ? "forbidden" : "indisponivel" }, code === "MM004" ? 403 : 503);
  }

  const token = validapaySecret("RECONCILE_TOKEN");
  if (!token) {
    log(FN, null, null, "sem_token");
    return json({ error: "indisponivel" }, 503);
  }
  try {
    const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/payments-validapay-reconcile`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: "{}",
    });
    if (!res.ok) {
      log(FN, null, String(res.status), "falhou");
      return json({ error: "indisponivel" }, 503);
    }
    const out = (await res.json()) as { confirmed?: number; failed?: number; unchanged?: number; unattached?: number; failures?: { label?: string; message?: string }[] };
    log(FN, null, null, "ok");
    const failures = (out.failures ?? []).slice(0, 20).map((f) => ({ label: String(f.label ?? ""), message: String(f.message ?? "") }));
    return json({ ok: true, confirmed: out.confirmed ?? 0, failed: out.failed ?? 0, unchanged: out.unchanged ?? 0, unattached: out.unattached ?? 0, failures });
  } catch {
    log(FN, null, null, "erro_rede");
    return json({ error: "indisponivel" }, 503);
  }
});
