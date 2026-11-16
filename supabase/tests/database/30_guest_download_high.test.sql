-- pgTAP · events.guest_download_high e photo_download_allowed (convidado só baixa foto de outros quando o anfitrião permite).
begin;
select no_plan();

create schema tests;
create function tests.login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated', 'is_anonymous', false, 'aal', 'aal2', 'app_metadata', '{}'::json)::text, true);
  set local role authenticated;
end $$;
grant usage on schema tests to authenticated;

insert into auth.users (id, aud, role, email, is_anonymous) values
  ('00000000-0000-4000-8000-000000003201', 'authenticated', 'authenticated', 'host32@test.local', false),
  ('00000000-0000-4000-8000-000000003202', 'authenticated', 'authenticated', 'gA32@test.local', false),
  ('00000000-0000-4000-8000-000000003203', 'authenticated', 'authenticated', 'gB32@test.local', false),
  ('00000000-0000-4000-8000-000000003204', 'authenticated', 'authenticated', 'out32@test.local', false);
insert into public.profiles (id) select id from auth.users where email like '%32@test.local' on conflict do nothing;

insert into public.events (id, title, category, host_id, host_name, duration_hours, capacity, shots_per_person, reveal_enabled, reveal_anchor) values
  ('00000000-0000-4000-8000-0000000032e1', 'Download 32 padrão', 'outro', '00000000-0000-4000-8000-000000003201', 'Host 32', 6, 20, 10, false, 'fim');
insert into public.events (id, title, category, host_id, host_name, duration_hours, capacity, shots_per_person, reveal_enabled, reveal_anchor, guest_download_high) values
  ('00000000-0000-4000-8000-0000000032e2', 'Download 32 fechado', 'outro', '00000000-0000-4000-8000-000000003201', 'Host 32', 6, 20, 10, false, 'fim', false);
insert into public.participants (event_id, user_id, name) values
  ('00000000-0000-4000-8000-0000000032e1', '00000000-0000-4000-8000-000000003202', 'Ana 32'),
  ('00000000-0000-4000-8000-0000000032e1', '00000000-0000-4000-8000-000000003203', 'Bia 32'),
  ('00000000-0000-4000-8000-0000000032e2', '00000000-0000-4000-8000-000000003202', 'Ana 32'),
  ('00000000-0000-4000-8000-0000000032e2', '00000000-0000-4000-8000-000000003203', 'Bia 32');
insert into public.photos (id, event_id, author_id, author_name, storage_path, upload_status) values
  ('00000000-0000-4000-8000-0000000032a1', '00000000-0000-4000-8000-0000000032e1', '00000000-0000-4000-8000-000000003203', 'Bia 32', '00000000-0000-4000-8000-0000000032e1/00000000-0000-4000-8000-0000000032a1', 'pronta'),
  ('00000000-0000-4000-8000-0000000032a2', '00000000-0000-4000-8000-0000000032e2', '00000000-0000-4000-8000-000000003203', 'Bia 32', '00000000-0000-4000-8000-0000000032e2/00000000-0000-4000-8000-0000000032a2', 'pronta'),
  ('00000000-0000-4000-8000-0000000032a3', '00000000-0000-4000-8000-0000000032e2', '00000000-0000-4000-8000-000000003202', 'Ana 32', '00000000-0000-4000-8000-0000000032e2/00000000-0000-4000-8000-0000000032a3', 'pronta');

select is((select guest_download_high from public.events where id = '00000000-0000-4000-8000-0000000032e1'), true, 'padrão: permitido (eventos existentes não mudam)');
select is((select guest_download_high from public.events where id = '00000000-0000-4000-8000-0000000032e2'), false, 'a coluna grava falso');

select tests.login('00000000-0000-4000-8000-000000003202');
select is(public.photo_download_allowed('00000000-0000-4000-8000-0000000032a1'), true, 'permitido: convidado baixa foto de outro');
select is(public.photo_download_allowed('00000000-0000-4000-8000-0000000032a2'), false, 'fechado: convidado não baixa foto de outro');
select is(public.photo_download_allowed('00000000-0000-4000-8000-0000000032a3'), true, 'fechado: baixa a própria foto');
select is((select guest_download_high from public.events where id = '00000000-0000-4000-8000-0000000032e2'), false, 'convidado lê o valor do evento');
update public.events set guest_download_high = true where id = '00000000-0000-4000-8000-0000000032e2';
reset role;
select is((select guest_download_high from public.events where id = '00000000-0000-4000-8000-0000000032e2'), false, 'convidado não altera o campo');
select tests.login('00000000-0000-4000-8000-000000003202');
reset role;

select tests.login('00000000-0000-4000-8000-000000003201');
select is(public.photo_download_allowed('00000000-0000-4000-8000-0000000032a2'), true, 'anfitrião baixa sempre');
update public.events set guest_download_high = true where id = '00000000-0000-4000-8000-0000000032e2';
reset role;
select is((select guest_download_high from public.events where id = '00000000-0000-4000-8000-0000000032e2'), true, 'anfitrião liga de novo');
select tests.login('00000000-0000-4000-8000-000000003202');
select is(public.photo_download_allowed('00000000-0000-4000-8000-0000000032a2'), true, 'ligado de novo: convidado baixa');
reset role;

select tests.login('00000000-0000-4000-8000-000000003204');
select throws_ok($$select public.photo_download_allowed('00000000-0000-4000-8000-0000000032a1')$$, 'MM004', null, 'quem não vê a foto não baixa');
reset role;
select throws_ok($$select public.photo_download_allowed('00000000-0000-4000-8000-0000000032a1')$$, 'MM004', null, 'sem sessão é recusado');

select * from finish();
rollback;
