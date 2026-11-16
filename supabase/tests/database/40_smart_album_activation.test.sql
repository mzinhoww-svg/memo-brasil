-- pgTAP · ativação: rollout {"all": true} libera em qualquer evento (com os demais gates), versão v1 aprovada, chave desligada desliga tudo.
begin;
select no_plan();
insert into auth.users (id, email, is_anonymous) values ('00000000-0000-4000-8000-0000000040a1', 'host40@test.local', false);
insert into public.profiles (id) values ('00000000-0000-4000-8000-0000000040a1') on conflict do nothing;
insert into public.events (id, title, category, host_id, host_name, duration_hours, capacity, shots_per_person, reveal_enabled) values
  ('00000000-0000-4000-8000-0000000040e1', 'Ativação 40', 'festa', '00000000-0000-4000-8000-0000000040a1', 'Host 40', 6, 20, 10, false);
select is(public.smart_album_face_consent_version(), '2026-11-16-v2', 'termo v2 (consentimento de conta) é a versão aprovada vigente');
insert into public.feature_flags (key, enabled, rollout) values ('smart_album_face_matching', true, '{"all": true}');
select is(public.smart_album_face_enabled('00000000-0000-4000-8000-0000000040e1'), false, 'all sem gate jurídico: continua desligada');
insert into public.platform_settings (key, value) values ('smart_album.legal_gate', '{"approved": true, "opinion_ref": "teste-40", "approved_by": "teste-40"}');
select is(public.smart_album_face_enabled('00000000-0000-4000-8000-0000000040e1'), true, 'all + gate: liberada em qualquer evento');
update public.feature_flags set rollout = '{"all": false}' where key = 'smart_album_face_matching';
select is(public.smart_album_face_enabled('00000000-0000-4000-8000-0000000040e1'), false, 'all=false sem allowlist: desligada');
update public.feature_flags set rollout = '{"all": true}', enabled = false where key = 'smart_album_face_matching';
select is(public.smart_album_face_enabled('00000000-0000-4000-8000-0000000040e1'), false, 'chave desligada (kill switch) desliga mesmo com all');
select * from finish();
rollback;
