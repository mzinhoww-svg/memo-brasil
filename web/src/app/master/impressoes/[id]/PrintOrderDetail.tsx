"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { adminErrorText } from "@/lib/master/reason";
import { ADVANCE, NEXT_STATUS, canCancel, type PrintStatus } from "@/lib/master/print-orders";
import { browserSupabase } from "@/lib/supabase/client";
import { PrintAdvanceSheet, PrintCancelSheet } from "@/revela/master/PrintOrderSheets";
import { DetalheActions, MasterImpressaoDetalheView, type ImpressaoDetalheData } from "@/revela/screens/MasterImpressaoDetalhe";

const NOTE_MAX = 500;

/** M30 no app: o desenho com o pedido real. Avançar (M30.f1), cancelar com motivo (M30.f2) e salvar a nota interna (ao sair do campo) gravam pela RPC, que confere a ordem e audita. */
export function PrintOrderDetail({ id, data }: { id: string; data: ImpressaoDetalheData }) {
  const router = useRouter();
  const [sheet, setSheet] = useState<"advance" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState(data.noteInternal);
  const [saved, setSaved] = useState(data.noteInternal);
  const [noteError, setNoteError] = useState<string | null>(null);
  const status: PrintStatus = data.status;
  const next = NEXT_STATUS[status];
  const close = () => { setSheet(null); setError(null); };

  async function change(to: PrintStatus, reason?: string) {
    setError(null);
    const { error: e } = await browserSupabase().rpc("admin_set_print_order_status", { p_id: id, p_status: to, p_note: reason ?? null });
    if (e) { setError(e.code === "MM009" ? "O pedido já mudou de estado. Atualize a página." : adminErrorText(e.code, e.message)); return; }
    close();
    router.refresh();
  }
  async function saveNote() {
    const text = note.trim();
    if (text === saved.trim()) return;
    setNoteError(null);
    const { error: e } = await browserSupabase().rpc("admin_set_print_order_note", { p_id: id, p_note: text });
    if (e) { setNoteError(e.code === "MM005" ? `A nota pode ter até ${NOTE_MAX} caracteres.` : adminErrorText(e.code, e.message)); return; }
    setSaved(text);
  }

  return (
    <>
      <MasterImpressaoDetalheView data={data}
        actions={<DetalheActions back={{ href: "/master/impressoes" }} onCancel={canCancel(status) ? () => setSheet("cancel") : null}
          advance={next ? { label: ADVANCE[next].button, onClick: () => setSheet("advance") } : null} />}
        note={{ value: note, onChange: setNote, onBlur: () => void saveNote(), error: noteError }} />
      {sheet === "advance" && next && <PrintAdvanceSheet code={data.code} from={status} to={next} error={error} onCancel={close} onConfirm={() => change(next)} />}
      {sheet === "cancel" && <PrintCancelSheet code={data.code} error={error} onCancel={close} onConfirm={(reason) => change("cancelado", reason)} />}
    </>
  );
}
