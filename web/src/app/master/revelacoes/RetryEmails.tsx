"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Sheet } from "@/components/revela";
import { Ico } from "@/revela/master-kit";
import { browserSupabase } from "@/lib/supabase/client";
import { adminErrorText, reasonError } from "../billing";
import { ReasonField } from "../billing-actions";

export function RetryEmails({ event }: { event: {id:string;title:string} }) {
 const router=useRouter();const [open,setOpen]=useState(false),[reason,setReason]=useState("");
 const [tried,setTried]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null);
 const close=()=>{setOpen(false);setReason("");setTried(false);setError(null);};
 async function submit(){
  setTried(true);if(reasonError(reason)||busy)return;setBusy(true);setError(null);
  try{const r=await browserSupabase().rpc("admin_master_retry_reveal_emails",{p_event:event.id,p_reason:reason.trim()});
   if(r.error){setError(adminErrorText(r.error.code,r.error.message));return;}close();router.refresh();
  }catch{setError("Não foi possível concluir agora. Tente novamente.");}finally{setBusy(false);}
 }
 return <><button type="button" className="rv-btn rv-btn--sm" onClick={()=>setOpen(true)}><Ico n="refresh"/>Reenviar falhas</button>
 {open&&<Sheet title="Reenviar falhas" onClose={close}>
  <p className="rv-caption">{event.title}. Os avisos com falha voltam à fila para a próxima execução. Quem já recebeu ou retirou o consentimento não recebe novamente.</p>
  <ReasonField label="Motivo (obrigatório, 10 a 500 caracteres)" value={reason} onChange={setReason} error={tried?reasonError(reason):null}/>
  {error&&<p className="rv-field-erro" role="alert">{error}</p>}
  <Button block disabled={busy} onClick={()=>void submit()}>{busy?"Enviando…":"Reenviar falhas"}</Button><Button block variant="texto" onClick={close}>Cancelar</Button>
 </Sheet>}</>;
}
