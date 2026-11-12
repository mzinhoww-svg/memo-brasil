"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Chip, Chips, EventTheme, Field, GuestShell, Progress } from "@/components/revela";
import { useRollPickerOptional } from "@/features/photos/roll-picker";
import { DEFAULT_FILM, wrapOf } from "@/domain/options";
import { ConvidadoCamera } from "@/revela/screens/ConvidadoCamera";
import type { CameraFx } from "@/revela/screens/CameraFrame";
import { odometer, shoot as kitShoot } from "@/lib/motion/revela-motion";
import { flyPose } from "@/lib/motion/use-moments";
import { ConvidadoFim } from "@/revela/screens/ConvidadoFim";
import { ConvidadoPermissao } from "@/revela/screens/ConvidadoPermissao";
import { momentName } from "@/domain/moments";
import { eventStatus, isRevealed, shotsLeft } from "@/domain/event";
import { useApp } from "@/features/app/provider";
import { useGuest } from "@/features/events/guest-context";
import { cameraFailure, photoAudienceCopy, cameraHelp, fileToImage, grabFrame, isEmbeddedBrowser, prewarmFilm, renderPhoto, renderPreview, stampText } from "@/features/photos/capture";
import { clearPhotoDraft, loadPhotoDraft, savePhotoDraft, type PhotoDraft } from "@/features/photos/draft";
import { postPhoto, retryDelayMs } from "@/features/photos/service";
import { blocksShooting, countsTowardRoll, queueStatus, uploadQueue } from "@/features/photos/upload-queue";
import { useQueuedUsed, useUploadQueue } from "@/features/photos/upload-queue-provider";
import { useAlive } from "@/lib/use-alive";
import type { PhotoData } from "@/repositories";

/**
 * permissao = pré-permissão (explica a câmera antes de pedir); negada = o navegador recusou; sem-camera = aparelho sem câmera ao vivo;
 * guardando = enviando; sem-sinal = o envio caiu e a mesma foto tenta de novo (mesma photoId).
 * guardando/sem-sinal/capturada são só da foto escolhida do aparelho: o disparo da câmera vai para a fila de envio
 * (upload-queue.ts) e o visor continua aberto.
 */
type Phase = "iniciando" | "permissao" | "camera" | "negada" | "sem-camera" | "camera-ocupada" | "camera-interrompida" | "capturada" | "guardando" | "sem-sinal" | "publicada";
const REMEMBER_KEY = "mm-camera-liberada";
const remembered = () => { try { return localStorage.getItem(REMEMBER_KEY) === "1"; } catch { return false; } };
const remember = () => { try { localStorage.setItem(REMEMBER_KEY, "1"); } catch { /* sem armazenamento: pergunta de novo da próxima vez */ } };
const DISCARD_NOTICE = "Descartar apaga apenas o rascunho neste aparelho. O envio pode ter sido confirmado; confira as fotos do evento.";
const SUGGESTIONS = ["Alguém precisava registrar isso.", "Ninguém segurou a emoção.", "Quem viu, viu.", "Só daqui dá para ver."];

