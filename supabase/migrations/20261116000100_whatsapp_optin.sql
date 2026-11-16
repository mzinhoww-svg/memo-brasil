-- Revela · avisos por WhatsApp (gateway Baileys, instância `revela`). ADITIVA: nada existente é apagado nem reescrito, exceto
-- reveal_due_events(), que mantém o comportamento e passa a enfileirar o aviso "fotos reveladas" na MESMA transação.
--
-- Modelo de privacidade: o telefone mora em tabela PRÓPRIA (não em participants, que os outros convidados leem). Só o próprio
-- convidado lê a sua linha; ninguém grava pelo cliente (escrita só pelo serviço, via whatsapp_apply_event). O telefone sai junto
-- com o convidado, a conta e o evento (cascata) e é apagado quando a pessoa manda SAIR. A auditoria nunca recebe o número.

-- ---------------------------------------------------------------- opt-in por convidado e evento
create table public.participant_whatsapp (
  event_id uuid not null,
  user_id uuid not null,
  whatsapp_phone text check (whatsapp_phone is null or whatsapp_phone ~ '^[0-9]{10,15}$'),
  whatsapp_optin boolean not null default false,
  whatsapp_optin_at timestamptz,
  revoked_at timestamptz,
  -- instante (do gateway) do último evento aplicado: um "confirmado" atrasado não ressuscita quem já saiu
  last_event_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id),
  foreign key (event_id, user_id) references public.participants (event_id, user_id) on delete cascade,
  constraint whatsapp_optin_needs_phone check (not whatsapp_optin or whatsapp_phone is not null)
);

alter table public.participant_whatsapp enable row level security;
revoke all on public.participant_whatsapp from anon, authenticated;
grant select on public.participant_whatsapp to authenticated;
grant select, insert, update, delete on public.participant_whatsapp to service_role;
create policy participant_whatsapp_own_select on public.participant_whatsapp for select to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------- fila de envio (só o serviço)
create table public.whatsapp_outbox (
  event_id uuid not null,
  user_id uuid not null,
  kind text not null check (kind ~ '^[a-z_]{1,32}$'),
  status text not null default 'pendente' check (status in ('pendente', 'enviado', 'revogado', 'falhou')),
  attempts int not null default 0,
  gateway_id text,
  last_error text check (last_error is null or char_length(last_error) <= 200),
  created_at timestamptz not null default now(),
  next_attempt_at timestamptz not null default now(),
  sent_at timestamptz,
  primary key (event_id, user_id, kind),
  foreign key (event_id, user_id) references public.participants (event_id, user_id) on delete cascade
);
create index whatsapp_outbox_due_idx on public.whatsapp_outbox (next_attempt_at) where status = 'pendente';
create index whatsapp_outbox_sent_idx on public.whatsapp_outbox (sent_at) where status = 'enviado';

alter table public.whatsapp_outbox enable row level security;
revoke all on public.whatsapp_outbox from anon, authenticated;
grant select, insert, update, delete on public.whatsapp_outbox to service_role;

-- ---------------------------------------------------------------- interruptor
-- Flag `whatsapp_avisos` (public.feature_flags). SEM linha = desligado: por isso não há seed aqui (outras migrations e testes contam as flags
-- existentes). O operador liga pelo Master (RPC admin_set_feature_flag) quando o gateway e os segredos estiverem prontos.

