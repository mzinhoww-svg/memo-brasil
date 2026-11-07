-- UX A18: filtro/contagem antes da paginação. Sem fotos, legendas ou tokens.
-- RPCs novas preservam assinaturas usadas por versões anteriores do console.
create function public.admin_search_users(p_limit int default 25, p_offset int default 0, p_search text default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare lim int := least(greatest(coalesce(p_limit, 25), 1), 100); off int := greatest(coalesce(p_offset, 0), 0);
        term text := lower(left(nullif(btrim(p_search), ''), 80)); full_pii boolean := public.is_master(); total bigint; items jsonb;
begin
  if not public.is_platform_staff() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  with f as (
    select u.* from auth.users u left join public.profiles p on p.id = u.id
    where term is null or strpos(lower(u.id::text), term) > 0 or strpos(lower(p.display_name), term) > 0
      or (full_pii and strpos(lower(u.email), term) > 0)
  ), page as (select * from f order by created_at desc, id limit lim offset off)
  select (select count(*) from f), coalesce(jsonb_agg(jsonb_build_object(
    'userId', u.id, 'isAnonymous', u.is_anonymous, 'provider', coalesce(u.raw_app_meta_data ->> 'provider', 'anonymous'),
    'email', case when full_pii then u.email else regexp_replace(u.email, '^(.).*(@.*)$', '\1***\2') end,
    'createdAt', u.created_at, 'lastSignInAt', u.last_sign_in_at,
    'platformRole', (select r.role from public.platform_roles r where r.user_id = u.id and r.revoked_at is null limit 1)
  ) order by u.created_at desc, u.id), '[]'::jsonb) into total, items from page u;
  return jsonb_build_object('total', total, 'limit', lim, 'offset', off, 'items', items);
end $$;

create function public.admin_search_participants(p_limit int default 25, p_offset int default 0, p_search text default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare lim int := least(greatest(coalesce(p_limit, 25), 1), 100); off int := greatest(coalesce(p_offset, 0), 0);
        term text := lower(left(nullif(btrim(p_search), ''), 80)); total bigint; items jsonb;
begin
  if not public.is_platform_staff() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  with f as (
    select p.*, e.title, e.host_id from public.participants p join public.events e on e.id = p.event_id
    where term is null or strpos(lower(p.name), term) > 0 or strpos(lower(e.title), term) > 0 or strpos(lower(p.table_label), term) > 0
  ), page as (select * from f order by joined_at desc, event_id, user_id limit lim offset off)
  select (select count(*) from f), coalesce(jsonb_agg(jsonb_build_object(
    'eventId', p.event_id, 'eventTitle', p.title, 'userId', p.user_id, 'name', p.name, 'table', p.table_label,
    'joinedAt', p.joined_at, 'blocked', p.blocked_at is not null, 'isHost', p.user_id = p.host_id
  ) order by p.joined_at desc, p.event_id, p.user_id), '[]'::jsonb) into total, items from page p;
  return jsonb_build_object('total', total, 'limit', lim, 'offset', off, 'items', items);
end $$;

create function public.admin_search_invites(p_limit int default 25, p_offset int default 0, p_search text default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare lim int := least(greatest(coalesce(p_limit, 25), 1), 100); off int := greatest(coalesce(p_offset, 0), 0);
        term text := lower(left(nullif(btrim(p_search), ''), 80)); total bigint; items jsonb;
begin
  if not public.is_platform_staff() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  with f as (
    select i.*, e.title from public.invitations i join public.events e on e.id = i.event_id
    where term is null or strpos(lower(i.label), term) > 0 or strpos(lower(e.title), term) > 0
  ), page as (select * from f order by created_at desc, id limit lim offset off)
  select (select count(*) from f), coalesce(jsonb_agg(jsonb_build_object(
    'id', i.id, 'eventId', i.event_id, 'eventTitle', i.title, 'label', i.label, 'uses', i.uses, 'maxUses', i.max_uses,
    'expiresAt', i.expires_at, 'revokedAt', i.revoked_at, 'createdAt', i.created_at,
    'state', case when i.revoked_at is not null then 'revogado' when i.expires_at <= now() then 'expirado'
      when i.max_uses is not null and i.uses >= i.max_uses then 'esgotado' else 'ativo' end
  ) order by i.created_at desc, i.id), '[]'::jsonb) into total, items from page i;
  return jsonb_build_object('total', total, 'limit', lim, 'offset', off, 'items', items);
end $$;

create function public.admin_list_reveals(p_limit int default 25, p_offset int default 0, p_search text default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare lim int := least(greatest(coalesce(p_limit, 25), 1), 100); off int := greatest(coalesce(p_offset, 0), 0);
        term text := lower(left(nullif(btrim(p_search), ''), 80)); total bigint; items jsonb;
begin
  if not public.is_platform_staff() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  with f as (
    select e.id, e.title, e.host_name, e.reveal_at from public.events e
    where e.deleted_at is null and e.reveal_enabled and e.revealed_at is null
      and (term is null or strpos(lower(e.title), term) > 0 or strpos(lower(e.host_name), term) > 0)
  ), page as (select * from f order by reveal_at asc nulls last, id limit lim offset off)
  select (select count(*) from f), coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id, 'title', e.title, 'hostName', e.host_name, 'revealAt', e.reveal_at,
    'revealState', case when e.reveal_at <= now() then 'atrasada' else 'pendente' end
  ) order by e.reveal_at asc nulls last, e.id), '[]'::jsonb) into total, items from page e;
  return jsonb_build_object('total', total, 'limit', lim, 'offset', off, 'items', items);
end $$;

revoke execute on function public.admin_search_users(int, int, text), public.admin_search_participants(int, int, text),
  public.admin_search_invites(int, int, text), public.admin_list_reveals(int, int, text) from public, anon;
grant execute on function public.admin_search_users(int, int, text), public.admin_search_participants(int, int, text),
  public.admin_search_invites(int, int, text), public.admin_list_reveals(int, int, text) to authenticated;
