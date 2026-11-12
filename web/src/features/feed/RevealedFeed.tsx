"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { retrospectiveOpen, eventStatus, isRevealed } from "@/domain/event";
import { visiblePhotos, type ReactionKind } from "@/domain/photo";
import { useApp } from "@/features/app/provider";
import { usePhotoUrls } from "@/features/app/hooks";
import { createCloudComments, createLocalComments, type CommentsApi } from "@/features/comments/service";
import { CommentsOverlay, Overlay } from "@/features/feed/CommentsOverlay";
import { commentsText, firstName, initialOf, likesText, photoMoment, poseLabel, printStamp, reactionItems } from "@/features/feed/format";
import { useGuest } from "@/features/events/guest-context";
import { CreateYourOwn } from "@/features/reveal/CreateYourOwn";
import { MoreSheet } from "@/features/photos/components";
import { photoReasonAt } from "@/features/moderation/report-reasons";
import { react, reportPhoto } from "@/features/photos/service";
import { canDownloadOriginal, DOWNLOAD_DENIED_TEXT, downloadPhoto, DownloadNotAllowedError, reactorsOf } from "@/features/photos/share";
import { stampDay } from "@/features/guest/format";
import { DENUNCIA_MOTIVOS_FOTO, FeedDenunciar } from "@/revela/screens/FeedDenunciar";
import { FeedEvento, type FeedPostData, type FeedStory } from "@/revela/screens/FeedEvento";
import { revealFeed } from "@/lib/motion/revela-motion";
import { useFirstOpen } from "@/lib/motion/use-moments";
import { FeedReacoes } from "@/revela/screens/FeedReacoes";

const BLANK = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
const PAGE = 20;
/** Eventos cuja virada (revealFeed) já tocou nesta sessão: voltar ao feed depois não repete. */
const TURNED = new Set<string>();

