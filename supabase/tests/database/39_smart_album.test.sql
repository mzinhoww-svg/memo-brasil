-- pgTAP · Revela Smart Album (Minhas Fotos): chaves desligadas por padrão, álbum pessoal preso a can_see_photo, isolamento por evento e
-- titular, gate jurídico + versão aprovada + allowlist para a busca facial, referência em bucket privado, revelação, worker que só grava
-- fotos elegíveis, match que não concede acesso, ocultação, bloqueio, revogação com purga e append-only do consentimento.
begin;
select no_plan();

create schema tests;
create function tests.login(p_user uuid, p_role text default null, p_anon boolean default false) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated', 'is_anonymous', p_anon, 'aal', 'aal2',
    'app_metadata', case when p_role is not null then json_build_object('role', p_role) else '{}'::json end)::text, true);
  set local role authenticated;
end $$;
grant usage on schema tests to authenticated;

-- a1 host · a2 Ana (convidada X) · a3 Bia (convidada X) · a4 Caio (convidado Y) · a5 anônimo (convidado X) · a6 master · a7 Duda (convidada P, não revelado)
insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-4000-8000-0000000039a1', 'host39@test.local', false),
  ('00000000-0000-4000-8000-0000000039a2', 'ana39@test.local', false),
  ('00000000-0000-4000-8000-0000000039a3', 'bia39@test.local', false),
  ('00000000-0000-4000-8000-0000000039a4', 'caio39@test.local', false),
  ('00000000-0000-4000-8000-0000000039a5', null, true),
  ('00000000-0000-4000-8000-0000000039a6', 'master39@test.local', false),
  ('00000000-0000-4000-8000-0000000039a7', 'duda39@test.local', false);
insert into public.profiles (id) select id from auth.users where id::text like '00000000-0000-4000-8000-0000000039a%' on conflict do nothing;
insert into public.platform_roles (user_id, role) values ('00000000-0000-4000-8000-0000000039a6', 'master');
-- X: revelado (fotos na hora), cada um vê só as próprias (everyone_sees_all = false) · Y: outro evento revelado · P: revelação no futuro
insert into public.events (id, title, category, host_id, host_name, duration_hours, capacity, shots_per_person, reveal_enabled, reveal_at, everyone_sees_all) values
  ('00000000-0000-4000-8000-0000000039e1', 'Smart X', 'casamento', '00000000-0000-4000-8000-0000000039a1', 'Host 39', 6, 20, 10, false, null, false),
  ('00000000-0000-4000-8000-0000000039e2', 'Smart Y', 'festa', '00000000-0000-4000-8000-0000000039a1', 'Host 39', 6, 20, 10, false, null, true),
  ('00000000-0000-4000-8000-0000000039e3', 'Smart P', 'festa', '00000000-0000-4000-8000-0000000039a1', 'Host 39', 6, 20, 10, true, now() + interval '3 days', true);
insert into public.participants (event_id, user_id, name) values
  ('00000000-0000-4000-8000-0000000039e1', '00000000-0000-4000-8000-0000000039a2', 'Ana'),
  ('00000000-0000-4000-8000-0000000039e1', '00000000-0000-4000-8000-0000000039a3', 'Bia'),
  ('00000000-0000-4000-8000-0000000039e1', '00000000-0000-4000-8000-0000000039a5', 'Anônimo'),
  ('00000000-0000-4000-8000-0000000039e2', '00000000-0000-4000-8000-0000000039a4', 'Caio'),
  ('00000000-0000-4000-8000-0000000039e3', '00000000-0000-4000-8000-0000000039a7', 'Duda');
