/** Formatação e validação puras da tela de códigos de cortesia (M3) do console master. */

export const NOTE_MIN = 3;
export const NOTE_MAX = 200;
export const USES_MAX = 1000;

type Tone = "ok" | "aviso" | "erro" | "info";
export type CodeStatus = "ativo" | "usado" | "expirado" | "revogado";

/** "MMT-7KQ4" → "MMT-7KQ4-…": depois de gerado, o código só aparece pelo começo. */
export const hintText = (hint: string) => `${hint}-…`;

export const usesText = (uses: number, maxUses: number) => `${uses} de ${maxUses}`;

const STATUS: Record<CodeStatus, Tone> = { ativo: "ok", usado: "info", expirado: "info", revogado: "erro" };
export function codeStatus(s: string): { label: string; tone: Tone } {
  return { label: s, tone: STATUS[s as CodeStatus] ?? "info" };
}

/** Cuiabá é UTC-4 o ano todo. */
const CUIABA_OFFSET_MS = -4 * 3_600_000;

/** Hoje + 30 dias, em AAAA-MM-DD no fuso de Cuiabá (valor do campo de data). */
export function defaultExpiry(now: Date = new Date()): string {
  return new Date(now.getTime() + CUIABA_OFFSET_MS + 30 * 86_400_000).toISOString().slice(0, 10);
}

/** AAAA-MM-DD → fim desse dia em Cuiabá (o código vale o dia inteiro); formato inválido → null. */
export function expiryIso(date: string): string | null {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) ? `${date}T23:59:59-04:00` : null;
}

/** Quantidade de eventos digitada em "Outro": inteiro de 1 a 1000; inválido → null. */
export function parseUses(text: string): number | null {
  const s = text.trim();
  if (!/^\d{1,4}$/.test(s)) return null;
  const n = Number(s);
  return n >= 1 && n <= USES_MAX ? n : null;
}

/** Nota obrigatória (o servidor confere de novo, MM005) ou null quando válida. */
export function noteError(note: string): string | null {
  const n = note.trim().length;
  if (n < NOTE_MIN) return `Escreva para quem é o código, com pelo menos ${NOTE_MIN} caracteres.`;
  if (n > NOTE_MAX) return `A nota pode ter no máximo ${NOTE_MAX} caracteres.`;
  return null;
}

/** Link de resgate: {origin}/c/{código}. */
export function codeLink(origin: string, code: string): string {
  return `${origin.replace(/\/+$/, "")}/c/${code}`;
}
