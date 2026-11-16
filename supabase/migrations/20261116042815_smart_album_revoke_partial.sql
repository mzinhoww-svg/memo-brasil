-- Aplicada em produção em 16/11/2026 04:28 (via conector): durante a aplicação em partes da 20261116000200, as funções de leitura entraram
-- antes do bloco de permissões. Fecha o EXECUTE padrão (PUBLIC/anon) e deixa o "como titular" só para o service_role.
revoke execute on function public.smart_album_eligible_photo_ids(uuid, uuid), public.smart_album_audit(uuid, text, jsonb) from public, anon, authenticated;
revoke execute on function public.can_upload_face_reference(text), public.smart_album_can_use(uuid), public.smart_album_state(uuid),
  public.smart_album_list_matches(uuid, int, timestamptz), public.smart_album_face_enabled(uuid) from public, anon;
grant execute on function public.smart_album_eligible_photo_ids(uuid, uuid) to service_role;
grant execute on function public.can_upload_face_reference(text), public.smart_album_can_use(uuid), public.smart_album_state(uuid),
  public.smart_album_list_matches(uuid, int, timestamptz), public.smart_album_face_enabled(uuid) to authenticated;