-- f1 Ana em X · f2 Bia em X (Ana NÃO vê: everyone_sees_all = false) · f3 Caio em Y · f4 Ana em X (será removida) · f5 Duda em P (não revelado)
insert into public.photos (id, event_id, author_id, author_name, storage_path, upload_status) values
  ('00000000-0000-4000-8000-0000000039f1', '00000000-0000-4000-8000-0000000039e1', '00000000-0000-4000-8000-0000000039a2', 'Ana', '00000000-0000-4000-8000-0000000039e1/00000000-0000-4000-8000-0000000039f1', 'pronta'),
  ('00000000-0000-4000-8000-0000000039f2', '00000000-0000-4000-8000-0000000039e1', '00000000-0000-4000-8000-0000000039a3', 'Bia', '00000000-0000-4000-8000-0000000039e1/00000000-0000-4000-8000-0000000039f2', 'pronta'),
  ('00000000-0000-4000-8000-0000000039f3', '00000000-0000-4000-8000-0000000039e2', '00000000-0000-4000-8000-0000000039a4', 'Caio', '00000000-0000-4000-8000-0000000039e2/00000000-0000-4000-8000-0000000039f3', 'pronta'),
  ('00000000-0000-4000-8000-0000000039f4', '00000000-0000-4000-8000-0000000039e1', '00000000-0000-4000-8000-0000000039a2', 'Ana', '00000000-0000-4000-8000-0000000039e1/00000000-0000-4000-8000-0000000039f4', 'pronta'),
  ('00000000-0000-4000-8000-0000000039f5', '00000000-0000-4000-8000-0000000039e3', '00000000-0000-4000-8000-0000000039a7', 'Duda', '00000000-0000-4000-8000-0000000039e3/00000000-0000-4000-8000-0000000039f5', 'pronta');

-- ===================================================================== padrão: tudo desligado
-- (a 20261116000300 publica o termo v1 aprovado; aqui ele é desaprovado na transação para provar cada gate isoladamente)
update public.face_consent_documents set approved = false where version = '2026-11-16-v1';
select is((select count(*)::int from public.feature_flags where key like 'smart_album%'), 0, 'sem linhas: as duas chaves nascem desligadas');
select is((select count(*)::int from public.face_consent_documents where approved), 0, 'nenhuma versão do consentimento biométrico está aprovada');
select is((select public from storage.buckets where id = 'face-references'), false, 'bucket da referência é privado');
select tests.login('00000000-0000-4000-8000-0000000039a2');
select is(public.smart_album_ui_enabled('00000000-0000-4000-8000-0000000039e1'), false, 'álbum pessoal desligado por padrão');
select is(public.smart_album_face_enabled('00000000-0000-4000-8000-0000000039e1'), false, 'busca facial desligada por padrão');
select throws_ok($$select public.smart_album_set_item('00000000-0000-4000-8000-0000000039f1', 'favorite', true)$$, 'MM019', null, 'chave desligada: favoritar é recusado');
select is(public.smart_album_state('00000000-0000-4000-8000-0000000039e1') -> 'face' ->> 'available', 'false', 'estado informa busca indisponível');
select throws_ok($$select public.smart_album_grant_face_consent('00000000-0000-4000-8000-0000000039e1', '2026-11-16-rascunho', 'upload', true)$$, 'MM019', null, 'sem chave/gate: consentimento biométrico recusado');
-- nenhum acesso direto às tabelas biométricas nem escrita direta no álbum
select throws_ok($$select count(*) from public.face_consents$$, '42501', null, 'cliente não lê face_consents');
select throws_ok($$select count(*) from public.face_profiles$$, '42501', null, 'cliente não lê face_profiles');
select throws_ok($$select count(*) from public.face_search_jobs$$, '42501', null, 'cliente não lê face_search_jobs');
select throws_ok($$select count(*) from public.face_photo_matches$$, '42501', null, 'cliente não lê face_photo_matches');
select throws_ok($$insert into public.personal_photo_items (event_id, user_id, photo_id, kind) values ('00000000-0000-4000-8000-0000000039e1', '00000000-0000-4000-8000-0000000039a2', '00000000-0000-4000-8000-0000000039f1', 'favorite')$$,
  '42501', null, 'sem INSERT direto em personal_photo_items');
