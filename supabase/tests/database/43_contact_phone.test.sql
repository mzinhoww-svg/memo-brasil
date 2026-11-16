-- pgTAP · número guardado na conta: só a própria conta grava/lê, normaliza, campanhas só com autorização explícita, esquecer apaga.
begin;
select no_plan();

insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-4000-8000-0000000043a1', null, true),
  ('00000000-0000-4000-8000-0000000043a2', null, true),
  ('00000000-0000-4000-8000-0000000043a3', 'master43@test.local', false);
insert into public.platform_roles (user_id, role) values ('00000000-0000-4000-8000-0000000043a3', 'master');

select is(public.normalize_br_phone('(65) 99999-0000'), '5565999990000', 'normaliza celular com DDD');
select is(public.normalize_br_phone('+55 65 3322-1100'), '556533221100', 'normaliza fixo com +55');
select is(public.normalize_br_phone('065999990000'), '5565999990000', 'tira o zero do DDD');
select is(public.normalize_br_phone('12345'), null, 'curto demais: inválido');
select is(public.normalize_br_phone('(00) 99999-0000'), null, 'DDD inválido');
select ok(exists (select 1 from public.legal_documents where kind = 'privacy' and version = '2026-11-16-v4'), 'Política v4 publicada');
select ok(exists (select 1 from public.legal_documents where kind = 'terms' and version = '2026-11-16-v3'), 'Termos v3 publicados');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-0000000043a1', 'role', 'authenticated')::text, true);

select throws_ok($$select public.save_my_phone('123')$$, 'MM005', null, 'número inválido: recusa');
select lives_ok($$select public.save_my_phone('(65) 99999-0000', false)$$, 'guarda o número');
select is((select phone from public.user_contact_phone), '5565999990000', 'vê o próprio número, normalizado');
select is((select marketing_optin from public.user_contact_phone), false, 'campanhas desligadas por padrão');
select is((select privacy_version from public.user_contact_phone), '2026-11-16-v4', 'registra a versão da Política');

select lives_ok($$select public.save_my_phone('65 98888-7777', true)$$, 'autoriza campanhas');
select is((select marketing_optin and marketing_optin_at is not null and marketing_revoked_at is null from public.user_contact_phone), true, 'autorização com data');
select is((select phone from public.user_contact_phone), '5565988887777', 'troca o número');
select lives_ok($$select public.save_my_phone('65 98888-7777')$$, 'sem resposta sobre campanhas');
select is((select marketing_optin from public.user_contact_phone), true, 'null mantém a autorização');
select is(public.set_my_marketing(false), true, 'retira a autorização');
select is((select not marketing_optin and marketing_revoked_at is not null from public.user_contact_phone), true, 'retirada com data');

select throws_ok($$insert into public.user_contact_phone (user_id, phone, privacy_version) values ('00000000-0000-4000-8000-0000000043a2', '5565999990000', 'x')$$, '42501', null, 'cliente não insere direto');
select throws_ok($$update public.user_contact_phone set marketing_optin = true$$, '42501', null, 'cliente não altera direto');

-- outra conta não vê nada
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-0000000043a2', 'role', 'authenticated')::text, true);
select is((select count(*)::int from public.user_contact_phone), 0, 'outra conta não vê o número');
select is(public.set_my_marketing(true), false, 'sem número guardado: nada a autorizar');

-- equipe lê para campanhas
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-0000000043a3', 'role', 'authenticated', 'app_metadata', json_build_object('role', 'master'))::text, true);
select is((select count(*)::int from public.user_contact_phone where user_id = '00000000-0000-4000-8000-0000000043a1'), 1, 'equipe lê');

-- esquecer
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-0000000043a1', 'role', 'authenticated')::text, true);
select lives_ok($$select public.forget_my_phone()$$, 'esquecer o número');
select is((select count(*)::int from public.user_contact_phone), 0, 'apagado');
reset role;

set local role anon;
select throws_ok($$select public.save_my_phone('65999990000')$$, '42501', null, 'sem login: não grava');
reset role;

select * from finish();
rollback;
