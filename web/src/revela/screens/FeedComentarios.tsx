"use client";
/* Feed-comentarios.html (24e): mesmo markup da referência; dados reais por props (padrão = desenho). */
import { FeedPost, FEED_REF_POSTS, type FeedPostData } from "./FeedEvento";

const svg = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export interface FeedComment {
  id: string;
  avatar: string;
  name: string;
  /** "2 min" */
  ago: string;
  text: string;
  likes: number;
  liked: boolean;
  mine?: boolean;
}

export const COMMENTS_REF: FeedComment[] = [
  { id: "c1", avatar: "A", name: "Ana", ago: "2 min", text: "Não sabia que tinha essa foto. Chorei de novo.", likes: 12, liked: true },
  { id: "c2", avatar: "B", name: "Bia", ago: "5 min", text: "Fui eu que tirei! Pose 19, aguentei o flash na cara.", likes: 8, liked: false },
  { id: "c3", avatar: "R", name: "Rafa", ago: "9 min", text: "Quero essa em papel na parede.", likes: 3, liked: false },
  { id: "c4", avatar: "L", name: "Lu", ago: "14 min", text: "A aliança saiu perfeita no flash.", likes: 5, liked: false },
];

export interface FeedComentariosProps {
  title?: string;
  /** a publicação que aparece esmaecida atrás da folha */
  post?: FeedPostData;
  /** número no carimbo do cabeçalho */
  count?: number;
  comments?: FeedComment[];
  meAvatar?: string;
  /** campo controlado quando `onChange` existe; senão o texto do desenho */
  placeholder?: string;
  value?: string;
  onChange?: (v: string) => void;
  onSend?: () => void;
  sending?: boolean;
  disabled?: boolean;
  /** mensagem de erro/estado da folha (ex.: "As fotos ainda não foram rereveladas") */
  message?: string;
  onClose?: () => void;
  onLike?: (id: string) => void;
  onReply?: (id: string) => void;
  onReport?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export function FeedComentarios({ title = "Ana & Leo", post = FEED_REF_POSTS[0], count = 14, comments = COMMENTS_REF, meAvatar = "B", placeholder = "Comente como Bia", value, onChange, onSend, sending, disabled, message, onClose, onLike, onReply, onReport, onDelete }: FeedComentariosProps = {}) {
  const act = (fn?: () => void) => fn && { role: "button" as const, tabIndex: 0, style: { cursor: "pointer" }, onClick: fn, onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(); } } };
  return (
    <>
    <div className="scr sheet-scr">
      <div className="safe" style={{ paddingBottom: "0", overflow: "hidden", opacity: ".35" }} onClick={onClose}>
        <div className="row between">
          <h1 className="rv-display" style={{ fontSize: "34px" }}>{title}</h1>
        </div>
        <FeedPost post={post} />
      </div>
      <div className="sheet-full" style={{ top: "150px" }} role={onClose ? "dialog" : undefined} aria-label={onClose ? "Comentários" : undefined}>
        <div className="rv-sheet__grab" {...act(onClose)} />
        <div className="row between" style={{ margin: "8px 0 4px" }}>
          <h2 className="rv-title">Comentários</h2>
          <span className="rv-stamp" style={{ fontSize: "13px" }}>{count}</span>
        </div>
        <div className="cmts" style={onChange ? { overflowY: "auto", flex: "1 1 auto", minHeight: 0 } : undefined}>
          {comments.map((c) => (
            <div key={c.id} className="cmt">
              <span className="avatar avatar--sm">{c.avatar}</span>
              <div className="cmt-b">
                <div>
                  <b>{c.name}</b>{" "}
                  <span className="rv-caption">{c.ago}</span>
                </div>
                <p>{c.text}</p>
                <span className="rv-caption" {...act(onReply && (() => onReply(c.id)))}>Responder</span>
                {onReport && !c.mine && <span className="rv-caption" {...act(() => onReport(c.id))}>{" · Denunciar"}</span>}
                {onDelete && c.mine && <span className="rv-caption" {...act(() => onDelete(c.id))}>{" · Apagar"}</span>}
              </div>
              <button type="button" aria-label="Curtir comentário" aria-pressed={onLike ? c.liked : undefined} className={c.liked ? "on" : ""} onClick={onLike && (() => onLike(c.id))}>
                <svg {...svg} fill={c.liked ? "currentColor" : "none"}>
                  <path d="M12 20s-7.5-4.6-9.3-9.6C1.5 7.2 3.5 4.5 6.6 4.5c2 0 3.4 1 5.4 3 2-2 3.4-3 5.4-3 3.1 0 5.1 2.7 3.9 5.9C19.500 15.400 12 20 12 20z" />
                </svg>
                <small>{c.likes}</small>
              </button>
            </div>
          ))}
        </div>
        <div className="grow" />
        {message && <p className="rv-caption" role="alert" style={{ margin: "0 0 8px" }}>{message}</p>}
        <form className="cmt-in" onSubmit={(e) => { e.preventDefault(); onSend?.(); }}>
          <span className="avatar avatar--sm">{meAvatar}</span>
          <label className="rv-field rv-field--focus" style={{ flex: "1", height: "48px" }}>
            {onChange ? <input disabled={disabled} value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label="Comentário" maxLength={280} autoComplete="off" /> : <input defaultValue={placeholder} aria-label="Comentário" />}
          </label>
          <button type="submit" className="rv-icon-btn" style={{ background: "var(--revela)", color: "var(--on-revela)" }} aria-label="Enviar" disabled={disabled || Boolean(onChange) && (sending || !(value ?? "").trim())}>
            <svg {...svg}>
              <path d="M21 3L10 14M21 3l-7 18-4-7-7-4z" />
            </svg>
          </button>
        </form>
      </div>
      <div className="home-ind" />
      <div className="grain" />
    </div>
    </>
  );
}