select throws_ok($$select public.smart_album_worker_claim(5)$$, '42501', null, 'cliente não chama o worker');
select throws_ok($$select public.smart_album_eligible_photo_ids('00000000-0000-4000-8000-0000000039e1', '00000000-0000-4000-8000-0000000039a2')$$, '42501', null, 'cliente não chama a consulta "como titular"');
reset role;
set local role anon;
select throws_ok($$select public.smart_album_state('00000000-0000-4000-8000-0000000039e1')$$, '42501', null, 'anon não chama as RPCs');
reset role;

-- ===================================================================== álbum pessoal (chave ligada)
select tests.login('00000000-0000-4000-8000-0000000039a6', 'master');
select lives_ok($$select public.admin_set_feature_flag('smart_album_ui', true, '{}'::jsonb, 'Liberar o álbum pessoal no laboratório')$$, 'master liga smart_album_ui com motivo');
reset role;
select tests.login('00000000-0000-4000-8000-0000000039a2');
select is(public.smart_album_set_item('00000000-0000-4000-8000-0000000039f1', 'favorite', true), true, 'Ana favorita a própria foto revelada');
select is(public.smart_album_set_item('00000000-0000-4000-8000-0000000039f1', 'favorite', true), true, 'favoritar de novo é idempotente');
select throws_ok($$select public.smart_album_set_item('00000000-0000-4000-8000-0000000039f2', 'favorite', true)$$, 'MM004', null, 'Ana não favorita foto que não vê (everyone_sees_all = false)');
select throws_ok($$select public.smart_album_set_item('00000000-0000-4000-8000-0000000039f3', 'favorite', true)$$, 'MM004', null, 'Ana não favorita foto de outro evento');
select throws_ok($$select public.smart_album_set_item('00000000-0000-4000-8000-0000000039ff', 'favorite', true)$$, 'MM004', null, 'foto inexistente responde igual a proibida (sem enumeração)');
select throws_ok($$select public.smart_album_set_item('00000000-0000-4000-8000-0000000039f1', 'outro', true)$$, 'MM005', null, 'tipo inválido');
select is(public.smart_album_set_item('00000000-0000-4000-8000-0000000039f4', 'selected', true), true, 'Ana seleciona outra foto');
select is((select count(*)::int from public.smart_album_my_items('00000000-0000-4000-8000-0000000039e1')), 2, 'Ana lista os 2 itens');
select is((select count(*)::int from public.personal_photo_items), 2, 'pela tabela, Ana lê só os próprios itens');
reset role;
select tests.login('00000000-0000-4000-8000-0000000039a3');
select is((select count(*)::int from public.smart_album_my_items('00000000-0000-4000-8000-0000000039e1')), 0, 'Bia não vê os itens de Ana');
select is((select count(*)::int from public.personal_photo_items), 0, 'pela tabela, Bia não lê itens de Ana');
reset role;
select tests.login('00000000-0000-4000-8000-0000000039a7');
select throws_ok($$select public.smart_album_set_item('00000000-0000-4000-8000-0000000039f5', 'favorite', true)$$, 'MM004', null, 'antes da revelação nem a própria foto pode ser favoritada');
reset role;
update public.photos set status = 'removida' where id = '00000000-0000-4000-8000-0000000039f4';
select tests.login('00000000-0000-4000-8000-0000000039a2');
select is((select array_agg(photo_id::text) from public.smart_album_my_items('00000000-0000-4000-8000-0000000039e1')), array['00000000-0000-4000-8000-0000000039f1'], 'foto removida pela moderação sai do álbum pessoal na hora');
select is(public.smart_album_set_item('00000000-0000-4000-8000-0000000039f1', 'favorite', false), false, 'desfavoritar');
select is((select count(*)::int from public.smart_album_my_items('00000000-0000-4000-8000-0000000039e1')), 0, 'sem itens visíveis');
reset role;
-- remoção é terminal (photos_guard grava deleted_at e purga): f4 fica fora de tudo daqui em diante

