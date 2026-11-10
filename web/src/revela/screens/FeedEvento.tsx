"use client";
/* Feed-evento.html (24d): mesmo markup da referência; dados reais por props (padrão = desenho). */
import Link from "next/link";
import type { ReactNode } from "react";
import { GuestTabs } from "../GuestTabs";

const svg = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export interface FeedStory { id: string; name: string; avatar: string; on?: boolean }
export interface FeedPostData {
  id: string;
  avatar: string;
  author: string;
  /** "pose 19 de 27" */
  pose: string;
  imageSrc: string;
  /** legenda do carimbo, esquerda e direita */
  stampLeft: string;
  stampRight: string;
  liked: boolean;
  likesText: string;
  caption?: string;
  commentsText: string;
}
export interface FeedPostHandlers {
  onOpen?: (id: string) => void;
  onLike?: (id: string) => void;
  onComments?: (id: string) => void;
  onShare?: (id: string) => void;
  onDownload?: (id: string) => void;
  onMore?: (id: string) => void;
}

export const FEED_REF_POSTS: FeedPostData[] = [
  { id: "p1", avatar: "L", author: "Leo", pose: "pose 19 de 27", imageSrc: "/revela/ref/sc-aliancas.jpg", stampLeft: "'27 03 14 · 22:41", stampRight: "Leo", liked: true, likesText: "86 curtidas", caption: "Esse foi o momento.", commentsText: "Ver os 14 comentários" },
  { id: "p2", avatar: "R", author: "Rafa", pose: "pose 7 de 27", imageSrc: "/revela/ref/sc-bolo.jpg", stampLeft: "'27 03 14 · 22:41", stampRight: "Rafa", liked: false, likesText: "52 curtidas", caption: "O bolo durou 4 minutos.", commentsText: "Ver os 9 comentários" },
];
export const FEED_REF_STORIES: FeedStory[] = [
  { id: "t", name: "Todas", avatar: "T", on: true },
  { id: "l", name: "Leo", avatar: "L" },
  { id: "b", name: "Bia", avatar: "B" },
  { id: "r", name: "Rafa", avatar: "R" },
  { id: "lu", name: "Lu", avatar: "L" },
  { id: "a", name: "Ana", avatar: "A" },
];

/** Uma publicação do feed (article.post). Sem handlers = só o desenho; usada também como fundo da folha de comentários. */
export function FeedPost({ post, onOpen, onLike, onComments, onShare, onDownload, onMore }: { post: FeedPostData } & FeedPostHandlers) {
  const p = post;
  return (
    <article className="post">
      <div className="post-h">
        <span className="avatar avatar--sm">{p.avatar}</span>
        <div style={{ flex: "1" }}>
          <b>{p.author}</b>
          <span>{p.pose}</span>
        </div>
        <button type="button" className="rv-icon-btn" aria-label="Mais" onClick={onMore && (() => onMore(p.id))}>
          <svg {...svg}>
            <circle cx="5" cy="12" r="1.2" />
            <circle cx="12" cy="12" r="1.2" />
            <circle cx="19" cy="12" r="1.2" />
          </svg>
        </button>
      </div>
      <div
        className="rv-print"
        style={{ width: "350px", height: "392px", transform: "rotate(0deg)", zIndex: "1", ...(onOpen ? { cursor: "pointer" } : {}) }}
        {...(onOpen ? { role: "button", tabIndex: 0, "aria-label": `Abrir a foto de ${p.author}. ${p.stampLeft} ${p.stampRight}`, onClick: () => onOpen(p.id), onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(p.id); } } } : {})}
      >
        <img src={p.imageSrc} alt="Foto de convidado" />
        <div className="rv-print__cap">
          <span>{p.stampLeft}</span>
          {" "}
          <span>{p.stampRight}</span>
        </div>
      </div>
      <div className="post-a">
        <button type="button" aria-label="Curtir" aria-pressed={onLike ? p.liked : undefined} className={p.liked ? "on" : ""} onClick={onLike && (() => onLike(p.id))}>
          <svg {...svg} fill={p.liked ? "currentColor" : "none"}>
            <path d="M12 20s-7.5-4.6-9.3-9.6C1.5 7.2 3.5 4.5 6.6 4.5c2 0 3.4 1 5.4 3 2-2 3.4-3 5.4-3 3.1 0 5.1 2.7 3.9 5.9C19.500 15.400 12 20 12 20z" />
          </svg>
        </button>
        <button type="button" aria-label="Comentar" onClick={onComments && (() => onComments(p.id))}>
          <svg {...svg}>
            <path d="M21 12a8 8 0 0 1-12 7l-5 1 1-4a8 8 0 1 1 16-4z" />
          </svg>
        </button>
        <button type="button" aria-label="Compartilhar" onClick={onShare && (() => onShare(p.id))}>
          <svg {...svg}>
            <path d="M12 3v13M7 8l5-5 5 5" />
            <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
          </svg>
        </button>
        <button type="button" aria-label="Baixar" style={{ marginLeft: "auto" }} onClick={onDownload && (() => onDownload(p.id))}>
          <svg {...svg}>
            <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
          </svg>
        </button>
      </div>
      <div className="post-c">
        <b>{p.likesText}</b>
        {p.caption && (
          <p>
            <b>{p.author}</b>
            {` ${p.caption}`}
          </p>
        )}
        <span className="rv-caption" {...(onComments ? { role: "button", tabIndex: 0, style: { cursor: "pointer", ...(p.caption ? {} : { display: "block" }) }, onClick: () => onComments(p.id), onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onComments(p.id); } } } : {})}>{p.commentsText}</span>
      </div>
    </article>
  );
}

