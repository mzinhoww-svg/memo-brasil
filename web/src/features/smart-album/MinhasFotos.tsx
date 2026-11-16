"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, ConfirmSheet, Sheet, Tabs, panelId } from "@/components/revela";
import { isRevealed } from "@/domain/event";
import { visiblePhotos, type Photo } from "@/domain/photo";
import { useApp } from "@/features/app/provider";
import { usePhotoUrls } from "@/features/app/hooks";
import { useGuest } from "@/features/events/guest-context";
import { revealLine } from "@/features/guest/format";
import { canDownloadOriginal, DOWNLOAD_DENIED_TEXT, downloadPhoto, DownloadNotAllowedError } from "@/features/photos/share";
import { GuestTabs } from "@/revela/GuestTabs";
import { countBucket, track } from "./analytics";
import { COPY, failureText, jobErrorText } from "./copy";
import { Onboarding, type OnboardingResult } from "./Onboarding";
import { toSmartAlbumError, type SmartAlbumState } from "./service";
import { useSmartAlbum } from "./use-smart-album";

type Segment = "found" | "taken" | "favorites";
const BLANK = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
const onbKey = (eventId: string, userId: string) => `mm-sa-onb:${eventId}:${userId}`;
function readOnb(k: string): string | null { try { return localStorage.getItem(k); } catch { return null; } }
function writeOnb(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* sem armazenamento: o convite volta na próxima visita */ } }