-- ===================================================================== busca facial: cada gate sozinho não abre
select tests.login('00000000-0000-4000-8000-0000000039a6', 'master');
select lives_ok($$select public.admin_set_feature_flag('smart_album_face_matching', true, '{"events":["00000000-0000-4000-8000-0000000039e1","00000000-0000-4000-8000-0000000039e3"]}'::jsonb, 'Laboratório da busca facial (sem gate)')$$, 'master liga a chave do motor com allowlist');
select is(public.smart_album_face_enabled('00000000-0000-4000-8000-0000000039e1'), false, 'chave + allowlist sem gate jurídico: continua desligada');
select lives_ok($$select public.admin_set_setting('smart_album.legal_gate', '{"approved":true,"opinion_ref":"PAR-TESTE-39","approved_by":"jurídico de teste"}'::jsonb, 'Gate de teste no banco descartável')$$, 'master registra o gate');
select is(public.smart_album_face_enabled('00000000-0000-4000-8000-0000000039e1'), false, 'gate sem versão aprovada do consentimento: continua desligada');
reset role;
insert into public.face_consent_documents (version, approved) values ('2026-11-16-teste', true);
select tests.login('00000000-0000-4000-8000-0000000039a2');
select is(public.smart_album_face_enabled('00000000-0000-4000-8000-0000000039e1'), true, 'todos os gates: liberada para o evento X');
select is(public.smart_album_face_enabled('00000000-0000-4000-8000-0000000039e2'), false, 'evento fora da allowlist continua desligado');
select throws_ok($$select public.smart_album_grant_face_consent('00000000-0000-4000-8000-0000000039e1', '2026-11-16-rascunho', 'upload', true)$$, 'MM005', null, 'versão não aprovada/atual é recusada');
select throws_ok($$select public.smart_album_grant_face_consent('00000000-0000-4000-8000-0000000039e1', '2026-11-16-teste', 'upload', false)$$, 'MM005', null, 'sem afirmar titularidade não há consentimento');
select throws_ok($$select public.smart_album_begin_reference('00000000-0000-4000-8000-0000000039e1', 'upload')$$, 'MM020', null, 'sem consentimento não há referência');
select throws_ok($$select public.smart_album_request_search('00000000-0000-4000-8000-0000000039e1', 'idem-ana-0001')$$, 'MM020', null, 'sem consentimento não há job');
select throws_ok($$select * from public.smart_album_list_matches('00000000-0000-4000-8000-0000000039e1')$$, 'MM020', null, 'sem consentimento não há resultados');
select throws_ok($$select public.smart_album_state('00000000-0000-4000-8000-0000000039e2')$$, 'MM004', null, 'Ana não lê o estado de um evento em que não está');
select throws_ok($$select public.smart_album_grant_face_consent('00000000-0000-4000-8000-0000000039e2', '2026-11-16-teste', 'upload', true)$$, 'MM004', null, 'Ana não consente em evento alheio');
select isnt(public.smart_album_grant_face_consent('00000000-0000-4000-8000-0000000039e1', '2026-11-16-teste', 'upload', true), null, 'Ana consente (versão aprovada, titularidade afirmada)');
select is((public.smart_album_state('00000000-0000-4000-8000-0000000039e1') -> 'face' ->> 'consented'), 'true', 'estado mostra consentimento ativo');
reset role;
select tests.login('00000000-0000-4000-8000-0000000039a5', null, true);
select throws_ok($$select public.smart_album_grant_face_consent('00000000-0000-4000-8000-0000000039e1', '2026-11-16-teste', 'upload', true)$$, 'MM004', null, 'sessão anônima não consente');
reset role;
select is((select count(*)::int from public.audit_logs where action = 'smart_album.consent_granted' and event_id is null and detail ->> 'event' = '00000000-0000-4000-8000-0000000039e1'), 1, 'aceite auditado (sem dado biométrico, sem event_id)');
select tests.login('00000000-0000-4000-8000-0000000039a1');
select is((select count(*)::int from public.audit_logs where action like 'smart_album.%'), 0, 'anfitrião NÃO vê na trilha quem consentiu à busca facial');
reset role;
select tests.login('00000000-0000-4000-8000-0000000039a4');
select is((public.smart_album_revoke_face('00000000-0000-4000-8000-0000000039e1') ->> 'status'), 'done', 'revogar sem nada a apagar responde "done"');
select is((public.smart_album_revoke_face('00000000-0000-4000-8000-0000000000ff') ->> 'status'), 'done', 'revogar em evento qualquer não falha…');
reset role;
select is((select count(*)::int from public.audit_logs where action like 'smart_album.%' and actor_id = '00000000-0000-4000-8000-0000000039a4'), 0, '…e não grava nada na trilha (sem poluição)');