/** 24d · 24e · 24f · 24g: o feed do evento revelado, ligado às fotos, reações e comentários reais. */
export function RevealedFeed() {
  const { repos, backend } = useApp();
  const { event, user, viewer, now, photos, reactions, participants, refresh, revealStatus, developed, celebrating } = useGuest();
  const [author, setAuthor] = useState("t");
  const [limit, setLimit] = useState(PAGE);
  const [openId, setOpenId] = useState<string | undefined>();
  const [commentsFor, setCommentsFor] = useState<string | undefined>();
  const [moreFor, setMoreFor] = useState<string | undefined>();
  const [reportFor, setReportFor] = useState<{ id: string; reason: number; busy: boolean; sent: boolean; error: boolean } | undefined>();
  const [note, setNote] = useState<string | undefined>();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const revealed = isRevealed(event, now);

  const api: CommentsApi = useMemo(
    () => (backend === "supabase" ? createCloudComments() : createLocalComments({ id: user.id, name: user.name }, { revealed: () => true, eventOf: () => event.id })),
    [backend, user.id, user.name, event.id],
  );
  const loadCounts = useCallback(async () => {
    if (!revealed) return;
    try { setCounts(await api.counts(event.id)); } catch { /* sem contagem: o feed segue sem o número */ }
  }, [api, event.id, revealed]);
  useEffect(() => {
    const t = setTimeout(() => void loadCounts(), 0);
    return () => clearTimeout(t);
  }, [loadCounts]);

  const all = useMemo(() => visiblePhotos(event, photos, viewer, now).sort((a, b) => photoMoment(b) - photoMoment(a) || b.id.localeCompare(a.id)), [event, photos, viewer, now]);
  const authors = useMemo(() => {
    const m = new Map<string, { id: string; name: string; n: number }>();
    for (const p of all) m.set(p.authorId, { id: p.authorId, name: p.authorName, n: (m.get(p.authorId)?.n ?? 0) + 1 });
    return [...m.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name)).slice(0, 12);
  }, [all]);
  const shown = useMemo(() => (author === "t" ? all : all.filter((p) => p.authorId === author)), [all, author]);
  const page = shown.slice(0, limit);
  const open = openId ? shown.findIndex((p) => p.id === openId) : -1;
  const develop = useFirstOpen(openId); // a foto revela (rv-develop) só na primeira vez que abre
  const wanted = useMemo(() => [...page, ...(open >= 0 ? [shown[open], shown[open - 1], shown[open + 1]].filter((p) => p !== undefined) : [])], [page, open, shown]);
  const urls = usePhotoUrls(wanted);

  // virada da revelação: se o feed nasceu da passagem pendente → revelada, as primeiras fotos chegam borradas e viram fotos reais
  const [veil, setVeil] = useState<{ ids: string[]; done: boolean } | null>(null);
  const [unveiled, setUnveiled] = useState<ReadonlySet<string>>(new Set());
  if (veil === null && developed && !TURNED.has(event.id) && page.length > 0) setVeil({ ids: page.slice(0, 4).map((p) => p.id), done: false });
  const [veilWaited, setVeilWaited] = useState(false);
  useEffect(() => {
    if (!veil) return;
    const t = setTimeout(() => setVeilWaited(true), 2500);
    return () => clearTimeout(t);
  }, [veil === null]); // eslint-disable-line react-hooks/exhaustive-deps
  const turning = useRef(false);
  useEffect(() => {
    if (!veil || veil.done || celebrating || turning.current) return;
    if (!veilWaited && veil.ids.some((id) => !urls[id])) return; // espera as fotos reais chegarem
    const items = veil.ids.flatMap((id) => {
      const post = document.querySelector(`article.post[data-post-id="${id}"]`);
      const photo = post?.querySelector<HTMLElement>(".rv-print img");
      return photo ? [{ id, photo, lock: post?.querySelector<HTMLElement>(".rvm-lock") ?? undefined }] : [];
    });
    turning.current = true;
    TURNED.add(event.id);
    void revealFeed(items, (i) => setUnveiled((s) => new Set(s).add(items[i].id))).then(() => setVeil((v) => v && { ...v, done: true }));
  }, [veil, celebrating, veilWaited, urls, event.id]);

  const likeCount = (id: string) => reactions.filter((r) => r.photoId === id).length;
  const mine = (id: string) => reactions.find((r) => r.photoId === id && r.authorId === user.id);
  const toPost = useCallback((p: (typeof all)[number]): FeedPostData => ({
    id: p.id, avatar: initialOf(p.authorName), author: firstName(p.authorName), pose: poseLabel(p, all, event),
    imageSrc: urls[p.id] ?? BLANK, stampLeft: printStamp(photoMoment(p), event.timezone), stampRight: firstName(p.authorName),
    canDownload: canDownloadOriginal(event, { host: viewer.host, userId: user.id }, p), downloadLabel: "Baixar em alta", liked: Boolean(mine(p.id)), likesText: likesText(likeCount(p.id)), veiled: Boolean(veil && !veil.done && veil.ids.includes(p.id) && !unveiled.has(p.id)), caption: p.caption, commentsText: commentsText(counts[p.id] ?? 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [all, event, urls, reactions, counts, user.id, veil, unveiled]);

  async function onReact(photoId: string, kind: ReactionKind) {
    if (!event.reactionsEnabled) { setNote("O anfitrião desligou as reações deste evento."); return; }
    await react(repos, event, photoId, user.id, kind, now);
    await refresh();
  }
  const onLike = (id: string) => void onReact(id, mine(id)?.kind ?? "amei");
  async function share() {
    const url = `${window.location.origin}/e/${event.code}`;
    try {
      if (navigator.share) await navigator.share({ title: event.title, url });
      else { await navigator.clipboard?.writeText(url); setNote("Link do evento copiado."); }
    } catch { /* cancelado pela pessoa */ }
  }
  async function download(id: string) {
    const p = photos.find((x) => x.id === id);
    try {
      setNote(p && (await downloadPhoto(repos, p)) ? "Foto baixada." : "Não deu para baixar essa foto. Tente de novo.");
    } catch (e) {
      setNote(e instanceof DownloadNotAllowedError ? DOWNLOAD_DENIED_TEXT : "Não deu para baixar essa foto. Tente de novo.");
    }
  }
  async function sendPhotoReport() {
    if (!reportFor || reportFor.busy || reportFor.sent) return;
    setReportFor({ ...reportFor, busy: true, error: false });
    try {
      await reportPhoto(repos, reportFor.id, photoReasonAt(reportFor.reason));
      setReportFor((r) => r && { ...r, busy: false, sent: true });
      await refresh();
    } catch {
      setReportFor((r) => r && { ...r, busy: false, error: true });
    }
  }

  // paginação sem botão: a sentinela no fim da lista pede mais fotos ao chegar na tela
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || shown.length <= limit || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) setLimit((n) => n + PAGE); }, { rootMargin: "400px" });
    io.observe(el);
    return () => io.disconnect();
  }, [shown.length, limit]);

  // setas do teclado na foto aberta
  useEffect(() => {
    if (open < 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && open > 0) setOpenId(shown[open - 1].id);
      if (e.key === "ArrowRight" && open < shown.length - 1) setOpenId(shown[open + 1].id);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, shown]);

  const stories: FeedStory[] = [{ id: "t", name: "Todas", avatar: "T", on: author === "t" }, ...authors.map((a) => ({ id: a.id, name: firstName(a.name), avatar: initialOf(a.name), on: author === a.id }))];
  const live = eventStatus(event, now) === "ativo";
  const notice = event.notice && (!event.notice.expiresAt || event.notice.expiresAt > now) && (!(event.notice as { startsAt?: number }).startsAt || (event.notice as { startsAt?: number }).startsAt! <= now) ? event.notice.text : undefined;
  const commentPost = commentsFor ? shown.concat(all).find((p) => p.id === commentsFor) : undefined;
  const openPhoto = open >= 0 ? shown[open] : undefined;
  const morePhoto = moreFor ? photos.find((p) => p.id === moreFor) : undefined;
  const reportPhotoRow = reportFor ? photos.find((p) => p.id === reportFor.id) : undefined;

  return (
    <>
      <FeedEvento
        code={event.code} stamp={stampDay(event.startAt, event.timezone)} title={event.title} bellHref={`/e/${event.code}/aviso-email`}
        stories={stories} onStory={(id) => { setAuthor(id); setLimit(PAGE); }}
        posts={page.map(toPost)} scroll
        onOpen={setOpenId} onLike={onLike} onComments={setCommentsFor} onShare={() => void share()} onDownload={(id) => void download(id)} onMore={setMoreFor}
        notice={(notice || (viewer.host && revealStatus === "pendente") || (!live && retrospectiveOpen(event, now, viewer.host))) ? (
          <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "4px" }}>
            {notice && <p className="rv-caption">{notice}</p>}
            {viewer.host && revealStatus === "pendente" && <p className="rv-caption" role="status">Revelação pendente: os convidados ainda não veem as fotos. Você vê tudo como anfitrião.</p>}
            {!live && retrospectiveOpen(event, now, viewer.host) && <Link className="rv-caption" href={`/e/${event.code}/retrospectiva`} style={{ textDecoration: "underline" }}>Ver a retrospectiva</Link>}
          </div>
        ) : undefined}
        after={(
          <>
            {shown.length === 0 && <p className="rv-caption" style={{ textAlign: "center", margin: "24px 0" }}>Ainda sem fotos. Viu alguma coisa boa? Posta.</p>}
            <div ref={sentinel} aria-hidden="true" style={{ height: 1 }} />
            {note && <p className="rv-caption" role="status" style={{ textAlign: "center", margin: "8px 0 16px" }}>{note}</p>}
            {!viewer.host && <div style={{ margin: "8px 0 24px" }}><CreateYourOwn eventId={event.id} userId={user.id} /></div>}
          </>
        )}
      />

      {openPhoto && (
        <Overlay label="Foto aberta">
          <FeedReacoes
            position={`${open + 1} de ${shown.length}`} imageSrc={urls[openPhoto.id] ?? BLANK} develop={develop}
            stampLeft={printStamp(photoMoment(openPhoto), event.timezone)} stampRight={`por ${firstName(openPhoto.authorName)}`}
            avatar={initialOf(openPhoto.authorName)} author={firstName(openPhoto.authorName)}
            meta={`${poseLabel(openPhoto, all, event)} · ${openPhoto.moment}`}
            reactions={reactionItems(openPhoto.id, reactions, user.id)}
            onClose={() => setOpenId(undefined)} onMore={() => setMoreFor(openPhoto.id)} onReact={(k) => void onReact(openPhoto.id, k as ReactionKind)}
            onComment={() => setCommentsFor(openPhoto.id)} onDownload={() => void download(openPhoto.id)}
            canDownload={canDownloadOriginal(event, { host: viewer.host, userId: user.id }, openPhoto)} downloadLabel="Baixar em alta"
            onPrev={open > 0 ? () => setOpenId(shown[open - 1].id) : undefined} onNext={open < shown.length - 1 ? () => setOpenId(shown[open + 1].id) : undefined}
          />
          {note && <p className="rv-caption" role="status" style={{ position: "absolute", left: 0, right: 0, bottom: 4, textAlign: "center" }}>{note}</p>}
        </Overlay>
      )}

      {commentsFor && commentPost && (
        <CommentsOverlay api={api} photoId={commentsFor} post={toPost(commentPost)} title={event.title} me={user.name} now={now} onClose={() => setCommentsFor(undefined)} onChanged={() => void loadCounts()} />
      )}

      {morePhoto && (
        <MoreSheet
          reactors={reactorsOf(morePhoto, reactions, participants, user, { id: event.hostId, name: event.hostName })}
          editHref={`/e/${event.code}/editar/${morePhoto.id}`} onDownload={canDownloadOriginal(event, { host: viewer.host, userId: user.id }, morePhoto) ? () => downloadPhoto(repos, morePhoto) : undefined}
          onClose={() => setMoreFor(undefined)}
          onReport={async () => { await reportPhoto(repos, morePhoto.id); await refresh(); }}
          onRequestReport={() => { setMoreFor(undefined); setReportFor({ id: morePhoto.id, reason: 1, busy: false, sent: false, error: false }); }}
        />
      )}

      {reportFor && reportPhotoRow && (
        <Overlay label="Denunciar foto">
          <FeedDenunciar
            title={event.title} reasons={DENUNCIA_MOTIVOS_FOTO} selected={reportFor.reason} onSelect={(i) => setReportFor({ ...reportFor, reason: i })}
            onBack={() => setReportFor(undefined)} onSubmit={reportFor.sent ? () => setReportFor(undefined) : () => void sendPhotoReport()}
            cta={reportFor.sent ? "Fechar" : reportFor.busy ? "Enviando…" : "Enviar denúncia"} disabled={reportFor.busy}
            message={reportFor.sent ? "Denúncia enviada. O anfitrião vai analisar." : reportFor.error ? "Não deu para enviar a denúncia. Tente de novo." : undefined}
          />
        </Overlay>
      )}
    </>
  );
}
