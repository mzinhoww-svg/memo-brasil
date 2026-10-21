-- MemoriesMT · 3/6 · Storage privado para as fotos. Caminho: {event_id}/{photo_id} (+ ".thumb" para miniatura).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-photos', 'event-photos', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 8388608, allowed_mime_types = excluded.allowed_mime_types;

-- extrai o id da foto do caminho (null se o caminho não segue a convenção)
create function public.photo_id_from_path(p_name text) returns uuid
language sql immutable set search_path = '' as $$
  select case when p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(\.thumb)?$'
    then split_part(split_part(p_name, '/', 2), '.', 1)::uuid end
$$;

-- subir: só o autor, só no caminho da própria foto que ainda está 'enviando'
create function public.can_upload_object(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.photos ph
    where ph.id = public.photo_id_from_path(p_name) and ph.author_id = auth.uid() and ph.upload_status = 'enviando'
      and (ph.storage_path = p_name or ph.storage_path || '.thumb' = p_name))
$$;

-- ler/assinar URL: exatamente a regra de visibilidade da foto (host vê tudo não removido; convidado só revelada e visível)
create function public.can_read_object(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.can_see_photo(public.photo_id_from_path(p_name)), false)
$$;

-- apagar: host, ou o autor enquanto a foto ainda não foi publicada
create function public.can_delete_object(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.photos ph
    where ph.id = public.photo_id_from_path(p_name)
      and (public.is_host(ph.event_id) or (ph.author_id = auth.uid() and ph.upload_status <> 'pronta')))
$$;
grant execute on function public.photo_id_from_path(text), public.can_upload_object(text), public.can_read_object(text), public.can_delete_object(text) to authenticated;

create policy "event_photos_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'event-photos' and public.can_upload_object(name));
create policy "event_photos_select" on storage.objects for select to authenticated
  using (bucket_id = 'event-photos' and public.can_read_object(name));
create policy "event_photos_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'event-photos' and public.can_delete_object(name));
-- sem policy de UPDATE: ninguém sobrescreve objeto existente (sem upsert)