-- append-only
select throws_ok($$update public.face_consents set source = 'google' where user_id = '00000000-0000-4000-8000-0000000039a2'$$, 'MM005', null, 'consentimento é append-only (só a revogação muda)');

-- ===================================================================== referência privada
select tests.login('00000000-0000-4000-8000-0000000039a2');
select ok((public.smart_album_begin_reference('00000000-0000-4000-8000-0000000039e1', 'upload') ->> 'path') like '00000000-0000-4000-8000-0000000039e1/00000000-0000-4000-8000-0000000039a2/%', 'referência no caminho evento/titular/perfil');
reset role;
create temporary table ref on commit drop as select reference_storage_path as path, id from public.face_profiles where user_id = '00000000-0000-4000-8000-0000000039a2' and status = 'pending';
grant select on ref to authenticated;
select tests.login('00000000-0000-4000-8000-0000000039a3');
select throws_ok($$insert into storage.objects (bucket_id, name) select 'face-references', path from ref$$, '42501', null, 'Bia não envia no caminho de Ana');
reset role;
select tests.login('00000000-0000-4000-8000-0000000039a2');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('face-references', '00000000-0000-4000-8000-0000000039e1/00000000-0000-4000-8000-0000000039a2/00000000-0000-4000-8000-000000000000')$$, '42501', null, 'Ana não envia fora do caminho do perfil pendente');
select lives_ok($$insert into storage.objects (bucket_id, name) select 'face-references', path from ref$$, 'Ana envia a referência no próprio caminho');
select is((select count(*)::int from storage.objects where bucket_id = 'face-references'), 0, 'nem a titular lê o objeto da referência (sem política de leitura)');
select throws_ok($$insert into storage.objects (bucket_id, name) select 'face-references', path from ref$$, '42501', null, 'não sobrescreve nem reenvia no mesmo caminho');
reset role;

-- ===================================================================== revelação e job
select tests.login('00000000-0000-4000-8000-0000000039a7');
select isnt(public.smart_album_grant_face_consent('00000000-0000-4000-8000-0000000039e3', '2026-11-16-teste', 'camera', true), null, 'Duda consente no evento P (ainda não revelado)');
select throws_ok($$select public.smart_album_request_search('00000000-0000-4000-8000-0000000039e3', 'idem-duda-0001')$$, 'MM017', null, 'antes da revelação: nenhum job');
select ok((public.smart_album_begin_reference('00000000-0000-4000-8000-0000000039e3', 'camera') ->> 'path') is not null, 'Duda pode preparar a referência antes da revelação');
select throws_ok($$select * from public.smart_album_list_matches('00000000-0000-4000-8000-0000000039e3')$$, 'MM017', null, 'antes da revelação: nenhum resultado');
reset role;
select tests.login('00000000-0000-4000-8000-0000000039a2');
select throws_ok($$select public.smart_album_request_search('00000000-0000-4000-8000-0000000039e1', 'x')$$, 'MM005', null, 'chave de idempotência inválida');
select is((public.smart_album_request_search('00000000-0000-4000-8000-0000000039e1', 'idem-ana-0001') ->> 'status'), 'queued', 'job enfileirado');
select is((public.smart_album_request_search('00000000-0000-4000-8000-0000000039e1', 'idem-ana-0001') ->> 'status'), 'queued', 'mesma chave: mesmo job');
select is((select count(*)::int from public.smart_album_list_matches('00000000-0000-4000-8000-0000000039e1')), 0, 'sem resultados enquanto processa');
reset role;

