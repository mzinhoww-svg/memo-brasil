-- pgTAP · estatísticas de acesso (primeira parte, sem cookies/IP): coleta com validação e limites, leitura só da equipe, agregações.
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
  ('00000000-0000-4000-8000-0000000041a1', 'authenticated', 'authenticated', 'staff41@test.local', false),
  ('00000000-0000-4000-8000-0000000041b1', 'authenticated', 'authenticated', 'user41@test.local', false);
insert into public.profiles (id) select id from auth.users where email like '%41@test.local' on conflict do nothing;
insert into public.platform_roles (user_id, role) values ('00000000-0000-4000-8000-0000000041a1', 'master');

-- ===================================================== coleta (anon)
set local role anon;
select is(public.record_access('aaaaaaaa11111111', '/', true, 'Google', 'orgânico', null, 'www.google.com', 'celular', 'Chrome', 'Android', 'BR'), true, 'coleta válida grava');
select is(public.record_access('aaaaaaaa11111111', '/e/:codigo/agora', false, null, null, null, null, 'celular', 'Chrome', 'Android', 'BR'), true, 'página interna do mesmo visitante');
select is(public.record_access('bbbbbbbb22222222', '/criar', true, 'Instagram', 'social', 'lancamento', 'l.instagram.com', 'computador', 'Safari', 'macOS', 'BR'), true, 'entrada com campanha');
select is(public.record_access('cccccccc33333333', '/', true, null, 'direto', null, null, 'tablet', 'Safari', 'iOS', null), true, 'entrada direta sem país');
select is(public.record_access('dddd', '/', true, null, null, null, null, 'celular', null, null, null), false, 'visitante curto demais é descartado');
select is(public.record_access('aaaaaaaa11111111', '/e/ABCD1234?x=1', true, null, null, null, null, 'celular', null, null, null), false, 'caminho com query/maiúsculas fora do padrão é descartado');
select is(public.record_access('aaaaaaaa11111111', '/<script>', true, null, null, null, null, 'celular', null, null, null), false, 'caminho com caracteres perigosos é descartado');
select is(public.record_access('aaaaaaaa11111111', '/', true, null, null, null, null, 'geladeira', null, null, null), false, 'aparelho desconhecido é descartado');
select is(public.record_access('aaaaaaaa11111111', '/', true, null, null, null, null, 'celular', null, null, 'brasil'), false, 'país fora do padrão é descartado');
select throws_ok($$select * from public.access_hits$$, '42501', null, 'anon não lê a tabela');
select throws_ok($$insert into public.access_hits (visitor, path, device) values ('aaaaaaaa', '/', 'celular')$$, '42501', null, 'anon não grava direto na tabela');
select throws_ok($$select public.admin_access_stats(7)$$, '42501', null, 'anon não executa a leitura');
reset role;

-- limite por visitante: 240 por hora
insert into public.rate_limits (key, hits) values ('access:v:eeeeeeee44444444', 240);
set local role anon;
select is(public.record_access('eeeeeeee44444444', '/', false, null, null, null, null, 'celular', null, null, null), false, 'estourou o limite do visitante: descartado');
reset role;

-- ===================================================== leitura (equipe)
select tests.login('00000000-0000-4000-8000-0000000041b1');
select throws_ok($$select public.admin_access_stats(7)$$, 'MM004', null, 'quem não é da equipe recebe MM004');
reset role;
select tests.login('00000000-0000-4000-8000-0000000041a1', true);
select is((public.admin_access_stats(7) -> 'totals' ->> 'views')::int, 4, 'total de visualizações (as 4 coletas válidas)');
select is((public.admin_access_stats(7) -> 'totals' ->> 'visitors')::int, 3, 'visitantes distintos do dia: 3');
select is((public.admin_access_stats(7) -> 'totals' ->> 'entries')::int, 3, 'entradas: 3');
select is(jsonb_array_length(public.admin_access_stats(7) -> 'series'), 7, 'série diária com 7 dias (inclui os zeros)');
select is(jsonb_array_length(public.admin_access_stats(365) -> 'series'), 90, 'série limitada a 90 dias');
select is((public.admin_access_stats(7) -> 'sources' -> 0 ->> 'entries')::int, 1, 'origens: cada entrada conta uma vez');
select ok(exists (select 1 from jsonb_array_elements(public.admin_access_stats(7) -> 'sources') s where s ->> 'source' = 'Direto'), 'entrada sem origem aparece como Direto');
select is((public.admin_access_stats(7) -> 'campaigns' -> 0 ->> 'campaign'), 'lancamento', 'campanha UTM listada');
select is((public.admin_access_stats(7) -> 'referrers' -> 0 ->> 'host'), 'www.google.com', 'sites de origem listados');
select is((public.admin_access_stats(7) -> 'pages' -> 0 ->> 'path'), '/', 'página mais vista');
select ok(exists (select 1 from jsonb_array_elements(public.admin_access_stats(7) -> 'countries') c where c ->> 'country' = '--'), 'visitante sem país vira "--"');
reset role;

select is((select count(*)::int from public.legal_documents where kind = 'privacy' and version = '2026-11-17-v4'), 1, 'Política v4 (medição de acesso sem cookies) publicada');

select * from finish();
rollback;
