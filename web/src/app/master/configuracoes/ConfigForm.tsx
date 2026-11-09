"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Sheet } from "@/components/revela";
import { browserSupabase } from "@/lib/supabase/client";
import { MasterConfigView } from "@/revela/screens/MasterConfig";
import { adminErrorText, reasonError } from "../billing";
import { ReasonField } from "../billing-actions";
import { PIX_MAX, PIX_MIN, SETTING_FIELDS, changesOf, fieldError, type ConfigState } from "./config";

export interface ConfigInitial extends ConfigState {
  env: "sandbox" | "production" | "desligado";
  webhook: { meta: string; tone: "ok" | "wait" | "info"; label: string };
}

/** M14: ValidaPay (validade do Pix, chave do cartão, checkout) e parâmetros da plataforma. Salvar pede motivo e grava com auditoria. */
export function ConfigForm({ initial }: { initial: ConfigInitial }) {
  const router = useRouter();
  const [draft, setDraft] = useState<ConfigState>(initial);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const changes = useMemo(() => changesOf(initial, draft), [initial, draft]);
  const errors = useMemo(() => Object.fromEntries(SETTING_FIELDS.map((f) => [f.key, fieldError(f.key, draft.settings[f.key] ?? "")])), [draft.settings]);
  const pixError = fieldError("validapay_pix_expiry_minutes", draft.pixMinutes);
  const invalid = Boolean(pixError) || Object.values(errors).some(Boolean);
  const set = (key: string, v: string) => setDraft((d) => ({ ...d, settings: { ...d.settings, [key]: v } }));

  async function save() {
    setTried(true);
    if (reasonError(reason)) return;
    setBusy(true); setError(null);
    const sb = browserSupabase();
    try {
      for (const c of changes) {
        const { error: e } = c.kind === "flag"
          ? await sb.rpc("admin_set_feature_flag", { p_key: c.key, p_enabled: c.value as boolean, p_rollout: {}, p_reason: reason.trim() })
          : await sb.rpc("admin_set_setting", { p_key: c.key, p_value: c.value, p_reason: reason.trim() });
        if (e) { setError(adminErrorText(e.code, e.message)); router.refresh(); return; }
      }
      setOpen(false); setReason(""); setTried(false); router.refresh();
    } finally { setBusy(false); }
  }

  const modal = open && (
    <Sheet title="Salvar configurações" onClose={() => { setOpen(false); setError(null); }}>
      <ul className="adm-diff" aria-label="O que muda">
        {changes.map((c) => <li key={c.key}><strong>{c.label}</strong>: <s>{c.from}</s> → <b>{c.to}</b></li>)}
      </ul>
      <ReasonField label="Motivo (obrigatório, 10 a 500 caracteres)" value={reason} onChange={setReason} error={tried ? reasonError(reason) : null} />
      <p className="adm-nota adm-sheet-nota">Cada mudança fica no registro de auditoria com o seu nome e este motivo.</p>
      {error && <p className="rv-field-erro" role="alert">{error}</p>}
      <Button block onClick={() => void save()} disabled={busy}>{busy ? "Salvando…" : "Salvar configurações"}</Button>
      <Button variant="texto" block onClick={() => { setOpen(false); setError(null); }}>Cancelar</Button>
    </Sheet>
  );

  return (
    <MasterConfigView
      env={initial.env}
      pix={{ minutes: draft.pixMinutes, onChange: (v) => setDraft((d) => ({ ...d, pixMinutes: v })), error: pixError }}
      card={{ on: draft.card, label: "Cartão de crédito", onToggle: () => setDraft((d) => ({ ...d, card: !d.card })), meta: draft.card ? "Ligado: o checkout oferece cartão, sempre com confirmação do banco (3DS)." : "Desligado: o checkout só oferece Pix. Ligue só depois de a conta ValidaPay liberar o cartão com 3DS." }}
      webhook={initial.webhook}
      checkout={{ on: draft.checkout, label: "Checkout ligado para anfitriões", onToggle: () => setDraft((d) => ({ ...d, checkout: !d.checkout })) }}
      platform={[
        ...SETTING_FIELDS.map((f) => ({ icon: f.icon, label: f.label, value: draft.settings[f.key] ?? "", placeholder: f.placeholder, onChange: (v: string) => set(f.key, v), hint: errors[f.key] ?? f.hint })),
        { icon: "photo" as const, label: "Tamanho máximo da foto", value: "8 MB", readOnly: true, hint: "Limite do armazenamento, não editável aqui." },
      ]}
      platformToggles={[]}
      save={{ dirty: changes.length > 0 && !invalid, busy, onSave: () => { setError(null); setOpen(true); } }}
      modal={modal || undefined}
      caption={`Pix de ${PIX_MIN} a ${PIX_MAX} minutos · mudanças gravam com motivo e auditoria`}
    />
  );
}
