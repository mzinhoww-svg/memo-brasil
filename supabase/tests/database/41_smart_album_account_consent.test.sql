-- pgTAP · Smart Album com consentimento único por conta (termo v2): aceite uma vez, selfie de conta, busca automática no servidor ao
-- revelar e com fotos novas, organizador desliga no evento, revogação apaga tudo em todos os eventos, expiração em 12 meses.
begin;
select no_plan();

create schema tests41;
create function tests41.login(p_user uuid, p_anon boolean default false) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated', 'is_anonymous', p_anon)::text, true);
  set local role authenticated;
end $$;
grant usage on schema tests41 to authenticated;

-- h host · g Gil (convidado em X, Y e P) · n anônimo (convidado em X) · o Olga (sem evento)
insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-4000-8000-0000000041a1', 'host41@test.local', false),
  ('00000000-0000-4000-8000-0000000041a2', 'gil41@test.local', false),
  ('00000000-0000-4000-8000-0000000041a3', null, true),
  ('00000000-0000-4000-8000-0000000041a4', 'olga41@test.local', false);
insert into public.profiles (id) select id from auth.users where id::text like '00000000-0000-4000-8000-0000000041a%' on conflict do nothing;
-- X revelado · Y revelado (organizador vai desligar a busca) · P revela no futuro
insert into public.events (id, title, category, host_id, host_name, duration_hours, capacity, shots_per_person, reveal_enabled, reveal_at, everyone_sees_all) values
  ('00000000-0000-4000-8000-0000000041e1', 'Conta X', 'casamento', '00000000-0000-4000-8000-0000000041a1', 'Host 41', 6, 20, 10, false, null, true),
  ('00000000-0000-4000-8000-0000000041e2', 'Conta Y', 'festa', '00000000-0000-4000-8000-0000000041a1', 'Host 41', 6, 20, 10, false, null, true),
  ('00000000-0000-4000-8000-0000000041e3', 'Conta P', 'festa', '00000000-0000-4000-8000-0000000041a1', 'Host 41', 6, 20, 10, true, now() + interval '3 days', true);
insert into public.participants (event_id, user_id, name) values
  ('00000000-0000-4000-8000-0000000041e1', '00000000-0000-4000-8000-0000000041a2', 'Gil'),
  ('00000000-0000-4000-8000-0000000041e2', '00000000-0000-4000-8000-0000000041a2', 'Gil'),
  ('00000000-0000-4000-8000-0000000041e3', '00000000-0000-4000-8000-0000000041a2', 'Gil'),
  ('00000000-0000-4000-8000-0000000041e1', '00000000-0000-4000-8000-0000000041a3', 'Anônimo');
insert into public.photos (id, event_id, author_id, author_name, storage_path, upload_status, created_at) values
  ('00000000-0000-4000-8000-0000000041f1', '00000000-0000-4000-8000-0000000041e1', '00000000-0000-4000-8000-0000000041a1', 'Host', '00000000-0000-4000-8000-0000000041e1/00000000-0000-4000-8000-0000000041f1', 'pronta', now() - interval '1 hour'),
  ('00000000-0000-4000-8000-0000000041f2', '00000000-0000-4000-8000-0000000041e2', '00000000-0000-4000-8000-0000000041a1', 'Host', '00000000-0000-4000-8000-0000000041e2/00000000-0000-4000-8000-0000000041f2', 'pronta', now() - interval '1 hour'),
  ('00000000-0000-4000-8000-0000000041f3', '00000000-0000-4000-8000-0000000041e3', '00000000-0000-4000-8000-0000000041a1', 'Host', '00000000-0000-4000-8000-0000000041e3/00000000-0000-4000-8000-0000000041f3', 'pronta', now() - interval '1 hour');

-- ===================================================================== gates
select is(public.smart_album_face_consent_version(), '2026-11-16-v2', 'v2 é o termo vigente');
insert into public.platform_settings (key, value) values ('smart_album.legal_gate', '{"approved": true, "opinion_ref": "teste-41", "approved_by": "teste-41"}')
  on conflict (key) do update set value = excluded.value;
insert into public.feature_flags (key, enabled, rollout) values ('smart_album_face_matching', true, '{"events": ["00000000-0000-4000-8000-0000000041e1"]}')
  on conflict (key) do update set enabled = true, rollout = excluded.rollout;
select tests41.login('00000000-0000-4000-8000-0000000041a2');
select is((public.smart_album_account_status() ->> 'available')::boolean, false, 'só allowlist de eventos: aceite de conta indisponível');
select throws_ok($$select public.smart_album_grant_account_consent('2026-11-16-v2', 'entrada', true)$$, 'MM019', null, 'sem rollout all não aceita conta');
reset role;
update public.feature_flags set rollout = '{"all": true}' where key = 'smart_album_face_matching';

