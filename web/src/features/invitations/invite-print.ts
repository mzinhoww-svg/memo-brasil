import type { MemoEvent } from "@/domain/event";
import { computeRevealStatus } from "@/domain/reveal";
import { PALETTES } from "@/lib/event-theme";
import { contrastRatio } from "@/lib/event-theme/contrast";
import { qrDarkColor } from "@/lib/event-theme/spec";
import { plural } from "@/lib/plural";
import { siteOrigin } from "@/lib/site";
import { inviteUrl } from "./links";

/** Tudo o que vai impresso no convite A5. Vem do evento (limites efetivos já gravados pelo servidor), nunca de constantes. */
export interface PrintInvite {
  title: string;
  tagline: string;
  steps: [string, string, string];
  noApp: string;
  shots: string;
  reveal: string;
  code: string;
  /** Endereço digitável, sem protocolo: "newmemocuiaba.vercel.app/entrar". */
  altAddress: string;
  /** Conteúdo do QR: a URL canônica do convite (`/e/<código>`), que é o mesmo destino de digitar o código em /entrar. */
  qrText: string;
  /** Cor do QR (≥ 7:1 sobre branco) e do destaque (≥ 4,5:1), da identidade do evento quando legível. */
  qrColor: string;
  accent: string;
  fileName: string;
}

const INK = "#1C1917";
const HEX = /^#[0-9A-Fa-f]{6}$/;

/** Data e hora da revelação no fuso do evento, por extenso para papel ("sábado, 25 de outubro, às 22h"). Nada de "hoje"/"amanhã": o convite é impresso antes. */
export function revealPhrase(at: number, tz: string): string {
  const parts = new Intl.DateTimeFormat("pt-BR", { timeZone: tz, weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(at));
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const h = Number(g("hour"));
  const m = g("minute");
  return `${g("weekday")}, ${Number(g("day"))} de ${g("month")}, às ${m === "00" ? `${h}h` : `${h}h${m}`}`;
}

function accentFor(e: Pick<MemoEvent, "theme" | "palette">): string {
  const c = e.theme?.colors.profundo ?? PALETTES[e.palette]?.dia.profundo;
  return c && HEX.test(c) && contrastRatio(c, "#FFFFFF") >= 4.5 ? c.toUpperCase() : INK;
}

/** Nome de arquivo legível e seguro: "convite-ana-e-rui.pdf" (sem acento, espaço ou caractere de caminho). */
export function inviteFileName(title: string): string {
  const slug = title.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/&/g, " e ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).replace(/-+$/, "");
  return `convite-${slug || "evento"}.pdf`;
}

export function printInvite(e: MemoEvent, now: number, origin: string = siteOrigin()): PrintInvite {
  const shots = e.shotsPerPerson === null ? "Fotos sem limite por pessoa." : `Cada pessoa tem ${e.shotsPerPerson} ${plural(e.shotsPerPerson, "foto", "fotos")}.`;
  const status = computeRevealStatus(e, now);
  let reveal: string;
  if (!e.everyoneSeesAll) reveal = `As fotos ficam com ${e.hostName}.`;
  else if (status === "desativada" || status === "revelada") reveal = "As fotos aparecem para todos na hora.";
  else if (e.revealAt === null) reveal = "As fotos aparecem para todos quando a festa terminar.";
  else {
    const when = revealPhrase(e.revealAt, e.timezone);
    reveal = `As fotos aparecem para todos ${when.split(",")[0].endsWith("feira") ? "na" : "no"} ${when}.`;
  }
  const host = new URL(origin).host;
  return {
    title: e.title.trim(),
    tagline: "A festa também acontece pelo seu olhar.",
    steps: ["Escaneie o QR Code.", "Entre com seu nome.", "Fotografe e compartilhe."],
    noApp: "Sem baixar aplicativo.",
    shots,
    reveal,
    code: e.code,
    altAddress: `${host}/entrar`,
    qrText: inviteUrl(origin, e.code),
    qrColor: qrDarkColor(e.theme),
    accent: accentFor(e),
    fileName: inviteFileName(e.title),
  };
}
