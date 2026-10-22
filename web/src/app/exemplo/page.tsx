/* eslint-disable @next/next/no-img-element -- fotos de exemplo vêm de blob URLs em memória */
"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Icon } from "@/components/memoriesmt";
import type { Photo } from "@/domain/photo";
import { createExampleParty, type ExampleParty } from "@/features/demo/example";
import { sampleImage } from "@/features/demo/seed";
import { renderPhoto } from "@/features/photos/capture";

/**
 * Tela S3: festa de exemplo sem cadastro. Tudo vive só em memória (`createExampleParty`):
 * nada é salvo no navegador nem no servidor e some ao sair da página.
 */
export default function Exemplo() {
  const [party, setParty] = useState<ExampleParty | undefined>();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [mine, setMine] = useState(0);
  const [camera, setCamera] = useState<"pedindo" | "ligada" | "sem">("pedindo");
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

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) return void (alive && setCamera("sem"));
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (!alive) return s.getTracks().forEach((t) => t.stop());
        stream.current = s;
        if (video.current) {
          video.current.srcObject = s;
          await video.current.play().catch(() => undefined);
        }
        setCamera("ligada");
      } catch {
        if (alive) setCamera("sem");
      }
    })();
    return () => {
      alive = false;
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  if (!party) return <main className="app-col" aria-busy="true"><p className="app-screen app-muted" role="status">Preparando a festa de exemplo…</p></main>;

  const left = party.shotsLimit - mine;

  async function shoot() {
    if (!party || left <= 0) return;
    const v = video.current;
    const data = camera === "ligada" && v?.videoWidth ? await renderPhoto(v, v.videoWidth, v.videoHeight, "original") : sampleImage(mine + 20);
    const photo: Photo = {
      id: crypto.randomUUID(), eventId: party.event.id, authorId: party.host.id, authorName: "Você", createdAt: Date.now(),
      moment: "Pista", status: "visivel", reports: 0, highlighted: false, version: 1, uploadStatus: "pronta",
    };
    await party.repos.photos.add(photo, data);
    setMine((n) => n + 1);
    await load(party);
  }

  return (
    <main className="app-col app-col--card app-fluid">
      <div className="app-topbar" style={{ background: "var(--tinta)", color: "var(--on-acao, #fff)", padding: "12px var(--space-4)" }}>
        <span className="eyebrow" data-testid="selo-exemplo" style={{ color: "inherit", fontWeight: 800 }}>Exemplo · nada é salvo</span>
        <Link href="/" className="app-link" style={{ color: "inherit", minHeight: 44, display: "inline-flex", alignItems: "center" }}>Sair</Link>
      </div>
      <div className="app-screen">
        <div className="app-stack-sm">
          <p className="eyebrow app-eyebrow">Festa de exemplo · ao vivo</p>
          <h1 className="titulo-tela app-h1">{party.event.title}</h1>
          <p className="corpo app-p app-muted">Tire até {party.shotsLimit} fotos para sentir como é. Elas ficam só neste aparelho e somem quando você sair.</p>
        </div>

        <div className="app-camera-box" style={{ borderRadius: "var(--radius-panel)", overflow: "hidden", background: "var(--tinta)", aspectRatio: "4 / 3", display: "grid", placeItems: "center" }}>
          <video ref={video} playsInline muted aria-label="Câmera ao vivo" style={{ width: "100%", height: "100%", objectFit: "cover", display: camera === "ligada" ? "block" : "none" }} />
          {camera !== "ligada" && <span className="meta" style={{ color: "var(--on-acao, #fff)", opacity: 0.8 }}>{camera === "pedindo" ? "Abrindo a câmera…" : "Sem câmera: o disparo usa uma imagem de exemplo."}</span>}
        </div>

        <div className="app-between">
          <p aria-live="polite" style={{ margin: 0 }}>
            <span className="display" style={{ fontSize: 40, display: "block" }}>{left}</span>
            <span className="eyebrow app-muted">{left === 1 ? "Foto restante" : "Fotos restantes"}</span>
          </p>
          <Button variant="cta" icon="camera" onClick={() => void shoot()} disabled={left <= 0}>{left <= 0 ? "Rolo acabou" : "Tirar foto de exemplo"}</Button>
        </div>

        <section className="app-stack-sm" aria-labelledby="como-fica">
          <h2 id="como-fica" className="titulo-card app-h1">Agora</h2>
          <p className="app-p app-muted">Assim a festa aparece para todo mundo. As fotos da Ana, do Beto e da turma são de exemplo.</p>
          <div className="app-grid-3">
            {photos.map((p) => (
              <div key={p.id} className="app-thumb">
                {urls[p.id] && <img src={urls[p.id]} alt={`Foto de exemplo de ${p.authorName}, momento ${p.moment}`} />}
              </div>
            ))}
          </div>
        </section>

        <div className="app-stack-sm" style={{ marginTop: "auto" }}>
          <Button href="/criar" block>Criar meu evento grátis</Button>
          <p className="app-p app-muted meta" style={{ textAlign: "center" }}><Icon name="casal" decorative size={16} /> Grátis até 10 convidados. Sem cartão.</p>
        </div>
      </div>
    </main>
  );
}
