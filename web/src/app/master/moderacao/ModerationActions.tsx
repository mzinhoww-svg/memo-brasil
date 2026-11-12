"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { browserSupabase } from "@/lib/supabase/client";
import { adminErrorText } from "@/lib/master/reason";
import { ACTION_LABEL, moderationCall, rowActions, sheetText, type ModAction, type ModKind } from "@/lib/master/moderation";
import { ActionSheet } from "@/revela/master/ActionSheet";

/** Botões da linha (Manter / Esconder / Excluir). Cada um abre a folha com o campo Motivo (10 a 500); o servidor confere de novo e grava a auditoria.
 *  Só o master recebe estes botões (a página não os monta para support e auditor). */
export function ModerationActions({ kind, id, hidden, subject }: { kind: ModKind; id: string; hidden: boolean; subject: string }) {
  const router = useRouter();
  const [action, setAction] = useState<ModAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const close = () => { setAction(null); setError(null); };
  async function confirm(reason: string) {
    if (!action) return;
    const { fn, args } = moderationCall(kind, id, action, reason);
    const { error: e } = await browserSupabase().rpc(fn, args);
    if (e) { setError(adminErrorText(e.code, e.message)); return; }
    close();
    router.refresh();
  }
  const t = action ? sheetText(kind, action, subject) : null;
  return (
    <>
      {rowActions(hidden).map((a, i) => (
        <Fragment key={a}>{i > 0 && " "}<button type="button" className="rv-btn rv-btn--sm" onClick={() => setAction(a)}>{ACTION_LABEL[a]}</button></Fragment>
      ))}
      {action && t && (
        <ActionSheet title={t.title} body={t.body} confirmLabel={t.confirm} busyLabel={t.busy} tone={action === "excluir" ? "danger" : "primary"} error={error} onConfirm={confirm} onCancel={close} />
      )}
    </>
  );
}
