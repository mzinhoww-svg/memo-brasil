-- M07: código escolhido no campo do desenho; contrato gerador de quatro argumentos permanece intacto.
-- O código inteiro não é armazenado nem auditado: hash compatível com redeem_code + identificação parcial.
create function public.admin_master_create_code(p_code text,p_plan text,p_max_uses integer,p_expires_at timestamptz,p_reason text) returns text
language plpgsql security definer set search_path='' as $$
declare chosen text:=upper(btrim(coalesce(p_code,''))); why text; pl public.plans; id uuid; hint text;
begin
 if not public.is_master() then raise exception 'forbidden' using errcode='MM004'; end if;
 why:=public.admin_reason(p_reason);
 if chosen!~'^[A-Z0-9][A-Z0-9-]{7,39}$' or length(regexp_replace(chosen,'-','','g'))<8
  or p_max_uses is null or p_max_uses<1 or p_max_uses>1000 or p_expires_at is null or p_expires_at<=now() then
  raise exception 'invalid' using errcode='MM005';
 end if;
 select * into pl from public.plans where code=p_plan and not is_free;
 if not found then raise exception 'invalid' using errcode='MM005'; end if;
 perform public.check_rate_limit('master-code:'||auth.uid()::text,20,interval '10 minutes');
 hint:='MMT-'||upper(substr(public.courtesy_code_hash(chosen),1,4));
 begin
  insert into public.courtesy_codes(code_hash,code_hint,plan_code,max_uses,expires_at,note,created_by)
  values(public.courtesy_code_hash(chosen),hint,pl.code,p_max_uses,p_expires_at,'Código escolhido pelo administrador',auth.uid()) returning courtesy_codes.id into id;
 exception when unique_violation then raise exception 'invalid' using errcode='MM005'; end;
 insert into public.audit_logs(actor_id,actor_role,action,target_type,target_id,reason,detail)
 values(auth.uid(),'master','code.created','courtesy_code',id::text,why,jsonb_build_object('codeId',id,'hint',hint,'plan',pl.code,'maxUses',p_max_uses,'expiresAt',p_expires_at));
 return chosen;
end $$;
revoke all on function public.admin_master_create_code(text,text,integer,timestamptz,text) from public,anon;
grant execute on function public.admin_master_create_code(text,text,integer,timestamptz,text) to authenticated;
