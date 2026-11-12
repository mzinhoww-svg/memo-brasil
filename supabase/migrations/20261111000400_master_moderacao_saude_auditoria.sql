-- Revela 2.0 · Master: Moderação com motivos (M26), Storage e saúde completa (M27) e Auditoria com filtros (M28). ADITIVA.
--
-- (1) admin_moderate_photo(p_photo, p_action, p_reason): "Manter", "Esconder" e "Excluir" uma foto denunciada. Só master; motivo de 10 a 500
--     caracteres (MM011). Grava a auditoria photo.kept / photo.hidden / photo.removed com o motivo, sem nenhum dado da imagem nem de quem denunciou.
--     Excluir usa o mesmo caminho do anfitrião (status 'removida': o gatilho carimba deleted_at e enfileira a limpeza do storage).
-- (2) admin_storage_breakdown(): continua igual e ganha os campos que o desenho M27 mostra: uploads em andamento e com falha nas últimas 24 h,
--     fotos prontas, cota opcional (platform_settings.storage_quota_bytes) e a fila de exclusão. Só aumenta chaves do JSON.
-- (3) admin_list_audit_v2(): cada linha ganha actorEmail (mascarado `a***@dominio` para quem não é master), targetLabel (título do evento, e-mail
--     mascarado, nome do plano) e exportRows. Continua só para master e auditor.
-- (4) admin_audit_events(): eventos que aparecem na trilha (lista do filtro "Evento" da M28). Só master e auditor.
-- (5) admin_export_audit_csv(p_category, p_event): exportação da M28 com os mesmos filtros da tela (categoria e evento), 50.000 linhas no máximo,
--     grava `export.csv` na auditoria. Só master e auditor.

