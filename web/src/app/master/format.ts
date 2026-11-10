/** Formatos de data e tom das tabelas do Master (fuso de Cuiabá, como no resto do console). */
import type { Tone } from "@/revela/master-kit";

const TZ = "America/Cuiaba";
const dayKey = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ });
const hm = (d: Date) => d.toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const dm = (d: Date) => d.toLocaleDateString("pt-BR", { timeZone: TZ, day: "2-digit", month: "short" }).replace(".", "");

/** "hoje 08:42", "ontem 21:55", "amanhã 18:00", "07 nov 15:41". */
export function relWhen(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const diff = Math.round((Date.parse(dayKey(d)) - Date.parse(dayKey(now))) / 86_400_000);
  if (diff === 0) return `hoje ${hm(d)}`;
  if (diff === -1) return `ontem ${hm(d)}`;
  if (diff === 1) return `amanhã ${hm(d)}`;
  return `${dm(d)} ${hm(d)}`;
}

/** "08 nov". */
export const shortDay = (iso: string | null | undefined): string => (iso ? dm(new Date(iso)) : "—");
/** "31 dez 2026". */
export const fullDay = (iso: string | null | undefined): string => (iso ? `${dm(new Date(iso))} ${new Date(iso).toLocaleDateString("pt-BR", { timeZone: TZ, year: "numeric" })}` : "—");
export const monthYear = (iso: string | null | undefined): string => (iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: TZ, month: "short", year: "numeric" }).replace(".", "").replace(" de ", " ") : "—");

/** Tom do console antigo (ok/aviso/erro/info) → tom do desenho (ok/wait/bad/info). */
export const toneOf = (t: "ok" | "aviso" | "erro" | "info"): Tone => (t === "aviso" ? "wait" : t === "erro" ? "bad" : t);

/** Método de pagamento como no desenho ("Pix", "Cartão"). */
export const methodLabel = (m: string | null | undefined): string => (m === "pix" ? "Pix" : m === "card" || m === "cartao" ? "Cartão" : m ? m : "—");

const WD = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
/** "hoje 12:00", "amanhã 18:00", "seg 10:00" (até 6 dias) ou "21 nov 10:00". */
export function revealShort(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const diff = Math.round((Date.parse(dayKey(d)) - Date.parse(dayKey(now))) / 86_400_000);
  if (diff < -1 || diff > 6) return `${dm(d)} ${hm(d)}`;
  if (diff >= -1 && diff <= 1) return relWhen(iso, now);
  return `${WD[new Date(`${dayKey(d)}T12:00:00Z`).getUTCDay()]} ${hm(d)}`;
}

export const CATEGORY: Record<string, string> = { casamento: "Casamento", aniversario: "Aniversário", formatura: "Formatura", corporativo: "Corporativo", outro: "Outro", festa: "Festa" };
export const nf = (n: number | null | undefined): string => new Intl.NumberFormat("pt-BR").format(n ?? 0);

export const pct =(n: number, max: number): number => (max > 0 ? Math.max(n > 0 ? 2 : 0, Math.round((n / max) * 100)) : 0);

/** Relógio fora dos componentes (a regra de pureza do React não aceita Date.now() no render). */
export const nowMs = (): number => Date.now();
