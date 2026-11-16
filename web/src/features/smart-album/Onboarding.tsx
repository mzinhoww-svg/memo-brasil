"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button, Sheet } from "@/components/revela";
import { CONTACT_EMAIL } from "@/lib/contact";
import { track } from "./analytics";
import { CameraCapture } from "./CameraCapture";
import { COPY, failureText, referenceProblemText } from "./copy";
import { ACCEPT, fetchGooglePicture, googlePictureUrl, prepareReference, type PreparedReference, type ReferenceProblem } from "./reference";
import { toSmartAlbumError, type ReferenceSource, type SmartAlbumState } from "./service";
import type { SmartAlbum } from "./use-smart-album";

type Step = "intro" | "source" | "camera" | "review" | "consent";
type Uiso = "google" | "gallery" | "camera";
const toSource = (s: Uiso): ReferenceSource => (s === "gallery" ? "upload" : s);

/** Fim do fluxo: `manual` = álbum sem reconhecimento; `skipped` = "agora não"; `activated` = consentimento + referência enviados. */
export type OnboardingResult = "manual" | "skipped" | "activated";

/**
 * Mini onboarding (máx. 3 passos, pulável): Introdução → Escolha da foto (+ revisão) → Autorização específica.
 * Nada é enviado nem gravado antes do aceite; com a busca indisponível o passo 3 explica isso e oferece o álbum manual.
 */
export function Onboarding({ sa, eventId, state, onDone, startAt = "intro" }: { sa: SmartAlbum; eventId: string; state: SmartAlbumState; onDone: (r: OnboardingResult) => void; startAt?: Step }) {
  const [step, setStep] = useState<Step>(startAt);
  const [source, setSource] = useState<Uiso | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [ref, setRef] = useState<PreparedReference | null>(null);
  const [mine, setMine] = useState(false);
  const [agree, setAgree] = useState(false);
  const [google, setGoogle] = useState<string | null | undefined>(undefined);
  const file = useRef<HTMLInputElement>(null);
  const fileUser = useRef<HTMLInputElement>(null);

  useEffect(() => { track("smart_album_onboarding_started", { step: startAt }); }, [startAt]);
  useEffect(() => {
    let live = true;
    void sa.googleMeta().then((m) => { if (live) setGoogle(googlePictureUrl(m)); });
    return () => { live = false; };
  }, [sa]);
  // a prévia é um object URL da imagem já recomprimida; some ao trocar ou fechar
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!ref) return;
    let live = true;
    const r = new FileReader();
    r.onload = () => { if (live) setPreview(String(r.result)); };
    r.readAsDataURL(ref.blob);
    return () => { live = false; };
  }, [ref]);

  async function accept(blob: Blob | null, from: Uiso) {
    setBusy(true);
    setProblem(null);
    setMine(false);
    try {
      if (!blob) { setProblem("Não deu para usar essa foto. Escolha outra."); setStep("source"); return; }
      const r = await prepareReference(blob);
      if (typeof r === "string") { setProblem(referenceProblemText(r as ReferenceProblem)); setRef(null); setStep("source"); return; }
      setSource(from);
      setPreview(null);
      setRef(r);
      setStep("review");
    } finally {
      setBusy(false);
    }
  }

  function pick(from: Uiso) {
    track("smart_album_source_selected", { source: from });
    setProblem(null);
    if (from === "gallery") file.current?.click();
    else if (from === "camera") setStep("camera");
    else if (google) { void fetchGooglePicture(google).then((b) => accept(b, "google")); }
  }

  async function activate() {
    if (!ref || !source || !state.face.consentVersion) return;
    setBusy(true);
    setProblem(null);
    try {
      await sa.api.grantConsent(eventId, state.face.consentVersion, toSource(source));
      track("smart_album_consent_granted", { source });
      await sa.api.uploadReference(eventId, toSource(source), ref.blob);
      if (state.face.profile) track("smart_album_reference_changed", { source });
      if (state.revealed) {
        await sa.api.requestSearch(eventId, `sa-${crypto.randomUUID().replace(/-/g, "")}`);
        track("smart_album_job_started");
      }
      setRef(null);
      await sa.reload();
      onDone("activated");
    } catch (e) {
      setProblem(failureText(toSmartAlbumError(e).code));
    } finally {
      setBusy(false);
    }
  }

  const close = (r: OnboardingResult) => { setRef(null); onDone(r); };
  const title = step === "intro" ? COPY.introTitle : step === "consent" ? "Autorização" : step === "review" ? COPY.reviewTitle : COPY.sourceTitle;
  const counter = step === "intro" ? 1 : step === "consent" ? 3 : 2;

  return (
    <Sheet title={title} onClose={() => close("skipped")} history>
      <p className="sa-steps" aria-label={`Passo ${counter} de 3`}>Passo {counter} de 3</p>
      <input ref={file} type="file" accept={ACCEPT} hidden aria-hidden="true" tabIndex={-1} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void accept(f, "gallery"); }} />
      <input ref={fileUser} type="file" accept="image/*" capture="user" hidden aria-hidden="true" tabIndex={-1} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void accept(f, "camera"); }} />

      {step === "intro" && (
        <div className="sa-stack">
          <p className="rv-body">{COPY.introBody}</p>
          <Button block onClick={() => setStep("source")}>Continuar</Button>
          <Button variant="texto" onClick={() => { track("smart_album_source_selected", { source: "skip" }); close("manual"); }}>{COPY.skip}</Button>
        </div>
      )}

      {step === "source" && (
        <div className="sa-stack">
          <p className="rv-caption">{COPY.sourceBody}</p>
          {problem && <p className="sa-problem" role="alert">{problem}</p>}
          <Button block variant="secundario" icon="voce" disabled={!google || busy} onClick={() => pick("google")}>{COPY.google}</Button>
          {google === null && <p className="rv-caption">Sua conta não tem foto do Google disponível. Use a galeria ou a câmera.</p>}
          <Button block variant="secundario" icon="imagem" disabled={busy} onClick={() => pick("gallery")}>{COPY.gallery}</Button>
          <Button block variant="secundario" icon="camera" disabled={busy} onClick={() => pick("camera")}>{COPY.camera}</Button>
          {busy && <p className="rv-caption" role="status">Preparando a foto…</p>}
          <Button variant="texto" onClick={() => { track("smart_album_source_selected", { source: "skip" }); close("skipped"); }}>{COPY.later}</Button>
        </div>
      )}

      {step === "camera" && (
        <CameraCapture onShot={(b) => void accept(b, "camera")} onCancel={() => setStep("source")} onFallback={() => { setStep("source"); fileUser.current?.click(); }} />
      )}

      {step === "review" && ref && (
        <div className="sa-stack">
          {preview && ref && <img className="sa-preview" src={preview} alt="Prévia da sua foto de referência" />}
          <p className="rv-caption">{COPY.reviewTips}</p>
          {ref.faces === "unchecked" && <p className="rv-caption">Este aparelho não confere rostos aqui. Se a foto não servir, avisamos depois e você troca.</p>}
          <label className="sa-check">
            <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} />
            <span>{COPY.selfConfirm}</span>
          </label>
          <Button block disabled={!mine} onClick={() => setStep("consent")}>Continuar</Button>
          <Button variant="texto" onClick={() => { setRef(null); setStep("source"); }}>Trocar foto</Button>
        </div>
      )}

      {step === "consent" && (
        <ConsentStep state={state} busy={busy} problem={problem} agree={agree} setAgree={setAgree} onActivate={() => void activate()} onManual={() => close("manual")} />
      )}
    </Sheet>
  );
}

