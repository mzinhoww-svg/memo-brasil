import { inviteUrl } from "./links";

/** Compartilha o convite do evento (folha do aparelho) ou, sem ela, copia. Nunca diz "copiado" sem ter copiado. */
export async function shareInvite(event: { title: string; code: string }, origin: string, table?: string): Promise<"compartilhado" | "copiado" | "falhou"> {
  const link = inviteUrl(origin, event.code, table);
  const text = `Você foi convidado para "${event.title}" no Revela. Entre com o código ${event.code} ou pelo link: ${link}`;
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ title: event.title, text });
      return "compartilhado";
    } catch {
      /* cancelado: cai para copiar */
    }
  }
  return (await copyText(text)) ? "copiado" : "falhou";
}

export async function copyText(value: string): Promise<boolean> {
  try {
    if (typeof navigator === "undefined" || !navigator.clipboard) return false;
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}
