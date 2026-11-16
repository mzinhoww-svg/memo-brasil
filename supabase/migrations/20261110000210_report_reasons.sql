-- Revela 2.0 · motivo da denúncia (24g do feed). ADITIVA: coluna nova com check, RPCs com parâmetro opcional p_reason, leituras agregadas.
-- Motivos (os do desenho Feed-denunciar): foto = nao_quero_aparecer · constrangedora · improprio · outro;
-- comentário = ofensivo · spam · improprio · outro. Sem motivo (clientes antigos) vale null e aparece como "sem_motivo" nas contagens.
-- Privacidade: user_id da denúncia continua sem leitura; só contagens por motivo saem, para o anfitrião do evento e a equipe.
-- Observação: report_photo(uuid) e report_comment(uuid) são substituídas por (uuid, text default null): duas sobrecargas com default
-- deixariam a chamada de um argumento ambígua. Chamadas antigas (só p_photo / p_comment) continuam valendo.
alter table public.photo_reports add column if not exists reason text;
alter table public.photo_reports drop constraint if exists photo_reports_reason_check;
alter table public.photo_reports add constraint photo_reports_reason_check
  check (reason is null or reason in ('nao_quero_aparecer', 'constrangedora', 'improprio', 'outro'));
alter table public.comment_reports add column if not exists reason text;
alter table public.comment_reports drop constraint if exists comment_reports_reason_check;
alter table public.comment_reports add constraint comment_reports_reason_check
  check (reason is null or reason in ('ofensivo', 'spam', 'improprio', 'outro'));

drop function if exists public.report_photo(uuid);
create function public.report_photo(p_photo uuid, p_reason text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_see_photo(p_photo) then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if p_reason is not null and p_reason not in ('nao_quero_aparecer', 'constrangedora', 'improprio', 'outro') then raise exception 'invalid' using errcode = 'MM005'; end if;
  insert into public.photo_reports (photo_id, user_id, reason) values (p_photo, auth.uid(), p_reason) on conflict do nothing;
  if found then update public.photos set reports = reports + 1 where id = p_photo; end if;
end $$;

drop function if exists public.report_comment(uuid);
create function public.report_comment(p_comment uuid, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); n int;
begin
  if uid is null or not public.can_see_comment(p_comment) then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if p_reason is not null and p_reason not in ('ofensivo', 'spam', 'improprio', 'outro') then raise exception 'invalid' using errcode = 'MM005'; end if;
  if exists (select 1 from public.photo_comments where id = p_comment and author_id = uid) then raise exception 'invalid' using errcode = 'MM005'; end if;
  perform public.check_rate_limit('commentreport:' || uid, 30, interval '1 hour');
  insert into public.comment_reports (comment_id, user_id, reason) values (p_comment, uid, p_reason) on conflict do nothing;
  select count(*) into n from public.comment_reports where comment_id = p_comment;
  update public.photo_comments set reports = n,
         hidden_at = case when n >= 3 and hidden_at is null then now() else hidden_at end,
         hidden_by = case when n >= 3 and hidden_at is null then 'denuncias' else hidden_by end
   where id = p_comment;
  return jsonb_build_object('reports', n, 'hidden', n >= 3);
end $$;

-- Contagem por motivo, sem identificar quem denunciou. Uso interno das RPCs abaixo (sem EXECUTE para clientes).
create function public.report_reason_counts(p_kind text, p_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_object_agg(r.reason, r.n), '{}'::jsonb) from (
    select coalesce(x.reason, 'sem_motivo') as reason, count(*) as n
      from (select reason from public.photo_reports where p_kind = 'photo' and photo_id = p_id
            union all select reason from public.comment_reports where p_kind = 'comment' and comment_id = p_id) x
     group by 1) r
$$;
revoke all on function public.report_reason_counts(text, uuid) from public, anon, authenticated;

-- Anfitrião (17c/17i) e Master: motivos agregados por foto e por comentário do evento.
create function public.report_reasons(p_event uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (public.is_host(p_event) or public.is_master()) then raise exception 'forbidden' using errcode = 'MM004'; end if;
  return jsonb_build_object(
    'photos', coalesce((select jsonb_object_agg(ph.id::text, public.report_reason_counts('photo', ph.id)) from public.photos ph
                         where ph.event_id = p_event and ph.deleted_at is null and ph.reports > 0), '{}'::jsonb),
    'comments', coalesce((select jsonb_object_agg(c.id::text, public.report_reason_counts('comment', c.id)) from public.photo_comments c
                           where c.event_id = p_event and c.deleted_at is null and c.reports > 0), '{}'::jsonb));
end $$;

-- Master (M09): a fila ganha "reasons" (contagem por motivo) em cada foto e comentário.
create or replace function public.admin_moderation_queue() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare master boolean := public.is_master(); photos jsonb; comments jsonb; blocked jsonb;
begin
  if not public.is_platform_staff() then raise exception 'forbidden' using errcode = 'MM004'; end if;

  select coalesce(jsonb_agg(jsonb_build_object('photoId', x.id, 'eventId', x.event_id, 'eventTitle', x.title, 'reports', x.reports, 'hidden', x.status = 'oculta',
                            'reasons', public.report_reason_counts('photo', x.id))
                            order by x.reports desc, x.created_at desc), '[]'::jsonb) into photos
    from (select ph.id, ph.event_id, e.title, ph.reports, ph.status, ph.created_at
            from public.photos ph join public.events e on e.id = ph.event_id
           where ph.deleted_at is null and ph.status <> 'removida' and ph.reports > 0 and e.deleted_at is null
           order by ph.reports desc, ph.created_at desc limit 100) x;

  select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'eventId', x.event_id, 'eventTitle', x.title, 'authorName', case when master then x.author_name end,
                                               'body', case when master then x.body end, 'reports', x.reports, 'hidden', x.hidden_at is not null, 'reasons', public.report_reason_counts('comment', x.id),
                                               'hiddenBy', x.hidden_by, 'createdAt', x.created_at) order by x.reports desc, x.created_at desc), '[]'::jsonb) into comments
    from (select c.id, c.event_id, e.title, c.author_name, c.body, c.reports, c.hidden_at, c.hidden_by, c.created_at
            from public.photo_comments c join public.events e on e.id = c.event_id
           where c.deleted_at is null and e.deleted_at is null and (c.reports > 0 or c.hidden_at is not null)
           order by c.reports desc, c.created_at desc limit 100) x;

  select coalesce(jsonb_agg(jsonb_build_object('eventId', x.event_id, 'eventTitle', x.title, 'name', case when master then x.name end, 'blockedAt', x.blocked_at)
                            order by x.blocked_at desc), '[]'::jsonb) into blocked
    from (select p.event_id, e.title, p.name, p.blocked_at
            from public.participants p join public.events e on e.id = p.event_id
           where p.blocked_at is not null and e.deleted_at is null order by p.blocked_at desc limit 100) x;

  return jsonb_build_object('photos', photos, 'comments', comments, 'blocked', blocked);
end $$;

revoke all on function public.report_photo(uuid, text), public.report_comment(uuid, text), public.report_reasons(uuid), public.admin_moderation_queue() from public, anon;
grant execute on function public.report_photo(uuid, text), public.report_comment(uuid, text), public.report_reasons(uuid), public.admin_moderation_queue() to authenticated;
