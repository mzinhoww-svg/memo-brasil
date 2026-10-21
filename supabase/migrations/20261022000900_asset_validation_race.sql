-- Fecha o TOCTOU da validação de logo/capa (achado da revisão A4-2) e confere o OBJETO REAL no Storage.
-- Enquanto a Edge Function valida (validating_at preenchido) o cliente não consegue inserir nem apagar o objeto.
alter table public.event_assets add column if not exists validating_at timestamptz;

create or replace function public.can_upload_branding(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.event_assets a
    where a.storage_path = p_name and a.created_by = auth.uid() and a.upload_status = 'enviando' and a.validating_at is null
      and public.is_host(a.event_id) and not public.event_theme_locked(a.event_id))
$$;

create or replace function public.can_delete_branding(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.is_host(public.branding_event_from_path(p_name)), false)
     and not exists (select 1 from public.event_assets a
                     where a.storage_path = p_name
                       and (a.validating_at is not null or (a.upload_status = 'pronta' and public.event_theme_locked(a.event_id))))
$$;

-- passo 1 (Edge Function, service_role): trava o ativo para validação; idempotente para 'pronta'
create function public.begin_asset_validation(p_id uuid, p_user uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare a public.event_assets; host uuid;
begin
  select * into a from public.event_assets where id = p_id for update;
  if not found or a.created_by is distinct from p_user then raise exception 'forbidden' using errcode = 'MM004'; end if;
  select e.host_id into host from public.events e where e.id = a.event_id;
  if host is distinct from p_user then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if a.upload_status = 'pronta' then return false; end if;
  if a.validating_at is not null and a.validating_at > now() - interval '5 minutes' then raise exception 'busy' using errcode = 'MM009'; end if;
  perform public.check_rate_limit('finalize:' || p_user, 30, interval '1 hour');
  update public.event_assets set validating_at = now() where id = p_id;
  return true;
end $$;
revoke execute on function public.begin_asset_validation(uuid, uuid) from public, anon, authenticated;
grant execute on function public.begin_asset_validation(uuid, uuid) to service_role;

-- passo 2: confirma só com o ativo travado e o objeto no Storage igual ao que a função validou (tamanho e tipo armazenados)
create or replace function public.mark_asset_validated(p_id uuid, p_user uuid, p_width int, p_height int, p_bytes int, p_mime text) returns void
language plpgsql security definer set search_path = '' as $$
declare a public.event_assets; host uuid; gone timestamptz; cap int; osize bigint; omime text;
begin
  select * into a from public.event_assets where id = p_id for update;
  if not found or a.created_by is distinct from p_user then raise exception 'forbidden' using errcode = 'MM004'; end if;
  select e.host_id, e.deleted_at into host, gone from public.events e where e.id = a.event_id;
  if host is distinct from p_user then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if a.upload_status = 'pronta' then return; end if;
  if gone is not null then raise exception 'invalid' using errcode = 'MM005'; end if;
  if public.event_theme_locked(a.event_id) then raise exception 'revealed' using errcode = 'MM008'; end if;
  if a.validating_at is null then raise exception 'invalid' using errcode = 'MM005'; end if;
  cap := 5242880;
  if a.kind = 'logo' then cap := 2097152; end if;
  if p_mime not in ('image/jpeg', 'image/png', 'image/webp') or p_width not between 16 and 8192 or p_height not between 16 and 8192
     or p_bytes <= 0 or p_bytes > cap then
    raise exception 'invalid' using errcode = 'MM005';
  end if;
  select (o.metadata ->> 'size')::bigint, o.metadata ->> 'mimetype' into osize, omime from storage.objects o
    where o.bucket_id = 'event-branding' and o.name = a.storage_path;
  if not found or osize is distinct from p_bytes::bigint or omime is distinct from p_mime then raise exception 'invalid' using errcode = 'MM005'; end if;
  update public.event_assets set upload_status = 'pronta', bytes = p_bytes, width = p_width, height = p_height, mime = p_mime, validating_at = null where id = p_id;
  insert into public.audit_logs (actor_id, actor_role, event_id, action, target_type, target_id, detail)
  values (p_user, 'organizador', a.event_id, 'asset.published', 'asset', a.id::text, jsonb_build_object('kind', a.kind, 'validated', true, 'width', p_width, 'height', p_height));
end $$;

-- ativos abandonados: 'enviando' há mais de 1 h, ou validação travada há mais de 10 min
create or replace function public.expire_pending_assets() returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  insert into public.storage_purge_queue (path, bucket)
    select storage_path, 'event-branding' from public.event_assets
    where upload_status = 'enviando' and ((validating_at is null and created_at < now() - interval '1 hour') or validating_at < now() - interval '10 minutes')
  on conflict do nothing;
  with gone as (delete from public.event_assets where upload_status = 'enviando' and ((validating_at is null and created_at < now() - interval '1 hour') or validating_at < now() - interval '10 minutes') returning id) select count(*) into n from gone;
  return n;
end $$;
revoke execute on function public.expire_pending_assets() from public, anon, authenticated;
