-- Reversão manual das migrations do Revela (20261109000100…400) em produção.
-- Restaura as funções exatamente como estavam em produção em 2026-11-09 (pg_get_functiondef) e remove os objetos novos.
-- Dados de comentários e e-mails dos convidados criados depois da publicação SÃO APAGADOS por este script. Rodar só em incidente.
begin;
CREATE OR REPLACE FUNCTION public.event_preview(p_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare e public.events; n int; t public.event_themes; th jsonb; plan text;
begin
  if auth.uid() is null then raise exception 'forbidden' using errcode = 'MM004'; end if;
  perform public.check_rate_limit('preview:' || auth.uid(), 120, interval '1 hour');
  select * into e from public.events where code = upper(btrim(p_code)) and deleted_at is null;
  if not found then return null; end if;
  select count(*) into n from public.participants where event_id = e.id;
  select * into t from public.event_themes where event_id = e.id;
  if found then
    th := jsonb_build_object('preset', t.preset, 'colors', t.colors, 'font', t.font, 'welcomeMessage', t.welcome_message,
                             'qrStyle', t.qr_style, 'decor', t.decor);
  end if;
  select x.plan_code into plan from public.effective_entitlement(e.id) x;
  return jsonb_build_object(
    'code', e.code, 'title', e.title, 'category', e.category, 'hostName', e.host_name, 'startAt', e.start_at, 'place', e.place,
    'palette', e.palette, 'eventFont', e.event_font, 'capacity', e.capacity,
    'status', case when now() >= public.event_end(e.start_at, e.duration_hours, e.ended_at) then 'encerrado' else 'ativo' end,
    'full', e.capacity is not null and n >= e.capacity + public.capacity_grace_slots(e.capacity),
    'theme', th,
    'shotsPerPerson', e.shots_per_person, 'revealAt', e.reveal_at, 'revealStatus', e.reveal_status,
    'timezone', e.timezone, 'everyoneSeesAll', e.everyone_sees_all, 'planCode', plan);
end $function$
;

CREATE OR REPLACE FUNCTION public.list_public_plans()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce(jsonb_agg(jsonb_build_object(
      'code', p.code, 'name', p.name, 'maxGuests', p.max_guests, 'maxShots', p.max_shots, 'priceCents', p.price_cents,
      'sort', p.sort, 'isFree', p.is_free, 'features', p.features) order by p.sort, p.code), '[]')
  from public.plans p
  where p.is_free
     or (public.payments_env() = 'sandbox' and p.sandbox_active)
     or (public.payments_env() = 'production' and p.production_active)
$function$
;

CREATE OR REPLACE FUNCTION public.admin_list_plans()
 RETURNS SETOF jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_master() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  return query
    select jsonb_build_object(
      'code', p.code, 'name', p.name, 'maxGuests', p.max_guests, 'maxShots', p.max_shots, 'priceCents', p.price_cents,
      'sort', p.sort, 'isFree', p.is_free, 'sandboxActive', p.sandbox_active, 'productionActive', p.production_active,
      'features', p.features, 'updatedAt', p.updated_at,
      'history', (select coalesce(jsonb_agg(jsonb_build_object('at', a.at, 'actorId', a.actor_id, 'actorRole', a.actor_role,
                                                               'reason', a.reason, 'old', a.detail -> 'old', 'new', a.detail -> 'new')
                                            order by a.at desc, a.id desc), '[]')
                    from (select * from public.audit_logs l
                           where l.target_type = 'plan' and l.target_id = p.code and l.action = 'plan.updated'
                           order by l.at desc, l.id desc limit 10) a))
    from public.plans p
    order by p.sort, p.code;
end $function$
;

CREATE OR REPLACE FUNCTION public.process_account_deletion(p_user uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  update public.photos set author_id = null, author_name = 'Participante removido' where author_id = p_user;
  delete from public.reactions where author_id = p_user;
  delete from public.participants where user_id = p_user;
  insert into public.storage_purge_queue (path)
    select storage_path from public.photos ph join public.events e on e.id = ph.event_id where e.host_id = p_user
  on conflict do nothing;
  update public.photos set deleted_at = now() where event_id in (select id from public.events where host_id = p_user) and deleted_at is null;
  update public.events set deleted_at = now() where host_id = p_user and deleted_at is null;
  update public.profiles set display_name = '' where id = p_user;
  update public.account_deletion_requests set processed_at = now() where user_id = p_user;
  insert into public.audit_logs (actor_id, event_id, action, detail) values (null, null, 'account.deleted', jsonb_build_object('user', p_user));
end $function$
;

CREATE OR REPLACE FUNCTION public.release_reveal(p_event uuid, p_at timestamp with time zone, p_source text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  update public.events set revealed_at = p_at, reveal_status = 'revelada'
   where id = p_event and reveal_enabled and revealed_at is null and deleted_at is null;
  if not found then return false; end if;
  insert into public.audit_logs (actor_id, event_id, action, detail)
  values (null, p_event, 'reveal.released', jsonb_build_object('at', p_at, 'ran_at', now())
          || case when p_source is null then '{}'::jsonb else jsonb_build_object('source', p_source) end);
  return true;
end $function$
;

drop function if exists public.admin_publish_plans(jsonb, text);
drop function if exists public.post_comment(uuid, text), public.list_photo_comments(uuid), public.comment_counts(uuid), public.toggle_comment_like(uuid),
  public.report_comment(uuid), public.moderate_comment(uuid, text, text), public.delete_my_comment(uuid), public.list_comments_for_moderation(uuid);
drop table if exists public.comment_likes, public.comment_reports, public.photo_comments;
drop function if exists public.can_see_comment(uuid);
drop function if exists public.set_my_email(uuid, text, boolean), public.get_my_email(uuid), public.email_opt_out(uuid), public.email_opt_out_mine(uuid),
  public.claim_reveal_emails(int), public.mark_reveal_email_sent(uuid), public.mark_reveal_email_failed(uuid, text);
drop table if exists public.reveal_email_queue, public.participant_emails;
drop index if exists public.plans_single_highlighted;
alter table public.plans drop column if exists highlighted;
alter table public.events drop constraint if exists events_camera_style_check;
alter table public.events drop column if exists film_look;
alter table public.events alter column camera_style set default 'original';
update public.events set camera_style = 'original' where camera_style in ('festa', 'casamento', 'aniversario', 'noite');
drop function if exists public.my_pose_times(uuid);
delete from supabase_migrations.schema_migrations where version in ('20261109000100', '20261109000200', '20261109000300', '20261109000400', '20261109000500');
commit;
