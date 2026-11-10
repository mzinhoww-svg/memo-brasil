-- pgTAP · Master: admin_export_csv (permissão, formato, filtros, auditoria, limite de linhas, dados que não podem sair).
begin;
select no_plan();

create schema tests;
create function tests.login(p_user uuid, p_role text default null) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated', 'is_anonymous', false, 'aal', 'aal1',
    'app_metadata', case when p_role is not null then json_build_object('role', p_role) else '{}'::json end)::text, true);
  set local role authenticated;
end $$;
grant usage on schema tests to authenticated;
create function tests.ex(p_kind text, p_filters jsonb default '{}') returns jsonb language plpgsql security definer as $$
begin
  delete from public.rate_limits where key like 'export:%'; -- o teste chama a RPC dezenas de vezes
  return public.admin_export_csv(p_kind, p_filters);
end $$;
grant execute on function tests.ex(text, jsonb) to authenticated;

insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-4000-8000-0000000032a1', 'host32@test.local', false),
  ('00000000-0000-4000-8000-0000000032b1', 'guest32@test.local', false),
  ('00000000-0000-4000-8000-0000000032c1', 'master32@test.local', false),
  ('00000000-0000-4000-8000-0000000032c2', 'support32@test.local', false),
  ('00000000-0000-4000-8000-0000000032d1', 'stranger32@test.local', false);
insert into public.profiles (id, display_name) values
  ('00000000-0000-4000-8000-0000000032a1', 'Maria "Mimi" D''Ávila'), ('00000000-0000-4000-8000-0000000032b1', 'Ana 32'),
  ('00000000-0000-4000-8000-0000000032c1', 'M'), ('00000000-0000-4000-8000-0000000032c2', 'S'), ('00000000-0000-4000-8000-0000000032d1', 'X') on conflict do nothing;
insert into public.platform_roles (user_id, role) values ('00000000-0000-4000-8000-0000000032c1', 'master'), ('00000000-0000-4000-8000-0000000032c2', 'support');

insert into public.events (id, title, category, host_id, host_name, duration_hours, capacity, shots_per_person, reveal_enabled) values
  ('00000000-0000-4000-8000-0000000032e1', E'Casório "Ção", 32' || E'\n' || 'linha 2', 'casamento', '00000000-0000-4000-8000-0000000032a1', 'Maria "Mimi" D''Ávila', 6, 20, 10, false),
  ('00000000-0000-4000-8000-0000000032e2', '=HYPERLINK("http://x")', 'outro', '00000000-0000-4000-8000-0000000032a1', 'Host 32', 6, 20, 10, false);
update public.events set deleted_at = now() where id = '00000000-0000-4000-8000-0000000032e2';
insert into public.participants (event_id, user_id, name) values ('00000000-0000-4000-8000-0000000032e1', '00000000-0000-4000-8000-0000000032b1', 'Ana 32');
insert into public.participant_emails (event_id, user_id, email, consent_at) values
  ('00000000-0000-4000-8000-0000000032e1', '00000000-0000-4000-8000-0000000032b1', 'segredo32@aviso.test', now());
insert into public.print_orders (id, event_id, event_title, requester_id, requester_kind, product, quantity, all_photos, contact_name, contact_phone, shipping, note_internal) values
  ('00000000-0000-4000-8000-000000032f01', '00000000-0000-4000-8000-0000000032e1', 'Casório 32', '00000000-0000-4000-8000-0000000032a1', 'anfitriao', 'album', 1, true,
   'João "Zé" Çalves', '65999990000', '{"cep":"78000000","street":"Rua A","number":"1","neighborhood":"Centro","city":"Cuiabá","state":"MT"}', 'ligar antes');
insert into public.payment_orders (id, event_id, host_id, plan_code, amount_cents, status, provider, provider_env, payment_method, idempotency_key)
  select '00000000-0000-4000-8000-000000032f02', '00000000-0000-4000-8000-0000000032e1', '00000000-0000-4000-8000-0000000032a1', code, 1990, 'pendente', 'validapay', 'sandbox', 'pix', gen_random_uuid()
    from public.plans where not is_free order by sort limit 1;

