-- M10: dados paginados e totais completos, sem alterar contratos administrativos existentes.
create function public.admin_master_people(p_tab text default 'organizadores', p_limit int default 25, p_offset int default 0, p_search text default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; rows jsonb; total bigint; lim int:=least(25,greatest(1,coalesce(p_limit,25))); off int:=greatest(0,coalesce(p_offset,0)); term text:=nullif(left(btrim(p_search),80),'');
begin
 if not public.is_platform_staff() then raise exception 'forbidden' using errcode='MM004'; end if;
 if p_tab not in ('organizadores','convidados','equipe') or p_tab is null then raise exception 'invalid' using errcode='MM005'; end if;
 if p_tab='organizadores' then
  result:=public.admin_list_organizers(lim,off,term); total:=(result->>'total')::bigint;
  select coalesce(jsonb_agg(x.item || jsonb_build_object(
   'provider',(select coalesce(u.raw_app_meta_data->>'provider','anonymous') from auth.users u where u.id=(x.item->>'userId')::uuid),
   'spentCents',case when public.is_master() then (select coalesce(sum(o.amount_cents),0) from public.payment_orders o where o.host_id=(x.item->>'userId')::uuid and o.status='pago') else null end) order by x.n),'[]'::jsonb)
   into rows from jsonb_array_elements(result->'items') with ordinality x(item,n);
 elsif p_tab='convidados' then
  result:=public.admin_search_participants(lim,off,term); total:=(result->>'total')::bigint;rows:=result->'items';
 else
  select count(distinct r.user_id) into total from public.platform_roles r join auth.users u on u.id=r.user_id
   where r.revoked_at is null and (term is null or strpos(lower(u.id::text),lower(term))>0 or (public.is_master() and strpos(lower(u.email),lower(term))>0));
  select coalesce(jsonb_agg(jsonb_build_object('userId',x.user_id,'email',case when public.is_master() then x.email else regexp_replace(x.email,'^(.).*(@.*)$','\1***\2') end,'platformRole',x.role,'createdAt',x.created_at) order by x.created_at desc,x.user_id),'[]'::jsonb) into rows
   from (select * from (select distinct on (r.user_id) r.user_id,r.role,u.email,u.created_at from public.platform_roles r join auth.users u on u.id=r.user_id where r.revoked_at is null
    and (term is null or strpos(lower(u.id::text),lower(term))>0 or (public.is_master() and strpos(lower(u.email),lower(term))>0)) order by r.user_id,case r.role when 'master' then 0 when 'support' then 1 else 2 end) members order by created_at desc,user_id limit lim offset off) x;
 end if;
 return jsonb_build_object('total',total,'limit',lim,'offset',off,'items',rows,'organizersTotal',(public.admin_list_organizers(1,0,null)->>'total')::bigint,'guestsTotal',(public.admin_search_participants(1,0,null)->>'total')::bigint,'teamTotal',(select count(distinct user_id) from public.platform_roles where revoked_at is null));
end $$;
revoke all on function public.admin_master_people(text,int,int,text) from public,anon;
grant execute on function public.admin_master_people(text,int,int,text) to authenticated;