-- ---------------------------------------------------------------- (1) moderar foto
create function public.admin_moderate_photo(p_photo uuid, p_action text, p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare why text; ph public.photos; act text;
begin
  if not public.is_master() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if p_action is null or p_action not in ('manter', 'esconder', 'excluir') then raise exception 'invalid' using errcode = 'MM005'; end if;
  why := public.admin_reason(p_reason);
  select * into ph from public.photos where id = p_photo and deleted_at is null and status <> 'removida' for update;
  if not found then raise exception 'invalid' using errcode = 'MM005'; end if;
  if p_action = 'manter' then
    update public.photos set status = 'visivel', reports = 0 where id = ph.id;
    delete from public.photo_reports where photo_id = ph.id;
    act := 'photo.kept';
  elsif p_action = 'esconder' then
    update public.photos set status = 'oculta' where id = ph.id;
    act := 'photo.hidden';
  else
    update public.photos set status = 'removida' where id = ph.id;
    act := 'photo.removed';
  end if;
  insert into public.audit_logs (actor_id, actor_role, event_id, action, target_type, target_id, reason, detail)
  values (auth.uid(), 'master', ph.event_id, act, 'photo', ph.id::text, why, jsonb_build_object('reports', ph.reports));
  return jsonb_build_object('ok', true, 'photoId', ph.id, 'action', p_action);
end $$;
revoke all on function public.admin_moderate_photo(uuid, text, text) from public, anon;
grant execute on function public.admin_moderate_photo(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------- (2) storage completo
create or replace function public.admin_storage_breakdown() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare tz constant text := 'America/Cuiaba'; r jsonb; growth jsonb; d0 date := (now() at time zone 'America/Cuiaba')::date - 29;
        quota bigint; up jsonb; queue jsonb;
begin
  if not public.is_platform_staff() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  with o as (
    select ob.created_at, coalesce((ob.metadata ->> 'size')::bigint, 0) as sz,
           case when ob.bucket_id = 'event-branding' then 'branding'
                when not exists (select 1 from public.photos ph where ph.id = public.photo_id_from_path(ob.name)
                                   and ob.name in (ph.storage_path, ph.storage_path || '.thumb')) then 'orphan'
                when ob.name like '%.thumb' then 'derived' else 'original' end as cls
    from storage.objects ob where ob.bucket_id in ('event-photos', 'event-branding')
  )
  select jsonb_build_object(
    'originals', jsonb_build_object('n', count(*) filter (where cls = 'original'), 'bytes', coalesce(sum(sz) filter (where cls = 'original'), 0)),
    'derived', jsonb_build_object('n', count(*) filter (where cls = 'derived'), 'bytes', coalesce(sum(sz) filter (where cls = 'derived'), 0)),
    'orphans', jsonb_build_object('n', count(*) filter (where cls = 'orphan'), 'bytes', coalesce(sum(sz) filter (where cls = 'orphan'), 0)),
    'branding', jsonb_build_object('n', count(*) filter (where cls = 'branding'), 'bytes', coalesce(sum(sz) filter (where cls = 'branding'), 0)),
    'avgPhotoBytes', coalesce(round(avg(sz) filter (where cls = 'original')), 0)::bigint,
    'totalBytes', coalesce(sum(sz), 0))
  into r from o;

  select coalesce(jsonb_agg(jsonb_build_object('day', g::date, 'bytes', coalesce(x.b, 0)) order by g), '[]') into growth
  from generate_series(d0::timestamp, (d0 + 29)::timestamp, interval '1 day') g
  left join (select (ob.created_at at time zone tz)::date as day, sum(coalesce((ob.metadata ->> 'size')::bigint, 0)) as b
               from storage.objects ob
              where ob.bucket_id in ('event-photos', 'event-branding') and ob.created_at >= (d0::timestamp at time zone tz)
              group by 1) x on x.day = g::date;

  select case when value #>> '{}' ~ '^[0-9]{1,15}$' then (value #>> '{}')::bigint end into quota from public.platform_settings where key = 'storage_quota_bytes';
  up := jsonb_build_object(
    'inProgress', (select count(*) from public.photos where upload_status = 'enviando' and deleted_at is null and created_at >= now() - interval '1 hour'),
    'failed24h', (select count(*) from public.photos
                   where (upload_status = 'falhou' or (upload_status = 'enviando' and created_at < now() - interval '1 hour'))
                     and created_at >= now() - interval '24 hours'),
    'photosReady', (select count(*) from public.photos where upload_status = 'pronta' and deleted_at is null));
  select jsonb_build_object('size', count(*), 'oldestAgeSeconds', coalesce(extract(epoch from now() - min(queued_at))::bigint, 0)) into queue
    from public.storage_purge_queue;
  return r || jsonb_build_object('growth', growth, 'uploads', up, 'quotaBytes', quota, 'purgeQueue', queue, 'generatedAt', now());
end $$;

-- ---------------------------------------------------------------- (3) auditoria com ator e alvo legíveis
create or replace function public.admin_list_audit_v2(p_limit int default 50, p_offset int default 0, p_category text default null,
                                                      p_event uuid default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare lim int := least(greatest(coalesce(p_limit, 50), 1), 200); off int := greatest(coalesce(p_offset, 0), 0);
        re text := public.audit_category_pattern(p_category); master boolean := public.is_master();
begin
  if not (master or public.is_platform_role('auditor')) then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if p_category is not null and re is null then raise exception 'invalid' using errcode = 'MM005'; end if;
  return jsonb_build_object(
    'total', (select count(*) from public.audit_logs a where (re is null or a.action ~ re) and (p_event is null or a.event_id = p_event)),
    'limit', lim, 'offset', off,
    'items', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', a.id, 'at', a.at, 'actorId', a.actor_id,
        'actorRole', coalesce(a.actor_role, public.audit_actor_role_for(a.actor_id, a.event_id)),
        'actorEmail', case when u.email is null then null when master then u.email else regexp_replace(u.email, '^(.).*(@.*)$', '\1***\2') end,
        'eventId', a.event_id, 'action', a.action,
        'targetType', coalesce(a.target_type, case when a.target_id is null and a.event_id is not null then 'event' end),
        'targetId', coalesce(a.target_id, case when a.target_type is null and a.event_id is not null then a.event_id::text end),
        'targetLabel', case
            when coalesce(a.target_type, 'event') = 'event' and coalesce(a.target_id, a.event_id::text) ~ '^[0-9a-f-]{36}$'
              then (select ev.title from public.events ev where ev.id = coalesce(a.target_id, a.event_id::text)::uuid)
            when a.target_type = 'user' and a.target_id ~ '^[0-9a-f-]{36}$'
              then (select case when master then t.email else regexp_replace(t.email, '^(.).*(@.*)$', '\1***\2') end from auth.users t where t.id = a.target_id::uuid)
            when a.target_type = 'plan' then (select pl.name from public.plans pl where pl.code = a.target_id)
          end,
        'exportRows', case when a.action = 'export.csv' and a.detail ->> 'rows' ~ '^[0-9]{1,9}$' then (a.detail ->> 'rows')::int end,
        'reason', a.reason, 'eventTitle', e.title,
        'sensitive', a.reason is not null
                     or a.action ~ '^(admin\.|platform_role\.|platform_settings\.|feature_flags\.|plan\.updated|entitlement\.courtesy|payment\.refund|photo\.access|audit\.)')
        order by a.at desc, a.id desc), '[]')
      from (select * from public.audit_logs l where (re is null or l.action ~ re) and (p_event is null or l.event_id = p_event)
             order by l.at desc, l.id desc limit lim offset off) a
      left join public.events e on e.id = a.event_id
      left join auth.users u on u.id = a.actor_id));