export interface FeedEventoProps extends FeedPostHandlers {
  code?: string;
  /** "DOM 15 MAR" */
  stamp?: string;
  title?: string;
  stories?: FeedStory[];
  posts?: FeedPostData[];
  /** liga a rolagem do feed (a referência é uma imagem estática) */
  scroll?: boolean;
  bellHref?: string;
  onStory?: (id: string) => void;
  /** conteúdo depois das publicações (estado vazio, sentinela de paginação) */
  after?: ReactNode;
  /** aviso do cerimonial, logo abaixo do título */
  notice?: ReactNode;
}

export function FeedEvento({ code, stamp = "DOM 15 MAR", title = "Ana & Leo", stories = FEED_REF_STORIES, posts = FEED_REF_POSTS, scroll, bellHref, onStory, after, notice, ...h }: FeedEventoProps = {}) {
  return (
    <>
    <div className="scr">
      <div className="safe" style={{ paddingBottom: scroll ? "92px" : "0", overflow: scroll ? "hidden auto" : "hidden" }}>
        <div className="row between">
          <div>
            <div className="rv-stamp" style={{ fontSize: "12px" }}>{stamp}</div>
            <h1 className="rv-display" style={{ fontSize: "34px", lineHeight: "36px", marginTop: "4px" }}>{title}</h1>
          </div>
          <Link href={bellHref ?? "#"} className="rv-icon-btn" aria-label="Notificações">
            <svg {...svg}>
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <path d="M10 21a2 2 0 0 0 4 0" />
            </svg>
          </Link>
        </div>
        {notice}
        <div className="stories">
          {stories.map((s) => (
            <div key={s.id} className={s.on ? "story on" : "story"} {...(onStory ? { role: "button", tabIndex: 0, "aria-pressed": Boolean(s.on), style: { cursor: "pointer" }, onClick: () => onStory(s.id), onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onStory(s.id); } } } : {})}>
              <span className="avatar">{s.avatar}</span>
              <small>{s.name}</small>
            </div>
          ))}
        </div>
        {posts.map((p) => <FeedPost key={p.id} post={p} {...h} />)}
        {after}
      </div>
      <GuestTabs code={code} current="feed" />
      <div className="home-ind" />
      <div className="grain" />
    </div>
    </>
  );
}
