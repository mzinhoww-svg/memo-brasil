/* Logos oficiais do kit. Tamanhos mínimos do README: selo 16px, wordmark 96px de largura. */
const FILES = {
  wordmark: { dia: "memoriesmt-wordmark.svg", noite: "memoriesmt-wordmark-negativo.svg", ratio: 503 / 73, min: 96 },
  selo: { dia: "memoriesmt-selo.svg", noite: "memoriesmt-selo-negativo.svg", ratio: 1, min: 16 },
  "icone-app": { dia: "memoriesmt-icone-app.svg", noite: "memoriesmt-icone-app.svg", ratio: 1, min: 32 },
  "icone-app-ao-vivo": { dia: "memoriesmt-icone-app-ao-vivo.svg", noite: "memoriesmt-icone-app-ao-vivo.svg", ratio: 1, min: 32 },
} as const;

export type LogoVariant = keyof typeof FILES;

/** `size` = largura (wordmark) ou lado (demais). Valores abaixo do mínimo são elevados ao mínimo. */
export function Logo({ variant = "wordmark", size, className }: { variant?: LogoVariant; size?: number; className?: string }) {
  const f = FILES[variant];
  const w = Math.max(f.min, size ?? (variant === "wordmark" ? 140 : 40));
  const h = Math.round(w / f.ratio);
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={`mm-logo--dia ${className ?? ""}`} src={`/brand/${f.dia}`} alt="MemoriesMT" width={w} height={h} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={`mm-logo--noite ${className ?? ""}`} src={`/brand/${f.noite}`} alt="MemoriesMT" width={w} height={h} />
    </>
  );
}
