"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Chip, Chips, Field, GuestShell, Icon, Progress, ShotCounter } from "@/components/revela";
import { useRollPickerOptional } from "@/features/photos/roll-picker";
import { DEFAULT_FILM } from "@/domain/options";
import { momentName } from "@/domain/moments";
import { eventStatus, isRevealed, shotsLeft } from "@/domain/event";
import { useApp } from "@/features/app/provider";
import { useGuest } from "@/features/events/guest-context";
import { cameraFailure, photoAudienceCopy, cameraHelp, fileToImage, isEmbeddedBrowser, renderPhoto, stampText } from "@/features/photos/capture";
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
  const [flashing, setFlashing] = useState(false);
  const quick = useRef(false); // disparo pelo obturador: a pose vai direto para o laboratório (sem prévia)
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

  /** 22 · Disparo: flash de 120 ms, a pose vai para o laboratório e o visor continua aberto. */
  async function shoot() {
    const v = video.current;
    if (!v || !v.videoWidth || sending.current) return;
    setError(undefined);
    if (flashOn) { setFlashing(true); setTimeout(() => setFlashing(false), 140); }
    try {
      const data = await renderPhoto(v, v.videoWidth, v.videoHeight, lookOf(event) as "natural" | "filme35" | "vintage" | "preto-e-branco", facing === "user");
      if (!alive.current) return;
      quick.current = true;
      picked.current = true;
      setShot({ data, url: URL.createObjectURL(new Blob([data.bytes], { type: data.type })) });
      await send(false, data);
    } catch {
      quick.current = false;
      setError("Não foi possível tirar a foto. Tente de novo.");
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
      const draft = snapshot();
      if (draft) await persist(draft);
      const r = await postPhoto(repos, event, user, payload, { moment, caption, tableLabel: participant?.tableLabel }, clock(), { photoId: photoId.current, resume: resuming });
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
        if (quick.current) {
          // câmera descartável: volta ao visor, com o contador uma pose a menos
          quick.current = false;
          attempted.current = false;
          setHasAttempt(false);
          picked.current = false;
          if (stream.current) setPhase("camera"); else { setPhase("iniciando"); setAttempt((n) => n + 1); }
          return;
        }
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
    const hh = Math.floor(ms / 3_600_000), mm = Math.floor((ms % 3_600_000) / 60_000), ss = Math.floor((ms % 60_000) / 1000);
    const p2 = (n: number) => String(n).padStart(2, "0");
    return (
      <GuestShell closeHref={close} action={revealed ? <Button href={close} block>Ver o feed</Button> : <Button variant="secundario" block disabled>Ver o feed quando abrir</Button>}>
        <div className="rv-stack" aria-hidden="true"><span className="rvl-print rvl-print--back" /><span className="rvl-print rvl-print--back" /><span className="rvl-print rvl-print--back" /></div>
        <div className="rv-guest__center">
          {!ended && <ShotCounter value={0} label="poses restantes" />}
          <h1 className="titulo-pagina app-h1">{ended ? "A câmera fechou" : "Seu filme acabou"}</h1>
          <p className="corpo app-muted" style={{ margin: 0 }}>
            {ended
              ? (revealed ? "Não dá mais para fotografar. As fotos já estão no feed do evento." : "Não dá mais para fotografar. Suas fotos estão no laboratório até a revelação.")
              : revealed ? `Suas ${used} fotos já estão no feed do evento.` : `Suas ${used} fotos estão no laboratório. Quando todas forem reveladas, elas entram no feed do evento.`}
          </p>
        </div>
        {!revealed && ms > 0 && (
          <div className="rv-timer" role="timer" aria-label={`Revela em ${hh} horas e ${mm} minutos`}>
            <div><b>{p2(hh)}</b><span>horas</span></div>
            <div><b>{p2(mm)}</b><span>min</span></div>
            <div><b>{p2(ss)}</b><span>seg</span></div>
          </div>
        )}
        <span data-testid="contador-rolo" className="rv-sr-only">{left ?? "ilimitado"}</span>
      </GuestShell>
    );
  }

  // galeria negada, sem câmera ao vivo: mesmas saídas de antes, no layout do convidado
  if (phase === "negada" || phase === "sem-camera" || phase === "camera-ocupada" || phase === "camera-interrompida") {
    const negada = phase === "negada";
    return (
      <GuestShell closeHref={close} action={<div className="app-stack-sm">
        {negada ? <Button icon="imagem" block onClick={pickGallery}>Escolher da galeria</Button> : <><Button icon="camera" block onClick={() => cameraInput.current?.click()}>Abrir a câmera do aparelho</Button><Button variant="secundario" block onClick={pickGallery}>Escolher da galeria</Button></>}
      </div>}>
        <div className="rv-guest__center">
          <Icon name={negada ? "imagem" : "camera"} decorative size={40} />
          <h1 className="titulo-pagina app-h1" id="neg-h">{negada ? "Tudo bem, use a galeria" : phase === "camera-ocupada" ? "A câmera está ocupada" : phase === "camera-interrompida" ? "A câmera não iniciou desta vez" : "Sem câmera por aqui"}</h1>
          <p className="corpo app-muted" style={{ margin: 0 }}>{negada ? "Escolha fotos que você tirou hoje na festa. Elas contam nas suas poses como as da câmera." : "Este aparelho ou navegador não abriu a câmera ao vivo. Use a câmera do aparelho ou escolha uma foto da galeria."}</p>
        </div>
        {negada && (
          <div className="rvl-group" data-testid="ajuda-camera" style={{ padding: "var(--space-4)", maxWidth: "none" }}>
            <h2 className="titulo-card app-h1">Quer usar a câmera?</h2>
            <ol className="app-passos">{help.steps.map((t) => <li key={t}>{t}</li>)}</ol>
            <span className="meta app-muted">Passos para {help.browser}.</span>
            <Button variant="secundario" block onClick={allowCamera}>Tentar a câmera de novo</Button>
          </div>
        )}
        {!negada && phase !== "sem-camera" && <Button variant="secundario" block onClick={allowCamera}>Tentar a câmera de novo</Button>}
        {embedded && <p className="corpo-sm app-muted">Abriu pelo Instagram ou WhatsApp? Toque em ⋯ e escolha <strong>Abrir no navegador</strong>.</p>}
        {inputs}
      </GuestShell>
    );
  }

  // foto do rolo (ou disparo que não foi confirmado): prévia, momento, legenda e envio
  if (!quick.current && (phase === "capturada" || phase === "guardando" || phase === "sem-sinal") || (quick.current && (phase === "capturada" || phase === "sem-sinal"))) {
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
        {!quick.current && (
          <>
            <div className="app-stack-sm">
              <span className="rv-group-label" id="mom">Momento</span>
              <Chips label="Momento">{event.moments.map(momentName).map((m) => <Chip key={m} variant="filtro" pressed={moment === m} onClick={() => { if (!inFlight) setMoment(m); }}>{m}</Chip>)}</Chips>
            </div>
            <Field label="Legenda (opcional)" value={caption} maxLength={140} placeholder="Ex.: Ninguém segurou a emoção." onChange={(e) => setCaption(e.target.value)} disabled={inFlight} />
            <Chips label="Sugestões de legenda">{SUGGESTIONS.map((x) => <Chip key={x} variant="sugestao" onClick={() => { if (!inFlight) setCaption(x); }}>{x}</Chip>)}</Chips>
          </>
        )}
        {draftWarning && <p className="corpo-sm" role="alert">Não foi possível salvar o rascunho neste aparelho. Mantenha esta tela aberta até enviar; sair pode perder a foto.</p>}
        {error && <p className="rv-field-erro" role="alert">{error}</p>}
        {shot && hasAttempt && <p className="corpo-sm app-muted">{DISCARD_NOTICE}</p>}
        <p className="corpo-sm app-muted" style={{ margin: 0 }}>Ao mandar, você declara ter o direito de compartilhar a foto com as pessoas autorizadas neste evento.</p>
        {inputs}
      </GuestShell>
    );
  }

  // 21 · Câmera, 22 · Disparo, 23 · Acesso à câmera
  const live = phase === "camera" || phase === "guardando";
  return (
    <div className="rv-cam" data-wrap={event.cameraStyle} data-fase={phase}>
      <div className="rv-cam__finder" aria-live="polite">
        <video ref={video} playsInline muted aria-label="Câmera ao vivo" style={{ display: live ? "block" : "none", transform: facing === "user" ? "scaleX(-1)" : undefined }} />
        {phase === "iniciando" && <p className="rv-cam__msg">Abrindo a câmera…</p>}
        <div className="rv-cam__bar">
          <Link href={close} className="rv-icon-btn" aria-label="Fechar câmera"><Icon name="fechar" decorative /></Link>
          <span className="rv-cam__title">{event.title}</span>
          <button type="button" className="rv-icon-btn" aria-label="Flash" aria-pressed={flashOn} onClick={() => setFlashOn((f) => !f)}><Icon name="flash" decorative /></button>
        </div>
        <span className="rv-cam__corners" aria-hidden="true" />
        {(event.filmLook ?? DEFAULT_FILM) === "filme35" && <span className="rv-cam__date" aria-hidden="true">{stampText(new Date(now))}</span>}
        {phase === "permissao" && (
          <div className="rv-dialog" role="dialog" aria-modal="true" aria-labelledby="perm-h">
            <div className="rv-dialog__panel">
              <div className="rv-dialog__body">
                <h2 id="perm-h">Libere a câmera</h2>
                <p>{left === null ? "As poses que o anfitrião liberou ficam guardadas até a revelação. Ninguém vê antes, nem você." : `As ${left} poses que o anfitrião liberou ficam guardadas até a revelação. Ninguém vê antes, nem você.`}</p>
              </div>
              <div className="rv-dialog__actions">
                <button type="button" onClick={() => setPhase("negada")}>Agora não</button>
                <button type="button" className="go" onClick={allowCamera}>Liberar</button>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="rv-cam__body">
        <ShotCounter value={left ?? "∞"} label="poses restantes" />
        <button type="button" className="rv-shutter" aria-label="Tirar foto" disabled={phase !== "camera" || sending.current} onClick={() => void shoot()} />
        <span className="rv-wheel" aria-hidden="true" />
        <button type="button" className="rv-cam__thumb" aria-label="Enviar do rolo da câmera" onClick={pickGallery}><span className="rvl-print rvl-print--back" /></button>
        <button type="button" className="rv-icon-btn" aria-label="Virar câmera" disabled={!live} onClick={() => setFacing(facing === "environment" ? "user" : "environment")}><Icon name="camera" decorative /></button>
        {(phase === "guardando" || error) && <p className="rv-cam__status" role={error ? "alert" : "status"}>{error ?? "Mandando para o laboratório…"}</p>}
        <span data-testid="contador-rolo" className="rv-sr-only">{left ?? "ilimitado"}</span>
      </div>
      <div className="rv-cam__band" aria-hidden="true">{band}</div>
      <div className={`rv-flash ${flashing ? "rv-flash--on" : ""}`} aria-hidden="true" />
      {inputs}
    </div>
  );
}
