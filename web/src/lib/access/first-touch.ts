/**
 * Primeiro toque (atribuição): na PRIMEIRA visita deste navegador guarda de onde a pessoa veio — origem, meio e campanha, na mesma
 * classificação das estatísticas de acesso (UTM manda; senão a referência; senão "direto"). Nada pessoal: sem cookie, sem id, sem
 * endereço; fica só no localStorage deste navegador e só sai daqui junto com o evento que a própria pessoa cria (gravado no evento e,
 * por ele, no pedido). Respeita o "não rastrear" do navegador. Visitas seguintes não sobrescrevem o primeiro toque; o último toque
 * (a origem mais recente antes de criar) também vai para o evento e o pedido.
 */
import { browserSupabase } from "@/lib/supabase/client";
import { backendMode } from "@/lib/supabase/env";
import { classifyOrigin } from "./classify";

export const FIRST_TOUCH_KEY = "mm-origem";
export const LAST_TOUCH_KEY = "mm-origem-ultima";
export type FirstTouch = { source: string | null; medium: string | null; campaign: string | null; at: number };

/** Navegador interno de app (Instagram, TikTok, Facebook): costuma abrir sem referência; o user-agent diz de onde veio. */
export function inAppSource(ua: string): string | null {
  if (/Instagram/i.test(ua)) return "Instagram";
  if (/musical_ly|TikTok|BytedanceWebview|trill_/i.test(ua)) return "TikTok";
  if (/FBAN|FBAV|FB_IAB|FBIOS/i.test(ua)) return "Facebook";
  return null;
}

function classifyHere(loc: { search: string; host: string }, ref: string, ua: string, now: number): FirstTouch {
  const q = new URLSearchParams(loc.search);
  const o = classifyOrigin({ ref, utm_source: q.get("utm_source"), utm_medium: q.get("utm_medium"), utm_campaign: q.get("utm_campaign") }, loc.host);
  const app = o.medium === "direto" ? inAppSource(ua) : null;
  return app ? { source: app, medium: "social", campaign: o.campaign, at: now } : { source: o.source, medium: o.medium, campaign: o.campaign, at: now };
}

const optedOut = () =>
  typeof navigator !== "undefined" && (navigator.doNotTrack === "1" || (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true);

/**
 * Chamada a cada página. Primeiro toque: só grava se ainda não houver. Último toque: troca sempre que a entrada traz uma origem
 * (UTM, outro site ou app) — "direto" e navegação interna não apagam a última origem conhecida.
 */
export function captureFirstTouch(loc: { search: string; host: string } = window.location, ref: string = document.referrer, now = Date.now(),
  ua: string = typeof navigator !== "undefined" ? navigator.userAgent : ""): void {
  try {
    if (optedOut()) return;
    const ft = classifyHere(loc, ref, ua, now);
    if (!localStorage.getItem(FIRST_TOUCH_KEY)) localStorage.setItem(FIRST_TOUCH_KEY, JSON.stringify(ft));
    if (ft.medium !== "direto" || !localStorage.getItem(LAST_TOUCH_KEY)) localStorage.setItem(LAST_TOUCH_KEY, JSON.stringify(ft));
  } catch { /* medir é secundário */ }
}

export function readFirstTouch(key: string = FIRST_TOUCH_KEY): FirstTouch | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<FirstTouch>;
    const s = (x: unknown, max: number) => (typeof x === "string" && x.trim() ? x.trim().slice(0, max) : null);
    return { source: s(v.source, 80), medium: s(v.medium, 40), campaign: s(v.campaign, 60), at: typeof v.at === "number" ? v.at : 0 };
  } catch { return null; }
}

/** Grava a origem no evento recém-criado (só o anfitrião, só uma vez). Falha em silêncio: não atrapalha a criação. */
export async function recordEventOrigin(eventId: string): Promise<void> {
  try {
    if (backendMode() !== "supabase") return;
    const none = { source: null, medium: "direto", campaign: null, at: 0 };
    const ft = readFirstTouch() ?? none;
    const lt = readFirstTouch(LAST_TOUCH_KEY) ?? ft;
    await browserSupabase().rpc("set_event_origin", {
      p_event: eventId, p_source: ft.source, p_medium: ft.medium, p_campaign: ft.campaign,
      p_last_source: lt.source, p_last_medium: lt.medium, p_last_campaign: lt.campaign,
    });
  } catch { /* secundário */ }
}