function ConsentStep({ state, busy, problem, agree, setAgree, onActivate, onManual }: { state: SmartAlbumState; busy: boolean; problem: string | null; agree: boolean; setAgree: (v: boolean) => void; onActivate: () => void; onManual: () => void }) {
  if (!state.face.available) {
    return (
      <div className="sa-stack" role="status">
        <h3 className="sa-h3">{COPY.faceUnavailableTitle}</h3>
        <p className="rv-body">{COPY.faceUnavailableBody}</p>
        <Button block onClick={onManual}>{COPY.useManual}</Button>
      </div>
    );
  }
  if (!state.face.account) {
    return (
      <div className="sa-stack" role="status">
        <p className="rv-body">{COPY.accountNeeded}</p>
        <Button block onClick={onManual}>{COPY.useManual}</Button>
      </div>
    );
  }
  return (
    <div className="sa-stack">
      <h3 className="sa-h3">{COPY.consentTitle}</h3>
      <p className="rv-body">{COPY.consentBody}</p>
      <p className="rv-caption">{COPY.consentThirdParties}</p>
      <ul className="sa-facts">
        <li>Finalidade: sugerir fotos deste evento em que você pode aparecer. Nada de treinar modelos, publicidade ou perfis.</li>
        <li>Como funciona: a foto que você escolher fica guardada de forma privada e é comparada só com as fotos deste evento que você já pode ver, num servidor do Revela. Ninguém mais vê essa foto.</li>
        <li>Retenção: a foto de referência é apagada quando você desativa, troca a foto, ou no máximo 30 dias após o evento.</li>
        <li>Versão do termo: {state.face.consentVersion}. <Link href="/privacidade">Política de privacidade</Link> · <a href={`mailto:${CONTACT_EMAIL}`}>Contato de privacidade</a></li>
      </ul>
      <label className="sa-check">
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
        <span>Li e autorizo a busca de fotos em que apareço neste evento.</span>
      </label>
      {problem && <p className="sa-problem" role="alert">{problem}</p>}
      <Button block disabled={!agree || busy} onClick={onActivate}>{busy ? "Ativando…" : COPY.activate}</Button>
      <Button variant="texto" onClick={onManual}>{COPY.skip}</Button>
    </div>
  );
}