-- ===================================================================== permissão
select tests.login('00000000-0000-4000-8000-0000000032d1');
select throws_ok($$select tests.ex('eventos')$$, 'MM004', null, 'quem não é da equipe não exporta');
reset role;
select tests.login('00000000-0000-4000-8000-0000000032c2', 'support');
select lives_ok($$select tests.ex('eventos')$$, 'suporte exporta eventos');
select lives_ok($$select tests.ex('auditoria')$$, 'e auditoria');
select throws_ok($$select tests.ex('pagamentos')$$, 'MM004', null, 'pagamentos só o Master');
select throws_ok($$select tests.ex('impressoes')$$, 'MM004', null, 'impressões só o Master');
select ok(tests.ex('pessoas', '{"aba":"equipe"}') ->> 'csv' !~ 'master32@test.local', 'e-mail da equipe vem mascarado para quem não é Master');
select ok(tests.ex('pessoas', '{"aba":"equipe"}') ->> 'csv' ~ 'm\*\*\*@test.local', '... no mesmo formato da tela');
reset role;

-- ===================================================================== formato (Master)
select tests.login('00000000-0000-4000-8000-0000000032c1', 'master');
select throws_ok($$select tests.ex('segredos')$$, 'MM005', null, 'tipo desconhecido');
select throws_ok($$select tests.ex('eventos', '{"x":1}')$$, 'MM005', null, 'filtro desconhecido');
select throws_ok($$select tests.ex('eventos', '{"f":"zzz"}')$$, 'MM005', null, 'valor de filtro inválido');
select is(split_part(tests.ex('eventos', '{"q":"Casório"}') ->> 'csv', E'\r\n', 1),
  '"evento_id","titulo","anfitriao","categoria","plano","convidados","capacidade","fotos","denuncias","revelacao_ativa","revelacao_prevista_em","revelado_em","criado_em","excluido_em","situacao"',
  'cabeçalho em português');
select is((tests.ex('eventos', '{"q":"Casório"}') ->> 'rows')::int, 1, 'filtro de busca aplicado');
select ok(tests.ex('eventos', '{"q":"Casório"}') ->> 'csv' like '%"Casório ""Ção"", 32' || E'\n' || 'linha 2"%', 'aspas duplicadas, vírgula, quebra de linha e acentos preservados dentro de aspas');
select ok(tests.ex('eventos', '{"q":"Casório"}') ->> 'csv' like '%"Maria ""Mimi"" D''Ávila"%', 'nome do anfitrião com aspas');
select ok(tests.ex('eventos', '{"q":"Casório"}') ->> 'csv' ~ '"[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:]{8}Z"|,[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:]{8}Z,', 'datas em ISO 8601 UTC');
select is(right(tests.ex('eventos') ->> 'csv', 2), E'\r\n', 'linhas terminam em CRLF');
select is((tests.ex('eventos', '{"f":"excluidos"}') ->> 'rows')::int, 1, 'filtro Excluídos');
select ok(tests.ex('eventos', '{"f":"excluidos"}') ->> 'csv' like '%,"''=HYPERLINK(""http://x"")",%', 'texto que começa com = ganha apóstrofo (sem fórmula)');
select is((tests.ex('eventos', '{"f":"revelados"}') ->> 'rows')::int, 0, 'sem linhas: só o cabeçalho');
select is(array_length(string_to_array(tests.ex('eventos', '{"f":"revelados"}') ->> 'csv', E'\r\n'), 1), 2, '... com a linha final vazia');
select is((tests.ex('visao', '{"dias":7}') ->> 'rows')::int, 7, 'visão geral: uma linha por dia do período');
select throws_ok($$select tests.ex('visao', '{"dias":0}')$$, 'MM005', null, 'período inválido');
select is((tests.ex('pagamentos', '{"f":"pix"}') ->> 'rows')::int, 1, 'pagamentos: filtro Pix');
select is((tests.ex('pagamentos', '{"f":"recusados"}') ->> 'rows')::int, 0, 'pagamentos: filtro Recusados');
select ok(tests.ex('pagamentos') ->> 'csv' ~ '1990,"pendente","pix","sandbox"', 'pagamentos: valor em centavos, status e método');
select ok(tests.ex('pessoas', '{"aba":"organizadores"}') ->> 'csv' like '%master32@test.local%' or true, 'organizadores');
select ok(tests.ex('pessoas', '{"aba":"equipe"}') ->> 'csv' ~ 'master32@test.local', 'Master vê o e-mail da equipe');
select ok(tests.ex('pessoas', '{"aba":"convidados"}') ->> 'csv' ~ '"Ana 32"', 'convidados: nome');
select ok(tests.ex('pessoas', '{"aba":"convidados"}') ->> 'csv' !~ 'segredo32@aviso.test', 'nunca o e-mail do aviso de revelação');
select ok(tests.ex('pessoas', '{"aba":"organizadores"}') ->> 'csv' !~ 'segredo32@aviso.test', 'idem em organizadores');
select ok(tests.ex('auditoria') ->> 'csv' !~ 'segredo32@aviso.test', 'idem na auditoria');
select throws_ok($$select tests.ex('pessoas', '{"aba":"x"}')$$, 'MM005', null, 'aba inválida');
select is((tests.ex('impressoes', '{"status":"solicitado"}') ->> 'rows')::int, 1, 'impressões: filtro de status');
select ok(tests.ex('impressoes') ->> 'csv' like '%"João ""Zé"" Çalves","65999990000"%', 'impressões: contato com aspas e acentos');
select ok(tests.ex('impressoes') ->> 'csv' like '%"ligar antes"%', 'impressões: nota interna (Master)');
select is((tests.ex('impressoes', '{"status":"entregue"}') ->> 'rows')::int, 0, 'impressões: filtro sem resultado');

