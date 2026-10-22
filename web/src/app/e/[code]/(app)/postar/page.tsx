"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Breadcrumbs, Button, Chip, Chips, Field, Progress } from "@/components/memoriesmt";
import { eventStatus, isRevealed, shotsLeft } from "@/domain/event";
import { useApp } from "@/features/app/provider";
import { useGuest } from "@/features/events/guest-context";
import { cameraPromptWhen, factsFromEvent } from "@/features/invitations/invite-copy";
import { cameraHelp, fileToImage, isEmbeddedBrowser, renderPhoto } from "@/features/photos/capture";
import { postPhoto, release, retryDelayMs } from "@/features/photos/service";
import type { PhotoData } from "@/repositories";

/**
 * permissao = pré-permissão (explica a câmera antes de pedir); negada = o navegador recusou; sem-camera = aparelho sem câmera ao vivo;
 * guardando = enviando; sem-sinal = o envio caiu e a mesma foto tenta de novo (mesma photoId).
 */
type Phase = "iniciando" | "permissao" | "camera" | "negada" | "sem-camera" | "capturada" | "guardando" | "sem-sinal" | "publicada";
const REMEMBER_KEY = "mm-camera-liberada";
const remembered = () => { try { return localStorage.getItem(REMEMBER_KEY) === "1"; } catch { return false; } };
const remember = () => { try { localStorage.setItem(REMEMBER_KEY, "1"); } catch { /* sem armazenamento: pergunta de novo da próxima vez */ } };
const SUGGESTIONS = ["Alguém precisava registrar isso.", "Ninguém segurou a emoção.", "Quem viu, viu.", "Só daqui dá para ver."];