-- ---------------------------------------------------------------- aplica um evento do webhook (idempotente e à prova de ordem)
-- Devolve: applied | stale | blocked | unknown_subject. Telefone fora do padrão e tipo desconhecido: MM005.
create function public.whatsapp_apply_event(p_type text, p_event uuid, p_user uuid, p_phone text, p_at timestamptz) returns text
language plpgsql security definer set search_path = '' as $$
declare
  phone text := nullif(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'), '');
  blocked timestamptz;
  found_participant boolean;
  n int;
  at_ts timestamptz := coalesce(p_at, now());
begin
  if p_type is null or p_type not in ('optin.confirmed', 'optin.revoked') then raise exception 'invalid' using errcode = 'MM005'; end if;

  select true, blocked_at into found_participant, blocked from public.participants where event_id = p_event and user_id = p_user;
  if not coalesce(found_participant, false) then return 'unknown_subject'; end if;

  if p_type = 'optin.confirmed' then
    if blocked is not null then return 'blocked'; end if;
    if phone is null or phone !~ '^[0-9]{10,15}$' then raise exception 'invalid' using errcode = 'MM005'; end if;
    insert into public.participant_whatsapp as w (event_id, user_id, whatsapp_phone, whatsapp_optin, whatsapp_optin_at, revoked_at, last_event_at, updated_at)
    values (p_event, p_user, phone, true, at_ts, null, at_ts, now())
    on conflict (event_id, user_id) do update
      set whatsapp_phone = excluded.whatsapp_phone, whatsapp_optin = true, whatsapp_optin_at = excluded.whatsapp_optin_at,
          revoked_at = null, last_event_at = excluded.last_event_at, updated_at = now()
      where w.last_event_at is null or w.last_event_at <= excluded.last_event_at;
    get diagnostics n = row_count;
    if n = 0 then return 'stale'; end if;
    insert into public.audit_logs (actor_id, event_id, action, detail) values (null, p_event, 'whatsapp.optin', jsonb_build_object('user', p_user));
  else
    insert into public.participant_whatsapp as w (event_id, user_id, whatsapp_phone, whatsapp_optin, revoked_at, last_event_at, updated_at)
    values (p_event, p_user, null, false, at_ts, at_ts, now())
    on conflict (event_id, user_id) do update
      set whatsapp_phone = null, whatsapp_optin = false, whatsapp_optin_at = null, revoked_at = excluded.revoked_at,
          last_event_at = excluded.last_event_at, updated_at = now()
      where w.last_event_at is null or w.last_event_at <= excluded.last_event_at;
    get diagnostics n = row_count;
    if n = 0 then return 'stale'; end if;
    insert into public.audit_logs (actor_id, event_id, action, detail) values (null, p_event, 'whatsapp.revoked', jsonb_build_object('user', p_user));
  end if;
  return 'applied';
end $$;
revoke all on function public.whatsapp_apply_event(text, uuid, uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.whatsapp_apply_event(text, uuid, uuid, text, timestamptz) to service_role;

-- ---------------------------------------------------------------- estado para a tela (só do próprio convidado)
create function public.whatsapp_status(p_event uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  allowed boolean;
  eligible boolean;
  w public.participant_whatsapp;
begin
  if uid is null then raise exception 'forbidden' using errcode = 'MM004'; end if;
  eligible := public.is_member(p_event);
  if not eligible and not public.is_host(p_event) then raise exception 'forbidden' using errcode = 'MM004'; end if;
  allowed := exists (select 1 from public.feature_flags where key = 'whatsapp_avisos' and enabled);
  select * into w from public.participant_whatsapp where event_id = p_event and user_id = uid;
  return jsonb_build_object(
    'enabled', allowed,
    'eligible', eligible,
    'optin', coalesce(w.whatsapp_optin, false),
    'optinAt', w.whatsapp_optin_at,
    'revoked', w.revoked_at is not null and not coalesce(w.whatsapp_optin, false));
end $$;
revoke all on function public.whatsapp_status(uuid) from public, anon;
grant execute on function public.whatsapp_status(uuid) to authenticated;

-- ---------------------------------------------------------------- fila: retirada em lote com teto por hora
-- Retira até p_limit itens vencidos, sem passar do teto de p_hourly_cap envios por hora (o gateway limita a 60/h). Quem saiu antes do
-- envio vira 'revogado' e nunca chega ao worker. O item retirado fica reservado por 10 min (se o worker cair, volta sozinho).
create function public.whatsapp_claim_batch(p_limit int, p_hourly_cap int)
returns table (event_id uuid, user_id uuid, kind text, phone text, title text, code text, attempts int)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare room int;
begin
  update public.whatsapp_outbox o set status = 'revogado', last_error = 'sem opt-in', next_attempt_at = now()
  where o.status = 'pendente'
    and not exists (select 1 from public.participant_whatsapp w where w.event_id = o.event_id and w.user_id = o.user_id and w.whatsapp_optin and w.whatsapp_phone is not null);

  room := least(greatest(p_limit, 0), greatest(p_hourly_cap - (select count(*)::int from public.whatsapp_outbox where status = 'enviado' and sent_at > now() - interval '1 hour'), 0));
  if room = 0 then return; end if;

  return query
  with due as (
    select o.event_id, o.user_id, o.kind from public.whatsapp_outbox o
    where o.status = 'pendente' and o.next_attempt_at <= now()
    order by o.created_at, o.user_id
    limit room
    for update skip locked
  ), upd as (
    update public.whatsapp_outbox o set attempts = o.attempts + 1, next_attempt_at = now() + interval '10 minutes'
    from due where o.event_id = due.event_id and o.user_id = due.user_id and o.kind = due.kind
    returning o.event_id, o.user_id, o.kind, o.attempts
  )
  select upd.event_id, upd.user_id, upd.kind, w.whatsapp_phone, e.title, e.code, upd.attempts
  from upd
  join public.participant_whatsapp w on w.event_id = upd.event_id and w.user_id = upd.user_id
  join public.events e on e.id = upd.event_id;
end $$;
revoke all on function public.whatsapp_claim_batch(int, int) from public, anon, authenticated;
grant execute on function public.whatsapp_claim_batch(int, int) to service_role;

-- Resultado do envio. 'pendente' reagenda (p_retry_in_s); 'enviado', 'revogado' e 'falhou' encerram o item.
create function public.whatsapp_mark(p_event uuid, p_user uuid, p_kind text, p_status text, p_gateway_id text, p_error text, p_retry_in_s int default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_status not in ('pendente', 'enviado', 'revogado', 'falhou') then raise exception 'invalid' using errcode = 'MM005'; end if;
  update public.whatsapp_outbox
     set status = p_status,
         gateway_id = coalesce(left(p_gateway_id, 100), gateway_id),
         last_error = left(p_error, 200),
         sent_at = case when p_status = 'enviado' then now() else sent_at end,
         next_attempt_at = case when p_status = 'pendente' then now() + make_interval(secs => greatest(coalesce(p_retry_in_s, 300), 30)) else next_attempt_at end
   where event_id = p_event and user_id = p_user and kind = p_kind;
end $$;
revoke all on function public.whatsapp_mark(uuid, uuid, text, text, text, text, int) from public, anon, authenticated;
grant execute on function public.whatsapp_mark(uuid, uuid, text, text, text, text, int) to service_role;

-- ---------------------------------------------------------------- revelação: mesmo comportamento + fila do aviso, na mesma transação
create or replace function public.reveal_due_events() returns int
language plpgsql security definer set search_path = '' as $$
declare r record; n int := 0;
begin
  for r in
    select id, reveal_at from public.events
    where reveal_enabled and revealed_at is null and deleted_at is null and reveal_at <= now()
    for update skip locked
  loop
    update public.events set revealed_at = r.reveal_at, reveal_status = 'revelada' where id = r.id;
    insert into public.audit_logs (actor_id, event_id, action, detail) values (null, r.id, 'reveal.released', jsonb_build_object('at', r.reveal_at, 'ran_at', now()));
    -- aviso só para quem deu opt-in, não está bloqueado e só enquanto o recurso está ligado; a chave única impede duplicar
    insert into public.whatsapp_outbox (event_id, user_id, kind)
      select w.event_id, w.user_id, 'revealed'
      from public.participant_whatsapp w
      join public.participants p on p.event_id = w.event_id and p.user_id = w.user_id
      where w.event_id = r.id and w.whatsapp_optin and w.whatsapp_phone is not null and p.blocked_at is null
        and exists (select 1 from public.feature_flags f where f.key = 'whatsapp_avisos' and f.enabled)
    on conflict (event_id, user_id, kind) do nothing;
    n := n + 1;
  end loop;
  return n;
end $$;
-- os grants de reveal_due_events (só service_role) permanecem: CREATE OR REPLACE não os altera

-- ---------------------------------------------------------------- texto legal: Política v2 (seção sobre avisos por WhatsApp)
-- Os Termos continuam na v1. Quem já aceitou a v1 não precisa de novo aceite: o aviso por WhatsApp é um opt-in próprio, dado
-- por quem manda a primeira mensagem do próprio número, e pode ser desfeito a qualquer hora com SAIR.
insert into public.legal_documents (kind, version, source, legal_review) values
  ('privacy', '2026-11-16-v2', 'v1 do operador + seção de avisos por WhatsApp redigida a pedido do operador', 'nenhuma revisão jurídica profissional registrada');