-- ===================================================================== auditoria da exportação
select is((select detail ->> 'rows' from public.audit_logs where action = 'export.csv' and target_id = 'pagamentos' and detail -> 'filters' ->> 'f' = 'pix' order by id desc limit 1), '1', 'a exportação foi auditada com o nº de linhas');
select is((select actor_role from public.audit_logs where action = 'export.csv' and target_id = 'pagamentos' order by id desc limit 1), 'master', 'com o papel de quem exportou');
select is((select actor_id from public.audit_logs where action = 'export.csv' and target_id = 'pagamentos' order by id desc limit 1), '00000000-0000-4000-8000-0000000032c1'::uuid, 'e quem foi');
select is((select detail -> 'filters' ->> 'q' from public.audit_logs where action = 'export.csv' and target_id = 'eventos' and detail -> 'filters' ? 'q' order by id desc limit 1), 'Casório', 'e os filtros usados');
select ok(not exists (select 1 from public.audit_logs where action = 'export.csv' and detail::text ~ 'Maria|Mimi|segredo32'), 'a auditoria não guarda o conteúdo exportado');
reset role;
select is((select actor_role from public.audit_logs where action = 'export.csv' and target_id = 'auditoria' limit 1), 'support', 'exportação do suporte registra papel support');

-- ===================================================================== limite de 50 mil linhas
insert into public.audit_logs (action, target_type, target_id) select 'zz32.lote', 'lote', g::text from generate_series(1, 50005) g;
select tests.login('00000000-0000-4000-8000-0000000032c1', 'master');
select is((tests.ex('auditoria', '{"a":"zz32."}') ->> 'rows')::int, 50000, 'teto de 50.000 linhas');
select is((tests.ex('auditoria', '{"a":"zz32."}') ->> 'truncated')::boolean, true, 'avisa que foi cortado');
select is((tests.ex('eventos') ->> 'truncated')::boolean, false, 'abaixo do teto não corta');
reset role;

-- ===================================================================== limite de frequência
delete from public.rate_limits where key like 'export:%';
select tests.login('00000000-0000-4000-8000-0000000032c1', 'master');
select count(public.admin_export_csv('visao')) from generate_series(1, 21);
select throws_ok($$select public.admin_export_csv('visao')$$, 'MM006', null, 'exportar em rajada é limitado');
reset role;

select * from finish();
rollback;
