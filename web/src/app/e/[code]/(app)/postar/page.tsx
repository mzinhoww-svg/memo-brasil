"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Breadcrumbs, Button, Chip, Chips, Field, Progress } from "@/components/revela";
import { DEFAULT_FILM } from "@/domain/options";
import { eventStatus, isRevealed, shotsLeft } from "@/domain/event";
import { useApp } from "@/features/app/provider";
import { useGuest } from "@/features/events/guest-context";
import { cameraFailure, photoAudienceCopy, cameraHelp, fileToImage, isEmbeddedBrowser, renderPhoto } from "@/features/photos/capture";
import { clearPhotoDraft, loadPhotoDraft, savePhotoDraft, type PhotoDraft } from "@/features/photos/draft";
import { postPhoto, retryDelayMs } from "@/features/photos/service";
import { useAlive } from "@/lib/use-alive";
import type { PhotoData } from "@/repositories";

/**
 * permissao = pré-permissão (explica a câmera antes de pedir); negada = o navegador recusou; sem-camera = aparelho sem câmera ao vivo;
 * guardando = enviando; sem-sinal = o envio caiu e a mesma foto tenta de novo (mesma photoId).
 */
type Phase = "iniciando" | "permissao" | "camera" | "negada" | "sem-camera" | "camera-ocupada" | "camera-interrompida" | "capturada" | "guardando" | "sem-sinal" | "publicada";
const REMEMBER_KEY = "mm-camera-liberada";
const remembered = () => { try { return localStorage.getItem(REMEMBER_KEY) === "1"; } catch { return false; } };
const remember = () => { try { localStorage.setItem(REMEMBER_KEY, "1"); } catch { /* sem armazenamento: pergunta de novo da próxima vez */ } };
const DISCARD_NOTICE = "Descartar apaga apenas o rascunho neste aparelho. O envio pode ter sido confirmado; confira as fotos do evento.";
const SUGGESTIONS = ["Alguém precisava registrar isso.", "Ninguém segurou a emoção.", "Quem viu, viu.", "Só daqui dá para ver."];

export default function Postar() {
  const { event, user } = useGuest();
  return <PostarSession key={JSON.stringify([event.id, user.id])} />;
}

