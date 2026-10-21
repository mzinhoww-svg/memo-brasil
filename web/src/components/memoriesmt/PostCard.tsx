import type { ReactNode } from "react";
import { Icon } from "./Icon";

export const initials = (name: string): string => name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");

/** Post do feed Agora: visão, momento, foto sem moldura, legenda e reações (slot). */
export function PostCard({ vision, meta, avatar, imageSrc, alt, caption, tag, onMore, reactions }: { vision: string; meta: string; avatar: string; imageSrc?: string; alt: string; caption?: string; tag?: string; onMore?: () => void; reactions?: ReactNode }) {
  return (
    <article className="mm-post">
      <div className="mm-post-head">
        <div className="mm-post-autor">
          <span className="mm-avatar" aria-hidden="true">{avatar}</span>
          <div>
            <span className="mm-post-nome">{vision}</span>
            <span className="mm-post-meta">{meta}</span>
          </div>
        </div>
        <button type="button" className="mm-icon-btn" aria-label="Mais opções, incluindo pedir para remover" onClick={onMore}>
          <Icon name="mais" decorative size={20} />
        </button>
      </div>
      <div className="mm-media">
        {imageSrc ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={imageSrc} alt={alt} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span>Carregando foto</span>}
        {tag && <span className="mm-tag">{tag}</span>}
      </div>
      {caption && <p className="mm-post-legenda" style={{ margin: 0 }}>{caption}</p>}
      {reactions}
    </article>
  );
}
