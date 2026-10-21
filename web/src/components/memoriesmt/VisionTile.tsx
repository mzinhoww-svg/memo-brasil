import Link from "next/link";

/** Miniatura de uma visão: foto de capa com o nome no rodapé. */
export function VisionTile({ href, name, imageSrc }: { href: string; name: string; imageSrc?: string }) {
  return (
    <Link className="mm-vision" href={href} style={imageSrc ? { backgroundImage: `url(${imageSrc})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>
      <span style={imageSrc ? { background: "var(--fundo)", color: "var(--tinta)", padding: "4px 8px", borderRadius: "var(--radius-pill)" } : undefined}>{name}</span>
    </Link>
  );
}
export function VisionGrid({ children }: { children: React.ReactNode }) {
  return <div className="mm-visions">{children}</div>;
}
