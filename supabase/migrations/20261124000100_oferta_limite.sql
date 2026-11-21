-- Aviso de upgrade quando o evento grátis chega ao limite + desconto de 20% por 48 h. ADITIVA (preço de tabela não muda).
--
-- Oferta: uma por evento, criada pelo banco no momento em que o evento grátis chega perto do limite (80% dos convidados ou alguém sem
-- poses). Vale 48 h DE VERDADE (a cotação do servidor confere a validade) e uma vez só (marcada como usada quando o pedido com
-- desconto é pago). O anfitrião não digita código: a oferta é do evento e entra sozinha na cotação do checkout.
-- O aviso pelo WhatsApp do "dia seguinte" (item 3) sai: depois do fim do evento o checkout não vende (evento_encerrado). No lugar,
-- o aviso sai na hora em que o limite é atingido, com o desconto.

create table public.upgrade_offers (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references public.events on delete cascade,
  code text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 10)),
  percent int not null default 20 check (percent between 1 and 50),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '48 hours',
  redeemed_at timestamptz,
  order_id uuid references public.payment_orders on delete set null
);
alter table public.upgrade_offers enable row level security;
revoke all on public.upgrade_offers from anon, authenticated;
grant select, insert, update, delete on public.upgrade_offers to service_role;

alter table public.payment_orders add column offer_id uuid references public.upgrade_offers on delete set null;

-- oferta válida agora (null = nenhuma): não usada, no prazo e o evento ainda no grátis
create function public.upgrade_offer_active(p_event uuid) returns public.upgrade_offers
language sql stable security definer set search_path = '' as $$
  select o.* from public.upgrade_offers o
  where o.event_id = p_event and o.redeemed_at is null and o.expires_at > now()
    and (select source from public.effective_entitlement(p_event)) = 'gratis'