function PostarSession() {
  const { repos, now: clock } = useApp();
  const { event, user, participant, now, counts, refresh } = useGuest();
  const [phase, setPhase] = useState<Phase>("iniciando");
  const [armed, setArmed] = useState(false); // true depois que a pessoa liberou (ou já tinha liberado) a câmera
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [moment, setMoment] = useState(event.moments[0] ?? "Agora");
  const [caption, setCaption] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [denial, setDenial] = useState<string>();
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
  const alive = useAlive();
  const [draftReady, setDraftReady] = useState(false);
  const [savedDraft, setSavedDraft] = useState<PhotoDraft>();
  const [draftWarning, setDraftWarning] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const draftPersisted = useRef(false);
  const draftCreatedAt = useRef(clock());
  const attempted = useRef(false);
  const [hasAttempt, setHasAttempt] = useState(false);
  const confirmed = useRef(false);
  const persistence = useRef(Promise.resolve());
  const persist = (draft: PhotoDraft) => {
    const work = persistence.current.then(async () => {
      const result = await savePhotoDraft(draft);
      if (result.ok) draftPersisted.current = true;
      if (alive.current) setDraftWarning(!result.ok);
    });
    persistence.current = work;
    return work;
  };
  const snapshot = (): PhotoDraft | undefined => shot ? {
    eventId: event.id, userId: user.id, createdAt: draftCreatedAt.current,
    photoId: photoId.current, data: shot.data, caption, moment,
    attempted: attempted.current, failures: failures.current, denial,
  } : undefined;

  useEffect(() => {
    let live = true;
    void loadPhotoDraft(event.id, user.id, clock()).then((result) => {
      if (!live) return;
      setDraftWarning(!result.ok);
      draftPersisted.current = !!result.draft;
      setSavedDraft(result.draft);
      setDraftReady(true);
    });
    return () => { live = false; };
  }, [event.id, user.id, clock]);

  useEffect(() => {
    const draft = snapshot();
    if (draft && !confirmed.current) void persist(draft);
    // Byte e metadados são salvos na mesma fila antes de uma limpeza.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shot, caption, moment]);

  useEffect(() => {
    if (!shot || phase === "publicada") return;
    const beforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    // Navigation API cancela antes de mudar URL/entrada, em ambas as direções.
    // Sem ela, popstate segue ao roteador: não há como inferir entradas anteriores
    // com segurança. O rascunho persistido permite retomar e beforeunload protege recargas.
    const navigation = (window as Window & { navigation?: EventTarget }).navigation;
    const traverse = (e: Event) => {
      if ((e as Event & { navigationType?: string }).navigationType !== "traverse" || !e.cancelable) return;
      if (!window.confirm("Há um rascunho de foto nesta tela. Sair?")) e.preventDefault();
    };
    const navigate = (e: MouseEvent) => {
      const a = (e.target as Element)?.closest?.("a[href]");
      if (!a || a.getAttribute("href")?.startsWith("#") || a.getAttribute("target") === "_blank" || e.metaKey || e.ctrlKey || e.defaultPrevented) return;
      if (!window.confirm("Há um rascunho de foto nesta tela. Sair?")) { e.preventDefault(); e.stopPropagation(); }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", navigate, true);
    navigation?.addEventListener("navigate", traverse);
    return () => { window.removeEventListener("beforeunload", beforeUnload); document.removeEventListener("click", navigate, true); navigation?.removeEventListener("navigate", traverse); };
  }, [shot, phase]);

  const inFlight = discarding || phase === "guardando" || phase === "sem-sinal";
  const used = counts.mine;
  const realLeft = shotsLeft(event, used);
  const left = inFlight && frozenLeft !== undefined ? frozenLeft : realLeft;
  const ended = eventStatus(event, now) === "encerrado";
  const noRoll = left !== null && left <= 0;
  const blocked = !!denial || (!inFlight && !shot && (ended || noRoll));
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;

  const stop = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }, []);

  // 1) decide se pede a câmera já ou explica antes (pré-permissão)
  useEffect(() => {
    if (blocked || armed || !draftReady || savedDraft || picked.current) return;
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
  }, [blocked, armed, attempt, draftReady, savedDraft]);

  // 2) abre a câmera depois da pré-permissão
  useEffect(() => {
    if (blocked || !armed || !draftReady || savedDraft || picked.current) return;
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
        if (live && !picked.current) setPhase(cameraFailure(e));
      }
    })();
    return () => {
      live = false;
      stop();
    };
  }, [facing, stop, blocked, armed, attempt, draftReady, savedDraft]);

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
      const data = await renderPhoto(v, v.videoWidth, v.videoHeight, event.filmLook ?? DEFAULT_FILM, facing === "user");
      if (!alive.current) return;
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
      const data = await renderPhoto(img, img.naturalWidth, img.naturalHeight, event.filmLook ?? DEFAULT_FILM);
      if (!alive.current) return;
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
    const resuming = resume || attempted.current;
    if (!resuming) { failures.current = 0; setFrozenLeft(realLeft); }
    attempted.current = true;
    setHasAttempt(true);
    setRetry(undefined);
    setError(undefined);
    setPhase("guardando");
    try {
      const draft = snapshot();
      if (draft) await persist(draft);
      const r = await postPhoto(repos, event, user, shot.data, { moment, caption, tableLabel: participant?.tableLabel }, clock(), { photoId: photoId.current, resume: resuming });
      if (!alive.current) return;
      if (r.ok) {
        confirmed.current = true;
        await persistence.current;
        const cleared = await clearPhotoDraft(event.id, user.id);
        if (!alive.current) return;
        setDraftWarning(!cleared.ok);
        if (cleared.ok) draftPersisted.current = false;
        // Publicação confirmada não depende da atualização do contador.
        void Promise.resolve().then(refresh).catch(() => undefined);
        setFrozenLeft(undefined);
        photoId.current = crypto.randomUUID();
        setShot(undefined);
        setPhase("publicada");
        return;
      }
      if (r.reason === "rede") {
        failures.current += 1;
        const draft = snapshot();
        if (draft) await persist(draft);
        if (!alive.current) return;
        const delay = retryDelayMs(failures.current);
        setPhase("sem-sinal");
        setSecsLeft(delay === null ? 0 : Math.ceil(delay / 1000));
        setRetry(delay === null ? "esgotado" : { n: failures.current, at: Date.now() + delay });
        return;
      }
      const denied = r.reason === "bloqueado" || r.reason === "acesso" || r.reason === "nao-encontrado";
      // Mesmo erros não classificados como rede podem ter resposta perdida.
      // Só sucesso ou descarte local encerram esta identidade.
      setFrozenLeft(undefined);
      setPhase("capturada");
      const message =
        r.reason === "rolo" ? "Você usou todas as suas fotos deste evento."
        : r.reason === "encerrado" ? "O evento terminou. Não dá mais para postar."
        : r.reason === "arquivo" ? "Essa foto não pode ser postada. Tire outra."
        : r.reason === "bloqueado" ? "Seu acesso para postar foi bloqueado pelo organizador."
        : r.reason === "acesso" ? "Você não tem acesso para postar neste evento."
        : r.reason === "nao-encontrado" ? "O evento ou envio não foi encontrado. Volte ao convite para conferir."
        : r.reason === "armazenamento" ? "Não deu para guardar a foto. Verifique o espaço livre no aparelho."
        : "Não deu para enviar a foto. Tente de novo.";
      setError(message);
      if (denied) setDenial(message);
      const nextDraft = snapshot();
      if (nextDraft) void persist({ ...nextDraft, denial: denied ? message : undefined });
    } catch {
      if (alive.current) {
        setPhase("sem-sinal");
        setRetry("esgotado");
        setError("Não foi possível confirmar o envio. Tente agora com a mesma foto.");
      }
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
    if (sending.current) return;
    sending.current = true;
    setDiscarding(true);
    try {
      await persistence.current;
      const cleared = await clearPhotoDraft(event.id, user.id);
      if (!alive.current) return;
      if (!cleared.ok && draftPersisted.current) {
        setDraftWarning(true);
        setError("Não foi possível apagar o rascunho. Tente descartar novamente.");
        return;
      }
      // Se nada pôde ser persistido, a pessoa ainda pode descartar os bytes em memória.
      setDraftWarning(!cleared.ok);
      if (cleared.ok) draftPersisted.current = false;
      if (!alive.current) return;
      attempted.current = false;
      setHasAttempt(false);
      confirmed.current = false;
      draftCreatedAt.current = clock();
      photoId.current = crypto.randomUUID();
      failures.current = 0;
      setFrozenLeft(undefined);
      setRetry(undefined);
      picked.current = false;
      setShot(undefined);
      setCaption("");
      setDenial(undefined);
      setError(undefined);
      setPhase("iniciando");
      setAttempt((n) => n + 1);
    } finally {
      sending.current = false;
      if (alive.current) setDiscarding(false);
    }
  }

  const base = `/e/${event.code}`;
  const audienceCopy = photoAudienceCopy(event.everyoneSeesAll, isRevealed(event, now));
  const embedded = isEmbeddedBrowser(ua);
  const help = cameraHelp(ua);
  const choosing = phase === "iniciando" || phase === "camera";
  const picking = phase === "permissao" || phase === "negada" || phase === "sem-camera" || phase === "camera-ocupada" || phase === "camera-interrompida";
  const pickGallery = () => galleryInput.current?.click();
  function resumeDraft() {
    if (!savedDraft) return;
    picked.current = true;
    photoId.current = savedDraft.photoId;
    draftCreatedAt.current = savedDraft.createdAt;
    attempted.current = savedDraft.attempted;
    setHasAttempt(savedDraft.attempted);
    failures.current = savedDraft.failures;
    setMoment(savedDraft.moment);
    setCaption(savedDraft.caption);
    setDenial(savedDraft.denial);
    setShot({ data: savedDraft.data, url: URL.createObjectURL(new Blob([savedDraft.data.bytes], { type: savedDraft.data.type })) });
    setPhase(savedDraft.attempted && !savedDraft.denial ? "sem-sinal" : "capturada");
    if (savedDraft.attempted && !savedDraft.denial) setRetry("esgotado");
    setSavedDraft(undefined);
  }

  async function discardDraft() {
    if (!savedDraft || sending.current) return;
    sending.current = true;
    setDiscarding(true);
    try {
      const result = await clearPhotoDraft(event.id, user.id);
      if (!alive.current) return;
      if (!result.ok) { setDraftWarning(true); return; }
      draftPersisted.current = false;
      if (alive.current) setSavedDraft(undefined);
    } finally {
      sending.current = false;
      if (alive.current) setDiscarding(false);
    }
  }

  if (!draftReady) return <p role="status">Buscando foto não enviada…</p>;
  if (savedDraft) return <section className="app-screen app-stack">
    <h1 className="titulo-tela app-h1">{savedDraft.attempted ? "Você tem uma foto sem confirmação." : "Você tem uma foto não enviada."}</h1>
    <p className="app-p">O rascunho fica neste aparelho por até 24 horas. Retomar não envia automaticamente.</p>
    {savedDraft.attempted && <p className="app-p">{DISCARD_NOTICE}</p>}
    {draftWarning && <p role="alert">Não foi possível apagar o rascunho. Tente novamente.</p>}
    <Button block disabled={discarding} onClick={resumeDraft}>Retomar foto</Button>
    <Button block variant="secundario" disabled={discarding} onClick={() => void discardDraft()}>Descartar foto</Button>
  </section>;
  return (
    <div className="app-screen" data-fase={phase}>
      <div className="app-between">
        <Breadcrumbs items={[{ label: "Agora", href: `${base}/agora` }, { label: "Postar" }]} />
        <span className="eyebrow app-muted" aria-live="polite">{left === null ? "Rolo ilimitado" : left === 1 ? "1 foto restante" : `${left} fotos restantes`}</span>
      </div>

      {phase === "publicada" ? (
        <div className="app-stack">
          <p className="emocao-lg app-emocao">Sua visão entrou na história.</p>
          {draftWarning && <p role="alert">Foto enviada. Não foi possível apagar o rascunho local; ele pode reaparecer até expirar.</p>}
          <p className="corpo app-p app-muted" data-testid={isRevealed(event, now) ? undefined : "guardada-no-escuro"}>{audienceCopy}</p>
          <div className="app-stack-sm">
            <Button href={`${base}/agora`} block>Ver no Agora</Button>
            {(left === null || left > 0) && <Button variant="secundario" block onClick={again}>Postar outra</Button>}
          </div>
        </div>
      ) : denial ? (
        <div className="app-stack">
          <p className="corpo app-p" role="alert">{denial}</p>
          {shot && hasAttempt && <p className="app-p">{DISCARD_NOTICE}</p>}
          <Button href={`${base}/agora`} block>Voltar ao evento</Button>
          {shot && <Button variant="secundario" block disabled={discarding} onClick={() => void again()}>Descartar foto</Button>}
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
              <p className="corpo app-p">{audienceCopy}</p>
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
          ) : phase === "sem-camera" || phase === "camera-ocupada" || phase === "camera-interrompida" ? (
            <section className="app-stack" aria-labelledby="sem-h">
              <h1 id="sem-h" className="titulo-tela app-h1">{phase === "camera-ocupada" ? "A câmera está ocupada." : phase === "camera-interrompida" ? "A câmera não iniciou desta vez." : "Sem câmera por aqui."}</h1>
              <p className="corpo app-p">Este aparelho ou navegador não abriu a câmera ao vivo. Use a câmera do aparelho ou escolha uma foto da galeria.</p>
              {phase !== "sem-camera" && <Button variant="secundario" block onClick={allowCamera}>Tentar a câmera de novo</Button>}
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

          {draftWarning && <p className="app-p" role="alert">Não foi possível salvar o rascunho neste aparelho. Mantenha esta tela aberta até enviar; sair pode perder a foto.</p>}
          {error && <p className="rv-field-erro" role="alert">{error}</p>}
          {shot && hasAttempt && <p className="app-p">{DISCARD_NOTICE}</p>}

          {phase === "guardando" && (
            <div className="app-stack-sm" role="status">
              <Progress label="Foto" status="Enviando…" />
              <p className="app-p app-muted">O contador só muda quando a foto chegar.</p>
            </div>
          )}

          {phase === "sem-sinal" && (
            <div className="app-stack-sm" role="status" aria-live="polite" data-testid="sem-sinal">
              <h2 className="titulo-tela app-h1">Sem sinal.</h2>
              <p className="corpo app-p">Sua foto ainda não foi confirmada. Você pode tentar novamente com a mesma foto ou descartá-la.</p>
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
                <span className="rv-group-label" id="mom">Momento</span>
                <Chips label="Momento">
                  {event.moments.map((m) => (
                    <Chip key={m} variant="filtro" pressed={moment === m} onClick={() => { if (!inFlight) setMoment(m); }}>{m}</Chip>
                  ))}
                </Chips>
              </div>
              <Field label="Legenda (opcional)" value={caption} maxLength={140} placeholder="Ex.: Ninguém segurou a emoção." onChange={(e) => setCaption(e.target.value)} disabled={inFlight} />
              <Chips label="Sugestões de legenda">
                {SUGGESTIONS.map((s) => (
                  <Chip key={s} variant="sugestao" onClick={() => { if (!inFlight) setCaption(s); }}>{s}</Chip>
                ))}
              </Chips>
              <p className="app-p app-muted">{audienceCopy}</p>
              <p className="app-p app-muted">Ao postar, você declara ter o direito de compartilhar a foto com as pessoas autorizadas neste evento.</p>
              <div className="app-stack-sm">
                <Button variant="cta" icon="camera" block disabled={inFlight} onClick={() => void send(false)}>{phase === "guardando" ? "Enviando…" : "Postar"}</Button>
                <Button variant="texto" onClick={() => void again()} disabled={phase === "guardando" || discarding}>{phase === "sem-sinal" ? "Descartar e tirar outra" : "Tirar outra"}</Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
