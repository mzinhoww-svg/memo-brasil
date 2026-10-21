import { PALETTES, type EventColors, EVENT_FONT_VAR } from "@/lib/event-theme";
import { MESSAGE_MAX, QR_STYLES, THEME_FONTS, type ThemeSpec } from "@/domain/theme";
import { contrastRatio, onColor } from "./contrast";

export { MESSAGE_MAX, QR_STYLES, THEME_FONTS };
export type { ThemeSpec, QrStyle, ThemeFont } from "@/domain/theme";

const HEX = /^#[0-9A-Fa-f]{6}$/;
const COLOR_KEYS = ["superficie", "grafismo", "controle", "texto", "profundo"] as const;

/** Os presets são as paletas da v1 (mesma fonte de dados dos testes de contraste). */
export const PRESETS: Record<string, { label: string; dia: EventColors; noite: EventColors }> = PALETTES;

/** Regras de contraste, iguais às do CHECK `event_themes_colors_contrast`: texto e profundo ≥ 4.5 sobre a superfície; rótulo do controle ≥ 3. */
export function validateTheme(t: ThemeSpec): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  for (const k of COLOR_KEYS) if (!HEX.test(t.colors?.[k] ?? "")) errors.push(`cor ${k} inválida (use #RRGGBB)`);
  if (!THEME_FONTS.includes(t.font)) errors.push("fonte fora da lista");
  if (!QR_STYLES.includes(t.qrStyle)) errors.push("estilo de QR desconhecido");
  if (typeof t.welcomeMessage !== "string" || t.welcomeMessage.length > MESSAGE_MAX) errors.push(`mensagem acima de ${MESSAGE_MAX} caracteres`);
  else if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(t.welcomeMessage)) errors.push("mensagem com caracteres de controle");
  if (errors.length === 0) {
    const c = t.colors;
    if (contrastRatio(c.texto, c.superficie) < 4.5) errors.push("texto sem contraste mínimo 4.5:1 sobre a superfície");
    if (contrastRatio(c.profundo, c.superficie) < 4.5) errors.push("cor profunda sem contraste mínimo 4.5:1 sobre a superfície");
    if (contrastRatio(onColor(c.controle), c.controle) < 3) errors.push("controle sem contraste mínimo 3:1 para o rótulo");
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Variáveis CSS do evento para o `style` do wrapper. Só chaves `--evento-*`, `--on-evento` e `--font-evento`;
 * lança se a entrada não for válida, então nada livre chega ao DOM.
 */
export function themeStyle(t: ThemeSpec, _modo: "dia" | "noite"): Record<string, string> {
  void _modo;
  const v = validateTheme(t);
  if (!v.ok) throw new Error(`tema inválido: ${v.errors.join("; ")}`);
  const o: Record<string, string> = {};
  for (const k of COLOR_KEYS) o[`--evento-${k}`] = t.colors[k].toUpperCase();
  o["--on-evento"] = onColor(t.colors.controle);
  o["--font-evento"] = `var(${EVENT_FONT_VAR[t.font]}), cursive`;
  return o;
}

const QR_PADRAO = "#1C1917";
/** O QR precisa ser lido por câmeras: só adota a cor do tema se tiver contraste ≥ 7:1 sobre o branco. */
export function qrDarkColor(t: ThemeSpec | undefined): string {
  const c = t?.colors.profundo;
  return c && /^#[0-9A-Fa-f]{6}$/.test(c) && contrastRatio(c, "#FFFFFF") >= 7 ? c.toUpperCase() : QR_PADRAO;
}

const fmt = (n: number) => n.toFixed(1).replace(".", ",");
/** Problemas de contraste por cor, para marcar o campo certo (mesmos limites de validateTheme). */
export function colorIssues(c: ThemeSpec["colors"]): Partial<Record<"texto" | "profundo" | "controle", string>> {
  const out: Partial<Record<"texto" | "profundo" | "controle", string>> = {};
  if (!Object.values(c).every((v) => HEX.test(v ?? ""))) return out;
  const t = contrastRatio(c.texto, c.superficie); if (t < 4.5) out.texto = `contraste ${fmt(t)}:1 sobre o fundo (mínimo 4,5:1)`;
  const p = contrastRatio(c.profundo, c.superficie); if (p < 4.5) out.profundo = `contraste ${fmt(p)}:1 sobre o fundo (mínimo 4,5:1)`;
  const k = contrastRatio(onColor(c.controle), c.controle); if (k < 3) out.controle = `rótulo com contraste ${fmt(k)}:1 (mínimo 3:1)`;
  return out;
}
