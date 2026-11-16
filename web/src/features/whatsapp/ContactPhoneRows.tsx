"use client";

import { useEffect, useState } from "react";
import { backendMode } from "@/lib/supabase/env";
import { forgetMyPhone, formatBrPhone, getMyPhone, setMyMarketing, type ContactPhone } from "./contact";

/** Você → Seus dados: número guardado na conta, autorização de campanhas (liga/desliga) e "Apagar". Sem número guardado, não aparece. */
export function ContactPhoneRows() {
  const live = backendMode() === "supabase";
  const [c, setC] = useState<ContactPhone | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  useEffect(() => {
    if (!live) return;
    let on = true;
    void getMyPhone().then((v) => { if (on) setC(v); }, () => undefined);
    return () => { on = false; };
  }, [live]);
  if (!c) return null;

  const toggle = async () => {
    if (busy) return;
    const next = !c.marketing;
    setBusy(true); setError(undefined);
    try { await setMyMarketing(next); setC({ ...c, marketing: next }); }
    catch { setError("Não deu para salvar agora. Tente de novo."); }
    finally { setBusy(false); }
  };
  const forget = async () => {
    if (busy || !window.confirm("Apagar o número guardado? Ele deixa de ser preenchido nos próximos eventos e você sai das novidades.")) return;
    setBusy(true); setError(undefined);
    try { await forgetMyPhone(); setC(null); }
    catch { setError("Não deu para apagar agora. Tente de novo."); }
    finally { setBusy(false); }
  };
  const key = (fn: () => void) => (e: React.KeyboardEvent) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); fn(); } };

  return (
    <>
      <div className="rv-row" data-testid="telefone-guardado">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a8.5 8.5 0 0 1-12.4 7.5L3 21l1.6-5.4A8.5 8.5 0 1 1 21 12z" /></svg>
        <div className="rv-row__text">
          {formatBrPhone(c.phone)}
          <div className="rv-row__meta">Guardado para preencher nos próximos eventos</div>
        </div>
        <button type="button" className="rv-row__end wa-row__acao" onClick={() => void forget()} disabled={busy}>Apagar</button>
      </div>
      <div className="rv-row" role="switch" aria-checked={c.marketing} aria-disabled={busy || undefined} tabIndex={0} onClick={() => void toggle()} onKeyDown={key(() => void toggle())}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l15-6v14L3 13z" /><path d="M7 13v4a2 2 0 0 0 4 0v-3" /></svg>
        <div className="rv-row__text">
          Novidades e ofertas no WhatsApp
          <div className="rv-row__meta">{c.marketing ? "Autorizado · desligue quando quiser" : "Desligado"}</div>
        </div>
        <span className={`rv-toggle${c.marketing ? " rv-toggle--on" : ""}`} />
      </div>
      {error && <p className="rv-field-erro" role="alert">{error}</p>}
    </>
  );
}
