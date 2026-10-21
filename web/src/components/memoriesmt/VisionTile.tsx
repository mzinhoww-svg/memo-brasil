import Link from "next/link";
import type { CSSProperties } from "react";

/** Miniatura de uma visão: foto de capa com o nome no rodapé. Link (`href`) ou filtro (`onSelect`). */
export function VisionTile({ href, onSelect, pressed, name, imageSrc }: { href?: string; onSelect?: () => void; pressed?: boolean; name: string; imageSrc?: string }) {
  const style: CSSProperties | undefined = imageSrc ? { backgroundImage: `url(${imageSrc})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined;
  const label = <span style={imageSrc ? { background: "var(--fundo)", color: "var(--tinta)", padding: "4px 8px", borderRadius: "var(--radius-pill)" } : undefined}>{name}</span>;
  if (href) return <Link className="mm-vision" href={href} style={style}>{label}</Link>;
  return (
    <button type="button" className="mm-vision" aria-pressed={pressed ?? false} onClick={onSelect} style={{ ...style, border: pressed ? "2px solid var(--tinta)" : 0, font: "inherit", textAlign: "left", cursor: "pointer" }}>
      {label}
    </button>
  );
}
export function VisionGrid({ children }: { children: React.ReactNode }) {
  return <div className="mm-visions">{children}</div>;
}
