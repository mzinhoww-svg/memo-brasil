"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ActionSheet } from "@/revela/master/ActionSheet";
import { MasterEventosTesteBar, MasterEventosTesteView, type EventoTesteRow } from "@/revela/screens/MasterEventosTeste";
import { RefusalSheet } from "@/revela/screens/MasterEventosFolhas";
import { deleteTestEvents, setTestFlag, TEST_ERROR_TEXT, type Refusal, type TestOutcome } from "@/lib/master/test-events";

export interface TesteRow extends EventoTesteRow { photosN: number }
type Sheet = null | { kind: "delete" } | { kind: "unmark" } | { kind: "refused"; refusals: Refusal[] };

/** M22 · lista de eventos de teste com seleção e lote. Só o master seleciona (`canSelect`); o banco recusa de novo qualquer outro papel. */
export function TesteLista({ caption, chips, rows, canSelect }: { caption: string; chips: { label: string; href: string; on?: boolean }[]; rows: TesteRow[]; canSelect: boolean }) {
  const router = useRouter();
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [sheet, setSheet] = useState<Sheet>(null);
  const [error, setError] = useState<string | null>(null);
  const picked = useMemo(() => rows.filter((r) => selected.has(r.key)), [rows, selected]);
  const toggle = (key: string) => setSelected((s) => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  const close = () => { setSheet(null); setError(null); };

  /** Resposta do servidor → fecha e atualiza, abre a folha de recusa (lote inteiro recusado) ou mostra o erro na folha. */
  function settle(o: TestOutcome) {
    if (o.ok) { setSelected(new Set()); close(); router.refresh(); return; }
    if (o.kind === "refused") { setError(null); setSheet({ kind: "refused", refusals: o.refusals }); return; }
    setError(TEST_ERROR_TEXT[o.kind]);
  }

  return (
    <>
      <MasterEventosTesteView
        caption={caption} chips={chips} rows={rows} selected={selected} onToggle={canSelect ? toggle : false} exportAction={null}
        bar={canSelect && selected.size ? <MasterEventosTesteBar count={selected.size} onUnmark={() => { setError(null); setSheet({ kind: "unmark" }); }} onDelete={() => { setError(null); setSheet({ kind: "delete" }); }} /> : null}
      />
      {sheet?.kind === "delete" && (
        <ActionSheet title={`Excluir ${picked.length} ${picked.length === 1 ? "evento de teste" : "eventos de teste"}?`} confirmLabel={`Excluir ${picked.length} ${picked.length === 1 ? "evento" : "eventos"}`} busyLabel="Excluindo…" tone="danger"
          body={`${picked.length === 1 ? "O evento, as" : "Os eventos, as"} ${picked.reduce((n, r) => n + r.photosN, 0).toLocaleString("pt-BR")} fotos e os convites somem.`}
          error={error} onCancel={close} onConfirm={async (reason) => settle(await deleteTestEvents(picked.map((r) => r.key), reason))}>
          <div className="rv-group" style={{ marginTop: "16px" }}>{picked.map((r) => <div className="rv-row" key={r.key}><div className="rv-row__text">{r.title}</div></div>)}</div>
        </ActionSheet>
      )}
      {sheet?.kind === "unmark" && (
        <ActionSheet title={`Desmarcar ${picked.length} ${picked.length === 1 ? "evento" : "eventos"} como teste?`} confirmLabel="Desmarcar teste" busyLabel="Desmarcando…"
          body="Eles voltam para as métricas e para a lista de eventos."
          error={error} onCancel={close} onConfirm={async (reason) => settle(await setTestFlag(picked.map((r) => r.key), false, reason))}>
          <div className="rv-group" style={{ marginTop: "16px" }}>{picked.map((r) => <div className="rv-row" key={r.key}><div className="rv-row__text">{r.title}</div></div>)}</div>
        </ActionSheet>
      )}
      {sheet?.kind === "refused" && (
        <RefusalSheet title="Lote recusado" body="Nada foi excluído. Tire estes eventos da seleção e tente de novo." closeLabel="Voltar para a lista" onClose={close}
          items={sheet.refusals.map((f) => ({ key: f.id, title: f.title ?? "Evento", reason: f.reason }))} />
      )}
    </>
  );
}

