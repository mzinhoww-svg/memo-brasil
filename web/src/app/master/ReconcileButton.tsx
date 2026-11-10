"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Ico } from "@/revela/master-kit";
import { ensureSecondFactor, reconcileNow, reconcileText, type ReconcileOutcome } from "@/lib/master/reconcile";

/** "Conciliar agora" (M05): confirma o segundo fator, pede à função do servidor e atualiza a lista. */
export function ReconcileButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | undefined>();
  async function run() {
    setBusy(true);
    setMsg(undefined);
    try {
      const f = await ensureSecondFactor((m) => window.prompt(m));
      if (f === "no-factor") return setMsg("Cadastre o autenticador antes (ele é pedido ao publicar preços em Planos).");
      if (f === "cancelled") return;
      if (f === "wrong-code") return setMsg("Código incorreto. Tente de novo.");
      const o: ReconcileOutcome = await reconcileNow();
      setMsg(reconcileText(o));
      if (o.kind === "ok") router.refresh();
    } catch {
      setMsg(reconcileText({ kind: "unavailable" }));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button type="button" className="rv-btn rv-btn--sm" onClick={() => void run()} disabled={busy} aria-busy={busy}><Ico n="refresh" />Conciliar agora</button>
      {msg && <span className="rv-caption" role="status" style={{ alignSelf: "center" }}>{msg}</span>}
    </>
  );
}
