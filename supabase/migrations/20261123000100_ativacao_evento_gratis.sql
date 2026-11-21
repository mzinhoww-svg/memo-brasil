-- Sequência de ativação do evento por WhatsApp (mesma fila e mesmo opt-in de host_outbox). ADITIVA.
-- Quatro avisos, todos só para quem ativou os avisos no WhatsApp (opt-in próprio; "SAIR" revoga):
--   ativ_criado        logo depois de criar (QR + como usar). Quem ainda não ativou os avisos tem até 24 h para ativar; depois sai da fila.
--   ativ_3d            3 dias antes do evento, às 10 h no fuso do evento ("já espalhou o QR?")
--   ativ_vespera       na véspera, às 10 h no fuso do evento
--   ativ_dia_seguinte  no dia seguinte ao fim, às 10 h — só se o evento chegou perto do limite do grátis (oferta de mais convidados/poses)
-- Os lembretes do QR (criado, 3 dias, véspera) valem para todo evento; a oferta do dia seguinte só para o grátis.
-- Nunca sai para evento de teste/equipe, apagado ou que já passou.
-- Mudou a data do evento: os avisos pendentes são reagendados (ou cancelados, se a nova data já não comporta).

-- ---------------------------------------------------------------- agenda (insert do evento e mudança de data)
create function public.host_outbox_schedule_event(p_event uuid, p_with_created boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  e public.events;
  tz text;
  d date;
  d_end date;
  slots jsonb;
  k text;
  at_ts timestamptz;
  kept text[] := '{}';
begin
  select * into e from public.events where id = p_event;
  if e.id is null or e.deleted_at is not null or e.is_test then return; end if;
  tz := coalesce(nullif(e.timezone, ''), 'America/Cuiaba');
  d := (e.start_at at time zone tz)::date;
  d_end := ((e.start_at + coalesce(e.duration_hours, 6) * interval '1 hour') at time zone tz)::date;
  slots := jsonb_build_object(
    'ativ_3d', ((d - 3) + time '10:00') at time zone tz,
    'ativ_vespera', ((d - 1) + time '10:00') at time zone tz,
    'ativ_dia_seguinte', ((d_end + 1) + time '10:00') at time zone tz);
  for k, at_ts in select key, (value #>> '{}')::timestamptz from jsonb_each(slots) loop
    -- 3 dias/véspera só fazem sentido antes do início; nada no passado
    if at_ts > now() and (k = 'ativ_dia_seguinte' or at_ts < e.start_at) then
      insert into public.host_outbox as h (user_id, event_id, kind, send_after)
      values (e.host_id, e.id, k, at_ts)
      on conflict (event_id, kind, order_id) do update
        set send_after = excluded.send_after, next_attempt_at = now()
        where h.status = 'pendente';
      kept := kept || k;
    end if;
  end loop;
  update public.host_outbox set status = 'cancelado', last_error = 'data_mudou'
   where event_id = e.id and status = 'pendente' and kind in ('ativ_3d', 'ativ_vespera', 'ativ_dia_seguinte') and not (kind = any (kept));
  if p_with_created then
    insert into public.host_outbox (user_id, event_id, kind, send_after)
    values (e.host_id, e.id, 'ativ_criado', e.created_at)
    on conflict do nothing;
  end if;
end $$;
revoke all on function public.host_outbox_schedule_event(uuid, boolean) from public, anon, authenticated;

create function public.host_outbox_on_event() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform public.host_outbox_schedule_event(new.id, true);
  elsif new.start_at is distinct from old.start_at or new.duration_hours is distinct from old.duration_hours
        or new.timezone is distinct from old.timezone then
    perform public.host_outbox_schedule_event(new.id, false);
  end if;
  return null;
end $$;
revoke all on function public.host_outbox_on_event() from public, anon, authenticated;
create trigger events_host_outbox after insert or update of start_at, duration_hours, timezone on public.events
  for each row execute function public.host_outbox_on_event();

-- ---------------------------------------------------------------- "perto do limite do grátis": 80% dos convidados ou alguém sem poses
create function public.event_near_free_limit(p_event uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare eff record; guests int;
begin
  select * into eff from public.effective_entitlement(p_event);
  select count(*)::int into guests from public.participants where event_id = p_event;
  return (eff.max_guests is not null and guests >= ceil(eff.max_guests * 0.8))
      or (eff.max_shots is not null and exists (
            select 1 from public.photos ph where ph.event_id = p_event and ph.deleted_at is null and ph.author_id is not null
            group by ph.author_id having count(*) >= eff.max_shots));
end $$;
revoke all on function public.event_near_free_limit(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------- regras de saída (substitui a do item 1; pedido continua igual)
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
  optin := exists (select 1 from public.host_whatsapp w where w.user_id = o.user_id and w.whatsapp_optin and w.whatsapp_phone is not null);

  if o.kind like 'ativ\_%' then
    -- lembretes do QR valem para todo evento; só a oferta do dia seguinte é exclusiva do grátis
    if o.kind = 'ativ_dia_seguinte' and (select source from public.effective_entitlement(e.id)) <> 'gratis' then return 'pago'; end if;
    if o.kind <> 'ativ_dia_seguinte' and e.start_at + coalesce(e.duration_hours, 6) * interval '1 hour' < now() then
      return 'evento_passou';
    end if;
    if o.kind = 'ativ_dia_seguinte' and not public.event_near_free_limit(e.id) then return 'longe_do_limite'; end if;
    if o.kind = 'ativ_criado' then
      if o.send_after < now() - interval '24 hours' then return 'atrasado'; end if;
      if not optin then return 'aguarda_optin'; end if; -- segue na fila: a pessoa ainda pode ativar os avisos
      return null;
    end if;
  else
    if e.start_at + coalesce(e.duration_hours, 6) * interval '1 hour' < now() then return 'evento_passou'; end if;
    if o.order_id is not null and exists (
         select 1 from public.payment_orders x
         where x.event_id = o.event_id and x.provider_env = 'production' and x.id <> po.id and x.created_at > po.created_at) then
      return 'pedido_novo';
    end if;
  end if;
  if o.send_after < now() - interval '6 hours' then return 'atrasado'; end if;
  if not optin then return 'sem_optin'; end if;
  return null;
end $$;
revoke all on function public.host_outbox_skip_reason(bigint) from public, anon, authenticated;

-- retirada: igual à do item 1, mas "aguarda_optin" não cancela (adia a próxima olhada em 5 min)
create or replace function public.host_claim_batch(p_limit int, p_hourly_cap int)
returns table (id bigint, kind text, phone text, host_name text, event_id uuid, event_title text, event_code text, plan_code text, attempts int)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare room int; r record; why text;
begin
  if not exists (select 1 from public.feature_flags where key = 'whatsapp_avisos' and enabled) then return; end if;
  for r in select o.id from public.host_outbox o where o.status = 'pendente' and o.send_after <= now() and o.next_attempt_at <= now() loop
    why := public.host_outbox_skip_reason(r.id);
    if why = 'aguarda_optin' then
      update public.host_outbox set next_attempt_at = now() + interval '5 minutes' where host_outbox.id = r.id;
    elsif why is not null then
      update public.host_outbox set status = 'cancelado', last_error = why where host_outbox.id = r.id;
    end if;
  end loop;

  room := least(greatest(p_limit, 0), greatest(p_hourly_cap
    - (select count(*)::int from public.whatsapp_outbox where status = 'enviado' and sent_at > now() - interval '1 hour')
    - (select count(*)::int from public.host_outbox where status = 'enviado' and sent_at > now() - interval '1 hour'), 0));
  if room = 0 then return; end if;

  return query
  with due as (
    select o.id from public.host_outbox o
    where o.status = 'pendente' and o.send_after <= now() and o.next_attempt_at <= now()
    order by o.send_after, o.id
    limit room
    for update skip locked
  ), upd as (
    update public.host_outbox o set attempts = o.attempts + 1, next_attempt_at = now() + interval '10 minutes'
    from due where o.id = due.id
    returning o.id, o.kind, o.user_id, o.event_id, o.order_id, o.attempts
  )
  select upd.id, upd.kind, w.whatsapp_phone,
         nullif(split_part(btrim(coalesce(p.display_name, '')), ' ', 1), ''),
         upd.event_id, e.title, e.code, po.plan_code, upd.attempts
  from upd
  join public.host_whatsapp w on w.user_id = upd.user_id
  join public.events e on e.id = upd.event_id
  left join public.profiles p on p.id = upd.user_id
  left join public.payment_orders po on po.id = upd.order_id;
end $$;
revoke all on function public.host_claim_batch(int, int) from public, anon, authenticated;
grant execute on function public.host_claim_batch(int, int) to service_role;

-- ---------------------------------------------------------------- eventos que já existem e ainda vão acontecer (sem o "logo depois de criar")
select public.host_outbox_schedule_event(e.id, false)
from public.events e
where e.deleted_at is null and not e.is_test and e.start_at + coalesce(e.duration_hours, 6) * interval '1 hour' > now() - interval '1 day';
