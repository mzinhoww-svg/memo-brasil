-- Validação real de logo/capa: só a Edge Function `finalize-asset` (service_role) confirma um ativo, depois de inspecionar os bytes.
-- Aditiva. O cliente deixa de poder chamar finalize_asset (o MIME e as dimensões que ele declara não eram autoridade).

create function public.mark_asset_validated(p_id uuid, p_user uuid, p_width int, p_height int, p_bytes int, p_mime text) returns void
language plpgsql security definer set search_path = '' as $$
declare a public.event_assets; host uuid; cap int;
begin
  select * into a from public.event_assets where id = p_id for update;
  if not found or a.created_by is distinct from p_user then raise exception 'forbidden' using errcode = 'MM004'; end if;
  select e.host_id into host from public.events e where e.id = a.event_id;
  if host is distinct from p_user then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if public.event_theme_locked(a.event_id) then raise exception 'revealed' using errcode = 'MM008'; end if;
  cap := 5242880;
  if a.kind = 'logo' then cap := 2097152; end if;
  if p_mime not in ('image/jpeg', 'image/png', 'image/webp') or p_width not between 16 and 8192 or p_height not between 16 and 8192
     or p_bytes <= 0 or p_bytes > cap then
    raise exception 'invalid' using errcode = 'MM005';
  end if;
  if a.upload_status = 'pronta' then return; end if;
  update public.event_assets set upload_status = 'pronta', bytes = p_bytes, width = p_width, height = p_height, mime = p_mime where id = p_id;
  insert into public.audit_logs (actor_id, actor_role, event_id, action, target_type, target_id, detail)
  values (p_user, 'organizador', a.event_id, 'asset.published', 'asset', a.id::text, jsonb_build_object('kind', a.kind, 'validated', true, 'width', p_width, 'height', p_height));
end $$;
revoke execute on function public.mark_asset_validated(uuid, uuid, int, int, int, text) from public, anon, authenticated;
grant execute on function public.mark_asset_validated(uuid, uuid, int, int, int, text) to service_role;

-- o cliente não finaliza mais por conta própria
revoke execute on function public.finalize_asset(uuid) from public, anon, authenticated;
