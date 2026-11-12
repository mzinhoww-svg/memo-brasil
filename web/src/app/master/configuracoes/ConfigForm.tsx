"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Sheet } from "@/components/revela";
import { browserSupabase } from "@/lib/supabase/client";
import { MasterConfigView } from "@/revela/screens/MasterConfig";
import { adminErrorText, reasonError } from "../billing";
import { ReasonField } from "../billing-actions";
import { changesOf, fieldError, type ConfigState } from "./config";
import { PLATFORM_LABELS, platformChanges, platformFieldError, platformFieldValue, platformValue, type PlatformConfig, type PlatformField } from "./platform-config";

export interface ConfigInitial extends ConfigState {
  env: "sandbox" | "production" | "desligado";
  webhook: { meta: string; tone: "ok" | "wait" | "info"; label: string };
  platform: PlatformConfig;
}

/** M14: ValidaPay (validade do Pix, chave do cartão, checkout) e parâmetros da plataforma. Salvar pede motivo e grava com auditoria. */
export function ConfigForm({ initial }: { initial: ConfigInitial }) {
  const router = useRouter();
  const [draft, setDraft] = useState<ConfigState>(initial);
  const [platform,setPlatform]=useState(initial.platform);
  const [editing,setEditing]=useState<PlatformField|"pix"|null>(null);
  const [editValue,setEditValue]=useState("");
  const [editTried,setEditTried]=useState(false);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const changes = useMemo(() => changesOf(initial, draft), [initial, draft]);
  const platformDiff=platformChanges(initial.platform,platform);
  const pixError = fieldError("validapay_pix_expiry_minutes", draft.pixMinutes);
  const invalid = Boolean(pixError);
  const editError=editing==="pix"?fieldError("validapay_pix_expiry_minutes",editValue):editing?platformFieldError(editing,editValue):null;
  const startEdit=(key:PlatformField|"pix")=>{setEditing(key);setEditTried(false);setEditValue(key==="pix"?draft.pixMinutes:key==="maxPhotoBytes"?String(platform.maxPhotoBytes/1048576):String(platform[key]??""));};

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
      if(Object.keys(platformDiff).length){
        const {error:e}=await sb.rpc("admin_set_master_config",{p_changes:platformDiff,p_reason:reason.trim()});
        if(e){setError(adminErrorText(e.code,e.message));return;}
      }
      setOpen(false); setReason(""); setTried(false); router.refresh();
    } finally { setBusy(false); }
  }

  const modal = open && (
    <Sheet title="Salvar configurações" onClose={() => { setOpen(false); setError(null); }}>
      <ul className="stack" aria-label="O que muda">
        {changes.map((c) => <li key={c.key}><strong>{c.label}</strong>: <s>{c.from}</s> → <b>{c.to}</b></li>)}
        {(Object.keys(platformDiff) as (keyof PlatformConfig)[]).map(k=><li key={k}>{k==="commentsEnabled"?"Comentários nas fotos":k==="revealEmailsEnabled"?"Aviso de revelação por e-mail":PLATFORM_LABELS[k]}: {typeof platformDiff[k]==="boolean"?(platformDiff[k]?"ligado":"desligado"):platformValue(platform,k as PlatformField)}</li>)}
      </ul>
      <ReasonField label="Motivo (obrigatório, 10 a 500 caracteres)" value={reason} onChange={setReason} error={tried ? reasonError(reason) : null} />
      <p className="rv-caption">Cada mudança fica no registro de auditoria com o seu nome e este motivo.</p>
      {error && <p className="rv-field-erro" role="alert">{error}</p>}
      <Button block onClick={() => void save()} disabled={busy}>{busy ? "Salvando…" : "Salvar configurações"}</Button>
      <Button variant="texto" block onClick={() => { setOpen(false); setError(null); }}>Cancelar</Button>
    </Sheet>
  );

  return (
    <MasterConfigView
      env={initial.env}
      pix={{ minutes: draft.pixMinutes, onOpen:()=>startEdit("pix"), error: pixError }}
      card={{ on: draft.card, label: "Cartão de crédito", onToggle: () => setDraft((d) => ({ ...d, card: !d.card })), meta: draft.card ? "Só com confirmação do banco (3DS)." : "Só com confirmação do banco (3DS). Sua conta ainda não liberou." }}
      webhook={initial.webhook}
      checkout={{ on: draft.checkout, label: "Checkout ligado para anfitriões", onToggle: () => setDraft((d) => ({ ...d, checkout: !d.checkout })) }}
      platform={[
        ...(["maxPhotosPerEvent","maxPhotoBytes","senderEmail"] as PlatformField[]).map(key=>({icon:key==="senderEmail"?"mail" as const:"photo" as const,label:PLATFORM_LABELS[key],value:platformValue(platform,key),onOpen:()=>startEdit(key)})),
      ]}
      platformToggles={[
        {icon:"chat",label:"Comentários nas fotos",on:platform.commentsEnabled,onToggle:()=>setPlatform(p=>({...p,commentsEnabled:!p.commentsEnabled}))},
        {icon:"bell",label:"Aviso de revelação por e-mail",on:platform.revealEmailsEnabled,onToggle:()=>setPlatform(p=>({...p,revealEmailsEnabled:!p.revealEmailsEnabled}))},
      ]}
      save={{ dirty: (changes.length > 0 || Object.keys(platformDiff).length>0) && !invalid, busy, onSave: () => { setError(null); setOpen(true); } }}
      modal={modal || (editing&&<Sheet title={editing==="pix"?"Validade do Pix em minutos":PLATFORM_LABELS[editing]} onClose={()=>setEditing(null)}>
       <label className="rv-field"><input aria-label={editing==="pix"?"Validade do Pix em minutos":PLATFORM_LABELS[editing]} value={editValue} onChange={e=>setEditValue(e.target.value)} inputMode={editing==="senderEmail"?"email":"decimal"}/></label>
       {editing==="senderEmail"&&<p className="rv-caption">Use um remetente autorizado na Brevo. Vazio mantém o remetente definido no serviço; salvar não verifica a autorização no provedor.</p>}
       {editing==="maxPhotosPerEvent"&&<p className="rv-caption">Vazio mantém o evento sem teto global. Os limites individuais do plano continuam valendo.</p>}
       {editing==="maxPhotoBytes"&&<p className="rv-caption">Até 8 MB, conforme o limite aceito pelo processamento de fotos. O novo valor vale para uploads futuros.</p>}
       {editTried&&editError&&<p className="rv-field-erro" role="alert">{editError}</p>}
       <Button block onClick={()=>{setEditTried(true);if(editError)return;if(editing==="pix")setDraft(d=>({...d,pixMinutes:editValue.trim()}));else setPlatform(p=>({...p,[editing]:platformFieldValue(editing,editValue)}));setEditing(null);}}>Continuar</Button>
       <Button block variant="texto" onClick={()=>setEditing(null)}>Cancelar</Button>
      </Sheet>) || undefined}
    />
  );
}
