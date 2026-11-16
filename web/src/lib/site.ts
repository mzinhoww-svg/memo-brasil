/**
 * Endereço público e canônico do app (convites impressos, QR). Nunca o domínio do preview, localhost ou URL assinada:
 * o que vai para o papel precisa continuar valendo depois do deploy. `NEXT_PUBLIC_SITE_URL` permite trocar o domínio.
 */
export const DEFAULT_SITE_ORIGIN = "https://fotosdocasamento.online";

export function siteOrigin(env: string | undefined = process.env.NEXT_PUBLIC_SITE_URL): string {
  if (!env) return DEFAULT_SITE_ORIGIN;
  try {
    const u = new URL(env);
    const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(u.hostname) || u.hostname.endsWith(".local");
    // previews da Vercel têm hash no subdomínio (projeto-xxxxxxxxx-equipe.vercel.app): não servem para papel
    const preview = /\.vercel\.app$/.test(u.hostname) && u.hostname.split(".")[0].split("-").length > 2;
    if (u.protocol !== "https:" || local || preview || u.pathname !== "/" || u.search || u.username) return DEFAULT_SITE_ORIGIN;
    return u.origin;
  } catch {
    return DEFAULT_SITE_ORIGIN;
  }
}