/** Minhas Fotos: Encontradas para mim (só com busca liberada e consentida), Fotos que tirei e Favoritas. */
export function MinhasFotos() {
  const { event, user, viewer, now, photos, counts } = useGuest();
  const sa = useSmartAlbum();
  const { state, items, matches, loading, error } = sa;
  const revealed = isRevealed(event, now);
  const visible = useMemo(() => visiblePhotos(event, photos, viewer, now), [event, photos, viewer, now]);
  const byId = useMemo(() => new Map(visible.map((p) => [p.id, p])), [visible]);
  const taken = useMemo(() => visible.filter((p) => p.authorId === user.id), [visible, user.id]);
  const favorites = useMemo(() => items.filter((i) => i.kind === "favorite").map((i) => byId.get(i.photoId)).filter((p): p is Photo => Boolean(p)), [items, byId]);
  const found = useMemo(() => matches.map((m) => byId.get(m.photoId)).filter((p): p is Photo => Boolean(p)), [matches, byId]);
  const favSet = useMemo(() => new Set(favorites.map((p) => p.id)), [favorites]);
  const faceActive = Boolean(state?.face.available && state.face.consented);

  const [segment, setSegment] = useState<Segment | null>(null);
  const current: Segment = segment ?? (faceActive && found.length ? "found" : "taken");
  const [onboarding, setOnboarding] = useState<null | "intro" | "source">(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => { track("smart_album_viewed"); }, []);
  // primeiro acesso com a chave ligada: abre o convite uma vez (pulável; a escolha fica só neste aparelho, sem dado biométrico)
  const k = onbKey(event.id, user.id);
  useEffect(() => {
    if (!state?.ui || state.face.consented || readOnb(k)) return;
    const t = setTimeout(() => setOnboarding("intro"), 0);
    return () => clearTimeout(t);
  }, [state?.ui, state?.face.consented, k]);

  const list = current === "found" ? found : current === "favorites" ? favorites : taken;
  const urls = usePhotoUrls(list, "thumb");
  const open = openId ? byId.get(openId) : undefined;

  async function toggleFavorite(p: Photo) {
    const on = !favSet.has(p.id);
    try {
      await sa.api.setItem(p.id, "favorite", on);
      if (on) track("smart_album_manual_favorite_added");
      await sa.reload();
    } catch (e) {
      setNote(failureText(toSmartAlbumError(e).code));
    }
  }
  async function hide(p: Photo) {
    try {
      await sa.api.hideMatch(event.id, p.id);
      track("smart_album_match_hidden");
      setOpenId(null);
      setNote("Pronto. Essa foto não aparece mais nas suas sugestões.");
      await sa.reload();
    } catch (e) {
      setNote(failureText(toSmartAlbumError(e).code));
    }
  }
  async function retry() {
    try {
      await sa.api.requestSearch(event.id, `sa-${crypto.randomUUID().replace(/-/g, "")}`);
      track("smart_album_job_started");
      await sa.reload();
    } catch (e) {
      setNote(failureText(toSmartAlbumError(e).code));
    }
  }
  function finishOnboarding(r: OnboardingResult) {
    setOnboarding(null);
    writeOnb(k, r);
    if (r === "activated") setNote(state?.revealed ? COPY.searching : "Pronto. Depois da revelação, procuramos suas fotos.");
  }

  const tabs = [
    ...(faceActive ? [{ id: "found", label: "Encontradas", count: found.length }] : []),
    { id: "taken", label: "Que tirei", count: revealed ? taken.length : undefined },
    { id: "favorites", label: "Favoritas", count: favorites.length },
  ];

  return (
    <>
      <div className="scr">
        <div className="safe safe--tabs sa-hub">
          <div className="row between">
            <h1 className="rv-title-lg" style={{ fontSize: "30px" }}>{COPY.title}</h1>
            <span className="avatar" aria-hidden="true">{user.name.trim().charAt(0).toUpperCase() || "?"}</span>
          </div>
          <p className="rv-caption">{event.title} · {revealed ? "revelado" : event.revealAt ? revealLine(event.revealAt, event.timezone) : "Revela na hora"}</p>

          {note && <p className="sa-note" role="status">{note}</p>}
          {error && <div className="sa-note" role="alert">{failureText(error.code)} <Button variant="texto" onClick={() => void sa.reload()}>Tentar de novo</Button></div>}

          {!loading && state && !state.ui ? (
            <div className="sa-empty" role="status">
              <p className="rv-body">Minhas Fotos ainda não está disponível neste evento.</p>
              <Button variant="secundario" href={`/e/${event.code}/agora`}>Voltar ao feed</Button>
            </div>
          ) : loading ? (
            <div className="sa-grid" aria-busy="true" aria-label="Carregando suas fotos">{Array.from({ length: 6 }, (_, i) => <span key={i} className="sa-tile sa-tile--skeleton" />)}</div>
          ) : (
            <>
              {state && <FaceCard state={state} onSetup={() => setOnboarding(state.face.profile ? "source" : "intro")} onRetry={() => void retry()} onRevoke={() => setConfirmRevoke(true)} />}
              <Tabs base="sa" label="Minhas Fotos" tabs={tabs} value={current} onChange={(id) => { setSegment(id as Segment); if (id === "found") track("smart_album_results_opened", { count_bucket: countBucket(found.length) }); }} />
              <section id={panelId("sa", current)} role="tabpanel" aria-label={tabs.find((t) => t.id === current)?.label}>
                {!revealed && !viewer.host ? (
                  <div className="sa-empty">
                    <p className="rv-body">{COPY.beforeReveal}</p>
                    {current === "taken" && counts.mine > 0 && <p className="rv-caption">{counts.mine === 1 ? "1 pose guardada" : `${counts.mine} poses guardadas`} até a revelação.</p>}
                  </div>
                ) : list.length === 0 ? (
                  <EmptyState segment={current} state={state} />
                ) : (
                  <div className="sa-grid">
                    {list.map((p) => (
                      <button key={p.id} type="button" className="sa-tile rv-press" onClick={() => { setSegment(current); setOpenId(p.id); }} aria-label={`Abrir a foto de ${p.authorName}`}>
                        <img src={urls[p.id] ?? BLANK} alt="" loading="lazy" />
                        {favSet.has(p.id) && <span className="sa-tile__fav" aria-hidden="true">★</span>}
                      </button>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
        <GuestTabs code={event.code} current="fotos" />
        <div className="home-ind" />
      </div>

      {open && <Viewer photo={open} found={current === "found"} favorite={favSet.has(open.id)} onClose={() => setOpenId(null)} onFavorite={() => void toggleFavorite(open)} onHide={() => void hide(open)} />}
      {onboarding && state && <Onboarding sa={sa} eventId={event.id} state={state} startAt={onboarding} onDone={finishOnboarding} />}
      {confirmRevoke && (
        <ConfirmSheet
          history
          title="Desativar a busca facial?"
          body="Seu consentimento é retirado, as sugestões somem e a foto de referência entra na fila de exclusão. Fotos que tirei e favoritas continuam."
          confirmLabel="Desativar e apagar"
          onCancel={() => setConfirmRevoke(false)}
          onConfirm={async () => {
            const r = await sa.api.revoke(event.id);
            track("smart_album_consent_revoked");
            setConfirmRevoke(false);
            setSegment(null);
            setNote(r.status === "purge_queued" ? "Busca desativada. A foto de referência foi enviada para exclusão e some do armazenamento em até 1 hora." : "Busca desativada.");
            await sa.reload();
          }}
        />
      )}
    </>
  );
}

function FaceCard({ state, onSetup, onRetry, onRevoke }: { state: SmartAlbumState; onSetup: () => void; onRetry: () => void; onRevoke: () => void }) {
  const f = state.face;
  if (!f.available) {
    // busca indisponível: só o convite (a escolha de foto não envia nada) quando a pessoa ainda não viu
    return null;
  }
  if (!f.consented) {
    return (
      <div className="sa-card">
        <b className="sa-h3">{COPY.inviteTitle}</b>
        <p className="rv-caption">{COPY.inviteBody}</p>
        <Button small onClick={onSetup}>Escolher minha foto</Button>
      </div>
    );
  }
  const job = f.job;
  const working = job?.status === "queued" || job?.status === "processing";
  return (
    <div className="sa-card">
      {working ? (
        <p className="rv-body" role="status"><b>{COPY.searching}</b> {COPY.searchingBody}</p>
      ) : f.profile === "error" || job?.status === "failed" ? (
        <p className="rv-body" role="alert">{jobErrorText(job?.errorCode ?? null)}</p>
      ) : !state.revealed ? (
        <p className="rv-body">Busca ativada. Procuramos suas fotos quando o evento for revelado.</p>
      ) : (
        <p className="rv-body">Busca ativada{typeof f.matches === "number" ? ` · ${f.matches === 1 ? "1 sugestão" : `${f.matches} sugestões`}` : ""}.</p>
      )}
      <div className="sa-row">
        <Button small variant="secundario" onClick={onSetup}>Trocar minha foto</Button>
        {state.revealed && !working && f.profile && <Button small variant="secundario" onClick={onRetry}>Procurar de novo</Button>}
      </div>
      <Button variant="texto" onClick={onRevoke}>{COPY.privacy}</Button>
    </div>
  );
}

function EmptyState({ segment, state }: { segment: Segment; state: SmartAlbumState | null }) {
  if (segment === "found") return <div className="sa-empty"><p className="rv-body">{COPY.empty}</p><p className="rv-caption">{COPY.emptyBody}</p></div>;
  if (segment === "favorites") return <div className="sa-empty"><p className="rv-body">Nenhuma favorita ainda.</p><p className="rv-caption">Abra uma foto e toque em Favoritar.{state?.ui ? "" : ""}</p></div>;
  return <div className="sa-empty"><p className="rv-body">Você ainda não tem fotos reveladas.</p><p className="rv-caption">As fotos que você tirar aparecem aqui depois da revelação.</p></div>;
}

function Viewer({ photo, found, favorite, onClose, onFavorite, onHide }: { photo: Photo; found: boolean; favorite: boolean; onClose: () => void; onFavorite: () => void; onHide: () => void }) {
  const { repos } = useApp();
  const { event, viewer, user } = useGuest();
  const urls = usePhotoUrls(useMemo(() => [photo], [photo]), "full");
  const [msg, setMsg] = useState<string | null>(null);
  const canDownload = canDownloadOriginal(event, { host: viewer.host, userId: user.id }, photo);
  return (
    <Sheet title={found ? COPY.results : "Foto"} onClose={onClose} history>
      <div className="sa-stack">
        <img className="sa-full" src={urls[photo.id] ?? BLANK} alt={`Foto de ${photo.authorName}`} />
        {found && <p className="rv-caption">Sugestão automática: pode não ser você.</p>}
        {msg && <p className="sa-note" role="status">{msg}</p>}
        <Button block variant={favorite ? "secundario" : "primario"} icon="estrela" onClick={onFavorite} aria-pressed={favorite}>{favorite ? "Tirar das favoritas" : "Favoritar"}</Button>
        {canDownload && (
          <Button block variant="secundario" icon="baixar" onClick={async () => {
            try { await downloadPhoto(repos, photo); } catch (e) { setMsg(e instanceof DownloadNotAllowedError ? DOWNLOAD_DENIED_TEXT : "Não deu para baixar agora. Tente de novo."); }
          }}>Baixar</Button>
        )}
        {found && <Button block variant="texto" onClick={onHide}>Não sou eu · ocultar</Button>}
      </div>
    </Sheet>
  );
}
