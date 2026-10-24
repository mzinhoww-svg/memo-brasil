"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, OptionGroup, Sheet } from "@/components/memoriesmt";
import { browserSupabase } from "@/lib/supabase/client";
import { adminErrorText } from "../billing";
import { codeLink, expiryIso, noteError, NOTE_MAX, parseUses, USES_MAX } from "../codes";
import { expiryInDays, type CodeTemplate } from "./lib";
import css from "./page.module.css";

/**
 * Modelos rápidos: abrem um formulário já preenchido (plano, usos, validade, nota) e enviam pela MESMA RPC do botão "Gerar código"
 * (`admin_create_code`, mesmos parâmetros). Nenhuma RPC nova. Tudo continua editável antes de gerar.
 */
export function CodeTemplates({ templates, plans }: { templates: CodeTemplate[]; plans: { code: string; name: string }[] }) {
  const [tpl, setTpl] = useState<CodeTemplate | null>(null);
  return (
    <div className={css.templates} role="group" aria-label="Modelos rápidos">
      {templates.map((t) => (
        <button key={t.id} type="button" className={`adm-btn ${css.tpl}`} onClick={() => setTpl(t)} disabled={!plans.length}>
          <span>{t.label}</span>
          <small>{t.hint}</small>
        </button>
      ))}
      {tpl && <TemplateSheet key={tpl.id} tpl={tpl} plans={plans} onClose={() => setTpl(null)} />}
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState<null | "ok" | "erro">(null);
  async function copy() {
    try { await navigator.clipboard.writeText(text); setDone("ok"); } catch { setDone("erro"); }
    setTimeout(() => setDone(null), 2500);
  }
  return <Button variant="secundario" small onClick={copy} aria-live="polite">{done === "ok" ? "Copiado" : done === "erro" ? "Não foi possível copiar" : label}</Button>;
}

function TemplateSheet({ tpl, plans, onClose }: { tpl: CodeTemplate; plans: { code: string; name: string }[]; onClose: () => void }) {
  const router = useRouter();
  const [plan, setPlan] = useState(tpl.plan);
  const [uses, setUses] = useState(String(tpl.uses));
  const [expiry, setExpiry] = useState(() => expiryInDays(tpl.days, new Date()));
  const [note, setNote] = useState(tpl.note);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);

  const maxUses = parseUses(uses);
  const usesErr = maxUses == null ? `Digite um número de 1 a ${USES_MAX}.` : null;
  const expiresAt = expiryIso(expiry);
  const [past, setPast] = useState(false);
  const expiryErr = !expiresAt || past ? "Escolha uma data a partir de hoje." : null;
  const noteErr = noteError(note);

  async function submit() {
    setTried(true);
    const isPast = !!expiresAt && Date.parse(expiresAt) <= Date.now();
    setPast(isPast);
    if (isPast || !plan || usesErr || expiryErr || noteErr || maxUses == null || !expiresAt) return;
    setBusy(true); setError(null);
    const { data, error: e } = await browserSupabase().rpc("admin_create_code", {
      p_plan: plan, p_max_uses: maxUses, p_expires_at: expiresAt, p_note: note.trim(),
    });
    setBusy(false);
    if (e || typeof data !== "string") { setError(adminErrorText(e?.code, e?.message ?? "")); return; }
    setCode(data);
    router.refresh();
  }

  return (
    <Sheet title={`Gerar código: ${tpl.label}`} onClose={onClose}>
      <OptionGroup label="Plano liberado" options={plans.map((p) => ({ value: p.code, label: p.name }))} value={plan} onChange={setPlan} />
      <Field label="Quantos eventos podem usar" inputMode="numeric" value={uses} onChange={(e) => setUses(e.target.value)}
        error={tried ? usesErr ?? undefined : undefined} help={`De 1 a ${USES_MAX}.`} />
      <Field label="Validade" type="date" value={expiry} onChange={(e) => { setExpiry(e.target.value); setPast(false); }}
        error={tried ? expiryErr ?? undefined : undefined} help="Depois disso o código para de funcionar. Planos já liberados continuam." />
      <Field label="Para quem / nota (obrigatório)" value={note} maxLength={NOTE_MAX + 20} onChange={(e) => setNote(e.target.value)}
        error={tried ? noteErr ?? undefined : undefined} />
      {code && (
        <div className="adm-code-card" role="status">
          <span className="adm-eyebrow">Código gerado · copie agora</span>
          <strong className="adm-code">{code}</strong>
          <p className="adm-nota adm-sheet-nota">Por segurança ele aparece inteiro só agora; depois, só o começo.</p>
          <div className="adm-code-actions">
            <CopyButton text={code} label="Copiar código" />
            <CopyButton text={codeLink(window.location.origin, code)} label="Copiar link" />
          </div>
        </div>
      )}
      {error && <p className="mm-field-erro" role="alert">{error}</p>}
      {!code && <Button block onClick={submit} disabled={busy}>{busy ? "Gerando…" : "Gerar código"}</Button>}
      <Button variant="texto" block onClick={onClose}>{code ? "Fechar" : "Cancelar"}</Button>
    </Sheet>
  );
}
