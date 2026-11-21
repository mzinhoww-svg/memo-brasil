/**
 * Primeiro toque (atribuição): na PRIMEIRA visita deste navegador guarda de onde a pessoa veio — origem, meio e campanha, na mesma
 * classificação das estatísticas de acesso (UTM manda; senão a referência; senão "direto"). Nada pessoal: sem cookie, sem id, sem
 * endereço; fica só no localStorage deste navegador e só sai daqui junto com o evento que a própria pessoa cria (gravado no evento e,
 * por ele, no pedido). Respeita o "não rastrear" do navegador. Visitas seguintes não sobrescrevem.
 */
import { browserSupabase } from "@/lib/supabase/client";
import { backendMode } from "@/lib/supabase/env";
import { classifyOrigin } from "./classify";

export const FIRST_TOUCH_KEY = "mm-origem";
export type FirstTouch = { source: string | null; medium: string | null; campaign: string | null; at: number };

const optedOut = () =>
  typeof navigator !== "undefined" && (navigator.doNotTrack === "1" || (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true);

/** Chamada a cada página: só grava se ainda não houver primeiro toque. */
export function captureFirstTouch(loc: { search: string; host: string } = window.location, ref: string = document.referrer, now = Date.now()): void {
  try {
    if (optedOut() || localStorage.getItem(FIRST_TOUCH_KEY)) return;
    const q = new URLSearchParams(loc.search);
    const o = classifyOrigin({ ref, utm_source: q.get("utm_source"), utm_medium: q.get("utm_medium"), utm_campaign: q.get("utm_campaign") }, loc.host);
    const ft: FirstTouch = { source: o.source, medium: o.medium, campaign: o.campaign, at: now };
    localStorage.setItem(FIRST_TOUCH_KEY, JSON.stringify(ft));
  } catch { /* medir é secundário */ }
}

export function readFirstTouch(): FirstTouch | null {
  try {
    const raw = localStorage.getItem(FIRST_TOUCH_KEY);
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
    const ft = readFirstTouch() ?? { source: null, medium: "direto", campaign: null, at: 0 };
    await browserSupabase().rpc("set_event_origin", { p_event: eventId, p_source: ft.source, p_medium: ft.medium, p_campaign: ft.campaign });
  } catch { /* secundário */ }
}
