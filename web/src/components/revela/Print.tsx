import type { ReactNode } from "react";

/** Foto impressa: papel com borda, sombra de objeto e, se houver, carimbo de data em laranja. */
export function Print({ children, caption, stamp, back, style, className }: { children?: ReactNode; caption?: ReactNode; stamp?: string; back?: boolean; style?: React.CSSProperties; className?: string }) {
  return (
    <figure className={`rvl-print ${back ? "rvl-print--back" : ""} ${className ?? ""}`} style={{ margin: 0, ...style }}>
      {children}
      {stamp && <span className="rv-tag" style={{ top: "auto", left: "auto", right: 14, bottom: 38 }}>{stamp}</span>}
      {caption && <figcaption className="rvl-print__cap">{caption}</figcaption>}
    </figure>
  );
}
