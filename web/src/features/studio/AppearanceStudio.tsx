"use client";

import { useMemo, useState } from "react";
import { Button, CameraStage, Notice, OptionGroup, ToggleRow, WrapPicker } from "@/components/revela";
import type { MemoEvent } from "@/domain/event";
import { DEFAULT_FILM, FILM_LABEL, WRAP_INFO, wrapOf, type FilmLook, type Wrap } from "@/domain/options";
import { MESSAGE_MAX, QR_STYLES, type QrStyle, type ThemeSpec } from "@/domain/theme";
import { PRESETS, validateTheme } from "@/lib/event-theme/spec";
import { PainelFoot, useEmbedded } from "@/revela/painel-ui";
import type { AssetKind } from "./assets";

export interface StudioImages { logoUrl?: string; coverUrl?: string; onUpload: (kind: AssetKind, file: File) => Promise<string | undefined> }
export interface LookPatch { cameraStyle: Wrap; filmLook: FilmLook }

const QR_LABEL: Record<QrStyle, string> = { classico: "Clássico", pontos: "Pontos", arredondado: "Arredondado" };
/** O que cada filme faz nas fotos (o texto acompanha a opção marcada). */
const FILM_INFO: Record<FilmLook, string> = {
  filme35: "Filme 35mm: tons quentes, grão, carimbo de data e o brilho do flash.",
  natural: "Natural: as cores como a câmera vê, sem grão, carimbo nem brilho de flash.",
};
const PREVIEW_KEY = "mm-aparencia-previa";

export function initialTheme(event: Pick<MemoEvent, "theme" | "palette" | "eventFont">): ThemeSpec {
  return event.theme ?? { preset: event.palette, colors: { ...PRESETS[event.palette].dia }, font: event.eventFont, welcomeMessage: "", qrStyle: "classico" };
}

/**
 * Aparência do evento no Revela: a identidade é a embalagem da câmera (festa, casamento, aniversario, noite),
 * mais o filme, a mensagem de boas-vindas, o estilo do QR e as imagens. Cores e fontes por evento não existem mais.
 */