-- ===================================================================== aceite único
select tests41.login('00000000-0000-4000-8000-0000000041a3', true);
select throws_ok($$select public.smart_album_grant_account_consent('2026-11-16-v2', 'entrada', true)$$, 'MM004', null, 'conta anônima não aceita');
reset role;
select tests41.login('00000000-0000-4000-8000-0000000041a2');
select throws_ok($$select public.smart_album_grant_account_consent('2026-11-16-v1', 'entrada', true)$$, 'MM005', null, 'versão antiga recusada');
select throws_ok($$select public.smart_album_grant_account_consent('2026-11-16-v2', 'entrada', false)$$, 'MM005', null, 'sem autodeclaração recusada');
create temporary table c1 on commit drop as select public.smart_album_grant_account_consent('2026-11-16-v2', 'entrada', true) as id;
select is((select public.smart_album_grant_account_consent('2026-11-16-v2', 'entrada', true)), (select id from c1), 'aceitar de novo devolve o mesmo consentimento');
select is((public.smart_album_account_status() ->> 'consented')::boolean, true, 'status de conta: consentido');
select is(public.smart_album_account_status() ->> 'profile', null, 'ainda sem selfie');
select is(public.smart_album_state('00000000-0000-4000-8000-0000000041e1') -> 'face' ->> 'scope', 'account', 'evento X enxerga o aceite de conta (sem pedir de novo)');
select is((public.smart_album_state('00000000-0000-4000-8000-0000000041e2') -> 'face' ->> 'consented')::boolean, true, 'evento Y também');
reset role;
select is((select event_id from public.face_consents where id = (select id from c1)), null, 'consentimento gravado sem evento (escopo de conta)');
select is((select retention_policy_version from public.face_consents where id = (select id from c1)), 'smart-album-conta-12m', 'retenção de conta registrada');

-- ===================================================================== selfie de conta
select tests41.login('00000000-0000-4000-8000-0000000041a2');
select ok((public.smart_album_begin_account_reference('camera') ->> 'path') like 'conta/00000000-0000-4000-8000-0000000041a2/%', 'selfie no caminho conta/titular/perfil');
reset role;
create temporary table ref41 on commit drop as select reference_storage_path as path from public.face_profiles where user_id = '00000000-0000-4000-8000-0000000041a2' and event_id is null and status = 'pending';
grant select on ref41 to authenticated;
select ok((select expires_at from public.face_profiles where reference_storage_path = (select path from ref41)) > now() + interval '11 months', 'selfie de conta vale 12 meses');
select tests41.login('00000000-0000-4000-8000-0000000041a4');
select throws_ok($$insert into storage.objects (bucket_id, name) select 'face-references', path from ref41$$, '42501', null, 'outra conta não envia no caminho de Gil');
reset role;
select tests41.login('00000000-0000-4000-8000-0000000041a2');
select lives_ok($$insert into storage.objects (bucket_id, name) select 'face-references', path from ref41$$, 'Gil envia a própria selfie de conta');
reset role;

-- ===================================================================== organizador desliga no evento
select tests41.login('00000000-0000-4000-8000-0000000041a2');
select throws_ok($$select public.set_event_face_search('00000000-0000-4000-8000-0000000041e2', false)$$, 'MM004', null, 'convidado não desliga a busca do evento');
reset role;
select tests41.login('00000000-0000-4000-8000-0000000041a1');
select lives_ok($$select public.set_event_face_search('00000000-0000-4000-8000-0000000041e2', false)$$, 'organizador desliga a busca no evento Y');
reset role;
select tests41.login('00000000-0000-4000-8000-0000000041a2');
select is((public.smart_album_state('00000000-0000-4000-8000-0000000041e2') -> 'face' ->> 'available')::boolean, false, 'Y: busca indisponível');
select is((public.smart_album_state('00000000-0000-4000-8000-0000000041e2') -> 'face' ->> 'hostDisabled')::boolean, true, 'Y: motivo = organizador desligou');
reset role;

