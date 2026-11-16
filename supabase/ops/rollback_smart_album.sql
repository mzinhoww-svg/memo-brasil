-- Reversão de 20261116000100_smart_album.sql (Revela Smart Album · Minhas Fotos).
-- Só objetos criados por aquela migration; nada existente é tocado. Rodar numa transação, no SQL Editor, com service_role.
-- ANTES de rodar: (1) desligar as chaves `smart_album_ui` e `smart_album_face_matching` pelo Master; (2) se houve uso da busca facial,
-- deixar o purge-storage esvaziar a fila de `face-references` (ou remover os objetos do bucket pelo painel) — o bucket só é apagado vazio.
begin;
drop policy if exists "face_references_insert" on storage.objects;
drop function if exists public.can_upload_face_reference(text);
-- o bucket `face-references` (privado, sem política restante) fica: o Storage proíbe DELETE por SQL. Remover pelo painel/API depois de vazio.

drop function if exists public.smart_album_expire();
drop function if exists public.smart_album_worker_fail(uuid, text, boolean);
drop function if exists public.smart_album_worker_complete(uuid, jsonb, int, text);
drop function if exists public.smart_album_worker_claim(int);
drop function if exists public.smart_album_eligible_photo_ids(uuid, uuid);
drop function if exists public.smart_album_revoke_face(uuid);
drop function if exists public.smart_album_hide_match(uuid, uuid);
drop function if exists public.smart_album_list_matches(uuid, int, timestamptz);
drop function if exists public.smart_album_request_search(uuid, text);
drop function if exists public.smart_album_begin_reference(uuid, text);
drop function if exists public.smart_album_grant_face_consent(uuid, text, text, boolean);
drop function if exists public.smart_album_state(uuid);
drop function if exists public.smart_album_erase(uuid, uuid, text);
drop function if exists public.smart_album_audit(uuid, text, jsonb);
drop function if exists public.smart_album_can_use(uuid);
drop function if exists public.smart_album_my_items(uuid);
drop function if exists public.smart_album_set_item(uuid, text, boolean);

drop table if exists public.face_photo_matches;
drop table if exists public.face_search_jobs;
drop table if exists public.face_profiles;
drop function if exists public.face_profiles_purge_on_delete();
drop table if exists public.face_consents;
drop function if exists public.face_consents_append_only();
drop table if exists public.personal_photo_items;

drop function if exists public.smart_album_face_enabled(uuid);
drop function if exists public.smart_album_face_consent_version();
drop table if exists public.face_consent_documents;
drop function if exists public.smart_album_legal_gate();
drop function if exists public.smart_album_ui_enabled(uuid);

delete from public.platform_settings where key = 'smart_album.legal_gate';
delete from public.feature_flags where key in ('smart_album_ui', 'smart_album_face_matching');
delete from supabase_migrations.schema_migrations where version = '20261116000100';
commit;