-- ===================================================================== worker (service_role)
set local role service_role;
create temporary table claimed on commit drop as select public.smart_album_worker_claim(5) as j;
reset role;
select is((select jsonb_array_length(j) from claimed), 1, 'worker pega 1 job');
select is((select (j -> 0 -> 'photoIds') from claimed), '["00000000-0000-4000-8000-0000000039f1"]'::jsonb,
  'elegíveis = só o que Ana vê na galeria (não a foto de Bia, nem outro evento, nem a removida)');
set local role service_role;
-- o motor (simulado) "acha" f1, f2 (Ana não vê), f3 (outro evento) e um id inexistente: só f1 pode ficar
select is(public.smart_album_worker_complete((select (j -> 0 ->> 'jobId')::uuid from claimed),
  '[{"photoId":"00000000-0000-4000-8000-0000000039f1","band":"probable"},{"photoId":"00000000-0000-4000-8000-0000000039f2","band":"probable"},{"photoId":"00000000-0000-4000-8000-0000000039f3","band":"review"},{"photoId":"00000000-0000-4000-8000-0000000039fe","band":"probable"}]'::jsonb,
  2, 'fake-engine-0'), 1, 'worker grava só a foto elegível');
reset role;
select is((select status from public.face_search_jobs where idempotency_key = 'idem-ana-0001'), 'completed', 'job concluído');
select is((select status from public.face_profiles where user_id = '00000000-0000-4000-8000-0000000039a2' and status <> 'erased'), 'ready', 'perfil pronto');

select tests.login('00000000-0000-4000-8000-0000000039a2');
select is((select array_agg(photo_id::text || ':' || band) from public.smart_album_list_matches('00000000-0000-4000-8000-0000000039e1')), array['00000000-0000-4000-8000-0000000039f1:probable'], 'Ana vê só a foto elegível, sem score');
select is((public.smart_album_state('00000000-0000-4000-8000-0000000039e1') -> 'face' ->> 'matches'), '1', 'contagem segura = 1');
reset role;
select tests.login('00000000-0000-4000-8000-0000000039a3');
select throws_ok($$select * from public.smart_album_list_matches('00000000-0000-4000-8000-0000000039e1')$$, 'MM020', null, 'Bia (sem consentimento) não vê resultados de Ana');
reset role;
select tests.login('00000000-0000-4000-8000-0000000039a1');
select throws_ok($$select * from public.face_photo_matches$$, '42501', null, 'anfitrião não lê resultados/perfis faciais pelo painel');
select is((public.smart_album_state('00000000-0000-4000-8000-0000000039e1') -> 'face' ->> 'consented'), 'false', 'anfitrião só vê o próprio estado');
reset role;

-- match não concede acesso: foto moderada some do resultado na hora
update public.photos set status = 'oculta' where id = '00000000-0000-4000-8000-0000000039f1';
select tests.login('00000000-0000-4000-8000-0000000039a2');
select is((select count(*)::int from public.smart_album_list_matches('00000000-0000-4000-8000-0000000039e1')), 0, 'foto oculta pela moderação sai dos resultados');
reset role;
update public.photos set status = 'visivel' where id = '00000000-0000-4000-8000-0000000039f1';

-- ocultar falso positivo: não volta nem em nova busca
select tests.login('00000000-0000-4000-8000-0000000039a2');
select lives_ok($$select public.smart_album_hide_match('00000000-0000-4000-8000-0000000039e1', '00000000-0000-4000-8000-0000000039f1')$$, 'Ana oculta o resultado');
select is((select count(*)::int from public.smart_album_list_matches('00000000-0000-4000-8000-0000000039e1')), 0, 'oculto não aparece');
select is((public.smart_album_request_search('00000000-0000-4000-8000-0000000039e1', 'idem-ana-0002') ->> 'status'), 'queued', 'nova busca');
reset role;
set local role service_role;
create temporary table claimed2 on commit drop as select public.smart_album_worker_claim(5) as j;
select is(public.smart_album_worker_complete((select (j -> 0 ->> 'jobId')::uuid from claimed2), '[{"photoId":"00000000-0000-4000-8000-0000000039f1","band":"probable"}]'::jsonb, 2, 'fake-engine-0'), 1, 'motor acha f1 de novo');
reset role;
select tests.login('00000000-0000-4000-8000-0000000039a2');
select is((select count(*)::int from public.smart_album_list_matches('00000000-0000-4000-8000-0000000039e1')), 0, 'o que a pessoa ocultou não volta');
reset role;