-- ===================================================================== busca automática (servidor)
select tests41.login('00000000-0000-4000-8000-0000000041a2');
select throws_ok($$select public.smart_album_enqueue_auto(5)$$, '42501', null, 'cliente não enfileira busca automática');
select throws_ok($$select public.smart_album_erase_account('00000000-0000-4000-8000-0000000041a2', 'x')$$, '42501', null, 'cliente não chama erase_account');
reset role;
select is(public.smart_album_enqueue_auto(5), 1, 'só X recebe busca automática (Y desligado, P não revelado)');
select is((select event_id from public.face_search_jobs where user_id = '00000000-0000-4000-8000-0000000041a2'), '00000000-0000-4000-8000-0000000041e1'::uuid, 'job automático é do evento X');
select is(public.smart_album_enqueue_auto(5), 0, 'job ativo: não duplica');
create temporary table claim41 on commit drop as select public.smart_album_worker_claim(5) as j;
select is((select j -> 0 ->> 'referencePath' from claim41), (select path from ref41), 'worker recebe a selfie de conta');
select is(public.smart_album_worker_complete(((select j -> 0 ->> 'jobId' from claim41))::uuid, '[{"photoId":"00000000-0000-4000-8000-0000000041f1","band":"probable"}]', 1, 'opencv-yunet-sface.t2'), 1, 'resultado gravado em X');
select is((select status from public.face_profiles where reference_storage_path = (select path from ref41)), 'ready', 'selfie de conta fica pronta');
select is(public.smart_album_enqueue_auto(5), 0, 'sem foto nova depois da busca: não repete');
-- ===================================================================== pré-processamento durante o evento
-- foto nova NÃO gera busca por pessoa: entra na fila de análise e é comparada uma vez com as selfies de quem autorizou
insert into public.photos (id, event_id, author_id, author_name, storage_path, upload_status) values
  ('00000000-0000-4000-8000-0000000041f4', '00000000-0000-4000-8000-0000000041e1', '00000000-0000-4000-8000-0000000041a1', 'Host', '00000000-0000-4000-8000-0000000041e1/00000000-0000-4000-8000-0000000041f4', 'pronta'),
  ('00000000-0000-4000-8000-0000000041f5', '00000000-0000-4000-8000-0000000041e3', '00000000-0000-4000-8000-0000000041a1', 'Host', '00000000-0000-4000-8000-0000000041e3/00000000-0000-4000-8000-0000000041f5', 'pronta'),
  ('00000000-0000-4000-8000-0000000041f6', '00000000-0000-4000-8000-0000000041e2', '00000000-0000-4000-8000-0000000041a1', 'Host', '00000000-0000-4000-8000-0000000041e2/00000000-0000-4000-8000-0000000041f6', 'pronta');
select is((select count(*)::int from public.photo_analysis where status = 'queued'), 2, 'fotos novas de X e P entram na fila; a de Y (organizador desligou) não');
select is(public.smart_album_enqueue_auto(5), 0, 'foto nova não cria busca por pessoa');
select tests41.login('00000000-0000-4000-8000-0000000041a2');
select throws_ok($$select public.smart_album_worker_claim_photos(8)$$, '42501', null, 'cliente não reserva fotos para análise');
select throws_ok($$select public.smart_album_worker_complete_photos('[]', '[]', '[]', 'x')$$, '42501', null, 'cliente não grava análise');
select throws_ok($$select count(*) from public.photo_analysis$$, '42501', null, 'cliente não lê a tabela de análise');
reset role;
create temporary table pre41 on commit drop as select public.smart_album_worker_claim_photos(8) as j;
select is(jsonb_array_length((select j -> 'photos' from pre41)), 2, 'worker recebe as 2 fotos');
select is((select count(*)::int from jsonb_array_elements((select j -> 'refs' from pre41)) x where x ->> 'referencePath' = (select path from ref41)), 2, 'a selfie de Gil vale para X e para P (participa dos dois)');
select is(public.smart_album_worker_complete_photos(
  jsonb_build_array(
    jsonb_build_object('photoId', '00000000-0000-4000-8000-0000000041f4', 'faces', 3, 'sharpness', 120.5, 'matches', jsonb_build_array(
      jsonb_build_object('profileId', (select id from public.face_profiles where reference_storage_path = (select path from ref41)), 'band', 'review'),
      jsonb_build_object('profileId', '00000000-0000-4000-8000-00000000dead', 'band', 'probable'))),
    jsonb_build_object('photoId', '00000000-0000-4000-8000-0000000041f5', 'faces', 1, 'sharpness', 80, 'matches', jsonb_build_array(
      jsonb_build_object('profileId', (select id from public.face_profiles where reference_storage_path = (select path from ref41)), 'band', 'probable')))),
  '[]', '[]', 'opencv-yunet-sface.t3'), 2, 'grava só os resultados de perfis válidos (perfil inexistente é ignorado)');
