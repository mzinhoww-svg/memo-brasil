-- M01: todos os planos (inclusive zero), sem truncar os 200 últimos pagamentos.
create function public.admin_master_plan_sales(p_days integer default 30) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare since timestamptz; result jsonb;
begin
 if not public.is_master() then raise exception 'forbidden' using errcode='MM004'; end if;
 if p_days is null or p_days<1 or p_days>366 then raise exception 'invalid' using errcode='MM005'; end if;
 since:=(((now() at time zone 'America/Cuiaba')::date-(p_days-1))::timestamp at time zone 'America/Cuiaba');
 select coalesce(jsonb_agg(jsonb_build_object('code',p.code,'name',p.name,'count',
  case when p.is_free then (select count(*) from public.events e where e.created_at>=since and e.deleted_at is null and not e.is_test
    and exists(select 1 from public.effective_entitlement(e.id) ee where ee.plan_code=p.code))
  else (select count(*) from public.payment_orders o left join public.events e on e.id=o.event_id where o.plan_code=p.code and o.status='pago' and o.paid_at>=since and (e.id is null or not e.is_test)) end) order by p.sort,p.code),'[]'::jsonb)
 into result from public.plans p;
 return result;
end $$;
revoke all on function public.admin_master_plan_sales(integer) from public,anon;
grant execute on function public.admin_master_plan_sales(integer) to authenticated;
