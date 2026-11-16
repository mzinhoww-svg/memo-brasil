-- pgTAP · motivo da denúncia (foto e comentário): coluna com check, RPCs com p_reason opcional, contagem por motivo sem identificar quem denunciou.
begin;
select no_plan();

create schema tests;
create function tests.login(p_user uuid, p_master boolean default false) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated', 'is_anonymous', false, 'aal', 'aal2',
    'app_metadata', case when p_master then json_build_object('role', 'master') else '{}'::json end)::text, true);
  set local role authenticated;
end $$;
grant usage on schema tests to authenticated;

insert into auth.users (id, aud, role, email, is_anonymous) values
  ('00000000-0000-4000-8000-000000003101', 'authenticated', 'authenticated', 'host31@test.local', false),
  ('00000000-0000-4000-8000-000000003102', 'authenticated', 'authenticated', 'gA31@test.local', false),
  ('00000000-0000-4000-8000-000000003103', 'authenticated', 'authenticated', 'gB31@test.local', false),
  ('00000000-0000-4000-8000-000000003104', 'authenticated', 'authenticated', 'master31@test.local', false),
  ('00000000-0000-4000-8000-000000003105', 'authenticated', 'authenticated', 'other31@test.local', false);
insert into public.profiles (id) select id from auth.users where email like '%31@test.local' on conflict do nothing;
insert into public.platform_roles (user_id, role) values ('00000000-0000-4000-8000-000000003104', 'master');

insert into public.events (id, title, category, host_id, host_name, duration_hours, capacity, shots_per_person, reveal_enabled, reveal_anchor) values
  ('00000000-0000-4000-8000-0000000031e1', 'Reasons 31', 'outro', '00000000-0000-4000-8000-000000003101', 'Host 31', 6, 20, 10, false, 'fim');
insert into public.participants (event_id, user_id, name) values
  ('00000000-0000-4000-8000-0000000031e1', '00000000-0000-4000-8000-000000003102', 'Ana 31'),
  ('00000000-0000-4000-8000-0000000031e1', '00000000-0000-4000-8000-000000003103', 'Bia 31');
insert into public.photos (id, event_id, author_id, author_name, storage_path, upload_status) values
  ('00000000-0000-4000-8000-0000000031f1', '00000000-0000-4000-8000-0000000031e1', '00000000-0000-4000-8000-000000003101', 'Host 31',
   '00000000-0000-4000-8000-0000000031e1/00000000-0000-4000-8000-0000000031f1', 'pronta');
insert into public.photo_comments (id, photo_id, event_id, author_id, author_name, body) values
  ('00000000-0000-4000-8000-0000000031c1', '00000000-0000-4000-8000-0000000031f1', '00000000-0000-4000-8000-0000000031e1', '00000000-0000-4000-8000-000000003101', 'Host 31', 'comentário 31');

-- foto
select tests.login('00000000-0000-4000-8000-000000003102');
select lives_ok($$select public.report_photo('00000000-0000-4000-8000-0000000031f1', 'nao_quero_aparecer')$$, 'denúncia de foto com motivo');
select throws_ok($$select public.report_photo('00000000-0000-4000-8000-0000000031f1', 'inventado')$$, 'MM005', null, 'motivo fora da lista é recusado');
select throws_ok($$select public.report_photo('00000000-0000-4000-8000-0000000031f1', 'spam')$$, 'MM005', null, 'motivo de comentário não vale para foto');
reset role;
select tests.login('00000000-0000-4000-8000-000000003103');
select lives_ok($$select public.report_photo('00000000-0000-4000-8000-0000000031f1')$$, 'assinatura antiga (só a foto) segue valendo');
reset role;
select tests.login('00000000-0000-4000-8000-000000003105');
select throws_ok($$select public.report_photo('00000000-0000-4000-8000-0000000031f1', 'outro')$$, 'MM004', null, 'quem não vê a foto não denuncia');
reset role;
select is((select reports from public.photos where id = '00000000-0000-4000-8000-0000000031f1'), 2, 'contador de denúncias da foto');
select is((select reason from public.photo_reports where user_id = '00000000-0000-4000-8000-000000003102'), 'nao_quero_aparecer', 'motivo gravado');
select is((select reason from public.photo_reports where user_id = '00000000-0000-4000-8000-000000003103'), null, 'sem motivo fica null');

-- comentário
select tests.login('00000000-0000-4000-8000-000000003102');
select is((public.report_comment('00000000-0000-4000-8000-0000000031c1', 'ofensivo') ->> 'reports')::int, 1, 'denúncia de comentário com motivo');
select throws_ok($$select public.report_comment('00000000-0000-4000-8000-0000000031c1', 'constrangedora')$$, 'MM005', null, 'motivo de foto não vale para comentário');
reset role;
select tests.login('00000000-0000-4000-8000-000000003103');
select is((public.report_comment('00000000-0000-4000-8000-0000000031c1') ->> 'reports')::int, 2, 'assinatura antiga do comentário segue valendo');
reset role;

-- leitura agregada
select tests.login('00000000-0000-4000-8000-000000003101');
select is(public.report_reasons('00000000-0000-4000-8000-0000000031e1') -> 'photos' -> '00000000-0000-4000-8000-0000000031f1',
  '{"nao_quero_aparecer": 1, "sem_motivo": 1}'::jsonb, 'anfitrião vê a contagem por motivo da foto');
select is(public.report_reasons('00000000-0000-4000-8000-0000000031e1') -> 'comments' -> '00000000-0000-4000-8000-0000000031c1',
  '{"ofensivo": 1, "sem_motivo": 1}'::jsonb, 'e a do comentário');
select ok(public.report_reasons('00000000-0000-4000-8000-0000000031e1')::text !~ '3102|3103', 'sem identificar quem denunciou');
reset role;
select tests.login('00000000-0000-4000-8000-000000003102');
select throws_ok($$select public.report_reasons('00000000-0000-4000-8000-0000000031e1')$$, 'MM004', null, 'convidado não lê os motivos');
select throws_ok($$select * from public.photo_reports$$, '42501', null, 'tabela de denúncias segue sem leitura direta');
reset role;

-- Master M09
select tests.login('00000000-0000-4000-8000-000000003104', true);
select is((select x -> 'reasons' from jsonb_array_elements(public.admin_moderation_queue() -> 'photos') x where x ->> 'photoId' = '00000000-0000-4000-8000-0000000031f1'),
  '{"nao_quero_aparecer": 1, "sem_motivo": 1}'::jsonb, 'fila do Master traz motivos da foto');
select is((select x -> 'reasons' from jsonb_array_elements(public.admin_moderation_queue() -> 'comments') x where x ->> 'id' = '00000000-0000-4000-8000-0000000031c1'),
  '{"ofensivo": 1, "sem_motivo": 1}'::jsonb, 'e do comentário');
select ok(public.admin_moderation_queue()::text !~ '3102|3103', 'fila do Master não identifica quem denunciou');
select ok(public.report_reasons('00000000-0000-4000-8000-0000000031e1') is not null, 'Master lê os motivos de qualquer evento');
reset role;

select * from finish();
rollback;
