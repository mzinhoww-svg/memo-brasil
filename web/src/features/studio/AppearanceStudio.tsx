"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Chip, Chips, EventTheme, Notice, OptionGroup } from "@/components/memoriesmt";
import type { MemoEvent } from "@/domain/event";
import { MESSAGE_MAX, QR_STYLES, THEME_FONTS, type QrStyle, type ThemeFont, type ThemeSpec } from "@/domain/theme";
import { EVENT_FONT_LABEL } from "@/lib/event-theme";
import { PRESETS, colorIssues, qrDarkColor, validateTheme } from "@/lib/event-theme/spec";
import { qrDataUrl } from "@/features/invitations/qr";
import type { AssetKind } from "./assets";

export interface StudioImages { logoUrl?: string; coverUrl?: string; onUpload: (kind: AssetKind, file: File) => Promise<string | undefined> }

const COLOR_LABEL = { superficie: "Fundo", grafismo: "Detalhes", controle: "Botões", texto: "Texto", profundo: "Destaque" } as const;
const COLOR_HELP = { superficie: "Fundo do convite", grafismo: "Detalhes e traços", controle: "Botões", texto: "Textos corridos", profundo: "Nome do evento e títulos" } as const;
const QR_LABEL: Record<QrStyle, string> = { classico: "Clássico", pontos: "Pontos", arredondado: "Arredondado" };

export function initialTheme(event: Pick<MemoEvent, "theme" | "palette" | "eventFont">): ThemeSpec {
  return event.theme ?? { preset: event.palette, colors: { ...PRESETS[event.palette].dia }, font: event.eventFont, welcomeMessage: "", qrStyle: "classico" };
}

