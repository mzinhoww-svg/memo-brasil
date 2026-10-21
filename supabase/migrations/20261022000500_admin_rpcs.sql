-- MemoriesMT v2 · 5/5 · MAD-004 + ANL-001 + LGPD/saúde · RPCs administrativas. ADITIVA (somente funções novas).
-- Todas SECURITY DEFINER com search_path fixo; sem EXECUTE para public/anon. Autorização dentro da função:
--   master          → tudo (inclui acesso excepcional a foto e PII completa)
--   support/auditor → somente leitura agregada/operacional (dashboard, listas, LGPD, saúde); e-mail mascarado
-- Nenhuma policy nova dá leitura de fotos/Storage a master: o acesso é excepcional, por admin_request_photo_access.

-- ---------------------------------------------------------------- MAD-004: acesso excepcional a foto privada
-- Grava a auditoria ANTES de devolver o caminho; o serviço (service_role, fora do app) assina a URL por 60 s com o caminho devolvido.
create function public.admin_request_photo_access(p_photo uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare ph public.photos; why text := btrim(coalesce(p_reason, '')); aid bigint;
begin
  if not public.is_master() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if char_length(why) < 10 then raise exception 'reasonrequired' using errcode = 'MM011'; end if;
  select * into ph from public.photos where id = p_photo and deleted_at is null;
  if not found then raise exception 'invalid' using errcode = 'MM005'; end if;
  perform public.check_rate_limit('photoaccess:' || auth.uid(), 30, interval '1 hour');
  insert into public.audit_logs (actor_id, actor_role, event_id, action, target_type, target_id, reason, detail)
  values (auth.uid(), 'master', ph.event_id, 'photo.access_requested', 'photo', ph.id::text, left(why, 500), jsonb_build_object('ttl_seconds', 60))
  returning id into aid;
  return jsonb_build_object('photoId', ph.id, 'eventId', ph.event_id, 'bucket', 'event-photos', 'storagePath', ph.storage_path,
                            'expiresInSeconds', 60, 'auditId', aid);
end $$;

-- ---------------------------------------------------------------- ANL-001: métricas agregadas reais
create function public.admin_dashboard_metrics(p_from timestamptz default now() - interval '30 days', p_to timestamptz default now(),
                                               p_tz text default 'America/Cuiaba') returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r jsonb; st jsonb; series jsonb;
begin
  if not public.is_platform_staff() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if p_from is null or p_to is null or p_to <= p_from or p_to - p_from > interval '366 days' then raise exception 'invalid' using errcode = 'MM005'; end if;

  select jsonb_build_object(
    'photosBytes', coalesce(sum((metadata ->> 'size')::bigint) filter (where bucket_id = 'event-photos'), 0),
    'photosObjects', count(*) filter (where bucket_id = 'event-photos'),
    'brandingBytes', coalesce(sum((metadata ->> 'size')::bigint) filter (where bucket_id = 'event-branding'), 0),
    'brandingObjects', count(*) filter (where bucket_id = 'event-branding'))
  into st from storage.objects where bucket_id in ('event-photos', 'event-branding');

  select coalesce(jsonb_agg(jsonb_build_object(
      'day', d::date, 'eventsCreated', coalesce(ec.n, 0), 'participantsJoined', coalesce(pj.n, 0),
      'photosUploaded', coalesce(pu.n, 0), 'uploadsFailed', coalesce(uf.n, 0)) order by d), '[]')
  into series
  from generate_series((p_from at time zone p_tz)::date, (p_to at time zone p_tz)::date, interval '1 day') d
  left join (select (created_at at time zone p_tz)::date as day, count(*) n from public.events
             where created_at >= p_from and created_at < p_to group by 1) ec on ec.day = d::date
  left join (select (joined_at at time zone p_tz)::date as day, count(*) n from public.participants
             where joined_at >= p_from and joined_at < p_to group by 1) pj on pj.day = d::date
  left join (select (created_at at time zone p_tz)::date as day, count(*) n from public.photos
             where upload_status = 'pronta' and created_at >= p_from and created_at < p_to group by 1) pu on pu.day = d::date
  left join (select (created_at at time zone p_tz)::date as day, count(*) n from public.photos
             where (upload_status = 'falhou' or (upload_status = 'enviando' and created_at < now() - interval '1 hour'))
               and created_at >= p_from and created_at < p_to group by 1) uf on uf.day = d::date;

  r := jsonb_build_object(
    'from', p_from, 'to', p_to, 'tz', p_tz, 'generatedAt', now(),
    'events', jsonb_build_object(
      'created', (select count(*) from public.events where created_at >= p_from and created_at < p_to),
      'active', (select count(*) from public.events e where e.deleted_at is null and now() < public.event_end(e.start_at, e.duration_hours, e.ended_at)),
      'ended', (select count(*) from public.events e where e.deleted_at is null and now() >= public.event_end(e.start_at, e.duration_hours, e.ended_at)),
      'total', (select count(*) from public.events where deleted_at is null)),
    'organizers', jsonb_build_object(
      -- ativo no período = tem evento não apagado que começou antes do fim do período e terminou depois do início
      'active', (select count(distinct e.host_id) from public.events e
                 where e.deleted_at is null and e.start_at < p_to and public.event_end(e.start_at, e.duration_hours, e.ended_at) >= p_from),
      'total', (select count(distinct host_id) from public.events where deleted_at is null)),
    'participants', jsonb_build_object(
      'joined', (select count(*) from public.participants where joined_at >= p_from and joined_at < p_to),
      'total', (select count(*) from public.participants)),
    'photos', jsonb_build_object(
      'uploaded', (select count(*) from public.photos where upload_status = 'pronta' and created_at >= p_from and created_at < p_to),
      'total', (select count(*) from public.photos where upload_status = 'pronta' and deleted_at is null)),
    'uploads', jsonb_build_object(
      'failed', (select count(*) from public.photos
                 where (upload_status = 'falhou' or (upload_status = 'enviando' and created_at < now() - interval '1 hour'))
                   and created_at >= p_from and created_at < p_to),
      'inProgress', (select count(*) from public.photos where upload_status = 'enviando' and created_at >= now() - interval '1 hour')),
    'reveals', jsonb_build_object(
      'pending', (select count(*) from public.events where reveal_enabled and revealed_at is null and deleted_at is null),
      'overdue', (select count(*) from public.events where reveal_enabled and revealed_at is null and deleted_at is null and reveal_at < now())),
    'storage', st,
    'series', series);
  return r;
end $$;

-- ---------------------------------------------------------------- listas paginadas (sem código de convite, sem fotos, sem legendas)
create function public.admin_list_events(p_limit int default 25, p_offset int default 0, p_search text default null,
                                         p_status text default null, p_include_deleted boolean default false) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare lim int := least(greatest(coalesce(p_limit, 25), 1), 100); off int := greatest(coalesce(p_offset, 0), 0);
        pat text := case when nullif(btrim(p_search), '') is null then null
                         else '%' || replace(replace(replace(left(btrim(p_search), 80), '\', '\\'), '%', '\%'), '_', '\_') || '%' end;
        total bigint; items jsonb;
begin
  if not public.is_platform_staff() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if p_status is not null and p_status not in ('ativo', 'encerrado') then raise exception 'invalid' using errcode = 'MM005'; end if;

  with f as (
    select e.* from public.events e
    where (p_include_deleted or e.deleted_at is null)
      and (pat is null or e.title ilike pat or e.host_name ilike pat)
      and (p_status is null or (p_status = 'ativo') = (now() < public.event_end(e.start_at, e.duration_hours, e.ended_at)))
  ), page as (select * from f order by created_at desc, id desc limit lim offset off)
  select (select count(*) from f), coalesce(jsonb_agg(jsonb_build_object(
      'id', e.id, 'title', e.title, 'category', e.category, 'hostId', e.host_id, 'hostName', e.host_name,
      'startAt', e.start_at, 'endAt', public.event_end(e.start_at, e.duration_hours, e.ended_at), 'createdAt', e.created_at, 'deletedAt', e.deleted_at,
      'status', case when now() >= public.event_end(e.start_at, e.duration_hours, e.ended_at) then 'encerrado' else 'ativo' end,
      'revealEnabled', e.reveal_enabled, 'revealAt', e.reveal_at,
      'revealState', case when not e.reveal_enabled then 'desativada' when e.revealed_at is not null then 'revelada'
                          when e.reveal_at < now() then 'atrasada' else 'pendente' end,
      'capacity', e.capacity,
      'participants', (select count(*) from public.participants p where p.event_id = e.id),
      'photos', (select count(*) from public.photos ph where ph.event_id = e.id and ph.upload_status = 'pronta' and ph.deleted_at is null),
      'failedUploads', (select count(*) from public.photos ph where ph.event_id = e.id and ph.upload_status = 'falhou'))
    order by e.created_at desc, e.id desc), '[]')
  into total, items from page e;
  return jsonb_build_object('total', total, 'limit', lim, 'offset', off, 'items', items);
end $$;

create function public.admin_list_organizers(p_limit int default 25, p_offset int default 0, p_search text default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare lim int := least(greatest(coalesce(p_limit, 25), 1), 100); off int := greatest(coalesce(p_offset, 0), 0);
        pat text := case when nullif(btrim(p_search), '') is null then null
                         else '%' || replace(replace(replace(left(btrim(p_search), 80), '\', '\\'), '%', '\%'), '_', '\_') || '%' end;
        full_pii boolean := public.is_master(); total bigint; items jsonb;
begin
  if not public.is_platform_staff() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  with org as (
    select e.host_id, count(*) as events_count,
           count(*) filter (where now() < public.event_end(e.start_at, e.duration_hours, e.ended_at)) as active_events,
           min(e.created_at) as first_event_at, max(e.created_at) as last_event_at
    from public.events e where e.deleted_at is null group by e.host_id
  ), f as (
    select o.*, pr.display_name, u.email from org o
    join public.profiles pr on pr.id = o.host_id left join auth.users u on u.id = o.host_id
    where pat is null or pr.display_name ilike pat or (full_pii and u.email ilike pat)
  )
  select (select count(*) from f), coalesce(jsonb_agg(jsonb_build_object(
      'userId', p.host_id, 'displayName', p.display_name,
      'email', case when full_pii then p.email else regexp_replace(p.email, '^(.).*(@.*)$', '\1***\2') end,
      'eventsCount', p.events_count, 'activeEvents', p.active_events, 'firstEventAt', p.first_event_at, 'lastEventAt', p.last_event_at,
      'photos', (select count(*) from public.photos ph join public.events e on e.id = ph.event_id
                 where e.host_id = p.host_id and e.deleted_at is null and ph.upload_status = 'pronta' and ph.deleted_at is null),
      'deletionRequested', exists (select 1 from public.account_deletion_requests d where d.user_id = p.host_id and d.processed_at is null))
    order by p.last_event_at desc, p.host_id), '[]')
  into total, items
  from (select * from f order by last_event_at desc, host_id limit lim offset off) p;
  return jsonb_build_object('total', total, 'limit', lim, 'offset', off, 'items', items);
end $$;

-- ---------------------------------------------------------------- LGPD
-- prazo de referência: 15 dias (resposta ao titular, art. 19 II LGPD); 'overdue' marca pedidos pendentes além do prazo
create function public.admin_lgpd_requests(p_limit int default 100, p_offset int default 0) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare lim int := least(greatest(coalesce(p_limit, 100), 1), 500); off int := greatest(coalesce(p_offset, 0), 0);
begin
  if not public.is_platform_staff() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  return jsonb_build_object(
    'slaDays', 15, 'generatedAt', now(),
    'summary', jsonb_build_object(
      'pending', (select count(*) from public.account_deletion_requests where processed_at is null),
      'processed', (select count(*) from public.account_deletion_requests where processed_at is not null),
      'overdue', (select count(*) from public.account_deletion_requests where processed_at is null and requested_at < now() - interval '15 days')),
    'items', (select coalesce(jsonb_agg(jsonb_build_object(
        'userId', d.user_id, 'requestedAt', d.requested_at, 'processedAt', d.processed_at,
        'status', case when d.processed_at is null then 'pendente' else 'processado' end,
        'daysOpen', case when d.processed_at is null then floor(extract(epoch from now() - d.requested_at) / 86400)::int end,
        'overdue', d.processed_at is null and d.requested_at < now() - interval '15 days') order by d.requested_at desc), '[]')
      from (select * from public.account_deletion_requests order by requested_at desc limit lim offset off) d));
end $$;

-- ---------------------------------------------------------------- saúde operacional
create function public.admin_health() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare jobs jsonb := '[]'; cron_ok boolean := to_regclass('cron.job') is not null; ov record; q record;
begin
  if not public.is_platform_staff() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if cron_ok then
    execute $q$
      select coalesce(jsonb_agg(jsonb_build_object(
        'name', j.jobname, 'schedule', j.schedule, 'active', j.active,
        'lastRun', case when l.start_time is null then null else jsonb_build_object(
          'startedAt', l.start_time, 'endedAt', l.end_time, 'status', l.status, 'message', left(l.return_message, 200)) end) order by j.jobname), '[]')
      from cron.job j
      left join lateral (select d.start_time, d.end_time, d.status, d.return_message from cron.job_run_details d
                         where d.jobid = j.jobid order by d.start_time desc limit 1) l on true
      where j.jobname like 'mm-%'
    $q$ into jobs;
  end if;
  select count(*) as n, extract(epoch from now() - min(reveal_at))::bigint as max_delay into ov
    from public.events where reveal_enabled and revealed_at is null and deleted_at is null and reveal_at < now();
  select count(*) as n, extract(epoch from now() - min(queued_at))::bigint as oldest into q from public.storage_purge_queue;
  return jsonb_build_object(
    'generatedAt', now(), 'cronAvailable', cron_ok, 'jobs', jobs,
    'reveals', jsonb_build_object('overdue', ov.n, 'maxDelaySeconds', coalesce(ov.max_delay, 0)),
    'purgeQueue', jsonb_build_object('size', q.n, 'oldestAgeSeconds', coalesce(q.oldest, 0)),
    'uploads', jsonb_build_object(
      'stalled', (select count(*) from public.photos where upload_status = 'enviando' and created_at < now() - interval '1 hour'),
      'failed', (select count(*) from public.photos where upload_status = 'falhou')),
    'lgpd', jsonb_build_object('pendingDeletions', (select count(*) from public.account_deletion_requests where processed_at is null)));
end $$;

-- ---------------------------------------------------------------- execução: autorização por papel dentro de cada função
revoke execute on all functions in schema public from public, anon;
grant execute on function public.admin_request_photo_access(uuid, text), public.admin_dashboard_metrics(timestamptz, timestamptz, text),
  public.admin_list_events(int, int, text, text, boolean), public.admin_list_organizers(int, int, text),
  public.admin_lgpd_requests(int, int), public.admin_health() to authenticated;
