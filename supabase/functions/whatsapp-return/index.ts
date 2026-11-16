// Link de volta do bot (/e/<código>/voltar?r=<token>): troca o token de uso único por uma sessão do mesmo convidado.
// verify_jwt desligado: quem chama costuma estar SEM sessão (navegador do WhatsApp). A prova é o próprio token (32 bytes, 2 h, uso único).
// Nunca registra o token, o e-mail técnico nem o link mágico: o log é só {fn, outcome}.
import { handleReturn } from "../_shared/wa-return.ts";
import { adminClient, corsPreflight, corsResponder, logWa, userClient } from "../_shared/wa-runtime.ts";

const FN = "whatsapp-return";

Deno.serve(async (req) => {
  const json = corsResponder(req);
  if (req.method === "OPTIONS") return corsPreflight(req);
  if (req.method !== "POST") return json({ error: "method" }, 405);

  let callerUserId: string | null = null;
  const auth = req.headers.get("Authorization") ?? "";
  if (auth.startsWith("Bearer ")) {
    const { data } = await userClient(auth).auth.getUser().catch(() => ({ data: { user: null } }));
    callerUserId = data.user?.id ?? null;
  }
  let body: Record<string, unknown> = {};
  try { body = (await req.json()) as Record<string, unknown>; } catch { return json({ error: "invalid" }, 400); }

  const admin = adminClient();
  try {
    const r = await handleReturn({ token: body.token }, {
      callerUserId,
      consume: async (tokenHash) => {
        const { data, error } = await admin.rpc("whatsapp_consume_return_token", { p_hash: tokenHash });
        if (error) throw new Error("consume");
        return (data ?? { status: "invalid" }) as { status: "ok" | "used" | "expired" | "invalid" | "blocked"; userId?: string; code?: string; title?: string };
      },
      getUser: async (id) => {
        const { data, error } = await admin.auth.admin.getUserById(id);
        if (error || !data.user) return null;
        return { email: data.user.email ?? null, isAnonymous: data.user.is_anonymous === true };
      },
      setTechnicalEmail: async (id, email) => {
        const { error } = await admin.auth.admin.updateUserById(id, { email, email_confirm: true });
        if (error) throw new Error("email");
      },
      restoreAnonymous: async (id) => {
        const { data, error } = await admin.rpc("whatsapp_restore_anonymous", { p_user: id });
        if (error) throw new Error("anon");
        return data === true;
      },
      magicLink: async (email) => {
        const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
        const hash = data?.properties?.hashed_token;
        if (error || !hash) throw new Error("link");
        return hash;
      },
    });
    logWa(FN, String(r.body.status));
    return json(r.body, r.status);
  } catch {
    logWa(FN, "erro");
    return json({ error: "indisponivel" }, 503);
  }
});
