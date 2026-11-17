/** Estatísticas de acesso (sem cookies, sem IP): normalização do caminho, origem do tráfego e aparelho. Tudo puro e testável. */

/** Áreas que nunca entram na medição (operação, ferramentas de desenvolvimento e o próprio coletor). */
const IGNORED = /^\/(master|dev|api|_next|auth)(\/|$)/;

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/**
 * Caminho sem query nem hash e sem identificadores: o código de convite (/e/ABCD2345), ids (UUID), códigos de presente (/c/...) e
 * tokens de /email/sair viram marcadores. Devolve `null` quando a página não deve ser medida.
 */
export function normalizePath(raw: string): string | null {
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//")) return null;
  let p = raw.split("#")[0].split("?")[0];
  try { p = decodeURIComponent(p); } catch { return null; }
  p = p.replace(UUID, ":id").replace(/\/+$/, "") || "/";
  if (IGNORED.test(p)) return null;
  p = p.replace(/^\/e\/[A-Za-z0-9]{6,12}(?=\/|$)/, "/e/:codigo").replace(/^\/c\/[^/]+/, "/c/:codigo").replace(/^\/email\/sair.*/, "/email/sair");
  p = p.replace(/[^A-Za-z0-9/_:.-]/g, "").slice(0, 120);
  return /^\/[A-Za-z0-9/_:.-]{0,119}$/.test(p) ? p : null;
}

export interface Origin { source: string | null; medium: string | null; campaign: string | null; refHost: string | null }

const SOCIAL: [RegExp, string][] = [
  [/(^|\.)instagram\.com$|(^|\.)l\.instagram\.com$/, "Instagram"],
  [/(^|\.)facebook\.com$|(^|\.)fb\.com$|(^|\.)l\.facebook\.com$|(^|\.)lm\.facebook\.com$/, "Facebook"],
  [/(^|\.)whatsapp\.com$|^wa\.me$|(^|\.)api\.whatsapp\.com$/, "WhatsApp"],
  [/(^|\.)youtube\.com$|^youtu\.be$/, "YouTube"],
  [/(^|\.)tiktok\.com$/, "TikTok"],
  [/(^|\.)t\.co$|(^|\.)twitter\.com$|(^|\.)x\.com$/, "X (Twitter)"],
  [/(^|\.)linkedin\.com$|^lnkd\.in$/, "LinkedIn"],
  [/(^|\.)pinterest\.[a-z.]+$/, "Pinterest"],
  [/(^|\.)t\.me$|(^|\.)telegram\.org$/, "Telegram"],
];
const SEARCH: [RegExp, string][] = [
  [/(^|\.)google\.[a-z.]+$/, "Google"], [/(^|\.)bing\.com$/, "Bing"], [/(^|\.)duckduckgo\.com$/, "DuckDuckGo"],
  [/(^|\.)yahoo\.com$/, "Yahoo"], [/(^|\.)ecosia\.org$/, "Ecosia"], [/(^|\.)brave\.com$/, "Brave"],
];
const MAIL = /(^|\.)mail\.google\.com$|(^|\.)outlook\.(live|office)\.com$|(^|\.)mail\.yahoo\.com$/;

const clean = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const s = v.trim().replace(/[\u0000-\u001f<>]/g, "").slice(0, max);
  return s || null;
};

/** Host da referência (sem www), ou null se vazio/inválido/do próprio site. */
export function refHostOf(ref: unknown, selfHost: string): string | null {
  if (typeof ref !== "string" || !ref) return null;
  try {
    const h = new URL(ref).hostname.toLowerCase().replace(/^www\./, "");
    const own = selfHost.toLowerCase().replace(/^www\./, "").split(":")[0];
    if (!h || h === own || h.endsWith(`.${own}`)) return null;
    return h.slice(0, 80);
  } catch { return null; }
}

/** Origem da entrada: UTM manda; senão a referência (rede social, buscador, e-mail, outro site); senão "Direto". */
export function classifyOrigin(input: { ref?: unknown; utm_source?: unknown; utm_medium?: unknown; utm_campaign?: unknown }, selfHost: string): Origin {
  const campaign = clean(input.utm_campaign, 60);
  const us = clean(input.utm_source, 40);
  const um = clean(input.utm_medium, 40)?.toLowerCase() ?? null;
  const refHost = refHostOf(input.ref, selfHost);
  if (us) {
    const known = [...SOCIAL, ...SEARCH].find(([re]) => re.test(us.toLowerCase().replace(/\s+/g, "") + ".com"))?.[1];
    const pretty = known ?? (us.length <= 3 ? us.toUpperCase() : us[0].toUpperCase() + us.slice(1));
    const medium = um === "email" || um === "e-mail" ? "e-mail" : um && /cpc|ppc|paid|ads?/.test(um) ? "pago" : um && /social/.test(um) ? "social" : um ?? "campanha";
    return { source: pretty, medium, campaign, refHost };
  }
  if (!refHost) return { source: null, medium: "direto", campaign, refHost: null };
  const social = SOCIAL.find(([re]) => re.test(refHost));
  if (social) return { source: social[1], medium: "social", campaign, refHost };
  if (MAIL.test(refHost)) return { source: "E-mail", medium: "e-mail", campaign, refHost }; // antes dos buscadores: mail.google.com não é busca
  const search = SEARCH.find(([re]) => re.test(refHost));
  if (search) return { source: search[1], medium: "orgânico", campaign, refHost };
  return { source: refHost, medium: "referência", campaign, refHost };
}

export interface Agent { device: "celular" | "tablet" | "computador"; browser: string; os: string; bot: boolean }

const BOT = /bot|crawl|spider|slurp|facebookexternalhit|whatsapp\/|preview|lighthouse|headless|curl|wget|python-requests|httpclient|monitor|uptime|pingdom|go-http|node-fetch|axios|vercel/i;

/** Aparelho, navegador e sistema por uma leitura simples do user-agent (o texto do user-agent nunca é guardado). */
export function parseAgent(ua: string | null | undefined): Agent {
  const u = ua ?? "";
  const bot = !u || BOT.test(u);
  const tablet = /iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(u);
  const mobile = /Mobi|iPhone|iPod|Android.*Mobile|Windows Phone/i.test(u);
  const device = tablet ? "tablet" : mobile ? "celular" : "computador";
  const os = /iPhone|iPad|iPod/.test(u) ? "iOS" : /Android/.test(u) ? "Android" : /Windows/.test(u) ? "Windows" : /Mac OS X|Macintosh/.test(u) ? "macOS" : /CrOS/.test(u) ? "ChromeOS" : /Linux/.test(u) ? "Linux" : "Outro";
  const browser = /Edg\//.test(u) ? "Edge" : /OPR\/|Opera/.test(u) ? "Opera" : /SamsungBrowser/.test(u) ? "Samsung" : /FxiOS|Firefox/.test(u) ? "Firefox" : /CriOS|Chrome\//.test(u) ? "Chrome" : /Safari\//.test(u) ? "Safari" : "Outro";
  return { device, browser, os, bot };
}