/** Filme das fotos: eventos antigos com filtro vintage ou preto e branco continuam com o filtro escolhido na época. */
const lookOf = (e: { cameraStyle: string; filmLook?: "natural" | "filme35" }) =>
  e.cameraStyle === "vintage" || e.cameraStyle === "preto-e-branco" ? e.cameraStyle : (e.filmLook ?? DEFAULT_FILM);

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
  const [moment, setMoment] = useState(momentName(event.moments[0] ?? "Agora"));
  const [caption, setCaption] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [denial, setDenial] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const [shot, setShot] = useState<{ data: PhotoData; url: string } | undefined>();
  const [retry, setRetry] = useState<{ n: number; at: number } | "esgotado" | undefined>();
  const [secsLeft, setSecsLeft] = useState(0);
  const [frozenLeft, setFrozenLeft] = useState<number | null | undefined>(); // o contador só muda quando a foto chegar
  const [flashOn, setFlashOn] = useState(true);
  const fx = useRef<CameraFx | null>(null); // peças da câmera que o disparo do kit anima
  const video = useRef<HTMLVideoElement | null>(null);
  const stream = useRef<MediaStream | null>(null);
  // O <video> é remontado quando a tela troca (prévia → câmera): religa o stream aberto, senão o visor fica preto.
  const attachVideo = useCallback((el: HTMLVideoElement | null) => {
    video.current = el;
    const s = stream.current;
    if (el && s && el.srcObject !== s) {
      el.srcObject = s;
      void el.play()?.catch(() => undefined);
    }
  }, []);
  const tapping = useRef(0); // disparos entre o toque e a entrada na fila (contam no rolo)
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
  // fila de envio da câmera: cada disparo pendente desconta na hora (left = real − pendentes) e o odômetro não volta
  const queue = useUploadQueue(event.id, user.id);
  const queued = queue.entries.filter(countsTowardRoll).length;
  const queueUsed = useQueuedUsed(used, queue.entries);
  const queueLeft = shotsLeft(event, queueUsed);
  const left = inFlight && frozenLeft !== undefined ? frozenLeft : queueLeft;
  const ended = eventStatus(event, now) === "encerrado";
  const noRoll = left !== null && left <= 0;
  // com fotos na fila, a câmera continua na tela (a última pose ainda está indo) até o contador real confirmar
  const blocked = !!denial || (!inFlight && !shot && queued === 0 && (ended || noRoll));
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
          await video.current.play()?.catch(() => undefined);
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

  // pré-aquece o filme (worker + LUT + grão) assim que a câmera abre, para o primeiro disparo não pagar isso
  const look = lookOf(event) as "natural" | "filme35" | "vintage" | "preto-e-branco";
  const cameraOpen = phase === "camera";
  useEffect(() => { if (cameraOpen) prewarmFilm(look); }, [cameraOpen, look]);

  /**
   * 22 · Disparo: congela o quadro no toque e libera o obturador na hora. O clarão roda em paralelo; a prévia pequena
   * (~320 px, mesmo filme) vai para o canto da câmera e a foto entra na fila, que revela em tamanho cheio e envia em
   * segundo plano. O rolo conta as poses pendentes: não dá para disparar além das restantes.
   */
  async function shoot() {
    const v = video.current;
    if (!v || !v.videoWidth || ended || blocksShooting(queue.entries)) return;
    if (left !== null && left - tapping.current <= 0) return;
    tapping.current += 1;
    setError(undefined);
    uploadQueue.dismiss(event.id);
    const parts = fx.current;
    const remaining = left === null ? undefined : Math.max(0, left - tapping.current);
    if (parts) void kitShoot({ flash: flashOn ? parts.flash : document.createElement("div"), shutter: parts.shutter, button: parts.button, wheel: parts.wheel, counter: parts.counter ?? undefined, remaining });
    const mirror = facing === "user";
    const createdAt = clock();
    const takenAt = new Date(createdAt);
    try {
      const frame = await grabFrame(v);
      const photoId = crypto.randomUUID();
      // a prévia desenha agora (antes da fila revelar e liberar o quadro); só o JPEG pequeno sai depois
      const preview = renderPreview(frame.source, frame.width, frame.height, look, mirror, takenAt);
      uploadQueue.enqueue({ photoId, event, user, createdAt, takenAt, meta: { moment, tableLabel: participant?.tableLabel }, frame, style: look, mirror });
      void preview.then((blob) => {
        const url = URL.createObjectURL(blob);
        uploadQueue.setLastShot({ photoId, eventId: event.id, userId: user.id, url, createdAt });
        return flyPose(url, parts?.viewfinder ?? null, parts?.roll ?? null);
      }).catch(() => undefined);
    } catch {
      if (parts?.counter && left !== null) odometer(parts.counter, Math.max(0, left - tapping.current + 1));
      setError("Não foi possível tirar a foto. Tente de novo.");
    } finally {
      tapping.current -= 1;
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(undefined);
    try {
      const img = await fileToImage(file);
      const data = await renderPhoto(img, img.naturalWidth, img.naturalHeight, lookOf(event) as "natural" | "filme35" | "vintage" | "preto-e-branco");
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
  async function send(resume: boolean, data?: PhotoData) {
    const payload = data ?? shot?.data;
    if (!payload || sending.current) return;
    sending.current = true;
    const resuming = resume || attempted.current;
    if (!resuming) { failures.current = 0; setFrozenLeft(realLeft); }
    attempted.current = true;
    setHasAttempt(true);
    setRetry(undefined);
    setError(undefined);
    setPhase("guardando");
    try {
      // marca a tentativa no rascunho uma vez (a seleção já foi salva pelo efeito); retomadas não regravam os bytes
      const draft = snapshot();
      if (draft && !resuming) await persist(draft);
      const r = await postPhoto(repos, event, user, payload, { moment, caption, tableLabel: participant?.tableLabel }, clock(), { photoId: photoId.current, resume: resuming });
      if (r.ok) {
        // confirmado: limpa o rascunho e atualiza o contador mesmo que a tela tenha saído no meio do envio
        // (senão, ao voltar, aparecia "pose sem confirmação" de uma foto já publicada)
        confirmed.current = true;
        await persistence.current;
        const cleared = await clearPhotoDraft(event.id, user.id);
        if (cleared.ok) draftPersisted.current = false;
        // Publicação confirmada não depende da atualização do contador.
        void Promise.resolve().then(refresh).catch(() => undefined);
        if (!alive.current) return;
        setDraftWarning(!cleared.ok);
        setFrozenLeft(undefined);
        photoId.current = crypto.randomUUID();
        setShot(undefined);
        setPhase("publicada");
        return;
      }
      if (!alive.current) return;
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
  const roll = useRollPickerOptional();
  const pickGallery = () => (roll ? roll.open() : galleryInput.current?.click());
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

  const close = `${base}/agora`;
  const shotsTxt = event.shotsPerPerson === null ? "poses livres" : `${event.shotsPerPerson} poses`;
  const d = new Date(event.startAt);
  const band = [event.title, shotsTxt, `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getFullYear() % 100).padStart(2, "0")}`].join(" · ");
  const inputs = (
    <>
      {/* dois caminhos distintos (UX-02): a galeria NÃO leva `capture`, senão o aparelho abre a câmera em vez da galeria */}
      <input ref={galleryInput} type="file" accept="image/*" hidden aria-label="Escolher foto do aparelho" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }} />
      <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden aria-label="Tirar foto com a câmera do aparelho" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }} />
    </>
  );

  if (!draftReady) return <GuestShell closeHref={close}><p className="corpo app-muted" role="status">Buscando foto não enviada…</p></GuestShell>;
  if (savedDraft) return (
    <GuestShell closeHref={close} action={<div className="app-stack-sm"><Button block disabled={discarding} onClick={resumeDraft}>Retomar foto</Button><Button block variant="secundario" disabled={discarding} onClick={() => void discardDraft()}>Descartar foto</Button></div>}>
      <div className="rv-guest__center" style={{ marginTop: "auto", marginBottom: "auto" }}>
        <h1 className="titulo-pagina app-h1">{savedDraft.attempted ? "Você tem uma pose sem confirmação" : "Você tem uma pose não enviada"}</h1>
        <p className="corpo app-muted" style={{ margin: 0 }}>O rascunho fica neste aparelho por até 24 horas. Retomar não envia automaticamente.</p>
        {savedDraft.attempted && <p className="corpo-sm app-muted" style={{ margin: 0 }}>{DISCARD_NOTICE}</p>}
        {draftWarning && <p className="rv-field-erro" role="alert">Não foi possível apagar o rascunho. Tente novamente.</p>}
      </div>
    </GuestShell>
  );

  if (phase === "publicada") return (
    <GuestShell closeHref={close} action={<div className="app-stack-sm"><Button href={close} block>Ver o feed</Button>{(left === null || left > 0) && <Button variant="secundario" block onClick={again}>Tirar outra</Button>}</div>}>
      <div className="rv-stack" aria-hidden="true"><span className="rvl-print rvl-print--back" /><span className="rvl-print rvl-print--back" /><span className="rvl-print rvl-print--back" /></div>
      <div className="rv-guest__center">
        <h1 className="titulo-pagina app-h1">Foi para o laboratório</h1>
        {draftWarning && <p role="alert" className="rv-field-erro">Foto enviada. Não foi possível apagar o rascunho local; ele pode reaparecer até expirar.</p>}
        <p className="corpo app-muted" style={{ margin: 0 }} data-testid={isRevealed(event, now) ? undefined : "guardada-no-escuro"}>{audienceCopy}</p>
      </div>
      {inputs}
    </GuestShell>
  );

  if (denial) return (
    <GuestShell closeHref={close} action={<div className="app-stack-sm"><Button href={close} block>Voltar ao evento</Button>{shot && <Button variant="secundario" block disabled={discarding} onClick={() => void again()}>Descartar foto</Button>}</div>}>
      <div className="rv-guest__center" style={{ marginTop: "auto", marginBottom: "auto" }}>
        <p className="corpo" role="alert">{denial}</p>
        {shot && hasAttempt && <p className="corpo-sm app-muted">{DISCARD_NOTICE}</p>}
      </div>
    </GuestShell>
  );

  // 24 · Seu filme acabou (e câmera fechada)
  if (blocked) {
    const revealed = isRevealed(event, now);
    const ms = event.revealEnabled && event.revealAt ? Math.max(0, event.revealAt - now) : 0;
    const notify = typeof Notification !== "undefined" && Notification.permission === "granted";
    const text = ended
      ? (revealed ? "Não dá mais para fotografar. As fotos já estão no feed do evento." : "Não dá mais para fotografar. Suas fotos estão no laboratório até a revelação.")
      : revealed ? `Suas ${used} fotos já estão no feed do evento.`
      : notify ? undefined : `Suas ${used} fotos estão no laboratório. Quando todas forem reveladas, elas entram no feed do evento.`;
    return (
      <EventTheme wrap={event.cameraStyle}>
        <ConvidadoFim taken={used} ended={ended} revealed={revealed} remainingMs={ms} notify={notify} body={text} closeHref={close} feedHref={close}>
          <span data-testid="contador-rolo" className="rv-sr-only">{left ?? "ilimitado"}</span>
        </ConvidadoFim>
      </EventTheme>
    );
  }

  // 23 · Acesso à câmera: negada, sem câmera ao vivo, ocupada ou interrompida (mesmos botões de antes, no aviso da tela)
  if (phase === "negada" || phase === "sem-camera" || phase === "camera-ocupada" || phase === "camera-interrompida") {
    return (
      <ConvidadoPermissao
        estado={phase === "negada" ? "negada" : phase === "sem-camera" ? "sem-camera" : phase === "camera-ocupada" ? "ocupada" : "interrompida"}
        title={event.title} wrap={wrapOf(event.cameraStyle)} left={left} band={band} closeHref={close} closeLabel="Fechar câmera" fase={phase}
        help={help} embedded={embedded}
        onAllow={allowCamera} onGallery={pickGallery} onDeviceCamera={() => cameraInput.current?.click()}
      >
        {inputs}
      </ConvidadoPermissao>
    );
  }

  // foto do rolo (ou disparo que não foi confirmado): prévia, momento, legenda e envio
  if (phase === "capturada" || phase === "guardando" || phase === "sem-sinal") {
    return (
      <GuestShell closeHref={close} action={<div className="app-stack-sm">
        {phase === "sem-sinal" ? <Button block onClick={() => void send(true)}>Tentar agora</Button> : <Button icon="enviar" block disabled={inFlight} onClick={() => void send(false)}>{phase === "guardando" ? "Enviando…" : "Mandar para o laboratório"}</Button>}
        <Button variant="texto" block onClick={() => void again()} disabled={phase === "guardando" || discarding}>{phase === "sem-sinal" ? "Descartar e tirar outra" : "Tirar outra"}</Button>
      </div>}>
        {/* eslint-disable-next-line @next/next/no-img-element -- prévia local (blob) */}
        {shot && <figure className="rvl-print" style={{ margin: "0 auto", width: "78%", transform: "rotate(-2deg)" }}><img src={shot.url} alt="Prévia da sua foto" style={{ aspectRatio: "3 / 4" }} /></figure>}
        {phase === "sem-sinal" && (
          <div className="rv-guest__center" role="status" aria-live="polite" data-testid="sem-sinal">
            <h2 className="titulo-card app-h1">Sem sinal</h2>
            <p className="corpo-sm app-muted" style={{ margin: 0 }}>Sua pose ainda não foi confirmada. Tente de novo com a mesma foto ou descarte.</p>
            <p className="corpo-sm app-muted" style={{ margin: 0 }}>{retry === "esgotado" ? "Ainda sem conexão. Toque em Tentar agora quando a internet voltar." : retry ? `Tentativa ${retry.n} de 3 · próxima em ${secsLeft} s` : null}</p>
          </div>
        )}
        {phase === "guardando" && <div role="status"><Progress label="Foto" status="Enviando…" /></div>}
        <div className="app-stack-sm">
          <span className="rv-group-label" id="mom">Momento</span>
          <Chips label="Momento">{event.moments.map(momentName).map((m) => <Chip key={m} variant="filtro" pressed={moment === m} onClick={() => { if (!inFlight) setMoment(m); }}>{m}</Chip>)}</Chips>
        </div>
        <Field label="Legenda (opcional)" value={caption} maxLength={140} placeholder="Ex.: Ninguém segurou a emoção." onChange={(e) => setCaption(e.target.value)} disabled={inFlight} />
        <Chips label="Sugestões de legenda">{SUGGESTIONS.map((x) => <Chip key={x} variant="sugestao" onClick={() => { if (!inFlight) setCaption(x); }}>{x}</Chip>)}</Chips>
        {draftWarning && <p className="corpo-sm" role="alert">Não foi possível salvar o rascunho neste aparelho. Mantenha esta tela aberta até enviar; sair pode perder a foto.</p>}
        {error && <p className="rv-field-erro" role="alert">{error}</p>}
        {shot && hasAttempt && <p className="corpo-sm app-muted">{DISCARD_NOTICE}</p>}
        <p className="corpo-sm app-muted" style={{ margin: 0 }}>Ao mandar, você declara ter o direito de compartilhar a foto com as pessoas autorizadas neste evento.</p>
        {inputs}
      </GuestShell>
    );
  }

  // 21 · Câmera, 22 · Disparo (clarão) e 23 · pedido de acesso (pré-permissão)
  const live = phase === "camera";
  const isFilm = event.cameraStyle === "vintage" || (event.cameraStyle !== "preto-e-branco" && (event.filmLook ?? DEFAULT_FILM) === "filme35");
  const wrap = wrapOf(event.cameraStyle);
  const frame = {
    title: event.title, wrap, left, band, closeHref: close, closeLabel: "Fechar câmera", fase: phase,
    viewfinder: (
      <>
        <video ref={attachVideo} playsInline muted aria-label="Câmera ao vivo" className={isFilm ? "rv-film-preview" : undefined} style={{ display: live ? "block" : "none", transform: facing === "user" ? "scaleX(-1)" : undefined }} />
        {live && isFilm && <span className="rv-film-preview-vignette" aria-hidden="true" />}
        {phase === "iniciando" && <p className="vf-msg" aria-live="polite">Abrindo a câmera…</p>}
      </>
    ),
    flashOn, onFlash: () => setFlashOn((f) => !f),
    stamp: isFilm ? stampText(new Date(now)) : undefined,
  };
  const counter = <span data-testid="contador-rolo" data-fila={queue.entries.filter((e) => e.status !== "enviada" && countsTowardRoll(e)).length} className="rv-sr-only">{left ?? "ilimitado"}</span>;
  const fila = queueStatus(queue.entries);
  if (phase === "permissao") {
    return (
      <ConvidadoPermissao {...frame} estado="pedir" onLater={() => setPhase("negada")} onAllow={allowCamera}>
        {counter}
        {inputs}
      </ConvidadoPermissao>
    );
  }
  return (
    <ConvidadoCamera
      {...frame}
      fx={fx}
      shootDisabled={phase !== "camera" || noRoll || ended || blocksShooting(queue.entries)}
      onShoot={() => void shoot()}
      rollLabel="Enviar do rolo da câmera"
      onRoll={pickGallery}
      lastShot={queue.lastShot?.url}
      flipDisabled={!live}
      onFlip={() => setFacing(facing === "environment" ? "user" : "environment")}
      status={error ?? fila?.text}
      statusRole={error || fila?.alert ? "alert" : "status"}
    >
      {counter}
      {inputs}
    </ConvidadoCamera>
  );
}
