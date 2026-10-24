-- pgTAP · Nome de pessoa sem repetição (migration 20261024000200_person_names).
-- clean_person_name espelha cleanPersonName (web/src/domain/person-name.ts); o trigger limpa ao gravar host_name,
-- display_name e o nome do participante; clean_person_names_backfill corrige o que já estava gravado e audita o valor anterior.
begin;
select no_plan();

-- mesma tabela de casos do teste do cliente
select is(public.clean_person_name('Aurimar NogueiraAurimar'), 'Aurimar Nogueira', 'prefixo colado no fim');
select is(public.clean_person_name('Ana SilvaAna Silva'), 'Ana Silva', 'nome inteiro colado');
select is(public.clean_person_name('Ana Silva Ana Silva'), 'Ana Silva', 'nome inteiro com espaço');
select is(public.clean_person_name('José ÁvilaJosé'), 'José Ávila', 'acentos');
select is(public.clean_person_name('  Ana   Paula '), 'Ana Paula', 'apara e junta espaços');
select is(public.clean_person_name(null), null, 'nulo continua nulo');
select is(
  (select array_agg(public.clean_person_name(n) = n) from unnest(array['Aurimar Nogueira', 'McDonald', 'Lala', 'Ana', 'João Pedro',
     'Maria Maria', 'DeAndre Jordan', 'Emy e Igor']) n),
  array[true, true, true, true, true, true, true, true], 'nomes legítimos ficam como estão');

insert into auth.users (id, aud, role, email, is_anonymous, raw_user_meta_data, raw_app_meta_data, created_at) values
  ('00000000-0000-4000-8000-0000000013a1', 'authenticated', 'authenticated', 'host13@test.local', false,
   '{"full_name":"Aurimar NogueiraAurimar"}', '{"provider":"google"}', now());
select is((select display_name from public.profiles where id = '00000000-0000-4000-8000-0000000013a1'), 'Aurimar Nogueira',
  'perfil novo nasce com o nome limpo');

insert into public.events (id, title, category, host_id, host_name, duration_hours, start_at) values
  ('00000000-0000-4000-8000-0000000013e1', 'Festa 13', 'festa', '00000000-0000-4000-8000-0000000013a1', 'Ana SilvaAna Silva', 6, now());
select is((select host_name from public.events where id = '00000000-0000-4000-8000-0000000013e1'), 'Ana Silva', 'INSERT de evento limpa host_name');
update public.events set host_name = 'Bia CostaBia' where id = '00000000-0000-4000-8000-0000000013e1';
select is((select host_name from public.events where id = '00000000-0000-4000-8000-0000000013e1'), 'Bia Costa', 'UPDATE de evento limpa host_name');

insert into public.participants (event_id, user_id, name, joined_at) values
  ('00000000-0000-4000-8000-0000000013e1', '00000000-0000-4000-8000-0000000013a1', 'Caio LimaCaio', now());
select is((select name from public.participants where event_id = '00000000-0000-4000-8000-0000000013e1'), 'Caio Lima', 'participante entra com o nome limpo');

-- dado antigo, gravado antes do trigger: o backfill corrige e guarda o valor anterior na auditoria
set local session_replication_role = replica;
update public.events set host_name = 'Aurimar NogueiraAurimar' where id = '00000000-0000-4000-8000-0000000013e1';
update public.profiles set display_name = 'Aurimar NogueiraAurimar' where id = '00000000-0000-4000-8000-0000000013a1';
update public.participants set name = 'Caio LimaCaio' where event_id = '00000000-0000-4000-8000-0000000013e1';
set local session_replication_role = origin;

select is(public.clean_person_names_backfill(), 3, 'backfill corrige as três linhas');
select is((select host_name from public.events where id = '00000000-0000-4000-8000-0000000013e1'), 'Aurimar Nogueira', 'host_name corrigido');
select is((select display_name from public.profiles where id = '00000000-0000-4000-8000-0000000013a1'), 'Aurimar Nogueira', 'display_name corrigido');
select is((select name from public.participants where event_id = '00000000-0000-4000-8000-0000000013e1'), 'Caio Lima', 'nome do participante corrigido');
select ok(exists (select 1 from public.audit_logs where action = 'system.person_names_cleaned' and target_type = 'events'
  and actor_role = 'sistema' and detail -> 'before' @> '[{"id": "00000000-0000-4000-8000-0000000013e1", "name": "Aurimar NogueiraAurimar"}]'),
  'auditoria guarda o valor anterior para reverter');
select is(public.clean_person_names_backfill(), 0, 'rodar de novo não muda nada');

-- só o dono do banco chama as funções internas
select is((select has_function_privilege('authenticated', 'public.clean_person_names_backfill()', 'execute')), false, 'authenticated não roda o backfill');
select is((select has_function_privilege('anon', 'public.clean_person_names_backfill()', 'execute')), false, 'anon não roda o backfill');

-- 20261024000300: a função pura também não fica exposta como RPC; o trigger continua funcionando para o cliente
select is((select has_function_privilege('anon', 'public.clean_person_name(text)', 'execute')), false, 'anon não chama clean_person_name');
select is((select has_function_privilege('authenticated', 'public.clean_person_name(text)', 'execute')), false, 'authenticated não chama clean_person_name');
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-0000000013a1', 'role', 'authenticated')::text, true);
set local role authenticated;
update public.profiles set display_name = 'Dora LimaDora' where id = '00000000-0000-4000-8000-0000000013a1';
reset role;
select is((select display_name from public.profiles where id = '00000000-0000-4000-8000-0000000013a1'), 'Dora Lima',
  'cliente autenticado grava o próprio nome e o trigger limpa');

select * from finish();
rollback;