end $$;

-- ---------------------------------------------------------------- (4) eventos do filtro
create function public.admin_audit_events(p_limit int default 100) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare lim int := least(greatest(coalesce(p_limit, 100), 1), 200);
begin
  if not (public.is_master() or public.is_platform_role('auditor')) then raise exception 'forbidden' using errcode = 'MM004'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'title', x.title) order by x.last_at desc, x.id)
                     from (select e.id, e.title, max(a.at) as last_at
                             from public.audit_logs a join public.events e on e.id = a.event_id
                            group by e.id, e.title order by max(a.at) desc limit lim) x), '[]'::jsonb);
end $$;

-- ---------------------------------------------------------------- (5) exportar a auditoria filtrada
create function public.admin_export_audit_csv(p_category text default null, p_event uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); master boolean := public.is_master(); re text := public.audit_category_pattern(p_category);
  cap constant int := 50000; header text; body text; total bigint := 0; trunc boolean; n int; clean jsonb := '{}'::jsonb;
begin
  if uid is null or not (master or public.is_platform_role('auditor')) then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if p_category is not null and re is null then raise exception 'invalid' using errcode = 'MM005'; end if;
  perform public.check_rate_limit('export:' || uid, 20, interval '10 minutes');
  if p_category is not null then clean := clean || jsonb_build_object('categoria', p_category); end if;
  if p_event is not null then clean := clean || jsonb_build_object('evento', p_event); end if;
  header := public.csv_line('"id"', '"quando"', '"papel_do_autor"', '"autor_id"', '"evento_id"', '"acao"', '"alvo_tipo"', '"alvo_id"', '"motivo"');
  with x as (
    select a.*, row_number() over (order by a.at desc, a.id desc) as rn from public.audit_logs a
     where (re is null or a.action ~ re) and (p_event is null or a.event_id = p_event)
     limit cap + 1
  )
  select string_agg(public.csv_line(x.id::text, public.csv_ts(x.at), public.csv_cell(x.actor_role), public.csv_cell(x.actor_id::text), public.csv_cell(x.event_id::text),
           public.csv_cell(x.action), public.csv_cell(x.target_type), public.csv_cell(x.target_id), public.csv_cell(x.reason)), E'\r\n' order by x.rn) filter (where x.rn <= cap), count(*)
    into body, total from x;
  trunc := total > cap;
  n := least(total, cap)::int;
  insert into public.audit_logs (actor_id, actor_role, action, target_type, target_id, detail)
  values (uid, case when master then 'master' else 'auditor' end, 'export.csv', 'export', 'auditoria',
          jsonb_build_object('kind', 'auditoria', 'filters', clean, 'rows', n, 'truncated', trunc));
  return jsonb_build_object('kind', 'auditoria', 'rows', n, 'truncated', trunc, 'csv', header || E'\r\n' || case when body is null then '' else body || E'\r\n' end);
end $$;

