"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, OptionGroup, Sheet } from "@/components/memoriesmt";
import { browserSupabase } from "@/lib/supabase/client";
import { adminErrorText, reasonError } from "./billing";
import { ReasonField } from "./billing-actions";
import { codeLink, defaultExpiry, expiryIso, hintText, noteError, NOTE_MAX, parseUses, USES_MAX } from "./codes";

type Uses = "1" | "5" | "20" | "outro";
const USES: { value: Uses; label: string }[] = [
  { value: "1", label: "1" }, { value: "5", label: "5" }, { value: "20", label: "20" }, { value: "outro", label: "Outro" },
];

/** Copia para a área de transferência e confirma no próprio botão por alguns segundos. */
function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState<null | "ok" | "erro">(null);
  async function copy() {
    try { await navigator.clipboard.writeText(text); setDone("ok"); } catch { setDone("erro"); }
    setTimeout(() => setDone(null), 2500);
  }
  return (
    <Button variant="secundario" small onClick={copy} aria-live="polite">
      {done === "ok" ? "Copiado" : done === "erro" ? "Não foi possível copiar" : label}
    </Button>
  );
}

// ---------------------------------------------------------------- gerar
export function GenerateCodeButton({ plans }: { plans: { code: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState(plans[0]?.code ?? "");
  const [uses, setUses] = useState<Uses>("1");
  const [other, setOther] = useState("");
  const [expiry, setExpiry] = useState(defaultExpiry);
  const [note, setNote] = useState("");
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);

  const maxUses = uses === "outro" ? parseUses(other) : Number(uses);
  const usesErr = maxUses == null ? `Digite um número de 1 a ${USES_MAX}.` : null;
  const expiresAt = expiryIso(expiry);
  const [past, setPast] = useState(false);
  const expiryErr = !expiresAt || past ? "Escolha uma data a partir de hoje." : null;
  const noteErr = noteError(note);

  const reset = () => {
    setPlan(plans[0]?.code ?? ""); setUses("1"); setOther(""); setExpiry(defaultExpiry()); setNote("");
    setTried(false); setPast(false); setError(null); setCode(null);
  };
  const close = () => { setOpen(false); setCode(null); setError(null); setTried(false); };

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
    <>
      <Button small onClick={() => { reset(); setOpen(true); }} disabled={!plans.length}>Gerar código</Button>
      {open && (
        <Sheet title="Gerar código" onClose={close}>
          <OptionGroup label="Plano liberado" options={plans.map((p) => ({ value: p.code, label: p.name }))} value={plan}
            onChange={setPlan} />
          <OptionGroup label="Quantos eventos podem usar" options={USES} value={uses} onChange={setUses} />
          {uses === "outro" && (
            <Field label="Número de eventos" inputMode="numeric" value={other} onChange={(e) => setOther(e.target.value)}
              error={tried ? usesErr ?? undefined : undefined} help={`De 1 a ${USES_MAX}.`} />
          )}
          <Field label="Validade" type="date" value={expiry} onChange={(e) => { setExpiry(e.target.value); setPast(false); }}
            error={tried ? expiryErr ?? undefined : undefined}
            help="Depois disso o código para de funcionar. Planos já liberados continuam." />
          <Field label="Para quem / nota (obrigatório)" value={note} maxLength={NOTE_MAX + 20}
            onChange={(e) => setNote(e.target.value)} error={tried ? noteErr ?? undefined : undefined} />
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
          {code
            ? <Button block onClick={reset}>Gerar outro</Button> /* só limpa o formulário: o próximo código sai em "Gerar código" */
            : <Button block onClick={submit} disabled={busy}>{busy ? "Gerando…" : "Gerar código"}</Button>}
          <Button variant="texto" block onClick={close}>{code ? "Fechar" : "Cancelar"}</Button>
        </Sheet>
      )}
    </>
  );
}

// ---------------------------------------------------------------- revogar
export function RevokeCodeButton({ code }: { code: { id: string; hint: string; planName: string | null } }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const close = () => { setOpen(false); setError(null); setTried(false); };
  async function submit() {
    setTried(true);
    if (reasonError(reason)) return;
    setBusy(true); setError(null);
    const { error: e } = await browserSupabase().rpc("admin_revoke_code", { p_code_id: code.id, p_reason: reason.trim() });
    setBusy(false);
    if (e) { setError(adminErrorText(e.code, e.message)); return; }
    setReason(""); close(); router.refresh();
  }
  return (
    <>
      <Button variant="texto" small onClick={() => setOpen(true)} aria-label={`Revogar ${hintText(code.hint)}`}>Revogar</Button>
      {open && (
        <Sheet title="Revogar código" onClose={close}>
          <p className="adm-nota adm-sheet-nota">{hintText(code.hint)} · {code.planName ?? "—"}</p>
          <ReasonField label="Motivo (obrigatório, 10 a 500 caracteres)" value={reason} onChange={setReason} error={tried ? reasonError(reason) : null} />
          <p className="adm-nota adm-sheet-nota">O código para de funcionar agora. Planos já liberados com ele continuam. Fica no registro de auditoria.</p>
          {error && <p className="mm-field-erro" role="alert">{error}</p>}
          <Button variant="destrutivo" block onClick={submit} disabled={busy}>{busy ? "Revogando…" : "Revogar código"}</Button>
          <Button variant="texto" block onClick={close}>Cancelar</Button>
        </Sheet>
      )}
    </>
  );
}