/** Editor com prévia em tempo real. A prévia usa o mesmo wrapper isolado (EventTheme) que o convidado verá. */
export function AppearanceStudio({ event, locked, onSave, onRestore, images }: { event: MemoEvent; locked: boolean; onSave: (t: ThemeSpec) => Promise<string | undefined>; onRestore: () => Promise<string | undefined>; images?: StudioImages }) {
  const [draft, setDraft] = useState<ThemeSpec>(() => initialTheme(event));
  const [msg, setMsg] = useState<string | undefined>();
  const verdict = useMemo(() => validateTheme(draft), [draft]);
  const issues = useMemo(() => colorIssues(draft.colors), [draft.colors]);
  const [qr, setQr] = useState<string | undefined>();
  const dark = qrDarkColor(draft);
  useEffect(() => {
    let alive = true;
    void qrDataUrl(`https://memoriesmt.app/e/${event.code ?? "CODIGO"}`, 240, dark).then((u) => { if (alive) setQr(u); });
    return () => { alive = false; };
  }, [event.code, dark]);
  const set = (patch: Partial<ThemeSpec>) => setDraft((d) => ({ ...d, ...patch }));

  return (
    <div className="studio-grid">
      <section className="app-stack" aria-labelledby="ap-titulo">
        <h1 id="ap-titulo" className="titulo-pagina app-h1">Aparência do evento</h1>
        {locked && <Notice text="A revelação já aconteceu: a identidade do evento não pode mais mudar." />}
        <fieldset disabled={locked} className="studio-fieldset">
          <div className="app-stack-sm">
            <span className="mm-group-label">Tema pronto</span>
            <Chips label="Tema pronto">
              {Object.keys(PRESETS).map((id) => (
                <Chip key={id} variant="filtro" pressed={draft.preset === id} onClick={() => set({ preset: id, colors: { ...PRESETS[id].dia } })}>{PRESETS[id].label}</Chip>
              ))}
            </Chips>
          </div>
          <div className="app-stack-sm">
            <span className="mm-group-label">Cores</span>
            <div className="studio-cores">
              {(Object.keys(COLOR_LABEL) as (keyof typeof COLOR_LABEL)[]).map((k) => (
                <div key={k} className="studio-cor" data-invalid={issues[k as keyof typeof issues] ? "true" : undefined}>
                  <label htmlFor={`ap-cor-${k}`}>{COLOR_LABEL[k]} <code>{draft.colors[k]}</code></label>
                  <input id={`ap-cor-${k}`} type="color" value={draft.colors[k]} aria-invalid={issues[k as keyof typeof issues] ? true : undefined} aria-describedby={issues[k as keyof typeof issues] ? `ap-cor-erro-${k}` : undefined} onChange={(e) => set({ preset: "personalizado", colors: { ...draft.colors, [k]: e.target.value.toUpperCase() } })} />
                  <small className="app-muted">{COLOR_HELP[k]}</small>
                  {issues[k as keyof typeof issues] && <small id={`ap-cor-erro-${k}`} className="mm-field-erro" role="alert">{issues[k as keyof typeof issues]}</small>}
                </div>
              ))}
            </div>
          </div>
          <OptionGroup<ThemeFont> label="Fonte do nome do evento" value={draft.font} onChange={(v) => set({ font: v })} options={THEME_FONTS.map((f) => ({ value: f, label: EVENT_FONT_LABEL[f] }))} />
          <div className="mm-field">
            <label className="mm-field-label" htmlFor="ap-msg">Mensagem de boas-vindas</label>
            <textarea id="ap-msg" className="mm-field-input studio-msg" rows={3} maxLength={MESSAGE_MAX} value={draft.welcomeMessage} onChange={(e) => set({ welcomeMessage: e.target.value })} aria-describedby="ap-msg-ajuda" />
            <p id="ap-msg-ajuda" className="app-p app-muted">{draft.welcomeMessage.length}/{MESSAGE_MAX}. Só texto; aparece no convite e na entrada.</p>
          </div>
          <OptionGroup<QrStyle> label="Estilo do QR Code" value={draft.qrStyle} onChange={(v) => set({ qrStyle: v })} options={QR_STYLES.map((q) => ({ value: q, label: QR_LABEL[q] }))} />
          <div className="app-stack-sm" data-testid="imagens">
            <span className="mm-group-label">Imagens</span>
            {images ? (
              (["logo", "cover"] as const).map((k) => (
                <div className="mm-field" key={k}>
                  <label className="mm-field-label" htmlFor={`ap-${k}`}>{k === "logo" ? "Logotipo (PNG, JPEG ou WebP, até 2 MB)" : "Capa (PNG, JPEG ou WebP, até 5 MB)"}</label>
                  <input id={`ap-${k}`} type="file" accept="image/png,image/jpeg,image/webp" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setMsg((await images.onUpload(k, f)) ?? (k === "logo" ? "Logotipo atualizado." : "Capa atualizada.")); e.target.value = ""; }} />
                </div>
              ))
            ) : (
              <p className="app-p app-muted">Logo e capa ficam disponíveis com o servidor ligado.</p>
            )}
          </div>
        </fieldset>
        {!verdict.ok && (
          <ul className="mm-field-erro" role="alert">{verdict.errors.map((e) => <li key={e}>{e}</li>)}</ul>
        )}
        {msg && <p className="app-p" role="status">{msg}</p>}
        <div className="studio-acoes">
          <Button variant="primario" disabled={locked || !verdict.ok} onClick={async () => setMsg((await onSave(draft)) ?? "Aparência salva.")}>Salvar aparência</Button>
          {!event.theme && !locked && <span className="app-muted" style={{ fontSize: 13, alignSelf: "center" }}>Ainda não há aparência salva para restaurar.</span>}
          <Button variant="secundario" disabled={locked || !event.theme} onClick={async () => { setMsg((await onRestore()) ?? "Tema padrão restaurado."); setDraft(initialTheme({ ...event, theme: undefined })); }}>Restaurar tema padrão</Button>
        </div>
      </section>

      <aside className="studio-previa" aria-label="Prévia do convite">
        <p className="mm-group-label">Prévia do convite{!verdict.ok && <span className="app-muted"> · mostrando o último tema válido (corrija as cores marcadas)</span>}</p>
        <EventTheme palette={event.palette} font={draft.font} theme={verdict.ok ? draft : undefined} className="studio-cartao">
          <div className="studio-cartao-corpo" style={{ background: "var(--evento-superficie)", color: "var(--evento-texto)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- URL assinada do Storage, sem otimizador */}
            {images?.coverUrl && <img className="studio-capa" src={images.coverUrl} alt="" />}
            {/* eslint-disable-next-line @next/next/no-img-element -- URL assinada do Storage, sem otimizador */}
            {images?.logoUrl && <img className="studio-logo" src={images.logoUrl} alt="Logotipo do evento" />}
            <p className="nome-evento app-h1" style={{ color: "var(--evento-profundo)", fontFamily: "var(--font-evento)" }}>{event.title}</p>
            {draft.welcomeMessage && <p className="app-p">{draft.welcomeMessage}</p>}
            {/* eslint-disable-next-line @next/next/no-img-element -- data URL local */}
            {qr ? <img className="studio-qr" data-estilo={draft.qrStyle} src={qr} alt="" aria-hidden="true" /> : <span className="studio-qr" aria-hidden="true" />}
            <span className="studio-botao" style={{ background: "var(--evento-controle)", color: "var(--on-evento)" }}>Entrar na festa</span>
            <small>Powered by MemoriesMT</small>
          </div>
        </EventTheme>
      </aside>
    </div>
  );
}