export default function Postar() {
  const { repos, now: clock } = useApp();
  const { event, user, participant, now, counts, refresh } = useGuest();
  const [phase, setPhase] = useState<Phase>("iniciando");
  const [armed, setArmed] = useState(false); // true depois que a pessoa liberou (ou já tinha liberado) a câmera
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [moment, setMoment] = useState(event.moments[0] ?? "Agora");
  const [caption, setCaption] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [attempt, setAttempt] = useState(0);
  const [shot, setShot] = useState<{ data: PhotoData; url: string } | undefined>();
  const [retry, setRetry] = useState<{ n: number; at: number } | "esgotado" | undefined>();
  const [secsLeft, setSecsLeft] = useState(0);
  const [frozenLeft, setFrozenLeft] = useState<number | null | undefined>(); // o contador só muda quando a foto chegar
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const photoId = useRef<string>(crypto.randomUUID()); // a mesma em todas as tentativas desta foto
  const failures = useRef(0);
  const sending = useRef(false);
  const picked = useRef(false); // já há foto (câmera ou galeria): uma resposta tardia do navegador não pode trocar a tela
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const inFlight = phase === "guardando" || phase === "sem-sinal";
  const used = counts.mine;
  const realLeft = shotsLeft(event, used);
  const left = inFlight && frozenLeft !== undefined ? frozenLeft : realLeft;
  const ended = eventStatus(event, now) === "encerrado";
  const noRoll = left !== null && left <= 0;
  const blocked = !inFlight && (ended || noRoll);
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;

  const stop = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }, []);

  // 1) decide se pede a câmera já ou explica antes (pré-permissão)
  useEffect(() => {
    if (blocked || armed) return;
    let live = true;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) return void (live && setPhase("sem-camera"));
      let state: PermissionState | undefined;
      try { state = (await navigator.permissions?.query({ name: "camera" as PermissionName }))?.state; } catch { /* Safari não consulta a câmera */ }
      if (!live || picked.current) return; // a pessoa já escolheu uma foto da galeria enquanto isso
      if (state === "granted" || remembered()) setArmed(true);
      else if (state === "denied") setPhase("negada");
      else setPhase("permissao");
    })();
    return () => { live = false; };
  }, [blocked, armed, attempt]);

  // 2) abre a câmera depois da pré-permissão
  useEffect(() => {
    if (blocked || !armed) return;
    let live = true;
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false });
        if (!live || picked.current) return s.getTracks().forEach((t) => t.stop());
        stream.current = s;
        if (video.current) {
          video.current.srcObject = s;
          await video.current.play().catch(() => undefined);
        }
        remember();
        if (picked.current) return; // escolheu da galeria durante o play(): a tela já é a da prévia
        setPhase((p) => (p === "iniciando" ? "camera" : p));
      } catch (e) {
        const name = e instanceof DOMException ? e.name : "";
        if (live) setPhase(name === "NotFoundError" || name === "OverconstrainedError" ? "sem-camera" : "negada");
      }
    })();
    return () => {
      live = false;
      stop();
    };
  }, [facing, stop, blocked, armed, attempt]);

  useEffect(() => () => shot && URL.revokeObjectURL(shot.url), [shot]);

  function allowCamera() {
    setError(undefined);
    setPhase("iniciando");
    setArmed(true);
    setAttempt((n) => n + 1);
  }

  async function capture() {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    setError(undefined);
    try {
      const data = await renderPhoto(v, v.videoWidth, v.videoHeight, event.cameraStyle, facing === "user");
      setShot({ data, url: URL.createObjectURL(new Blob([data.bytes], { type: data.type })) });
      picked.current = true;
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
      picked.current = true;
      stop();
      setPhase("capturada");
    } catch {
      setError("Essa imagem não abriu. Tente outra foto.");
    }
  }

  /** Envia (ou reenvia, com a mesma photoId) e decide o próximo passo conforme o tipo de falha. */
  async function send(resume: boolean) {
    if (!shot || sending.current) return;
    sending.current = true;
    if (!resume) { failures.current = 0; setFrozenLeft(realLeft); }
    setRetry(undefined);
    setError(undefined);
    setPhase("guardando");
    try {
      const r = await postPhoto(repos, event, user, shot.data, { moment, caption, tableLabel: participant?.tableLabel }, clock(), { photoId: photoId.current, resume });
      if (!alive.current) return;
      if (r.ok) {
        await refresh();
        setFrozenLeft(undefined);
        photoId.current = crypto.randomUUID();
        setPhase("publicada");
        return;
      }
      if (r.reason === "rede") {
        failures.current += 1;
        const delay = retryDelayMs(failures.current);
        setPhase("sem-sinal");
        setSecsLeft(delay === null ? 0 : Math.ceil(delay / 1000));
        setRetry(delay === null ? "esgotado" : { n: failures.current, at: Date.now() + delay });
        return;
      }
      photoId.current = crypto.randomUUID(); // a reserva foi liberada: a próxima tentativa é uma foto nova
      setFrozenLeft(undefined);
      setPhase("capturada");
      setError(
        r.reason === "rolo" ? "Você usou todas as suas fotos deste evento."
        : r.reason === "encerrado" ? "O evento terminou. Não dá mais para postar."
        : r.reason === "arquivo" ? "Essa foto não pode ser postada. Tire outra."
        : r.reason === "armazenamento" ? "Não deu para guardar a foto. Verifique o espaço livre no aparelho."
        : "Não deu para enviar a foto. Tente de novo.",
      );
    } finally {
      sending.current = false;
    }
  }
  const sendRef = useRef(send);
  useEffect(() => { sendRef.current = send; });

  const retryAt = typeof retry === "object" ? retry.at : undefined;
  // contagem da nova tentativa automática (2 s, 5 s, 15 s) e retomada imediata quando a internet volta
  useEffect(() => {
    if (phase !== "sem-sinal" || retryAt === undefined) return;
    const tick = setInterval(() => {
      setSecsLeft(Math.max(0, Math.ceil((retryAt - Date.now()) / 1000)));
      if (Date.now() >= retryAt) { clearInterval(tick); void sendRef.current(true); }
    }, 250);
    return () => clearInterval(tick);
  }, [phase, retryAt]);
  useEffect(() => {
    if (phase !== "sem-sinal") return;
    const onOnline = () => void sendRef.current(true);
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [phase]);

  async function again() {
    if (inFlight) await release(repos, photoId.current); // descarta a foto que não chegou a sair
    photoId.current = crypto.randomUUID();
    failures.current = 0;
    setFrozenLeft(undefined);
    setRetry(undefined);
    picked.current = false;
    setShot(undefined);
    setCaption("");
    setError(undefined);
    setPhase("iniciando");
    setAttempt((n) => n + 1);
  }

  const base = `/e/${event.code}`;
  const facts = factsFromEvent(event, now);
  const embedded = isEmbeddedBrowser(ua);
  const help = cameraHelp(ua);
  const choosing = phase === "iniciando" || phase === "camera";
  const picking = phase === "permissao" || phase === "negada" || phase === "sem-camera";
  const pickGallery = () => galleryInput.current?.click();
  return (
    <div className="app-screen" data-fase={phase}>
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
          {phase === "permissao" ? (
            <section className="app-stack" aria-labelledby="perm-h">
              <p className="eyebrow app-eyebrow">Para começar</p>
              <h1 id="perm-h" className="titulo-tela app-h1">Libere a câmera</h1>
              <p className="emocao app-emocao">{left === null ? "Ela destrava as suas fotos" : `Ela destrava suas ${left} ${left === 1 ? "foto" : "fotos"}`}</p>
              <p className="corpo app-p">Cada foto vai para o álbum da festa e aparece para todos {cameraPromptWhen(facts, now)}.</p>
              <div className="app-stack-sm">
                <Button variant="cta-xl" icon="camera" block onClick={allowCamera}>Liberar câmera</Button>
                <Button variant="texto" block onClick={pickGallery}>Prefiro escolher da galeria</Button>
              </div>
            </section>
          ) : phase === "negada" ? (
            <section className="app-stack" aria-labelledby="neg-h">
              <h1 id="neg-h" className="titulo-tela app-h1">Tudo bem, use a galeria.</h1>
              <p className="corpo app-p">Escolha fotos que você tirou hoje na festa. Elas contam no seu rolo como as da câmera.</p>
              <Button variant="cta" icon="camera" block onClick={pickGallery}>Escolher da galeria</Button>
              <div className="app-card" data-testid="ajuda-camera">
                <span className="eyebrow app-muted">Quer usar a câmera?</span>
                <ol className="app-passos">
                  {help.steps.map((t) => <li key={t}>{t}</li>)}
                </ol>
                <span className="meta app-muted">Passos para {help.browser}.</span>
                <Button variant="secundario" block onClick={allowCamera}>Tentar a câmera de novo</Button>
              </div>
              {embedded && <p className="corpo app-p">Abriu pelo Instagram ou WhatsApp? Toque em ⋯ e escolha <strong>Abrir no navegador</strong>.</p>}
            </section>
          ) : phase === "sem-camera" ? (
            <section className="app-stack" aria-labelledby="sem-h">
              <h1 id="sem-h" className="titulo-tela app-h1">Sem câmera por aqui.</h1>
              <p className="corpo app-p">Este aparelho ou navegador não abriu a câmera ao vivo. Use a câmera do aparelho ou escolha uma foto da galeria.</p>
              <div className="app-stack-sm">
                <Button variant="cta" icon="camera" block onClick={() => cameraInput.current?.click()}>Abrir a câmera do aparelho</Button>
                <Button variant="secundario" block onClick={pickGallery}>Escolher da galeria</Button>
              </div>
              {embedded && <p className="corpo app-p">Abriu pelo Instagram ou WhatsApp? Toque em ⋯ e escolha <strong>Abrir no navegador</strong>.</p>}
            </section>
          ) : (
            <h1 className="titulo-tela app-h1">Postar daqui</h1>
          )}

          {left !== null && (
            <div className="app-contador" data-testid="contador-rolo">
              <span className="display">{left}</span>
              <span className="eyebrow app-muted">de {event.shotsPerPerson} fotos</span>
            </div>
          )}

          {!picking && (
            <div className="app-camera" aria-live="polite">
              {phase === "capturada" || phase === "guardando" || phase === "sem-sinal" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={shot?.url} alt="Prévia da sua foto" />
              ) : (
                <>
                  <video ref={video} playsInline muted aria-label="Câmera ao vivo" style={{ display: phase === "camera" ? "block" : "none", transform: facing === "user" ? "scaleX(-1)" : undefined }} />
                  {phase === "iniciando" && <p className="app-camera-msg">Abrindo a câmera…</p>}
                </>
              )}
            </div>
          )}

          {error && <p className="mm-field-erro" role="alert">{error}</p>}

          {phase === "guardando" && (
            <div className="app-stack-sm" role="status">
              <Progress label="Foto" status="Enviando…" />
              <p className="app-p app-muted">O contador só muda quando a foto chegar.</p>
            </div>
          )}

          {phase === "sem-sinal" && (
            <div className="app-stack-sm" role="status" aria-live="polite" data-testid="sem-sinal">
              <h2 className="titulo-tela app-h1">Sem sinal.</h2>
              <p className="corpo app-p">Não feche esta tela: sua foto vai assim que a internet voltar.</p>
              <p className="app-p app-muted">
                {retry === "esgotado" ? "Ainda sem conexão. Toque em Tentar agora quando a internet voltar." : retry ? `Tentativa ${retry.n} de 3 · próxima em ${secsLeft} s` : null}
              </p>
              <Button variant="secundario" block onClick={() => void send(true)}>Tentar agora</Button>
            </div>
          )}

          {choosing && (
            <div className="app-stack-sm">
              {phase === "camera" && <Button variant="cta-xl" icon="camera" block onClick={capture}>Tirar foto</Button>}
              <div className="app-row">
                {phase === "camera" && <Button variant="secundario" className="" onClick={() => setFacing(facing === "environment" ? "user" : "environment")}>Virar câmera</Button>}
                <Button variant="secundario" onClick={pickGallery}>Escolher da galeria</Button>
              </div>
            </div>
          )}

          {/* dois caminhos distintos (UX-02): a galeria NÃO leva `capture`, senão o aparelho abre a câmera em vez da galeria */}
          <input ref={galleryInput} type="file" accept="image/*" hidden aria-label="Escolher foto do aparelho" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }} />
          <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden aria-label="Tirar foto com a câmera do aparelho" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }} />

          {(phase === "capturada" || phase === "guardando" || phase === "sem-sinal") && (
            <div className="app-stack">
              <div className="app-stack-sm">
                <span className="mm-group-label" id="mom">Momento</span>
                <Chips label="Momento">
                  {event.moments.map((m) => (
                    <Chip key={m} variant="filtro" pressed={moment === m} onClick={() => setMoment(m)}>{m}</Chip>
                  ))}
                </Chips>
              </div>
              <Field label="Legenda (opcional)" value={caption} maxLength={140} placeholder="Ex.: Ninguém segurou a emoção." onChange={(e) => setCaption(e.target.value)} disabled={inFlight} />
              <Chips label="Sugestões de legenda">
                {SUGGESTIONS.map((s) => (
                  <Chip key={s} variant="sugestao" onClick={() => setCaption(s)}>{s}</Chip>
                ))}
              </Chips>
              <p className="app-p app-muted">Ao postar, você declara ter o direito de compartilhar a foto com as pessoas autorizadas neste evento.</p>
              <div className="app-stack-sm">
                <Button variant="cta" icon="camera" block disabled={inFlight} onClick={() => void send(false)}>{phase === "guardando" ? "Enviando…" : "Postar"}</Button>
                <Button variant="texto" onClick={() => void again()} disabled={phase === "guardando"}>{phase === "sem-sinal" ? "Descartar e tirar outra" : "Tirar outra"}</Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
