-- RPCs de listagem do console master: usuários, participantes, convites e auditoria.
-- Somente staff (is_platform_staff), search_path fixo, paginação limitada, sem fotos, sem token de convite, sem telefone/metadata.
-- E-mail completo só para master; os demais papéis veem mascarado (mesma regra de admin_list_organizers).

create function public.admin_list_users(p_limit int default 50, p_offset int default 0) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare lim int := least(greatest(coalesce(p_limit, 50), 1), 200); off int := greatest(coalesce(p_offset, 0), 0);
        full_pii boolean := public.is_master();
begin
  if not public.is_platform_staff() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  return jsonb_build_object(
    'total', (select count(*) from auth.users),
    'limit', lim, 'offset', off,
    'items', (select coalesce(jsonb_agg(jsonb_build_object(
        'userId', u.id, 'isAnonymous', u.is_anonymous,
        'provider', coalesce(u.raw_app_meta_data ->> 'provider', 'anonymous'),
        'email', case when u.email is null then null when full_pii then u.email else regexp_replace(u.email, '^(.).*(@.*)$', '\1***\2') end,
        'createdAt', u.created_at, 'lastSignInAt', u.last_sign_in_at,
        'platformRole', (select r.role from public.platform_roles r where r.user_id = u.id and r.revoked_at is null limit 1)
      ) order by u.created_at desc), '[]')
      from (select * from auth.users order by created_at desc limit lim offset off) u));
end $$;

create function public.admin_list_participants(p_event uuid default null, p_limit int default 50, p_offset int default 0) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare lim int := least(greatest(coalesce(p_limit, 50), 1), 200); off int := greatest(coalesce(p_offset, 0), 0);
begin
  if not public.is_platform_staff() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  return jsonb_build_object(
    'total', (select count(*) from public.participants where p_event is null or event_id = p_event),
    'limit', lim, 'offset', off,
    'items', (select coalesce(jsonb_agg(jsonb_build_object(
        'eventId', x.event_id, 'eventTitle', x.title, 'userId', x.user_id, 'name', x.name, 'table', x.table_label,
        'joinedAt', x.joined_at, 'blocked', x.blocked_at is not null,
        'isHost', x.user_id = x.host_id) order by x.joined_at desc), '[]')
      from (select p.*, e.title, e.host_id from public.participants p join public.events e on e.id = p.event_id
            where p_event is null or p.event_id = p_event order by p.joined_at desc limit lim offset off) x));
end $$;

create function public.admin_list_invites(p_event uuid default null, p_limit int default 50, p_offset int default 0) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare lim int := least(greatest(coalesce(p_limit, 50), 1), 200); off int := greatest(coalesce(p_offset, 0), 0);
begin
  if not public.is_platform_staff() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  return jsonb_build_object(
    'total', (select count(*) from public.invitations where p_event is null or event_id = p_event),
    'limit', lim, 'offset', off,
    'items', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', x.id, 'eventId', x.event_id, 'eventTitle', x.title, 'label', x.label, 'uses', x.uses, 'maxUses', x.max_uses,
        'expiresAt', x.expires_at, 'revokedAt', x.revoked_at, 'createdAt', x.created_at,
        'state', case when x.revoked_at is not null then 'revogado'
                      when x.expires_at is not null and x.expires_at <= now() then 'expirado'
                      when x.max_uses is not null and x.uses >= x.max_uses then 'esgotado' else 'ativo' end
      ) order by x.created_at desc), '[]')
      from (select i.*, e.title from public.invitations i join public.events e on e.id = i.event_id
            where p_event is null or i.event_id = p_event order by i.created_at desc limit lim offset off) x));
end $$;

create function public.admin_list_audit(p_limit int default 50, p_offset int default 0, p_action text default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare lim int := least(greatest(coalesce(p_limit, 50), 1), 200); off int := greatest(coalesce(p_offset, 0), 0);
        pat text := case when nullif(btrim(p_action), '') is null then null
                         else replace(replace(replace(left(btrim(p_action), 60), '\', '\\'), '%', '\%'), '_', '\_') || '%' end;
begin
  if not public.is_platform_staff() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  return jsonb_build_object(
    'total', (select count(*) from public.audit_logs where pat is null or action like pat),
    'limit', lim, 'offset', off,
    'items', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', a.id, 'at', a.at, 'actorId', a.actor_id, 'actorRole', a.actor_role, 'eventId', a.event_id,
        'action', a.action, 'targetType', a.target_type, 'targetId', a.target_id, 'reason', a.reason) order by a.at desc, a.id desc), '[]')
      from (select * from public.audit_logs where pat is null or action like pat order by at desc, id desc limit lim offset off) a));
end $$;

revoke execute on function public.admin_list_users(int, int), public.admin_list_participants(uuid, int, int),
  public.admin_list_invites(uuid, int, int), public.admin_list_audit(int, int, text) from public, anon;
grant execute on function public.admin_list_users(int, int), public.admin_list_participants(uuid, int, int),
  public.admin_list_invites(uuid, int, int), public.admin_list_audit(int, int, text) to authenticated;
