/** Contraste WCAG 2.x. Entradas são sempre #RRGGBB já validadas pelo chamador. */
const lin = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
export function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
}
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
const CLARO = "#FFFFFF", ESCURO = "#141211";
/** Cor de texto (branco ou quase preto) com maior contraste sobre `fundo`. */
export function onColor(fundo: string): string {
  return contrastRatio(CLARO, fundo) >= contrastRatio(ESCURO, fundo) ? CLARO : ESCURO;
}
