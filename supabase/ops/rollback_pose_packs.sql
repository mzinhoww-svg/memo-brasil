-- Reversão da migration 20261112000100_pose_packs.sql. Rode ANTES de reverter o front (ou depois: o front esconde o pacote sozinho
-- quando list_public_pose_packs não existe/devolve vazio). Idempotente.
--  1. Desliga todas as variantes (para de vender de imediato).
--  2. Restaura as funções como estavam antes (list_public_plans, admin_list_plans, payments_quote_internal).
--  3. Remove list_public_pose_packs.
--  4. Apaga as variantes SEM nenhuma referência (pedido, direito, código de cortesia). As já compradas ficam, desligadas
--     (o direito do cliente precisa continuar válido); a coluna pack_of só é removida quando não sobra variante.
begin;

do $$ begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'plans' and column_name = 'pack_of') then
    execute 'update public.plans set sandbox_active = false, production_active = false where pack_of is not null';
  end if;
end $$;

create or replace function public.payments_quote_internal(p_event uuid, p_plan text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  ev public.events;
  pl public.plans;
  eff record;
  env text := public.payments_env();
  from_price int := 0;
  amount int;
  reason text := 'ok';
begin
  select * into ev from public.events where id = p_event and deleted_at is null;
  if not found then raise exception 'forbidden' using errcode = 'MM004'; end if;
  select * into pl from public.plans where code = p_plan;
  if not found then raise exception 'invalid' using errcode = 'MM005'; end if;
  select * into eff from public.effective_entitlement(p_event);
  if eff.source = 'pago' then
    select p.price_cents into from_price from public.plans p where p.code = eff.plan_code;
  end if;
  amount := greatest(pl.price_cents - coalesce(from_price, 0), 0);
  if now() >= public.event_end(ev.start_at, ev.duration_hours, ev.ended_at) then
    reason := 'evento_encerrado';
  elsif env = 'desligado' or (env = 'sandbox' and not pl.sandbox_active) or (env = 'production' and not pl.production_active) then
    reason := 'plano_inativo';
  elsif pl.is_free or public.payments_plan_covered(p_event, p_plan) or amount = 0 then
    reason := 'ja_incluido';
  elsif amount < 100 then
    reason := 'valor_minimo';
  end if;
  return jsonb_build_object('planCode', pl.code, 'fromPlanCode', eff.plan_code, 'amountCents', amount,
                            'payable', reason = 'ok', 'reason', reason);
end $$;

-- admin_list_plans e list_public_plans voltam ao corpo de 20261109000200 (sem packOf / sem o filtro pack_of).
-- Variantes que restarem (já compradas) ficam desligadas: list_public_plans só lista planos ativos, então não aparecem.
create or replace function public.list_public_plans() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'code', p.code, 'name', p.name, 'maxGuests', p.max_guests, 'maxShots', p.max_shots, 'priceCents', p.price_cents,
      'sort', p.sort, 'isFree', p.is_free, 'features', p.features, 'highlighted', p.highlighted) order by p.sort, p.code), '[]')
  from public.plans p
  where p.is_free
     or (public.payments_env() = 'sandbox' and p.sandbox_active)
     or (public.payments_env() = 'production' and p.production_active)
$$;

create or replace function public.admin_list_plans() returns setof jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_master() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  return query
    select jsonb_build_object(
      'code', p.code, 'name', p.name, 'maxGuests', p.max_guests, 'maxShots', p.max_shots, 'priceCents', p.price_cents,
      'sort', p.sort, 'isFree', p.is_free, 'sandboxActive', p.sandbox_active, 'productionActive', p.production_active,
      'highlighted', p.highlighted, 'features', p.features, 'updatedAt', p.updated_at,
      'history', (select coalesce(jsonb_agg(jsonb_build_object('at', a.at, 'actorId', a.actor_id, 'actorRole', a.actor_role,
                                                               'action', a.action, 'reason', a.reason, 'old', a.detail -> 'old', 'new', a.detail -> 'new')
                                            order by a.at desc, a.id desc), '[]')
                    from (select * from public.audit_logs l
                           where l.target_type = 'plan' and l.target_id = p.code and l.action in ('plan.updated', 'plan.price_changed')
                           order by l.at desc, l.id desc limit 10) a))
    from public.plans p
    order by p.sort, p.code;
end $$;

drop function if exists public.list_public_pose_packs();

-- apaga só as variantes sem nenhum uso; as compradas ficam (direitos e pedidos dependem delas).
-- A coluna e a constraint só saem quando não resta variante.
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'plans' and column_name = 'pack_of') then
    execute $q$delete from public.plans k
      where k.pack_of is not null
        and not exists (select 1 from public.payment_orders o where o.plan_code = k.code or o.from_plan_code = k.code)
        and not exists (select 1 from public.event_entitlements e where e.plan_code = k.code)
        and not exists (select 1 from public.courtesy_codes c where c.plan_code = k.code)$q$;
    if not exists (select 1 from public.plans where pack_of is not null) then
      alter table public.plans drop constraint if exists plans_pack_not_self;
      alter table public.plans drop column pack_of;
    else
      raise notice 'Restam variantes compradas: pack_of mantida. Elas ficam desligadas e ocultas do catálogo (list_public_plans anterior só lista ativas).';
    end if;
  end if;
end $$;

commit;