-- falha do worker: retry limitado
select tests.login('00000000-0000-4000-8000-0000000039a2');
select is((public.smart_album_request_search('00000000-0000-4000-8000-0000000039e1', 'idem-ana-0003') ->> 'status'), 'queued', 'terceira busca');
reset role;
set local role service_role;
create temporary table claimed3 on commit drop as select public.smart_album_worker_claim(5) as j;
select is(public.smart_album_worker_fail((select (j -> 0 ->> 'jobId')::uuid from claimed3), 'engine_timeout'), 'queued', 'falha transitória volta à fila');
select throws_ok($$select public.smart_album_worker_fail((select (j -> 0 ->> 'jobId')::uuid from claimed3), 'Erro com PII')$$, 'MM005', null, 'código de erro não aceita texto livre');
reset role;
-- referência rejeitada pelo motor (simulado num job à parte, em savepoint): perfil em erro, caminho zerado, objeto na fila de purga
savepoint ref_invalid;
set local role service_role;
create temporary table claimed4 on commit drop as select public.smart_album_worker_claim(5) as j;
select is(public.smart_album_worker_fail((select (j -> 0 ->> 'jobId')::uuid from claimed4), 'no_face', true), 'failed', 'referência sem rosto: falha definitiva');
reset role;
select is((select count(*)::int from public.face_profiles where user_id = '00000000-0000-4000-8000-0000000039a2' and status = 'error' and reference_storage_path is null), 1, 'perfil em erro sem caminho guardado');
select ok(exists(select 1 from public.storage_purge_queue q join ref on q.path = ref.path where q.bucket = 'face-references'), 'referência rejeitada vai para a purga');
rollback to savepoint ref_invalid;

-- bloqueio do participante revoga a consulta
update public.participants set blocked_at = now() where event_id = '00000000-0000-4000-8000-0000000039e1' and user_id = '00000000-0000-4000-8000-0000000039a2';
select tests.login('00000000-0000-4000-8000-0000000039a2');
select throws_ok($$select * from public.smart_album_list_matches('00000000-0000-4000-8000-0000000039e1')$$, 'MM004', null, 'bloqueada: sem resultados');
reset role;
set local role service_role;
select is((select jsonb_array_length(public.smart_album_worker_claim(5))), 1, 'job da bloqueada ainda é pego…');
reset role;
select is((select eligible_photos_count from public.face_search_jobs where idempotency_key = 'idem-ana-0003'), 0, '…mas sem nenhuma foto elegível');
set local role service_role;
select is(public.smart_album_expire(), 1, 'expiração apaga os dados da titular bloqueada');
reset role;
select is((select revoked_reason from public.face_consents where user_id = '00000000-0000-4000-8000-0000000039a2' order by granted_at desc limit 1), 'bloqueado', 'consentimento encerrado como bloqueado');
select is((select count(*)::int from public.face_photo_matches where user_id = '00000000-0000-4000-8000-0000000039a2'), 0, 'resultados apagados');
select is((select status from public.face_search_jobs where idempotency_key = 'idem-ana-0003'), 'cancelled', 'job cancelado');
select ok(exists(select 1 from public.storage_purge_queue q join ref on q.path = ref.path where q.bucket = 'face-references'), 'referência enfileirada para purga do bucket privado');
update public.participants set blocked_at = null where event_id = '00000000-0000-4000-8000-0000000039e1' and user_id = '00000000-0000-4000-8000-0000000039a2';

