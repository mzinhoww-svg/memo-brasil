"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { adminErrorText } from "@/lib/master/reason";
import { browserSupabase } from "@/lib/supabase/client";
import { FlagSheet, SettingSheet } from "@/revela/master/ConfigSheets";
import { MasterConfigRevisadaView, type ConfigEditKey, type ConfigFlagKey, type MasterConfigRevisadaViewProps } from "@/revela/screens/MasterConfigRevisada";
import { EDIT, FLAG, SETTING_KEY, fieldError, jsonOf, rawOf, type ConfigOverview } from "./config";

type Sheet = { kind: "edit"; key: ConfigEditKey } | { kind: "flag"; key: ConfigFlagKey; next: boolean } | null;

/** M31 no app: a tela do desenho com os valores reais. Cada alteração abre a folha (valor antigo, novo e motivo) e grava pela RPC, que audita. */
export function ConfigPanel({ overview, view }: { overview: ConfigOverview; view: Pick<MasterConfigRevisadaViewProps, "env" | "flags" | "values" | "webhook"> }) {
  const router = useRouter();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const close = () => { setSheet(null); setError(null); };

  async function run(call: () => PromiseLike<{ error: { code?: string; message: string } | null }>) {
    setError(null);
    const { error: e } = await call();
    if (e) { setError(adminErrorText(e.code, e.message)); return; }
    close();
    router.refresh();
  }

  return (
    <>
      <MasterConfigRevisadaView {...view} showPrinted
        onEdit={(key) => { setValue(rawOf(key, overview)); setError(null); setSheet({ kind: "edit", key }); }}
        onToggle={(key) => { setError(null); setSheet({ kind: "flag", key, next: !overview.flags[key] }); }} />
      {sheet?.kind === "edit" && (() => {
        const m = EDIT[sheet.key];
        return (
          <SettingSheet title={m.title} body={m.body} today={view.values?.[sheet.key]} fieldLabel={m.fieldLabel} inputLabel={m.inputLabel} unit={m.unit}
            value={value} onValue={setValue} invalid={fieldError(sheet.key, value)} error={error} onCancel={close}
            onConfirm={(reason) => run(() => browserSupabase().rpc("admin_set_setting", { p_key: SETTING_KEY[sheet.key], p_value: jsonOf(sheet.key, value), p_reason: reason }))} />
        );
      })()}
      {sheet?.kind === "flag" && (() => {
        const m = FLAG[sheet.key][sheet.next ? "on" : "off"];
        return (
          <FlagSheet title={m.title} body={m.body} confirmLabel={m.confirm} busyLabel={m.busy} tone={m.tone} error={error} onCancel={close}
            onConfirm={(reason) => run(() => browserSupabase().rpc("admin_set_feature_flag", { p_key: sheet.key, p_enabled: (sheet as { next: boolean }).next, p_rollout: {}, p_reason: reason }))} />
        );
      })()}
    </>
  );
}
