-- MemoriesMT v2 · 3/5 · EST-001 · logo/capa do evento: tabela event_assets + bucket PRIVADO event-branding.
-- ADITIVA. Caminho no Storage: {event_id}/{asset_id}. Limites: png/jpeg/webp, 5 MiB no bucket (logo 2 MiB, capa 5 MiB no finalize),
-- sem SVG (vetor de XSS), sem sobrescrever (sem policy de UPDATE), leitura só por quem vê o evento.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-branding', 'event-branding', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = excluded.allowed_mime_types;

create table public.event_assets (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events on delete cascade,
  kind text not null check (kind in ('logo', 'cover')),
  storage_path text not null unique,
  mime text not null check (mime in ('image/jpeg', 'image/png', 'image/webp')),
  bytes int check (bytes is null or bytes between 1 and 5242880), -- preenchido no finalize, a partir do objeto real
  width int not null check (width between 16 and 8192),
  height int not null check (height between 16 and 8192),
  upload_status public.upload_status not null default 'enviando',
  created_by uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  constraint event_assets_path_matches check (storage_path = event_id::text || '/' || id::text)
);
create index event_assets_event_idx on public.event_assets (event_id, kind, created_at desc);

alter table public.event_assets enable row level security;
revoke all on public.event_assets from anon, authenticated;
grant select on public.event_assets to authenticated; -- escrita só por begin_asset/finalize_asset/discard_asset

create policy event_assets_select on public.event_assets for select to authenticated
  using (public.is_host(event_id) or (upload_status = 'pronta' and (public.is_member(event_id) or public.is_master())));

-- ---------------------------------------------------------------- funções de caminho e autorização do Storage
create function public.branding_event_from_path(p_name text) returns uuid
language sql immutable set search_path = '' as $$
  select case when p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then split_part(p_name, '/', 1)::uuid end
$$;

-- subir: só o host que abriu o envio, no caminho exato, enquanto 'enviando' e o tema não está bloqueado
create function public.can_upload_branding(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.event_assets a
    where a.storage_path = p_name and a.created_by = auth.uid() and a.upload_status = 'enviando'
      and public.is_host(a.event_id) and not public.event_theme_locked(a.event_id))
$$;

-- ler/assinar URL: host (qualquer estado), membro ou master (somente 'pronta') — quem enxerga o evento
create function public.can_read_branding(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.event_assets a join public.events e on e.id = a.event_id
    where a.storage_path = p_name and e.deleted_at is null
      and (e.host_id = auth.uid() or (a.upload_status = 'pronta' and (public.is_member(e.id) or public.is_master()))))
$$;

create function public.can_delete_branding(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.is_host(public.branding_event_from_path(p_name)), false)
$$;

create policy "event_branding_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'event-branding' and public.can_upload_branding(name));
create policy "event_branding_select" on storage.objects for select to authenticated
  using (bucket_id = 'event-branding' and public.can_read_branding(name));
create policy "event_branding_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'event-branding' and public.can_delete_branding(name));
-- sem policy de UPDATE: ninguém sobrescreve objeto existente (sem upsert)

-- ---------------------------------------------------------------- RPCs (espelham begin_photo/finalize_photo)
create function public.begin_asset(p_id uuid, p_event uuid, p_kind text, p_mime text, p_width int, p_height int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); existing public.event_assets; path text := p_event::text || '/' || p_id::text;
begin
  if uid is null or not public.is_host(p_event) then raise exception 'forbidden' using errcode = 'MM004'; end if;
  select * into existing from public.event_assets where id = p_id;
  if found then -- idempotente
    if existing.event_id <> p_event or existing.created_by <> uid then raise exception 'forbidden' using errcode = 'MM004'; end if;
    return jsonb_build_object('id', existing.id, 'storagePath', existing.storage_path, 'uploadStatus', existing.upload_status);
  end if;
  if public.event_theme_locked(p_event) then raise exception 'revealed' using errcode = 'MM008'; end if;
  if p_kind not in ('logo', 'cover') or p_mime not in ('image/jpeg', 'image/png', 'image/webp')
     or p_width is null or p_height is null or p_width not between 16 and 8192 or p_height not between 16 and 8192 then
    raise exception 'invalid' using errcode = 'MM005';
  end if;
  perform public.check_rate_limit('asset:' || uid, 20, interval '1 hour');
  if (select count(*) from public.event_assets where event_id = p_event) >= 10 then raise exception 'capacityfull' using errcode = 'MM003'; end if;
  insert into public.event_assets (id, event_id, kind, storage_path, mime, width, height, created_by)
  values (p_id, p_event, p_kind, path, p_mime, p_width, p_height, uid);
  return jsonb_build_object('id', p_id, 'storagePath', path, 'uploadStatus', 'enviando');
end $$;

create function public.finalize_asset(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a public.event_assets; obj record; cap int;
begin
  select * into a from public.event_assets where id = p_id for update;
  if not found or a.created_by is distinct from auth.uid() or not public.is_host(a.event_id) then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if a.upload_status = 'pronta' then return jsonb_build_object('id', a.id, 'uploadStatus', 'pronta'); end if;
  cap := case a.kind when 'logo' then 2097152 else 5242880 end;
  select (metadata ->> 'size')::int as size, metadata ->> 'mimetype' as mime into obj from storage.objects
    where bucket_id = 'event-branding' and name = a.storage_path;
  if not found or obj.size is null or obj.size <= 0 or obj.size > cap or obj.mime is distinct from a.mime then
    raise exception 'invalid' using errcode = 'MM005';
  end if;
  update public.event_assets set upload_status = 'pronta', bytes = obj.size where id = p_id;
  perform public.audit(a.event_id, 'asset.published', jsonb_build_object('asset', a.id, 'kind', a.kind));
  return jsonb_build_object('id', a.id, 'uploadStatus', 'pronta');
end $$;

-- descarta um envio ou substitui um ativo; o objeto é removido pelo cliente (policy de delete do host)
create function public.discard_asset(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare a public.event_assets;
begin
  select * into a from public.event_assets where id = p_id for update;
  if not found then return; end if; -- idempotente
  if not public.is_host(a.event_id) or public.event_theme_locked(a.event_id) then raise exception 'forbidden' using errcode = 'MM004'; end if;
  delete from public.event_assets where id = p_id;
  perform public.audit(a.event_id, 'asset.discarded', jsonb_build_object('asset', a.id, 'kind', a.kind));
end $$;

-- ---------------------------------------------------------------- execução
revoke execute on all functions in schema public from public, anon;
grant execute on function public.branding_event_from_path(text), public.can_upload_branding(text), public.can_read_branding(text),
  public.can_delete_branding(text), public.begin_asset(uuid, uuid, text, text, int, int), public.finalize_asset(uuid), public.discard_asset(uuid) to authenticated;
