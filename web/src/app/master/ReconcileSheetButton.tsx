"use client";

import { useRouter } from "next/navigation";
import { Ico } from "@/revela/master-kit";
import { ReconcileSheet, useReconcile } from "@/revela/master/ReconcileSheet";

/** "Conciliar agora" (M23): abre a folha única. Sem segundo fator pede o código do autenticador; depois mostra conciliados, falhas e sem mudança,
 *  com 1 minuto de espera entre chamadas (a contagem regressiva é da folha; a regra é do servidor). `last` = quando foi a última conciliação manual. */
export function ReconcileSheetButton({ last }: { last?: string }) {
  const router = useRouter();
  const rec = useReconcile({ last, onDone: () => router.refresh() });
  return (
    <>
      <button type="button" className="rv-btn rv-btn--sm" onClick={() => void rec.start()} aria-haspopup="dialog"><Ico n="refresh" />Conciliar agora</button>
      {rec.state && <ReconcileSheet state={rec.state} onSubmitCode={(c) => void rec.submitCode(c)} onClose={rec.close} />}
    </>
  );
}
