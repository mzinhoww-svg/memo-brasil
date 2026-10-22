-- COM-004 / retenção · ADITIVA. (1) publica Termos e Política 2026-10-22-v1 (texto fornecido pelo operador, sem revisão jurídica profissional registrada);
-- (2) separa o aceite dos Termos da ciência da Política; (3) retenção: fotos disponíveis 90 dias após o encerramento do evento,
-- depois acesso retirado e exclusão do armazenamento ativo em até 30 dias.
-- NADA é apagado por esta migration. A política só vale para eventos criados a partir daqui (retention_policy); os anteriores ficam como estavam.

-- ---------------------------------------------------------------- documentos publicados
alter table public.legal_documents add column source text, add column legal_review text;
insert into public.legal_documents (kind, version, source, legal_review) values
  ('terms', '2026-10-22-v1', 'texto fornecido pelo operador', 'nenhuma revisão jurídica profissional registrada'),
  ('privacy', '2026-10-22-v1', 'texto fornecido pelo operador', 'nenhuma revisão jurídica profissional registrada');

-- ---------------------------------------------------------------- aceite dos Termos x ciência da Política
-- Linhas anteriores (rascunho) mantêm as colunas novas nulas: histórico intocado.
alter table public.user_consents
  add column terms_accepted_at timestamptz,
  add column privacy_acknowledged_at timestamptz,
  add column context text check (context is null or context in ('criar-evento', 'entrar-evento'));

drop function public.record_consent(text, text, text, uuid);
create function public.record_consent(p_terms_version text, p_privacy_version text, p_role text, p_event_id uuid default null,
  p_terms_accepted boolean default false, p_privacy_ack boolean default false, p_context text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); anon boolean := coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false); ins bigint;
begin
  if uid is null then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if p_role is null or p_role not in ('organizador', 'convidado') then raise exception 'invalid' using errcode = 'MM005'; end if;
  -- o aceite dos Termos e a ciência da Política são afirmações separadas e ambas explícitas; nenhuma vale por omissão
  if p_terms_accepted is not true or p_privacy_ack is not true then raise exception 'invalid' using errcode = 'MM005'; end if;
  if p_context is null or p_context not in ('criar-evento', 'entrar-evento') then raise exception 'invalid' using errcode = 'MM005'; end if;
  if not exists (select 1 from public.legal_documents where kind = 'terms' and version = p_terms_version)
     or not exists (select 1 from public.legal_documents where kind = 'privacy' and version = p_privacy_version) then
    raise exception 'invalid' using errcode = 'MM005';
  end if;
  if p_role = 'organizador' and anon then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if p_event_id is not null and not (case p_role when 'organizador' then public.is_host(p_event_id) else public.is_member(p_event_id) end) then
    raise exception 'forbidden' using errcode = 'MM004';
  end if;
  insert into public.user_consents (user_id, role, event_id, terms_version, privacy_version, terms_accepted_at, privacy_acknowledged_at, context)
  values (uid, p_role, p_event_id, p_terms_version, p_privacy_version, now(), now(), p_context) on conflict do nothing returning id into ins;
  if ins is not null then
    -- a Política é registrada como CIÊNCIA; não vira consentimento genérico para qualquer tratamento
    perform public.audit(p_event_id, 'consent.recorded', jsonb_build_object('role', p_role, 'context', p_context, 'terms', p_terms_version, 'privacy', 'ciencia', 'privacyVersion', p_privacy_version));
  end if;
end $$;
revoke execute on function public.record_consent(text, text, text, uuid, boolean, boolean, text) from public, anon;
grant execute on function public.record_consent(text, text, text, uuid, boolean, boolean, text) to authenticated;

-- ---------------------------------------------------------------- retenção
-- A política fica gravada no evento no momento da criação; o cliente não a escolhe nem a altera. Eventos anteriores: null (sem expiração automática).
alter table public.events add column retention_policy text;

create function public.events_retention_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then new.retention_policy := '2026-10-22-v1';
  else new.retention_policy := old.retention_policy; end if;
  return new;
end $$;
create trigger events_retention_guard before insert or update on public.events for each row execute function public.events_retention_guard();

-- Acesso às fotos: o host e os convidados perdem a leitura 90 dias após o encerramento (eventos sob a política). Mesma função que protege
-- a tabela, as reações, as URLs assinadas e o Storage: um só ponto de decisão.
create or replace function public.can_see_photo(p_photo uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.photos ph join public.events e on e.id = ph.event_id
    where ph.id = p_photo and ph.deleted_at is null and ph.upload_status = 'pronta' and ph.status <> 'removida' and e.deleted_at is null
      and (e.retention_policy is null or now() < public.event_end(e.start_at, e.duration_hours, e.ended_at) + interval '90 days')
      and (
        e.host_id = auth.uid()
        or (ph.status = 'visivel' and public.is_member(e.id) and public.is_revealed(e.id)
            and (e.everyone_sees_all or ph.author_id = auth.uid()))))
$$;

-- Passou de 90 dias: o evento é marcado como excluído (acesso retirado de vez); purge_deleted_events conclui a exclusão. Idempotente.
create function public.expire_retained_events() returns int
language plpgsql security definer set search_path = '' as $$
declare r record; n int := 0;
begin
  for r in
    select id from public.events
    where retention_policy is not null and deleted_at is null
      and now() >= public.event_end(start_at, duration_hours, ended_at) + interval '90 days'
    for update skip locked
  loop
    update public.events set deleted_at = now() where id = r.id;
    insert into public.audit_logs (actor_id, event_id, action, detail) values (null, r.id, 'retention.expired', jsonb_build_object('policy', '2026-10-22-v1', 'ran_at', now()));
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.expire_retained_events() from public, anon, authenticated;
grant execute on function public.expire_retained_events() to service_role;

-- Exclusão do armazenamento ativo: eventos sob a política saem após 28 dias de marcados (cron diário + worker a cada 30 min => dentro de 30 dias).
-- Eventos anteriores à política mantêm exatamente o prazo de 30 dias que já tinham.
create or replace function public.purge_deleted_events() returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  insert into public.storage_purge_queue (path)
    select ph.storage_path from public.photos ph join public.events e on e.id = ph.event_id
      where e.deleted_at < now() - interval '30 days' or (e.retention_policy is not null and e.deleted_at < now() - interval '28 days')
    union all
    select ph.storage_path || '.thumb' from public.photos ph join public.events e on e.id = ph.event_id
      where e.deleted_at < now() - interval '30 days' or (e.retention_policy is not null and e.deleted_at < now() - interval '28 days')
  on conflict do nothing;
  with gone as (
    delete from public.events where deleted_at < now() - interval '30 days' or (retention_policy is not null and deleted_at < now() - interval '28 days') returning id
  ) select count(*) into n from gone;
  delete from public.rate_limits where window_start < now() - interval '1 day';
  return n;
end $$;

-- Agendamento (pg_cron): diário, antes da purga das 03:17. Só atua em eventos criados sob a política; na data desta migration não há nenhum vencível.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('mm-expire-retention', '5 3 * * *', 'select public.expire_retained_events()');
  end if;
end $$;
