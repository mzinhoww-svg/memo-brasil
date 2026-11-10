/* eslint-disable @next/next/no-img-element -- fotos de exemplo vêm de blob URLs em memória e das cenas do kit */
"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Photo } from "@/domain/photo";
import { createExampleParty, type ExampleParty } from "@/features/demo/example";
import { renderPhoto } from "@/features/photos/capture";

/** Cenas do kit (geradas por `scripts/gen-revela-assets.mjs`): fotos de quem já está na festa e imagem do disparo sem câmera. */
const SCENES = ["pista", "aliancas", "bolo", "brinde", "baloes", "bolo-natural", "camera"] as const;
const scene = (i: number, w: 360 | 720 = 720) => `/revela/exemplo/sc-${SCENES[((i % SCENES.length) + SCENES.length) % SCENES.length]}-${w}.webp`;

const svg = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

/**
 * Festa de exemplo sem cadastro (`/exemplo`): câmera do convidado (Convidado-camera) e o feed (Feed-evento) com as cenas `sc-*`.
 * Tudo vive só em memória (`createExampleParty`): nada é salvo no navegador nem no servidor e some ao sair da página.
 */
export default function Exemplo() {
  const [party, setParty] = useState<ExampleParty | undefined>();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [mine, setMine] = useState(0);
  const [view, setView] = useState<"camera" | "feed">("camera");
  // a câmera só liga quando a pessoa pede (ação visível); "recusada" = permissão negada, "sem" = aparelho sem câmera
  const [camera, setCamera] = useState<"parada" | "pedindo" | "ligada" | "recusada" | "sem">("parada");
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const released = useRef<Array<() => void>>([]);

  const load = useCallback(async (p: ExampleParty) => {
    const all = (await p.repos.photos.listByEvent(p.event.id)).sort((a, b) => b.createdAt - a.createdAt);
    const next: Record<string, string> = {};
    for (const ph of all) {
      const u = await p.repos.photos.getUrl(ph.id, "thumb");
      if (u) {
        released.current.push(u.release);
        next[ph.id] = u.url;
      }
    }
    setPhotos(all);
    setUrls(next);
  }, []);

  useEffect(() => {
    let alive = true;
    const releases = released.current;
    void createExampleParty(Date.now()).then(async (p) => {
      if (!alive) return;
      setParty(p);
      await load(p);
    });
    return () => {
      alive = false;
      releases.forEach((r) => r());
    };
  }, [load]);

  const stop = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
  }, []);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      stop(); // sair da página sempre desliga a câmera
    };
  }, [stop]);

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) return setCamera("sem");
    setCamera("pedindo");
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      if (!mounted.current) return s.getTracks().forEach((t) => t.stop()); // saiu antes de responder ao aviso
      stream.current = s;
      if (video.current) {
        video.current.srcObject = s;
        await video.current.play().catch(() => undefined);
      }
      setCamera("ligada");
    } catch (e) {
      if (mounted.current) setCamera((e as DOMException)?.name === "NotAllowedError" ? "recusada" : "sem");
    }
  }

  if (!party) return <main className="app-col" aria-busy="true"><p className="app-screen app-muted" role="status">Preparando a festa de exemplo…</p></main>;

  const left = party.shotsLimit - mine;

  async function shoot() {
    if (!party || left <= 0) return;
    const v = video.current;
    let data: { bytes: ArrayBuffer; type: string };
    if (camera === "ligada" && v?.videoWidth) data = await renderPhoto(v, v.videoWidth, v.videoHeight, "original");
    else {
      const res = await fetch(scene(mine + 1));
      data = { bytes: await res.arrayBuffer(), type: "image/webp" };
    }
    const photo: Photo = {
      id: crypto.randomUUID(), eventId: party.event.id, authorId: party.host.id, authorName: "Você", createdAt: Date.now(),
      moment: "Pista", status: "visivel", reports: 0, highlighted: false, version: 1, uploadStatus: "pronta",
    };
    await party.repos.photos.add(photo, data);
    setMine((n) => n + 1);
    await load(party);
  }

  const title = party.event.title;
  const message = camera === "parada" ? "A câmera fica desligada até você pedir." : camera === "pedindo" ? "Permita o acesso no aviso do navegador." : camera === "recusada" ? "Acesso à câmera recusado. O disparo usa uma imagem de exemplo." : camera === "sem" ? "Sem câmera: o disparo usa uma imagem de exemplo." : null;

  if (view === "feed") {
    // Feed-evento: as fotos da turma (cenas) e as suas, no formato de post
    return (
      <main>
        <div className="scr">
          <div className="safe" style={{ paddingBottom: "0", overflow: "hidden auto" }}>
            <div className="row between">
              <div>
                <div className="rv-stamp" style={{ fontSize: "12px" }} data-testid="selo-exemplo">Exemplo · nada é salvo</div>
                <h1 className="rv-display" style={{ fontSize: "34px", lineHeight: "36px", marginTop: "4px" }}>{title}</h1>
              </div>
              <button className="rv-icon-btn" aria-label="Voltar para a câmera" onClick={() => setView("camera")}>
                <svg {...svg}><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3" /></svg>
              </button>
            </div>
            <h2 className="rv-title" style={{ fontSize: "22px", marginTop: "16px" }}>Agora</h2>
            <p className="rv-caption">Assim a festa aparece para todo mundo. As fotos da Ana, do Beto e da turma são de exemplo.</p>
            {photos.map((p, i) => (
              <article className="post" key={p.id}>
                <div className="post-h">
                  <span className="avatar avatar--sm">{p.authorName.slice(0, 1).toUpperCase()}</span>
                  <div style={{ flex: "1" }}>
                    <b>{p.authorName}</b>
                    <span>{p.moment}</span>
                  </div>
                </div>
                <div className="rv-print" style={{ width: "350px", height: "392px", transform: "rotate(0deg)", zIndex: "1" }}>
                  <img src={p.authorName === "Você" ? urls[p.id] : scene(i)} alt={`Foto de exemplo de ${p.authorName}, momento ${p.moment}`} />
                  <div className="rv-print__cap"><span>{p.moment}</span><span>{p.authorName}</span></div>
                </div>
              </article>
            ))}
            <div style={{ display: "grid", gap: "10px", padding: "20px 0 calc(34px + env(safe-area-inset-bottom))" }}>
              <Link href="/criar" className="rv-btn rv-btn--block rv-btn--primary">Criar meu evento grátis</Link>
              <p className="rv-caption center">Grátis até 10 convidados. Sem cartão.</p>
            </div>
          </div>
          <div className="grain" />
        </div>
      </main>
    );
  }

  // Convidado-camera: visor, contador, disparo e rolo
  return (
    <main>
      <div className="scr camscr">
        <div className="vf">
          <img src={scene(0)} alt="" style={{ display: camera === "ligada" ? "none" : "block" }} />
          <video ref={video} playsInline muted aria-label="Câmera ao vivo" style={{ width: "100%", height: "100%", objectFit: "cover", display: camera === "ligada" ? "block" : "none" }} />
          <div className="vf-top">
            <Link href="/" className="glass" aria-label="Sair"><svg {...svg}><path d="M6 6l12 12M18 6L6 18" /></svg></Link>
            <h1 className="vf-title">{title}</h1>
            <span data-testid="selo-exemplo" className="rv-stamp" style={{ fontSize: "10px", color: "var(--paper)", maxWidth: "80px", textAlign: "right" }}>Exemplo · nada é salvo</span>
          </div>
          {message && (
            <div role="status" style={{ position: "absolute", left: "24px", right: "24px", bottom: "90px", display: "grid", gap: "10px", justifyItems: "center", textAlign: "center", padding: "12px 14px", borderRadius: "var(--radius-md)", background: "var(--shade)", color: "var(--paper)", font: "500 14px/19px var(--font-sans)" }}>
              <span>{message}</span>
              {(camera === "parada" || camera === "recusada") && <button className="rv-btn rv-btn--primary" onClick={() => void startCamera()}>{camera === "recusada" ? "Tentar de novo" : "Ligar a câmera"}</button>}
            </div>
          )}
          {camera === "ligada" && (
            <button className="glass" style={{ position: "absolute", right: "12px", bottom: "16px", width: "auto", padding: "0 14px", borderRadius: "22px", font: "500 14px/18px var(--font-sans)" }} onClick={() => { stop(); setCamera("parada"); }}>Desligar a câmera</button>
          )}
          <div className="vf-corners"><i /><i /><i /><i /></div>
        </div>
        <div className="body body--casamento">
          <div className="body-shade" />
          <div className="body-row">
            <div className="rv-counter" aria-live="polite">
              <b>{left}</b>
              <span>{left === 1 ? "Foto restante" : "Fotos restantes"}</span>
            </div>
            <button className="shutter" aria-label={left <= 0 ? "Rolo acabou" : "Tirar foto de exemplo"} disabled={left <= 0} onClick={() => void shoot()}>
              <i />
            </button>
            <div className="wheel" aria-hidden="true" />
          </div>
          <div className="body-foot">
            <button className="filmstack" aria-label="Minhas fotos" onClick={() => setView("feed")}>
              <i />
              <i />
            </button>
            <Link href="/criar" className="rv-btn rv-btn--primary" style={{ minHeight: "44px" }}>Criar meu evento grátis</Link>
          </div>
        </div>
        <div className="grain" />
      </div>
    </main>
  );
}
