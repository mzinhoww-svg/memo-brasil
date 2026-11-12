"use client";

import { useCallback, useEffect, useState } from "react";
import { commentAgo, commentFailureText, toCommentError, COMMENT_MAX, type CommentsApi, type PhotoComment } from "@/features/comments/service";
import { initialOf, firstName } from "@/features/feed/format";
import { commentReasonAt } from "@/features/moderation/report-reasons";
import { DENUNCIA_MOTIVOS_COMENTARIO, FeedDenunciar } from "@/revela/screens/FeedDenunciar";
import { FeedComentarios } from "@/revela/screens/FeedComentarios";
import type { FeedPostData } from "@/revela/screens/FeedEvento";

/** Camada em tela cheia sobre a página atual (as folhas de diálogo ficam acima, z-index 50). */
export function Overlay({ children, label }: { children: React.ReactNode; label: string }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);
  return <div role="presentation" aria-label={label} style={{ position: "fixed", inset: 0, zIndex: 40, background: "var(--bg)", overflow: "hidden" }}>{children}</div>;
}

/** 24e: folha de comentários de uma foto, com curtir, responder, apagar o próprio e denunciar (24g). */
export function CommentsOverlay({ api, photoId, post, title, me, now, onClose, onChanged }: { api: CommentsApi; photoId: string; post: FeedPostData; title: string; me: string; now: number; onClose: () => void; onChanged: () => void }) {
  const [list, setList] = useState<PhotoComment[] | undefined>();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [enabled,setEnabled]=useState(!api.enabled);
  const [message, setMessage] = useState<string | undefined>();
  const [report, setReport] = useState<{ id: string; sent: boolean; busy: boolean; reason: number; error?: string } | undefined>();

  const load = useCallback(async () => {
    try {
      if(api.enabled){const on=await api.enabled();setEnabled(on);if(!on)setMessage(commentFailureText("disabled"));}
      setList(await api.list(photoId));
    } catch (e) {
      setList([]);
      setMessage(commentFailureText(toCommentError(e).code));
    }
  }, [api, photoId]);
  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  async function send() {
    if (sending || !enabled || !text.trim()) return;
    setSending(true);
    setMessage(undefined);
    try {
      await api.post(photoId, text);
      setText("");
      await load();
      onChanged();
    } catch (e) {
      setMessage(commentFailureText(toCommentError(e).code));
    } finally {
      setSending(false);
    }
  }
  async function like(id: string) {
    setList((l) => l?.map((c) => (c.id === id ? { ...c, likedByMe: !c.likedByMe, likes: Math.max(0, c.likes + (c.likedByMe ? -1 : 1)) } : c)));
    try {
      const r = await api.toggleLike(id);
      setList((l) => l?.map((c) => (c.id === id ? { ...c, likedByMe: r.liked, likes: r.likes } : c)));
    } catch (e) {
      setMessage(commentFailureText(toCommentError(e).code));
      await load();
    }
  }
  async function remove(id: string) {
    try {
      await api.remove(id);
      await load();
      onChanged();
    } catch (e) {
      setMessage(commentFailureText(toCommentError(e).code));
    }
  }
  async function sendReport() {
    if (!report || report.busy || report.sent) return;
    setReport({ ...report, busy: true, error: undefined });
    try {
      await api.report(report.id, commentReasonAt(report.reason));
      setReport((r) => r && { ...r, busy: false, sent: true });
      await load();
      onChanged();
    } catch (e) {
      setReport((r) => r && { ...r, busy: false, error: commentFailureText(toCommentError(e).code) });
    }
  }

  if (report) {
    return (
      <Overlay label="Denunciar comentário">
        <FeedDenunciar
          title={title} heading="Denunciar este comentário" caption="Só os anfitriões veem a denúncia. Quem comentou não sabe quem foi."
          reasons={DENUNCIA_MOTIVOS_COMENTARIO} selected={report.reason} onSelect={(i) => setReport({ ...report, reason: i })}
          onBack={() => setReport(undefined)} onSubmit={report.sent ? () => setReport(undefined) : () => void sendReport()}
          cta={report.sent ? "Fechar" : report.busy ? "Enviando…" : "Enviar denúncia"} disabled={report.busy}
          message={report.sent ? "Denúncia enviada. Obrigado por avisar." : report.error}
        />
      </Overlay>
    );
  }
  return (
    <Overlay label="Comentários">
      <FeedComentarios
        title={title} post={post} count={list?.length ?? 0} meAvatar={initialOf(me)} placeholder={`Comente como ${firstName(me)}`}
        comments={(list ?? []).map((c) => ({ id: c.id, avatar: initialOf(c.authorName), name: firstName(c.authorName), ago: commentAgo(c.createdAt, now), text: c.body, likes: c.likes, liked: c.likedByMe, mine: c.mine }))}
        value={text} onChange={setText} onSend={() => void send()} sending={sending} disabled={!enabled} message={message ?? (text.length > COMMENT_MAX ? commentFailureText("invalid") : undefined)}
        onClose={onClose} onLike={(id) => void like(id)}
        onReply={(id) => { const c = list?.find((x) => x.id === id); if (c) setText((t) => (t.startsWith(`@${firstName(c.authorName)} `) ? t : `@${firstName(c.authorName)} ${t}`)); }}
        onReport={(id) => setReport({ id, sent: false, busy: false, reason: 0 })} onDelete={(id) => void remove(id)}
      />
    </Overlay>
  );
}
