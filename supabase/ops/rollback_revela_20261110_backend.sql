-- Reversão manual das migrations 20261110000200…220 (reveal_now, motivo da denúncia, baixar em alta). Rodar só em incidente.
-- Apaga os motivos das denúncias e o valor de guest_download_high já gravados. Não toca em audit_logs (imutável).
begin;
-- 20261110000200: admin_reveal_now volta ao corpo original (20261024000100); reveal_now sai
create or replace function public.admin_reveal_now(p_event uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare why text; ev public.events;
begin
  if not public.is_master() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  why := public.admin_reason(p_reason);
  select * into ev from public.events where id = p_event for update;
  if not found or ev.deleted_at is not null or not ev.reveal_enabled then raise exception 'invalid' using errcode = 'MM005'; end if;
  if ev.revealed_at is not null then raise exception 'revealed' using errcode = 'MM008'; end if;
  if not public.release_reveal(ev.id, now(), 'admin') then raise exception 'revealed' using errcode = 'MM008'; end if;
  perform public.admin_log('admin.reveal_now', 'event', ev.id::text, why, ev.id);
  return jsonb_build_object('ok', true, 'eventId', ev.id, 'revealedAt', now());
end $$;
drop function if exists public.reveal_now(uuid, text);

-- 20261110000210: funções de denúncia voltam às assinaturas e corpos originais; leituras novas e colunas saem
drop function if exists public.report_reasons(uuid);
drop function if exists public.report_photo(uuid, text);
drop function if exists public.report_comment(uuid, text);
create function public.report_photo(p_photo uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_see_photo(p_photo) then raise exception 'forbidden' using errcode = 'MM004'; end if;
  insert into public.photo_reports (photo_id, user_id) values (p_photo, auth.uid()) on conflict do nothing;
  if found then update public.photos set reports = reports + 1 where id = p_photo; end if;
end $$;
create function public.report_comment(p_comment uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); n int;
begin
  if uid is null or not public.can_see_comment(p_comment) then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if exists (select 1 from public.photo_comments where id = p_comment and author_id = uid) then raise exception 'invalid' using errcode = 'MM005'; end if;
  perform public.check_rate_limit('commentreport:' || uid, 30, interval '1 hour');
  insert into public.comment_reports (comment_id, user_id) values (p_comment, uid) on conflict do nothing;
  select count(*) into n from public.comment_reports where comment_id = p_comment;
  update public.photo_comments set reports = n,
         hidden_at = case when n >= 3 and hidden_at is null then now() else hidden_at end,
         hidden_by = case when n >= 3 and hidden_at is null then 'denuncias' else hidden_by end
   where id = p_comment;
  return jsonb_build_object('reports', n, 'hidden', n >= 3);
end $$;
revoke all on function public.report_photo(uuid), public.report_comment(uuid) from public, anon;
grant execute on function public.report_photo(uuid), public.report_comment(uuid) to authenticated;
create or replace function public.admin_moderation_queue() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare master boolean := public.is_master(); photos jsonb; comments jsonb; blocked jsonb;
begin
  if not public.is_platform_staff() then raise exception 'forbidden' using errcode = 'MM004'; end if;

  select coalesce(jsonb_agg(jsonb_build_object('photoId', x.id, 'eventId', x.event_id, 'eventTitle', x.title, 'reports', x.reports, 'hidden', x.status = 'oculta')
                            order by x.reports desc, x.created_at desc), '[]'::jsonb) into photos
    from (select ph.id, ph.event_id, e.title, ph.reports, ph.status, ph.created_at
            from public.photos ph join public.events e on e.id = ph.event_id
           where ph.deleted_at is null and ph.status <> 'removida' and ph.reports > 0 and e.deleted_at is null
           order by ph.reports desc, ph.created_at desc limit 100) x;

  select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'eventId', x.event_id, 'eventTitle', x.title, 'authorName', case when master then x.author_name end,
                                               'body', case when master then x.body end, 'reports', x.reports, 'hidden', x.hidden_at is not null,
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
drop function if exists public.report_reason_counts(text, uuid);
alter table public.photo_reports drop constraint if exists photo_reports_reason_check;
alter table public.comment_reports drop constraint if exists comment_reports_reason_check;
alter table public.photo_reports drop column if exists reason;
alter table public.comment_reports drop column if exists reason;

-- 20261110000220
drop function if exists public.photo_download_allowed(uuid);
alter table public.events drop column if exists guest_download_high;
commit;
