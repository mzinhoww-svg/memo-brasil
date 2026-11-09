/* Logos oficiais do Revela 2.0. Mínimos do brandkit: símbolo 24px, lockup 88px de largura. */
const FILES = {
  wordmark: { file: "revela-wordmark-paper.svg", ratio: 2802 / 804, min: 88 },
  selo: { file: "revela-mark.svg", ratio: 1, min: 24 },
  lockup: { file: "revela-lockup-dark.svg", ratio: 221.4 / 64, min: 88 },
  "icone-app": { file: "revela-app-icon.svg", ratio: 1, min: 32 },
} as const;

export type LogoVariant = keyof typeof FILES;

/** `size` = largura (wordmark e lockup) ou lado (demais). Valores abaixo do mínimo são elevados ao mínimo. */
export function Logo({ variant = "wordmark", size, className }: { variant?: LogoVariant; size?: number; className?: string }) {
  const f = FILES[variant];
  const w = Math.max(f.min, size ?? (variant === "wordmark" || variant === "lockup" ? 132 : 40));
  const h = Math.round(w / f.ratio);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img className={className} src={`/revela/logos/${f.file}`} alt="Revela" width={w} height={h} />
  );
}
