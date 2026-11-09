/* eslint-disable @next/next/no-img-element -- fotos locais vêm de blob URLs; next/image não se aplica */
import type { ReactNode } from "react";
import { Icon } from "./Icon";

export const initials = (name: string): string => name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");

/** Post do feed Agora: visão, momento, foto sem moldura, legenda e reações (slot). */
export function PostCard({ vision, meta, avatar, imageSrc, alt, caption, tag, onMore, reactions }: { vision: string; meta: string; avatar: string; imageSrc?: string; alt: string; caption?: string; tag?: string; onMore?: () => void; reactions?: ReactNode }) {
  return (
    <article className="rv-post">
      <div className="rv-post-head">
        <div className="rv-post-autor">
          <span className="rv-avatar" aria-hidden="true">{avatar}</span>
          <div>
            <span className="rv-post-nome">{vision}</span>
            <span className="rv-post-meta">{meta}</span>
          </div>
        </div>
        <button type="button" className="rv-icon-btn" aria-label="Mais opções, incluindo pedir para remover" onClick={onMore}>
          <Icon name="mais" decorative size={20} />
        </button>
      </div>
      <div className="rv-media">
        {imageSrc ? <img src={imageSrc} alt={alt} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span>Carregando foto</span>}
        {tag && <span className="rv-tag">{tag}</span>}
      </div>
      {caption && <p className="rv-post-legenda" style={{ margin: 0 }}>{caption}</p>}
      {reactions}
    </article>
  );
}