revoke all on function public.admin_audit_events(int), public.admin_export_audit_csv(text, uuid) from public, anon;
grant execute on function public.admin_audit_events(int), public.admin_export_audit_csv(text, uuid) to authenticated;

-- ---------------------------------------------------------------- (6) exportar a moderação
-- Botão "Exportar" da M26. Sem foto, sem texto de comentário, sem nome de convidado e sem quem denunciou: só id curto, evento, total, motivos e situação.
create function public.admin_export_moderation_csv(p_aba text default 'fotos') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); master boolean := public.is_master(); header text; body text; total bigint := 0; n int; cap constant int := 50000;
begin
  if uid is null or not (master or public.is_platform_role('auditor')) then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if p_aba is null or p_aba not in ('fotos', 'comentarios', 'bloqueados') then raise exception 'invalid' using errcode = 'MM005'; end if;
  perform public.check_rate_limit('export:' || uid, 20, interval '10 minutes');
  if p_aba = 'fotos' then
    header := public.csv_line('"foto"', '"evento"', '"denuncias"', '"motivos"', '"situacao"');
    with x as (
      select ph.id, e.title, ph.reports, ph.status, row_number() over (order by ph.reports desc, ph.created_at desc) as rn
        from public.photos ph join public.events e on e.id = ph.event_id
       where ph.deleted_at is null and ph.status <> 'removida' and ph.reports > 0 and e.deleted_at is null limit cap + 1)
    select string_agg(public.csv_line(public.csv_cell(left(x.id::text, 8)), public.csv_cell(x.title), x.reports::text,
             public.csv_cell((select string_agg(r.key || ':' || r.value, ';' order by r.key) from jsonb_each_text(public.report_reason_counts('photo', x.id)) r)),
             public.csv_cell(case when x.status = 'oculta' then 'escondida' else 'visivel' end)), E'\r\n' order by x.rn) filter (where x.rn <= cap), count(*)
      into body, total from x;
  elsif p_aba = 'comentarios' then
    header := public.csv_line('"comentario"', '"evento"', '"denuncias"', '"motivos"', '"situacao"');
    with x as (
      select c.id, e.title, c.reports, c.hidden_at, row_number() over (order by c.reports desc, c.created_at desc) as rn
        from public.photo_comments c join public.events e on e.id = c.event_id
       where c.deleted_at is null and e.deleted_at is null and (c.reports > 0 or c.hidden_at is not null) limit cap + 1)
    select string_agg(public.csv_line(public.csv_cell(left(x.id::text, 8)), public.csv_cell(x.title), x.reports::text,
             public.csv_cell((select string_agg(r.key || ':' || r.value, ';' order by r.key) from jsonb_each_text(public.report_reason_counts('comment', x.id)) r)),
             public.csv_cell(case when x.hidden_at is not null then 'escondido' else 'visivel' end)), E'\r\n' order by x.rn) filter (where x.rn <= cap), count(*)
      into body, total from x;
  else
    header := public.csv_line('"evento"', '"bloqueado_em"');
    with x as (
      select e.title, p.blocked_at, row_number() over (order by p.blocked_at desc) as rn
        from public.participants p join public.events e on e.id = p.event_id
       where p.blocked_at is not null and e.deleted_at is null limit cap + 1)
    select string_agg(public.csv_line(public.csv_cell(x.title), public.csv_ts(x.blocked_at)), E'\r\n' order by x.rn) filter (where x.rn <= cap), count(*)
      into body, total from x;
  end if;
  n := least(total, cap)::int;
  insert into public.audit_logs (actor_id, actor_role, action, target_type, target_id, detail)
  values (uid, case when master then 'master' else 'auditor' end, 'export.csv', 'export', 'moderacao',
          jsonb_build_object('kind', 'moderacao', 'filters', jsonb_build_object('aba', p_aba), 'rows', n, 'truncated', total > cap));
  return jsonb_build_object('kind', 'moderacao', 'rows', n, 'truncated', total > cap, 'csv', header || E'\r\n' || case when body is null then '' else body || E'\r\n' end);
end $$;
revoke all on function public.admin_export_moderation_csv(text) from public, anon;
grant execute on function public.admin_export_moderation_csv(text) to authenticated;
