-- Avisos ao ANFITRIÃO por WhatsApp (só WhatsApp, pelo mesmo gateway dos avisos aos convidados). ADITIVA.
-- Primeiro uso: recuperação de pedido não pago (1 h e 24 h depois). A ativação do evento grátis usa a mesma fila (kinds próprios).
--
-- Consentimento (LGPD): o telefone só existe depois que o próprio anfitrião manda a mensagem de opt-in pelo WhatsApp (o gateway
-- confirma por webhook, subject `host.<user_id>`); "SAIR" revoga e apaga o telefone. Sem opt-in, nada é enviado e o item sai da fila.
-- A fila só guarda ids (nada de telefone); o telefone vem de host_whatsapp na hora do envio. Equipe e eventos de teste nunca recebem.

-- ---------------------------------------------------------------- opt-in por conta do anfitrião
create table public.host_whatsapp (
  user_id uuid primary key references auth.users on delete cascade,
  whatsapp_phone text check (whatsapp_phone is null or whatsapp_phone ~ '^[0-9]{10,15}$'),
  whatsapp_optin boolean not null default false,
  whatsapp_optin_at timestamptz,
  revoked_at timestamptz,
  last_event_at timestamptz, -- instante (do gateway) do último evento aplicado: um "confirmado" atrasado não ressuscita quem saiu
  updated_at timestamptz not null default now(),
  constraint host_whatsapp_optin_needs_phone check (not whatsapp_optin or whatsapp_phone is not null)
);
alter table public.host_whatsapp enable row level security;
revoke all on public.host_whatsapp from anon, authenticated;
grant select on public.host_whatsapp to authenticated;
grant select, insert, update, delete on public.host_whatsapp to service_role;
create policy host_whatsapp_own_select on public.host_whatsapp for select to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------- fila (só o serviço)
create table public.host_outbox (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  event_id uuid not null references public.events on delete cascade,
  order_id uuid references public.payment_orders on delete cascade,
  kind text not null check (kind ~ '^[a-z0-9_]{1,32}$'),
  status text not null default 'pendente' check (status in ('pendente', 'enviado', 'cancelado', 'revogado', 'falhou')),
  send_after timestamptz not null,
  next_attempt_at timestamptz not null default now(),
  attempts int not null default 0,
  gateway_id text,
  last_error text check (last_error is null or char_length(last_error) <= 200),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create unique index host_outbox_once on public.host_outbox (event_id, kind, order_id) nulls not distinct;
create index host_outbox_due_idx on public.host_outbox (send_after) where status = 'pendente';
create index host_outbox_sent_idx on public.host_outbox (sent_at) where status = 'enviado';
alter table public.host_outbox enable row level security;
revoke all on public.host_outbox from anon, authenticated;
grant select, insert, update, delete on public.host_outbox to service_role;

-- ---------------------------------------------------------------- opt-in / opt-out vindos do gateway (webhook)
create function public.host_whatsapp_apply_event(p_type text, p_user uuid, p_phone text, p_at timestamptz) returns text
language plpgsql security definer set search_path = '' as $$
declare
  phone text := nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'), '');
  at_ts timestamptz := coalesce(p_at, now());
  n int;
begin
  if p_type is null or p_type not in ('optin.confirmed', 'optin.revoked') then raise exception 'invalid' using errcode = 'MM005'; end if;
  if not exists (select 1 from auth.users where id = p_user) then return 'unknown_subject'; end if;
  if p_type = 'optin.confirmed' then
    if phone is null or phone !~ '^[0-9]{10,15}$' then raise exception 'invalid' using errcode = 'MM005'; end if;
    insert into public.host_whatsapp as w (user_id, whatsapp_phone, whatsapp_optin, whatsapp_optin_at, revoked_at, last_event_at, updated_at)
    values (p_user, phone, true, at_ts, null, at_ts, now())
    on conflict (user_id) do update
      set whatsapp_phone = excluded.whatsapp_phone, whatsapp_optin = true, whatsapp_optin_at = excluded.whatsapp_optin_at,
          revoked_at = null, last_event_at = excluded.last_event_at, updated_at = now()
      where w.last_event_at is null or w.last_event_at <= excluded.last_event_at;
  else
    insert into public.host_whatsapp as w (user_id, whatsapp_phone, whatsapp_optin, revoked_at, last_event_at, updated_at)
    values (p_user, null, false, at_ts, at_ts, now())
    on conflict (user_id) do update
      set whatsapp_phone = null, whatsapp_optin = false, whatsapp_optin_at = null, revoked_at = excluded.revoked_at,
          last_event_at = excluded.last_event_at, updated_at = now()
      where w.last_event_at is null or w.last_event_at <= excluded.last_event_at;
  end if;
  get diagnostics n = row_count;
  if n = 0 then return 'stale'; end if;
  insert into public.audit_logs (actor_id, action, target_type, target_id, detail)
  values (null, case when p_type = 'optin.confirmed' then 'whatsapp.host_optin' else 'whatsapp.host_revoked' end, 'user', p_user::text, '{}');
  return 'applied';
end $$;
revoke all on function public.host_whatsapp_apply_event(text, uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.host_whatsapp_apply_event(text, uuid, text, timestamptz) to service_role;

-- estado para a tela do anfitrião (sem expor o telefone)
create function public.host_whatsapp_status() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'enabled', exists (select 1 from public.feature_flags where key = 'whatsapp_avisos' and enabled),
    'optin', coalesce((select w.whatsapp_optin from public.host_whatsapp w where w.user_id = auth.uid()), false),
    'optinAt', (select w.whatsapp_optin_at from public.host_whatsapp w where w.user_id = auth.uid() and w.whatsapp_optin))
  where auth.uid() is not null
$$;
revoke all on function public.host_whatsapp_status() from public, anon;
grant execute on function public.host_whatsapp_status() to authenticated;

-- ---------------------------------------------------------------- recuperação de pedido: agenda ao criar o pedido (produção)
create function public.host_outbox_on_order() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.provider_env = 'production' and new.event_id is not null then
    insert into public.host_outbox (user_id, event_id, order_id, kind, send_after)
    values (new.host_id, new.event_id, new.id, 'pedido_1h', new.created_at + interval '1 hour'),
           (new.host_id, new.event_id, new.id, 'pedido_24h', new.created_at + interval '24 hours')
    on conflict do nothing;
  end if;
  return new;
end $$;
revoke all on function public.host_outbox_on_order() from public, anon, authenticated;
create trigger payment_orders_host_outbox after insert on public.payment_orders for each row execute function public.host_outbox_on_order();

-- ---------------------------------------------------------------- por que um item NÃO deve sair (null = pode enviar)
create function public.host_outbox_skip_reason(p_id bigint) returns text
language plpgsql stable security definer set search_path = '' as $$
declare o public.host_outbox; po public.payment_orders; e public.events;
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
  if o.order_id is not null and exists (
       select 1 from public.payment_orders x
       where x.event_id = o.event_id and x.provider_env = 'production' and x.id <> po.id and x.created_at > po.created_at) then
    return 'pedido_novo'; -- o pedido mais novo tem os próprios avisos
  end if;
  if o.send_after < now() - interval '6 hours' then return 'atrasado'; end if;
  if not exists (select 1 from public.host_whatsapp w where w.user_id = o.user_id and w.whatsapp_optin and w.whatsapp_phone is not null) then
    return 'sem_optin';
  end if;
  return null;
end $$;
revoke all on function public.host_outbox_skip_reason(bigint) from public, anon, authenticated;

-- ---------------------------------------------------------------- retirada pelo worker (mesmo teto por hora dos avisos aos convidados)
create function public.host_claim_batch(p_limit int, p_hourly_cap int)
returns table (id bigint, kind text, phone text, host_name text, event_id uuid, event_title text, event_code text, plan_code text, attempts int)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare room int; r record; why text;
begin
  if not exists (select 1 from public.feature_flags where key = 'whatsapp_avisos' and enabled) then return; end if;
  -- cancela o que venceu e não deve sair (com o motivo), antes de contar o espaço
  for r in select o.id from public.host_outbox o where o.status = 'pendente' and o.send_after <= now() loop
    why := public.host_outbox_skip_reason(r.id);
    if why is not null then
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

create function public.host_mark(p_id bigint, p_status text, p_gateway_id text, p_error text, p_retry_in_s int default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_status not in ('pendente', 'enviado', 'revogado', 'falhou') then raise exception 'invalid' using errcode = 'MM005'; end if;
  update public.host_outbox
     set status = p_status,
         gateway_id = coalesce(left(p_gateway_id, 100), gateway_id),
         last_error = left(p_error, 200),
         sent_at = case when p_status = 'enviado' then now() else sent_at end,
         next_attempt_at = case when p_status = 'pendente' then now() + make_interval(secs => greatest(coalesce(p_retry_in_s, 300), 30)) else next_attempt_at end
   where id = p_id;
end $$;
revoke all on function public.host_mark(bigint, text, text, text, int) from public, anon, authenticated;
grant execute on function public.host_mark(bigint, text, text, text, int) to service_role;

-- "Ativado ✓" na tela do anfitrião assim que o webhook grava (Realtime; a RLS mostra só a própria linha)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'host_whatsapp') then
    alter publication supabase_realtime add table public.host_whatsapp;
  end if;
end $$;