export function AppearanceStudio({ event, locked, onSave, onSaveLook, images }: { event: MemoEvent; locked: boolean; onSave: (t: ThemeSpec) => Promise<string | undefined>; onSaveLook: (p: LookPatch) => Promise<string | undefined>; images?: StudioImages }) {
  const [wrap, setWrap] = useState<Wrap>(wrapOf(event.cameraStyle));
  const [film, setFilm] = useState<FilmLook>(event.filmLook ?? DEFAULT_FILM);
  const [draft, setDraft] = useState<ThemeSpec>(() => initialTheme(event));
  const [msg, setMsg] = useState<string | undefined>();
  const verdict = useMemo(() => validateTheme(draft), [draft]);
  const [busy, setBusy] = useState(false);
  const embedded = useEmbedded();
  // a prévia recolhida fica lembrada neste aparelho (conveniência: sem o armazenamento, abre aberta)
  const [previewOpen, setPreviewOpen] = useState(() => {
    try { return window.localStorage.getItem(PREVIEW_KEY) !== "fechada"; } catch { return true; } // a tela só monta no navegador, depois de carregar o evento
  });
  const setPreview = (open: boolean) => {
    setPreviewOpen(open);
    try { window.localStorage.setItem(PREVIEW_KEY, open ? "aberta" : "fechada"); } catch { /* sem armazenamento */ }
  };
  const set = (patch: Partial<ThemeSpec>) => { setMsg(undefined); setDraft((d) => ({ ...d, ...patch })); };

  async function save() {
    if (busy) return;
    setBusy(true);
    try {
      const look = await onSaveLook({ cameraStyle: wrap, filmLook: film });
      if (look) return setMsg(look);
      const theme = await onSave(draft);
      setMsg(theme ?? "Aparência salva.");
    } finally { setBusy(false); }
  }

  const filmInfo = FILM_INFO[film];
  const save_ = (
    <>
      <p className="app-p" role="status" aria-live="polite" data-testid="studio-msg">{msg ?? ""}</p>
      <Button variant="primario" block disabled={locked || !verdict.ok || busy} aria-busy={busy} onClick={() => void save()}>Salvar aparência</Button>
    </>
  );

  return (
    <div className="studio">
      {!embedded && <h1 id="ap-titulo" className="rv-title-lg app-h1">Aparência</h1>}
      <section className="app-stack studio-prev-wrap" aria-label="Prévia da câmera">
        <button type="button" className="studio-prev-toggle" aria-expanded={previewOpen} aria-controls="ap-previa" onClick={() => setPreview(!previewOpen)}>
          <span className="rv-group-label">Prévia da câmera</span>
          <span aria-hidden="true" className="studio-prev-chev" data-open={previewOpen} />
        </button>
        <div id="ap-previa" className="studio-previa" hidden={!previewOpen}>
          <div className="studio-cartao-corpo rv-grain" style={{ background: "var(--surface-1)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- URL assinada do Storage, sem otimizador */}
            {images?.coverUrl && <img className="studio-capa" src={images.coverUrl} alt="" />}
            {/* eslint-disable-next-line @next/next/no-img-element -- URL assinada do Storage, sem otimizador */}
            {images?.logoUrl && <img className="studio-logo" src={images.logoUrl} alt="Logotipo do evento" />}
            <div className="studio-stage"><CameraStage wrap={wrap} size={360} /></div>
            <p className="rv-title" style={{ color: "var(--ink)" }}>{event.title}</p>
            {draft.welcomeMessage && <p className="app-p">{draft.welcomeMessage}</p>}
            <small className="rv-caption">Feito com Revela</small>
          </div>
        </div>
      </section>

      <section className="app-stack">
        {locked && <Notice text="A revelação já aconteceu: a aparência da câmera não pode mais mudar." />}
        <fieldset disabled={locked} className="studio-fieldset">
          <div className="app-stack-sm">
            <span className="rv-group-label">Embalagem</span>
            <WrapPicker value={wrap} onChange={(w) => { setMsg(undefined); setWrap(w); }} />
            <p className="rv-caption">{WRAP_INFO[wrap].blurb}</p>
          </div>
          <OptionGroup<FilmLook> label="Filme" value={film} onChange={(f) => { setMsg(undefined); setFilm(f); }} options={(Object.keys(FILM_LABEL) as FilmLook[]).map((f) => ({ value: f, label: FILM_LABEL[f] }))} />
          <p className="rv-caption" data-testid="filme-info">{filmInfo}</p>
          <div className="rvl-field">
            <label className="rv-field-label" htmlFor="ap-msg">Mensagem de boas-vindas</label>
            <textarea id="ap-msg" className="rv-field-input studio-msg" rows={3} maxLength={MESSAGE_MAX} value={draft.welcomeMessage} onChange={(e) => set({ welcomeMessage: e.target.value })} aria-describedby="ap-msg-ajuda" />
            <p id="ap-msg-ajuda" className="rv-field-ajuda">{draft.welcomeMessage.length}/{MESSAGE_MAX}. Só texto; aparece no convite e na entrada.</p>
          </div>
          <OptionGroup<QrStyle> label="Estilo do QR Code" value={draft.qrStyle} onChange={(v) => set({ qrStyle: v })} options={QR_STYLES.map((q) => ({ value: q, label: QR_LABEL[q] }))} />
          <div className="app-stack-sm" data-testid="imagens">
            <span className="rv-group-label">Imagens</span>
            {images ? (
              (["logo", "cover"] as const).map((k) => (
                <div className="rvl-field" key={k}>
                  <label className="rv-field-label" htmlFor={`ap-${k}`}>{k === "logo" ? "Logotipo (PNG, JPEG ou WebP, até 2 MB)" : "Capa (PNG, JPEG ou WebP, até 5 MB)"}</label>
                  <input id={`ap-${k}`} type="file" accept="image/png,image/jpeg,image/webp" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setMsg((await images.onUpload(k, f)) ?? (k === "logo" ? "Logotipo atualizado." : "Capa atualizada.")); e.target.value = ""; }} />
                </div>
              ))
            ) : (
              <p className="rv-caption">Logo e capa ficam disponíveis com o servidor ligado.</p>
            )}
          </div>
        </fieldset>
        {embedded ? <PainelFoot>{save_}</PainelFoot> : <div className="studio-acoes">{save_}</div>}
      </section>
    </div>
  );
}
