-- Sobrecarga aditiva: preserva integralmente admin_export_csv(text,jsonb).
-- A versão explícita evita ambiguidade de resolução no PostgREST.
create function public.admin_export_csv(p_kind text,p_filters jsonb,p_design_version integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); master boolean:=public.is_master(); f jsonb:=coalesce(p_filters,'{}'::jsonb); term text; k text; body text; total bigint; n int; trunc boolean; operator_role text; cap constant int:=50000;
begin
 if uid is null or not public.is_platform_staff() then raise exception 'forbidden' using errcode='MM004'; end if;
 if p_design_version is distinct from 2 then raise exception 'invalid' using errcode='MM005'; end if;
 if p_kind is distinct from 'pessoas' or coalesce(f->>'aba','organizadores')<>'equipe' then
  return public.admin_export_csv(p_kind,p_filters);
 end if;
 if jsonb_typeof(f)<>'object' then raise exception 'invalid' using errcode='MM005'; end if;
 for k in select jsonb_object_keys(f) loop
  if k not in ('aba','q') then raise exception 'invalid' using errcode='MM005'; end if;
 end loop;
 perform public.check_rate_limit('export:'||uid,20,interval '10 minutes');
 term:=nullif(left(btrim(f->>'q'),80),'');
 operator_role:=case when master then 'master' when public.is_platform_role('support') then 'support' else 'auditor' end;
 with members as (
  select distinct on(r.user_id) r.user_id,r.role,u.email,u.created_at from public.platform_roles r join auth.users u on u.id=r.user_id
  where r.revoked_at is null and (term is null or strpos(lower(u.id::text),lower(term))>0 or (master and strpos(lower(u.email),lower(term))>0))
  order by r.user_id,case r.role when 'master' then 0 when 'support' then 1 else 2 end
 ), bounded as (
  select *,row_number() over(order by created_at desc,user_id) rn from members order by created_at desc,user_id limit cap+1
 )
 select string_agg(public.csv_line(public.csv_cell(case when master then email else regexp_replace(email,'^(.).*(@.*)$','\1***\2') end),public.csv_cell(role),public.csv_ts(created_at)),E'\r\n' order by rn) filter(where rn<=cap),count(*) into body,total from bounded;
 n:=least(total,cap)::int;trunc:=total>cap;
 insert into public.audit_logs(actor_id,actor_role,action,target_type,target_id,detail)
 values(uid,operator_role,'export.csv','export',p_kind,jsonb_build_object('kind',p_kind,'filters',jsonb_build_object('aba','equipe')||case when term is null then '{}'::jsonb else jsonb_build_object('q',term) end,'rows',n,'truncated',trunc,'designVersion',2));
 return jsonb_build_object('kind',p_kind,'rows',n,'truncated',trunc,'csv',public.csv_line('"email"','"papel"','"desde"')||E'\r\n'||coalesce(body||E'\r\n',''));
end $$;
revoke all on function public.admin_export_csv(text,jsonb,integer) from public,anon;
grant execute on function public.admin_export_csv(text,jsonb,integer) to authenticated;