$$;
revoke all on function public.upgrade_offer_active(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------- cria a oferta (e o aviso no WhatsApp) quando o limite chega
create function public.upgrade_offer_check(p_event uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare e public.events;
begin
  if exists (select 1 from public.upgrade_offers where event_id = p_event) then return; end if;
  select * into e from public.events where id = p_event;
  if e.id is null or e.deleted_at is not null or e.is_test then return; end if;
  if now() >= public.event_end(e.start_at, e.duration_hours, e.ended_at) then return; end if;
  if (select source from public.effective_entitlement(p_event)) <> 'gratis' then return; end if;
  if not public.event_near_free_limit(p_event) then return; end if;
  insert into public.upgrade_offers (event_id) values (p_event) on conflict (event_id) do nothing;
  if found then
    insert into public.host_outbox (user_id, event_id, kind, send_after) values (e.host_id, p_event, 'ativ_limite', now())
    on conflict do nothing;
  end if;
end $$;
revoke all on function public.upgrade_offer_check(uuid) from public, anon, authenticated;

create function public.upgrade_offer_on_activity() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.upgrade_offer_check(new.event_id);
  return null;
end $$;
revoke all on function public.upgrade_offer_on_activity() from public, anon, authenticated;
create trigger participants_upgrade_offer after insert on public.participants for each row execute function public.upgrade_offer_on_activity();
create trigger photos_upgrade_offer after insert on public.photos for each row execute function public.upgrade_offer_on_activity();

-- ---------------------------------------------------------------- cotação: o desconto entra aqui (o mesmo valor vai para o pedido)
create or replace function public.payments_quote_internal(p_event uuid, p_plan text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  ev public.events;
  pl public.plans;
  eff record;
  env text := public.payments_env();
  from_price int := 0;
  amount int;
  list_amount int;
  offer public.upgrade_offers;
  reason text := 'ok';
begin
  select * into ev from public.events where id = p_event and deleted_at is null;
  if not found then raise exception 'forbidden' using errcode = 'MM004'; end if;
  select * into pl from public.plans where code = p_plan;
  if not found then raise exception 'invalid' using errcode = 'MM005'; end if;
  select * into eff from public.effective_entitlement(p_event);
  if eff.source = 'pago' then
    select p.price_cents into from_price from public.plans p where p.code = eff.plan_code;
  elsif pl.pack_of is not null and eff.source in ('cortesia', 'codigo') and public.payments_plan_covered(p_event, pl.pack_of) then
    select p.price_cents into from_price from public.plans p where p.code = pl.pack_of;
  end if;
  list_amount := greatest(pl.price_cents - coalesce(from_price, 0), 0);
  amount := list_amount;
  offer := public.upgrade_offer_active(p_event);
  if offer.id is not null and not pl.is_free then
    amount := round(list_amount * (100 - offer.percent) / 100.0)::int;
  end if;
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
                            'payable', reason = 'ok', 'reason', reason)
      || case when amount < list_amount
              then jsonb_build_object('listCents', list_amount, 'discountPct', offer.percent, 'offerExpiresAt', offer.expires_at)
              else '{}'::jsonb end;
end $$;

-- pedido aberto com a oferta válida leva a marca (o valor já veio com desconto da mesma cotação, na mesma transação)
create function public.payment_orders_mark_offer() returns trigger
language plpgsql security definer set search_path = '' as $$
declare offer public.upgrade_offers; list_amount int;
begin
  if new.event_id is null then return new; end if;
  offer := public.upgrade_offer_active(new.event_id);
  if offer.id is not null then
    select p.price_cents into list_amount from public.plans p where p.code = new.plan_code;
    if new.amount_cents < list_amount then new.offer_id := offer.id; end if;
  end if;
  return new;
end $$;
revoke all on function public.payment_orders_mark_offer() from public, anon, authenticated;
create trigger payment_orders_offer before insert on public.payment_orders for each row execute function public.payment_orders_mark_offer();

-- pago: a oferta foi usada (uso único)
create function public.payment_orders_redeem_offer() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.offer_id is not null and new.status = 'pago' and old.status is distinct from 'pago' then
    update public.upgrade_offers set redeemed_at = now(), order_id = new.id where id = new.offer_id and redeemed_at is null;
  end if;
  return null;
end $$;
revoke all on function public.payment_orders_redeem_offer() from public, anon, authenticated;
create trigger payment_orders_offer_redeem after update of status on public.payment_orders for each row execute function public.payment_orders_redeem_offer();

-- ---------------------------------------------------------------- para o painel do anfitrião (só o próprio evento)
create function public.event_upgrade_offer(p_event uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare offer public.upgrade_offers;
begin
  if auth.uid() is null or not (public.is_host(p_event) or public.is_master()) then raise exception 'forbidden' using errcode = 'MM004'; end if;
  offer := public.upgrade_offer_active(p_event);
  if offer.id is null then return null; end if;
  return jsonb_build_object('percent', offer.percent, 'expiresAt', offer.expires_at);
end $$;
revoke all on function public.event_upgrade_offer(uuid) from public, anon;
grant execute on function public.event_upgrade_offer(uuid) to authenticated;

-- ---------------------------------------------------------------- fila do WhatsApp: "dia seguinte" sai, "limite" entra
create or replace function public.host_outbox_schedule_event(p_event uuid, p_with_created boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  e public.events;
  tz text;
  d date;
  slots jsonb;
  k text;
  at_ts timestamptz;
  kept text[] := '{}';
begin
  select * into e from public.events where id = p_event;
  if e.id is null or e.deleted_at is not null or e.is_test then return; end if;
  tz := coalesce(nullif(e.timezone, ''), 'America/Cuiaba');
  d := (e.start_at at time zone tz)::date;
  slots := jsonb_build_object(
    'ativ_3d', ((d - 3) + time '10:00') at time zone tz,
    'ativ_vespera', ((d - 1) + time '10:00') at time zone tz);
  for k, at_ts in select key, (value #>> '{}')::timestamptz from jsonb_each(slots) loop
    if at_ts > now() and at_ts < e.start_at then
      insert into public.host_outbox as h (user_id, event_id, kind, send_after)
      values (e.host_id, e.id, k, at_ts)
      on conflict (event_id, kind, order_id) do update
        set send_after = excluded.send_after, next_attempt_at = now()
        where h.status = 'pendente';
      kept := kept || k;
    end if;
  end loop;
  update public.host_outbox set status = 'cancelado', last_error = 'data_mudou'
   where event_id = e.id and status = 'pendente' and kind in ('ativ_3d', 'ativ_vespera') and not (kind = any (kept));
  if p_with_created then
    insert into public.host_outbox (user_id, event_id, kind, send_after)
    values (e.host_id, e.id, 'ativ_criado', e.created_at)
    on conflict do nothing;
  end if;
end $$;

update public.host_outbox set status = 'cancelado', last_error = 'substituido'
 where kind = 'ativ_dia_seguinte' and status = 'pendente';

create or replace function public.host_outbox_skip_reason(p_id bigint) returns text
language plpgsql stable security definer set search_path = '' as $$
declare o public.host_outbox; po public.payment_orders; e public.events; optin boolean;
begin
  select * into o from public.host_outbox where id = p_id;
  select * into e from public.events where id = o.event_id;
  if o.order_id is not null then
    select * into po from public.payment_orders where id = o.order_id;
    if po.status = 'pago' then return 'pago'; end if;
  end if;
  if coalesce(e.is_test, false) or coalesce((select p.is_test from public.profiles p where p.id = o.user_id), false)
     or exists (select 1 from public.platform_roles r where r.user_id = o.user_id and r.revoked_at is null) then
    return 'teste';
  end if;
  if e.deleted_at is not null then return 'evento_apagado'; end if;
  if e.start_at + coalesce(e.duration_hours, 6) * interval '1 hour' < now() then return 'evento_passou'; end if;
  optin := exists (select 1 from public.host_whatsapp w where w.user_id = o.user_id and w.whatsapp_optin and w.whatsapp_phone is not null);

  if o.kind = 'ativ_dia_seguinte' then
    return 'substituido';
  elsif o.kind = 'ativ_limite' then
    if (public.upgrade_offer_active(e.id)).id is null then return 'sem_oferta'; end if; -- pagou, venceu ou já usou
  elsif o.kind = 'ativ_criado' then
    if o.send_after < now() - interval '24 hours' then return 'atrasado'; end if;
    if not optin then return 'aguarda_optin'; end if; -- segue na fila: a pessoa ainda pode ativar os avisos
    return null;
  elsif o.order_id is not null and exists (
       select 1 from public.payment_orders x
       where x.event_id = o.event_id and x.provider_env = 'production' and x.id <> po.id and x.created_at > po.created_at) then
    return 'pedido_novo';
  end if;
  if o.send_after < now() - interval '6 hours' then return 'atrasado'; end if;
  if not optin then return 'sem_optin'; end if;
  return null;
end $$;
revoke all on function public.host_outbox_skip_reason(bigint) from public, anon, authenticated;

-- "perto do limite" conta só convidados (o anfitrião também pode estar em participants)
create or replace function public.event_near_free_limit(p_event uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare eff record; guests int;
begin
  select * into eff from public.effective_entitlement(p_event);
  select count(*)::int into guests from public.participants p join public.events e on e.id = p.event_id
   where p.event_id = p_event and p.user_id <> e.host_id;
  return (eff.max_guests is not null and guests >= ceil(eff.max_guests * 0.8))
      or (eff.max_shots is not null and exists (
            select 1 from public.photos ph where ph.event_id = p_event and ph.deleted_at is null and ph.author_id is not null
            group by ph.author_id having count(*) >= eff.max_shots));
end $$;
revoke all on function public.event_near_free_limit(uuid) from public, anon, authenticated;
