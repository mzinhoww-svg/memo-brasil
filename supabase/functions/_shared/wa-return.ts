// Troca do token de volta (link do bot) por uma sessão do MESMO convidado (lógica pura; a cola Deno fica em whatsapp-return/index.ts).
// O token nunca é registrado: só o SHA-256 vai ao banco e o log é {fn, outcome}.
import { RETURN_TOKEN_RE, sha256Hex } from "./wa-optin.ts";

export type ReturnStatus = "ok" | "used" | "expired" | "invalid" | "blocked";
export type Consumed = { status: ReturnStatus; userId?: string; code?: string; title?: string };
export type ReturnDeps = {
  /** usuário da sessão atual do navegador (se houver) */
  callerUserId: string | null;
  consume: (tokenHash: string) => Promise<Consumed>;
  getUser: (id: string) => Promise<{ email: string | null; isAnonymous: boolean } | null>;
  setTechnicalEmail: (id: string, email: string) => Promise<void>;
  restoreAnonymous: (id: string) => Promise<boolean>;
  /** link mágico emitido pela API admin: devolve só o token_hash (o cliente troca por sessão com verifyOtp) */
  magicLink: (email: string) => Promise<string>;
};
export type ReturnResult = { status: number; body: Record<string, unknown> };

/** E-mail técnico de quem não tem e-mail (convidado anônimo). Domínio .invalid: nunca recebe mensagem e nunca aparece na tela. */
export const technicalEmail = (userId: string) => `wa-${userId}@retorno.invalid`;
export const isTechnicalEmail = (email: string | null | undefined) => typeof email === "string" && /@retorno\.invalid$/i.test(email);

export async function handleReturn(input: { token?: unknown }, d: ReturnDeps): Promise<ReturnResult> {
  const token = typeof input.token === "string" ? input.token : "";
  if (!RETURN_TOKEN_RE.test(token)) return { status: 200, body: { status: "invalid" } };
  const c = await d.consume(await sha256Hex(token));
  const meta = { ...(c.code ? { code: c.code } : {}), ...(c.title ? { title: c.title } : {}) };
  if (c.status !== "ok" || !c.userId) return { status: 200, body: { status: c.status === "ok" ? "invalid" : c.status, ...meta } };
  // o navegador já está com a sessão desse convidado: só volta
  if (d.callerUserId && d.callerUserId === c.userId) return { status: 200, body: { status: "ok", same: true, ...meta } };

  const u = await d.getUser(c.userId);
  if (!u) return { status: 200, body: { status: "invalid", ...meta } };
  let email = u.email;
  if (!email) {
    email = technicalEmail(c.userId);
    await d.setTechnicalEmail(c.userId, email);
    if (u.isAnonymous && !(await d.restoreAnonymous(c.userId))) throw new Error("restore");
  }
  const tokenHash = await d.magicLink(email);
  return { status: 200, body: { status: "ok", tokenHash, ...meta } };
}