-- ===================================================================== revogação pelo titular (funciona mesmo com a chave desligada)
select tests.login('00000000-0000-4000-8000-0000000039a2');
select isnt(public.smart_album_grant_face_consent('00000000-0000-4000-8000-0000000039e1', '2026-11-16-teste', 'google', true), null, 'Ana consente de novo');
select ok((public.smart_album_begin_reference('00000000-0000-4000-8000-0000000039e1', 'google') ->> 'profileId') is not null, 'nova referência');
reset role;
select tests.login('00000000-0000-4000-8000-0000000039a6', 'master');
select lives_ok($$select public.admin_set_feature_flag('smart_album_face_matching', false, '{}'::jsonb, 'Desligar o motor (kill switch)')$$, 'kill switch do motor');
reset role;
select tests.login('00000000-0000-4000-8000-0000000039a2');
select throws_ok($$select * from public.smart_album_list_matches('00000000-0000-4000-8000-0000000039e1')$$, 'MM019', null, 'chave desligada: nenhum resultado sai');
select is((public.smart_album_revoke_face('00000000-0000-4000-8000-0000000039e1') ->> 'status'), 'purge_queued', 'revogar com a chave desligada: purga enfileirada (sem falso "apagado")');
select is((public.smart_album_state('00000000-0000-4000-8000-0000000039e1') -> 'face' ->> 'consented'), 'false', 'sem consentimento ativo');
select is((public.smart_album_revoke_face('00000000-0000-4000-8000-0000000039e1') ->> 'status'), 'done', 'revogar de novo é idempotente');
reset role;
select is((select count(*)::int from public.face_profiles where user_id = '00000000-0000-4000-8000-0000000039a2' and (status <> 'erased' or reference_storage_path is not null)), 0, 'nenhum perfil ativo nem caminho guardado');
select is((select count(*)::int from public.face_consents where user_id = '00000000-0000-4000-8000-0000000039a2' and revoked_at is null), 0, 'histórico preservado, todos revogados');
select ok(exists(select 1 from public.audit_logs where action = 'smart_album.consent_revoked'), 'revogação auditada');
select ok(not exists(select 1 from public.audit_logs where action like 'smart_album.%' and detail::text ~ '(face-references|/00000000-0000-4000-8000-0000000039a2/)'), 'auditoria sem caminho de referência');

-- cascata: excluir o evento leva todos os dados faciais, e a referência ainda guardada vai para a purga (não fica órfã)
create temporary table duda_ref on commit drop as select reference_storage_path as path from public.face_profiles where event_id = '00000000-0000-4000-8000-0000000039e3' and reference_storage_path is not null;
select is((select count(*)::int from duda_ref), 1, 'Duda tem referência guardada');
delete from public.events where id = '00000000-0000-4000-8000-0000000039e3';
select is((select count(*)::int from public.face_consents where event_id = '00000000-0000-4000-8000-0000000039e3'), 0, 'evento excluído: consentimentos/perfis/jobs somem em cascata');
select ok(exists(select 1 from public.storage_purge_queue q join duda_ref d on q.path = d.path where q.bucket = 'face-references'), 'exclusão física enfileira a referência para purga');

-- quem sai do evento (participação apagada, ex.: exclusão de conta) tem os dados apagados pela expiração
select tests.login('00000000-0000-4000-8000-0000000039a6', 'master');
select lives_ok($$select public.admin_set_feature_flag('smart_album_face_matching', true, '{"events":["00000000-0000-4000-8000-0000000039e1"]}'::jsonb, 'Religar para o teste de saída')$$, 'religa a busca');
reset role;
select tests.login('00000000-0000-4000-8000-0000000039a3');
select isnt(public.smart_album_grant_face_consent('00000000-0000-4000-8000-0000000039e1', '2026-11-16-teste', 'upload', true), null, 'Bia consente');
select ok((public.smart_album_begin_reference('00000000-0000-4000-8000-0000000039e1', 'upload') ->> 'path') is not null, 'Bia prepara a referência');
reset role;
delete from public.participants where event_id = '00000000-0000-4000-8000-0000000039e1' and user_id = '00000000-0000-4000-8000-0000000039a3';
set local role service_role;
select is(public.smart_album_expire(), 1, 'expiração apaga os dados de quem saiu do evento');
reset role;
select is((select count(*)::int from public.face_consents where user_id = '00000000-0000-4000-8000-0000000039a3' and revoked_at is null), 0, 'consentimento de quem saiu encerrado');

select * from finish();
rollback;
