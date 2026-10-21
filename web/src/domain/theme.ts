/** Identidade do evento: dados fechados, sem CSS livre. É isto que se persiste em `event_themes`. */
export const QR_STYLES = ["classico", "pontos", "arredondado"] as const;
export type QrStyle = (typeof QR_STYLES)[number];
export const THEME_FONTS = ["birthstone", "pinyon", "vibes"] as const;
export type ThemeFont = (typeof THEME_FONTS)[number];
export const MESSAGE_MAX = 280;

export interface ThemeColors { superficie: string; grafismo: string; controle: string; texto: string; profundo: string }
export interface ThemeSpec {
  preset: string;
  colors: ThemeColors;
  font: ThemeFont;
  welcomeMessage: string;
  qrStyle: QrStyle;
}
