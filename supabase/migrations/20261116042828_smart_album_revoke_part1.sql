-- Aplicada em produção em 16/11/2026 04:28 (via conector): permissões das funções da parte 1 da 20261116000200 (aplicada sem o bloco final).
revoke execute on function public.smart_album_ui_enabled(uuid), public.smart_album_legal_gate(), public.smart_album_face_consent_version(),
  public.smart_album_set_item(uuid, text, boolean), public.smart_album_my_items(uuid) from public, anon;
revoke execute on function public.smart_album_legal_gate(), public.smart_album_face_consent_version() from authenticated;
grant execute on function public.smart_album_ui_enabled(uuid), public.smart_album_set_item(uuid, text, boolean), public.smart_album_my_items(uuid) to authenticated;
