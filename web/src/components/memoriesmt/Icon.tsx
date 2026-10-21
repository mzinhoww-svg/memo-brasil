import { ICONS, type IconName } from "./icon-data";

export type { IconName };

type Props = { name: IconName; size?: number; strokeWidth?: number; className?: string } & ({ label: string; decorative?: never } | { decorative: true; label?: never });

/** Ícone do kit (traço 2px, 24px de grade). Ícone sozinho exige `label`; dentro de botão com texto use `decorative`. */
export function Icon({ name, size = 24, strokeWidth = 2, className, label, decorative }: Props) {
  const def = ICONS[name];
  const common = { xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 24 24", width: size, height: size, className, ...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": label }) };
  return def.filled ? (
    <svg {...common} fill="currentColor" dangerouslySetInnerHTML={{ __html: def.body }} />
  ) : (
    <svg {...common} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: def.body }} />
  );
}
