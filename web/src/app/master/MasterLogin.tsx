"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ico, MNote } from "@/revela/master-kit";
import { browserSupabase } from "@/lib/supabase/client";

/** Campos do M00 ligados ao Auth; acesso ao console continua decidido pelo servidor/banco. */
export function MasterLoginAction() {
 const router=useRouter();const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [code,setCode]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState<string>();
 async function submit(){
  if(busy)return;
  if(!email.trim()||!password||!/^\d{6}$/.test(code)){setError('Preencha e-mail, senha e os 6 números do autenticador.');return;}
  setBusy(true);setError(undefined);
  let clearSession:(()=>Promise<unknown>)|undefined;
  try{
   const sb=browserSupabase();const login=await sb.auth.signInWithPassword({email:email.trim(),password});
   if(login.error){setError('Não foi possível entrar. Confira os dados e tente novamente.');return;}
   clearSession=()=>sb.auth.signOut({scope:"local"});
   const factors=await sb.auth.mfa.listFactors();const factor=factors.data?.totp.find(f=>f.status==='verified');
   if(factors.error||!factor){await sb.auth.signOut({scope:"local"});setError('Configure o autenticador na sua conta antes de entrar por esta tela.');return;}
   const challenge=await sb.auth.mfa.challenge({factorId:factor.id});
   if(challenge.error||!challenge.data){await sb.auth.signOut({scope:"local"});setError('Não foi possível validar o autenticador. Tente novamente.');return;}
   const verify=await sb.auth.mfa.verify({factorId:factor.id,challengeId:challenge.data.id,code});
   if(verify.error){await sb.auth.signOut({scope:"local"});setError('Código incorreto ou expirado.');return;}
   router.refresh();
  }catch{await clearSession?.().catch(()=>undefined);setError('Não foi possível entrar agora. Tente novamente.');}finally{setBusy(false);}
 }
 return <form onSubmit={e=>{e.preventDefault();void submit();}} aria-busy={busy}>
  <label className="rv-field"><Ico n="mail"/><input aria-label="E-mail" type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} required/></label>
  <label className="rv-field" style={{marginTop:'10px'}}><Ico n="lock"/><input aria-label="Senha" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required/></label>
  <p className="rv-caption" style={{margin:'18px 0 8px'}}>Código do app autenticador</p>
  <div className="otp" style={{position:'relative'}}>{Array.from({length:6},(_,i)=><span key={i} className={i===code.length?'on':''}>{code[i]??' '}</span>)}<input aria-label="Código do autenticador" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))} style={{position:'absolute',inset:0,width:'100%',opacity:0}}/></div>
  {error&&<MNote>{error}</MNote>}
  <div style={{marginTop:'22px'}}><button type="submit" className="rv-btn rv-btn--block rv-btn--primary" disabled={busy}>{busy?'Entrando…':'Entrar'}</button></div>
 </form>;
}
