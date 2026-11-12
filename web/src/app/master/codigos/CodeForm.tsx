"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ico } from "@/revela/master-kit";
import { Button,Sheet } from "@/components/revela";
import { browserSupabase } from "@/lib/supabase/client";
import { adminErrorText,reasonError } from "../billing";
import { ReasonField } from "../billing-actions";
import { nowMs } from "../format";
import { codeLink, defaultExpiry, expiryIso, namedCodeError, parseUses, USES_MAX } from "../codes";

/** Copia e confirma no próprio botão por alguns segundos. */
function Copy({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState<null | "ok" | "erro">(null);
  async function copy() {
    try { await navigator.clipboard.writeText(text); setDone("ok"); } catch { setDone("erro"); }
    setTimeout(() => setDone(null), 2500);
  }
  return <button type="button" className="rv-btn rv-btn--sm" onClick={() => void copy()} aria-live="polite">{done === "ok" ? "Copiado" : done === "erro" ? "Não foi possível copiar" : label}</button>;
}

/** M07 · Código escolhido no desenho; o banco guarda apenas hash/identificação, sem alterar o gerador antigo. */
export function CodeForm({ plans }: { plans: { code: string; name: string }[] }) {
  const router = useRouter();
  const [plan, setPlan] = useState(plans[0]?.code ?? "");
  const [uses, setUses] = useState("20");
  const [expiry, setExpiry] = useState(defaultExpiry);
  const [name, setName] = useState("");
  const [confirming,setConfirming]=useState(false),[reason,setReason]=useState("");
  const [reasonTried,setReasonTried]=useState(false);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);

  const maxUses = parseUses(uses);
  const expiresAt = expiryIso(expiry);
  const errs = [name.trim()||tried ? namedCodeError(name) : null, tried && maxUses == null ? `Usos: de 1 a ${USES_MAX}.` : null, tried && (!expiresAt || Date.parse(expiresAt) <= nowMs()) ? "Validade: escolha uma data a partir de hoje." : null].filter(Boolean) as string[];

  async function submit() {
    setReasonTried(true);
    if (busy || reasonError(reason) || !plan || maxUses == null || !expiresAt || Date.parse(expiresAt) <= nowMs() || namedCodeError(name)) return;
    setBusy(true); setError(null);
    const { data, error: e } = await browserSupabase().rpc("admin_master_create_code", { p_code:name.trim().toUpperCase(),p_plan: plan, p_max_uses: maxUses, p_expires_at: expiresAt, p_reason:reason.trim() });
    setBusy(false);
    if (e || typeof data !== "string") { setError(adminErrorText(e?.code, e?.message ?? "")); return; }
    setCode(data);
    setConfirming(false);setReason("");setReasonTried(false);
    router.refresh();
  }
  const again = () => { setCode(null); setName(""); setTried(false); setError(null); };

  return (
    <div className="stack" style={{ marginTop: "14px" }}>
      <label className="rv-field">
        <Ico n="tag" />
        <input value={name} maxLength={40} onChange={(e) => setName(e.target.value.toUpperCase())} placeholder="Código" aria-label="Código" />
      </label>
      <label className="rv-field">
        <Ico n="ticket" />
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
          <span>Código criado · copie agora. Por segurança ele aparece inteiro só agora; depois, só uma identificação parcial.</span>
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
        : <button type="button" className="rv-btn rv-btn--block rv-btn--primary" onClick={()=>{setTried(true);if(!plan||namedCodeError(name)||maxUses===null||!expiresAt||Date.parse(expiresAt)<=nowMs())return;setError(null);setConfirming(true);}} disabled={busy || !plans.length}>{busy ? "Criando…" : "Criar código"}</button>}
      {confirming&&<Sheet title="Criar código" onClose={()=>{setConfirming(false);setReason("");setReasonTried(false);}}>
       <p className="rv-caption">{name.trim().toUpperCase()} · {uses} usos. Cada resgate concede o plano escolhido sem pagamento.</p>
       <ReasonField label="Motivo (obrigatório, 10 a 500 caracteres)" value={reason} onChange={setReason} error={reasonTried?reasonError(reason):null}/>
       {error&&<p className="rv-field-erro" role="alert">{error}</p>}
       <Button block onClick={()=>void submit()} disabled={busy}>{busy?"Criando…":"Criar código"}</Button>
       <Button block variant="texto" onClick={()=>{setConfirming(false);setReason("");setReasonTried(false);}}>Cancelar</Button>
      </Sheet>}
    </div>
  );
}