select is((select kind from public.photo_analysis where photo_id = '00000000-0000-4000-8000-0000000041f4'), 'grupo', '3 rostos = grupo');
select is((select kind from public.photo_analysis where photo_id = '00000000-0000-4000-8000-0000000041f5'), 'retrato', '1 rosto = retrato');
select is(public.smart_album_enqueue_auto(5), 0, 'tudo coberto: nenhuma busca por pessoa');
select tests41.login('00000000-0000-4000-8000-0000000041a2');
select is((select count(*)::int from public.smart_album_list_matches('00000000-0000-4000-8000-0000000041e1', 30, null)), 2, 'Gil vê os resultados em X (busca + pré-processamento)');
select throws_ok($$select * from public.smart_album_list_matches('00000000-0000-4000-8000-0000000041e3', 30, null)$$, 'MM017', null, 'P não revelou: o resultado pré-processado fica fechado');
select is(public.smart_album_state('00000000-0000-4000-8000-0000000041e3') -> 'face' ->> 'matches', null, 'P não revelou: nem a contagem aparece');
reset role;
-- quem entra depois: fotos já analisadas pedem uma busca de recuperação
insert into auth.users (id, email, is_anonymous) values ('00000000-0000-4000-8000-0000000041a5', 'lia41@test.local', false);
insert into public.profiles (id) values ('00000000-0000-4000-8000-0000000041a5') on conflict do nothing;
select tests41.login('00000000-0000-4000-8000-0000000041a5');
select lives_ok($$select public.smart_album_grant_account_consent('2026-11-16-v2', 'entrada', true)$$, 'Lia autoriza na conta');
create temporary table lia41 on commit drop as select public.smart_album_begin_account_reference('camera') ->> 'path' as path;
select lives_ok($$insert into storage.objects (bucket_id, name) select 'face-references', path from lia41$$, 'Lia envia a selfie');
reset role;
select is(public.smart_album_enqueue_auto(5), 0, 'Lia não participa de nenhum evento: nada a buscar');
insert into public.participants (event_id, user_id, name, joined_at) values ('00000000-0000-4000-8000-0000000041e1', '00000000-0000-4000-8000-0000000041a5', 'Lia', now() + interval '1 second');
select is(public.smart_album_enqueue_auto(5), 1, 'Lia entrou em X depois das análises: busca de recuperação');
select is(public.smart_album_enqueue_auto(5), 0, 'e só uma');
reset role;

-- ===================================================================== revogação apaga tudo, em todos os eventos
select tests41.login('00000000-0000-4000-8000-0000000041a2');
select is((public.smart_album_revoke_account() ->> 'revoked')::int, 1, 'revogar a conta retira o consentimento');
select is((public.smart_album_state('00000000-0000-4000-8000-0000000041e1') -> 'face' ->> 'consented')::boolean, false, 'X: sem consentimento');
select throws_ok($$select * from public.smart_album_list_matches('00000000-0000-4000-8000-0000000041e1', 30, null)$$, 'MM020', null, 'X: resultados fechados');
reset role;
select is((select count(*)::int from public.face_photo_matches where user_id = '00000000-0000-4000-8000-0000000041a2'), 0, 'resultados apagados');
select is((select count(*)::int from public.face_search_jobs where user_id = '00000000-0000-4000-8000-0000000041a2' and status in ('queued', 'processing')), 0, 'buscas em andamento canceladas');
select is((select count(*)::int from public.storage_purge_queue where path = (select path from ref41)), 1, 'selfie na fila de purga');
select is((select reference_storage_path from public.face_profiles where user_id = '00000000-0000-4000-8000-0000000041a2' and event_id is null), null, 'perfil sem caminho');
select throws_ok($$update public.face_consents set event_id = '00000000-0000-4000-8000-0000000041e1' where id = (select id from c1)$$, 'MM005', null, 'append-only: consentimento de conta não vira de evento');

-- ===================================================================== expiração (12 meses)
select tests41.login('00000000-0000-4000-8000-0000000041a2');
select lives_ok($$select public.smart_album_grant_account_consent('2026-11-16-v2', 'camera', true)$$, 'aceitar de novo depois de revogar');
select lives_ok($$select public.smart_album_begin_account_reference('camera')$$, 'nova selfie');
reset role;
update public.face_profiles set expires_at = now() - interval '1 day' where user_id = '00000000-0000-4000-8000-0000000041a2' and event_id is null and status = 'pending';
select ok(public.smart_album_expire() >= 1, 'expiração processa a selfie vencida');
select is((select count(*)::int from public.face_consents where user_id = '00000000-0000-4000-8000-0000000041a2' and event_id is null and revoked_at is null), 0, 'aceite vence junto com a selfie');
select is((select count(*)::int from public.face_consents where user_id = '00000000-0000-4000-8000-0000000041a2' and event_id is null and revoked_reason = 'expirado'), 1, 'motivo: expirado');

select * from finish();
rollback;
