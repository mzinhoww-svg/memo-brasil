"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ico } from "@/revela/master-kit";
import { browserSupabase } from "@/lib/supabase/client";
import { adminErrorText } from "../billing";
import { codeLink, defaultExpiry, expiryIso, noteError, NOTE_MAX, parseUses, USES_MAX } from "../codes";

/** Copia e confirma no próprio botão por alguns segundos. */
function Copy({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState<null | "ok" | "erro">(null);
  async function copy() {
    try { await navigator.clipboard.writeText(text); setDone("ok"); } catch { setDone("erro"); }
    setTimeout(() => setDone(null), 2500);
  }
  return <button type="button" className="rv-btn rv-btn--sm" onClick={() => void copy()} aria-live="polite">{done === "ok" ? "Copiado" : done === "erro" ? "Não foi possível copiar" : label}</button>;
}

/** M07 · Novo código: o servidor gera o código (não é digitado); a nota diz para quem é. Aparece inteiro uma única vez. */
export function CodeForm({ plans }: { plans: { code: string; name: string }[] }) {
  const router = useRouter();
  const [plan, setPlan] = useState(plans[0]?.code ?? "");
  const [uses, setUses] = useState("20");
  const [expiry, setExpiry] = useState(defaultExpiry);
  const [note, setNote] = useState("");
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);

  const maxUses = parseUses(uses);
  const expiresAt = expiryIso(expiry);
  const errs = [note.trim() ? noteError(note) : tried ? noteError(note) : null, tried && maxUses == null ? `Usos: de 1 a ${USES_MAX}.` : null, tried && (!expiresAt || Date.parse(expiresAt) <= Date.now()) ? "Validade: escolha uma data a partir de hoje." : null].filter(Boolean) as string[];

  async function submit() {
    setTried(true);
    if (!plan || maxUses == null || !expiresAt || Date.parse(expiresAt) <= Date.now() || noteError(note)) return;
    setBusy(true); setError(null);
    const { data, error: e } = await browserSupabase().rpc("admin_create_code", { p_plan: plan, p_max_uses: maxUses, p_expires_at: expiresAt, p_note: note.trim() });
    setBusy(false);
    if (e || typeof data !== "string") { setError(adminErrorText(e?.code, e?.message ?? "")); return; }
    setCode(data);
    router.refresh();
  }
  const again = () => { setCode(null); setNote(""); setTried(false); setError(null); };

  return (
    <div className="stack" style={{ marginTop: "14px" }}>
      <label className="rv-field">
        <Ico n="ticket" />
        <input value={note} maxLength={NOTE_MAX + 20} onChange={(e) => setNote(e.target.value)} placeholder="Para quem / nota (obrigatório)" aria-label="Para quem / nota" />
      </label>
      <label className="rv-field">
        <Ico n="tag" />
        <select value={plan} onChange={(e) => setPlan(e.target.value)} aria-label="Plano" style={{ all: "unset", flex: 1, font: "inherit", cursor: "pointer" }}>
          {plans.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
        </select>
      </label>
      <div className="row" style={{ gap: "8px" }}>
        <label className="rv-field" style={{ flex: "1" }}>
          <input value={uses} inputMode="numeric" onChange={(e) => setUses(e.target.value)} aria-label="Usos" placeholder="Usos" />
        </label>
        <label className="rv-field" style={{ flex: "1" }}>
          <input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} aria-label="Validade" />
        </label>
      </div>
      {errs.map((m) => <p key={m} className="rv-caption" role="alert" style={{ color: "var(--danger)" }}>{m}</p>)}
      {code && (
        <div className="mnote" role="status" style={{ margin: 0, flexDirection: "column" }}>
          <span>Código gerado · copie agora. Por segurança ele aparece inteiro só agora; depois, só o começo.</span>
          <strong style={{ font: "400 20px/26px var(--font-stamp)", letterSpacing: ".08em" }} aria-label="Código gerado">{code}</strong>
          <span className="row" style={{ gap: "8px" }}>
            <Copy text={code} label="Copiar código" />
            <Copy text={codeLink(window.location.origin, code)} label="Copiar link" />
          </span>
        </div>
      )}
      {error && <p className="rv-caption" role="alert" style={{ color: "var(--danger)" }}>{error}</p>}
      {code
        ? <button type="button" className="rv-btn rv-btn--block rv-btn--primary" onClick={again}>Gerar outro</button>
        : <button type="button" className="rv-btn rv-btn--block rv-btn--primary" onClick={() => void submit()} disabled={busy || !plans.length}>{busy ? "Criando…" : "Criar código"}</button>}
    </div>
  );
}
