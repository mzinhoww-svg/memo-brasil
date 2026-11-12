"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Sheet } from "@/components/revela";
import { Ico } from "@/revela/master-kit";
import { browserSupabase } from "@/lib/supabase/client";
import { adminErrorText, reasonError } from "../billing";
import { ReasonField } from "../billing-actions";

type Action = "mostrar" | "esconder" | "remover";
const TITLE: Record<Action, string> = { mostrar: "Manter a foto", esconder: "Esconder a foto", remover: "Remover a foto" };

/** Modera somente metadados; nenhuma ação solicita ou mostra bytes da foto privada. */
export function ModeratePhoto({ id, event }: { id: string; event: string }) {
 const router=useRouter();
 const [action,setAction]=useState<Action|null>(null),[reason,setReason]=useState("");
 const [tried,setTried]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null);
 const close=()=>{setAction(null);setReason("");setTried(false);setError(null);};
 async function submit(){
  setTried(true);if(!action||reasonError(reason)||busy)return;
  setBusy(true);setError(null);
  try{const r=await browserSupabase().rpc("admin_master_moderate_photo",{p_photo:id,p_action:action,p_reason:reason.trim()});
   if(r.error){setError(adminErrorText(r.error.code,r.error.message));return;}close();router.refresh();
  }catch{setError("Não foi possível concluir agora. Tente novamente.");}finally{setBusy(false);}
 }
 return <>
  <button type="button" className="rv-btn rv-btn--sm" onClick={()=>setAction("mostrar")}>Manter</button>
  <button type="button" className="rv-btn rv-btn--sm" onClick={()=>setAction("esconder")}>Esconder</button>
  <button type="button" className="rv-btn rv-btn--sm" style={{color:"var(--danger)"}} aria-label="Remover" onClick={()=>setAction("remover")}><Ico n="trash"/></button>
  {action&&<Sheet title={TITLE[action]} onClose={close}>
   <p className="rv-caption">{event} · foto {id.slice(0,8)}. A fotografia privada não é exibida neste console.</p>
   <ReasonField label="Motivo (obrigatório, 10 a 500 caracteres)" value={reason} onChange={setReason} error={tried?reasonError(reason):null}/>
   {error&&<p className="rv-field-erro" role="alert">{error}</p>}
   <Button block variant={action==="remover"?"destrutivo":"primario"} disabled={busy} onClick={()=>void submit()}>{busy?"Enviando…":TITLE[action]}</Button>
   <Button block variant="texto" onClick={close}>Cancelar</Button>
  </Sheet>}
 </>;
}
