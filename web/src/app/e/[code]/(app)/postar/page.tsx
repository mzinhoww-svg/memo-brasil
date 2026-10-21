"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Breadcrumbs, Button, Chip, Chips, Field, Progress } from "@/components/memoriesmt";
import { eventStatus, isRevealed, shotsLeft } from "@/domain/event";
import { useApp } from "@/features/app/provider";
import { useGuest } from "@/features/events/guest-context";
import { fileToImage, renderPhoto } from "@/features/photos/capture";
import { postPhoto } from "@/features/photos/service";
import type { PhotoData } from "@/repositories";

type Phase = "iniciando" | "camera" | "sem-camera" | "capturada" | "guardando" | "publicada";
const SUGGESTIONS = ["Alguém precisava registrar isso.", "Ninguém segurou a emoção.", "Quem viu, viu.", "Só daqui dá para ver."];

export default function Postar() {
  const { repos, now: clock } = useApp();
  const { event, user, participant, now, counts, refresh } = useGuest();
  const [phase, setPhase] = useState<Phase>("iniciando");
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [moment, setMoment] = useState(event.moments[0] ?? "Agora");
  const [caption, setCaption] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [attempt, setAttempt] = useState(0);
  const [shot, setShot] = useState<{ data: PhotoData; url: string } | undefined>();
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const used = counts.mine;
  const left = shotsLeft(event, used);
  const ended = eventStatus(event, now) === "encerrado";
  const noRoll = left !== null && left <= 0;
  const blocked = ended || noRoll;

  const stop = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }, []);

  useEffect(() => {
    if (blocked) return;
    let alive = true;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) return void (alive && setPhase("sem-camera"));
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false });
        if (!alive) return s.getTracks().forEach((t) => t.stop());
        stream.current = s;
        if (video.current) {
          video.current.srcObject = s;
          await video.current.play().catch(() => undefined);
        }
        setPhase("camera");
      } catch {
        if (alive) setPhase("sem-camera");
      }
    })();
    return () => {
      alive = false;
      stop();
    };
  }, [facing, stop, blocked, attempt]);

  useEffect(() => () => shot && URL.revokeObjectURL(shot.url), [shot]);

  async function capture() {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    setError(undefined);
    try {
      const data = await renderPhoto(v, v.videoWidth, v.videoHeight, event.cameraStyle, facing === "user");
      setShot({ data, url: URL.createObjectURL(new Blob([data.bytes], { type: data.type })) });
      stop();
      setPhase("capturada");
    } catch {
      setError("Não foi possível tirar a foto. Tente de novo.");
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(undefined);
    try {
      const img = await fileToImage(file);
      const data = await renderPhoto(img, img.naturalWidth, img.naturalHeight, event.cameraStyle);
      setShot({ data, url: URL.createObjectURL(new Blob([data.bytes], { type: data.type })) });
      stop();
      setPhase("capturada");
    } catch {
      setError("Essa imagem não abriu. Tente outra foto.");
    }
  }

  async function publish() {
    if (!shot) return;
    setPhase("guardando");
    const r = await postPhoto(repos, event, user, shot.data, { moment, caption, tableLabel: participant?.tableLabel }, clock());
    if (!r.ok) {
      setPhase("capturada");
      setError(r.reason === "rolo" ? "Você usou todas as suas fotos deste evento." : r.reason === "encerrado" ? "O evento terminou. Não dá mais para postar." : r.reason === "arquivo" ? "Essa foto não pode ser postada. Tire outra." : "Não deu para guardar a foto. Verifique o espaço livre no aparelho.");
      return;
    }
    await refresh();
    setPhase("publicada");
  }

  function again() {
    setShot(undefined);
    setCaption("");
    setError(undefined);
    setPhase("iniciando");
    setAttempt((n) => n + 1);
  }

  const base = `/e/${event.code}`;
  return (
    <div className="app-screen">
      <div className="app-between">
        <Breadcrumbs items={[{ label: "Agora", href: `${base}/agora` }, { label: "Postar" }]} />
        <span className="eyebrow app-muted" aria-live="polite">{left === null ? "Rolo ilimitado" : left === 1 ? "1 foto restante" : `${left} fotos restantes`}</span>
      </div>

      {phase === "publicada" ? (
        <div className="app-stack">
          <p className="emocao-lg app-emocao">Sua visão entrou na história.</p>
          {!isRevealed(event, now) && <p className="corpo app-p app-muted" data-testid="guardada-no-escuro">Sua foto ficou guardada no escuro. Ela aparece para todos na revelação.</p>}
          <div className="app-stack-sm">
            <Button href={`${base}/agora`} block>Ver no Agora</Button>
            {(left === null || left > 0) && <Button variant="secundario" block onClick={again}>Postar outra</Button>}
          </div>
        </div>
      ) : blocked ? (
        <div className="app-stack">
          <h1 className="titulo-tela app-h1">{ended ? "O evento terminou." : "Seu rolo acabou."}</h1>
          <p className="corpo app-p">{ended ? "Não dá mais para postar. As fotos estão no Agora." : "Você usou todas as suas fotos deste evento."}</p>
          <Button href={`${base}/agora`} block>Ver no Agora</Button>
        </div>
      ) : (
        <>
          <h1 className="titulo-tela app-h1">Postar daqui</h1>
          <div className="app-camera" aria-live="polite">
            {phase === "capturada" || phase === "guardando" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shot?.url} alt="Prévia da sua foto" />
            ) : (
              <>
                <video ref={video} playsInline muted aria-label="Câmera ao vivo" style={{ display: phase === "camera" ? "block" : "none", transform: facing === "user" ? "scaleX(-1)" : undefined }} />
                {phase === "iniciando" && <p className="app-camera-msg">Abrindo a câmera…</p>}
                {phase === "sem-camera" && <p className="app-camera-msg">O MemoriesMT precisa da câmera para você postar. Libere nas permissões do navegador ou escolha uma foto.</p>}
              </>
            )}
          </div>

          {error && <p className="mm-field-erro" role="alert">{error}</p>}

          {phase === "guardando" && <Progress label="Foto 1" status="Guardando" value={60} />}

          {(phase === "camera" || phase === "sem-camera") && (
            <div className="app-stack-sm">
              {phase === "camera" && <Button variant="cta-xl" icon="camera" block onClick={capture}>Tirar foto</Button>}
              <div className="app-row">
                {phase === "camera" && <Button variant="secundario" className="" onClick={() => setFacing(facing === "environment" ? "user" : "environment")}>Virar câmera</Button>}
                <Button variant="secundario" onClick={() => fileInput.current?.click()}>Escolher foto</Button>
              </div>
              <input ref={fileInput} type="file" accept="image/*" capture="environment" hidden aria-label="Escolher foto do aparelho" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }} />
            </div>
          )}

          {(phase === "capturada" || phase === "guardando") && (
            <div className="app-stack">
              <div className="app-stack-sm">
                <span className="mm-group-label" id="mom">Momento</span>
                <Chips label="Momento">
                  {event.moments.map((m) => (
                    <Chip key={m} variant="filtro" pressed={moment === m} onClick={() => setMoment(m)}>{m}</Chip>
                  ))}
                </Chips>
              </div>
              <Field label="Legenda (opcional)" value={caption} maxLength={140} placeholder="Ex.: Ninguém segurou a emoção." onChange={(e) => setCaption(e.target.value)} />
              <Chips label="Sugestões de legenda">
                {SUGGESTIONS.map((s) => (
                  <Chip key={s} variant="sugestao" onClick={() => setCaption(s)}>{s}</Chip>
                ))}
              </Chips>
              <p className="app-p app-muted">Ao postar, você autoriza {event.category === "casamento" ? "os noivos" : "o anfitrião"} a guardar e compartilhar a foto.</p>
              <div className="app-stack-sm">
                <Button variant="cta" icon="camera" block disabled={phase === "guardando"} onClick={publish}>{phase === "guardando" ? "Guardando…" : "Postar"}</Button>
                <Button variant="texto" onClick={again} disabled={phase === "guardando"}>Tirar outra</Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
