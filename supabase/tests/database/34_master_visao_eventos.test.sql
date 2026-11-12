-- pgTAP · Console Master: Visão geral, detalhe do evento e eventos de teste (M20 a M22).
-- Cobre: critério de teste unificado nas métricas, permissão por papel, só master marca/desmarca/exclui teste, evento pago não vira teste,
-- lote com evento real ou pago recusado inteiro (com o motivo de cada evento), motivo <10 ou >500 recusado no servidor,
-- e-mail mascarado para support/auditor, detalhe do evento (avisos só em números, denúncias por motivo, impressão só com a chave).
begin;
select no_plan();

create schema tests;
create function tests.login(p_user uuid, p_role text default null, p_aal text default 'aal1') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated', 'is_anonymous', false, 'aal', p_aal,
    'app_metadata', case when p_role is not null then json_build_object('role', p_role) else '{}'::json end)::text, true);
  set local role authenticated;
end $$;
grant usage on schema tests to authenticated;

insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-4000-8000-0000000034a1', 'master34@dominio.test', false),
  ('00000000-0000-4000-8000-0000000034a2', 'support34@dominio.test', false),
  ('00000000-0000-4000-8000-0000000034a3', 'auditor34@dominio.test', false),
  ('00000000-0000-4000-8000-0000000034a4', 'semrole34@dominio.test', false),
  ('00000000-0000-4000-8000-0000000034b1', 'ana34@dominio.test', false),
  ('00000000-0000-4000-8000-0000000034b2', 'guest34@dominio.test', false);
insert into public.profiles (id, display_name) values
  ('00000000-0000-4000-8000-0000000034a1', 'Master 34'), ('00000000-0000-4000-8000-0000000034a2', 'Support 34'), ('00000000-0000-4000-8000-0000000034a3', 'Auditor 34'),
  ('00000000-0000-4000-8000-0000000034a4', 'Sem papel 34'), ('00000000-0000-4000-8000-0000000034b1', 'Ana 34'), ('00000000-0000-4000-8000-0000000034b2', 'Guest 34') on conflict do nothing;
update public.profiles set display_name = 'Master 34' where id = '00000000-0000-4000-8000-0000000034a1';
insert into public.platform_roles (user_id, role) values
  ('00000000-0000-4000-8000-0000000034a1', 'master'), ('00000000-0000-4000-8000-0000000034a2', 'support'), ('00000000-0000-4000-8000-0000000034a3', 'auditor');

-- e1 real; t1, t2 testes livres; t3 teste com pedido pago em produção; t4 teste com pedido pendente em sandbox; r2 real com pedido pago
insert into public.events (id, title, category, host_id, host_name, duration_hours, capacity, shots_per_person, reveal_enabled, reveal_at, is_test, created_at) values
  ('00000000-0000-4000-8000-0000000034e1', 'Evento real 34', 'casamento', '00000000-0000-4000-8000-0000000034b1', 'Ana 34', 6, 20, 10, true, now() + interval '3 days', false, now() - interval '1 day'),
  ('00000000-0000-4000-8000-0000000034e2', 'Teste livre A', 'outro', '00000000-0000-4000-8000-0000000034b1', 'Ana 34', 6, 20, 10, false, null, true, now() - interval '2 days'),
  ('00000000-0000-4000-8000-0000000034e3', 'Teste livre B', 'outro', '00000000-0000-4000-8000-0000000034b1', 'Ana 34', 6, 20, 10, false, null, true, now() - interval '3 days'),
  ('00000000-0000-4000-8000-0000000034e4', 'Teste pago', 'outro', '00000000-0000-4000-8000-0000000034b1', 'Ana 34', 6, 20, 10, false, null, true, now() - interval '4 days'),
  ('00000000-0000-4000-8000-0000000034e5', 'Teste Pix pendente', 'outro', '00000000-0000-4000-8000-0000000034b1', 'Ana 34', 6, 20, 10, false, null, true, now() - interval '5 days'),
  ('00000000-0000-4000-8000-0000000034e6', 'Real pago', 'casamento', '00000000-0000-4000-8000-0000000034b1', 'Ana 34', 6, 20, 10, false, null, false, now() - interval '6 days');
insert into public.payment_orders (id, event_id, host_id, plan_code, amount_cents, status, provider, provider_env, payment_method, idempotency_key, paid_at) values
  ('00000000-0000-4000-8000-000000034f01', '00000000-0000-4000-8000-0000000034e4', '00000000-0000-4000-8000-0000000034b1', 'festa', 2900, 'pago', 'validapay', 'production', 'pix', gen_random_uuid(), now()),
  ('00000000-0000-4000-8000-000000034f02', '00000000-0000-4000-8000-0000000034e5', '00000000-0000-4000-8000-0000000034b1', 'festa', 2900, 'pendente', 'validapay', 'sandbox', 'pix', gen_random_uuid(), null),
  ('00000000-0000-4000-8000-000000034f03', '00000000-0000-4000-8000-0000000034e6', '00000000-0000-4000-8000-0000000034b1', 'casamento', 18900, 'pago', 'validapay', 'sandbox', 'pix', gen_random_uuid(), now());
-- atividade: duas fotos prontas e uma falha no evento real; uma foto pronta e uma falha no evento de teste; uma entrada em cada
insert into public.participants (event_id, user_id, name) values
  ('00000000-0000-4000-8000-0000000034e1', '00000000-0000-4000-8000-0000000034b2', 'Guest 34'),
  ('00000000-0000-4000-8000-0000000034e2', '00000000-0000-4000-8000-0000000034b2', 'Guest 34');
insert into public.photos (id, event_id, author_id, author_name, upload_status, storage_path) values
  ('00000000-0000-4000-8000-000000034a01', '00000000-0000-4000-8000-0000000034e1', '00000000-0000-4000-8000-0000000034b2', 'G', 'pronta', '00000000-0000-4000-8000-0000000034e1/00000000-0000-4000-8000-000000034a01'),
  ('00000000-0000-4000-8000-000000034a02', '00000000-0000-4000-8000-0000000034e1', '00000000-0000-4000-8000-0000000034b2', 'G', 'pronta', '00000000-0000-4000-8000-0000000034e1/00000000-0000-4000-8000-000000034a02'),
  ('00000000-0000-4000-8000-000000034a03', '00000000-0000-4000-8000-0000000034e1', '00000000-0000-4000-8000-0000000034b2', 'G', 'falhou', '00000000-0000-4000-8000-0000000034e1/00000000-0000-4000-8000-000000034a03'),
  ('00000000-0000-4000-8000-000000034a04', '00000000-0000-4000-8000-0000000034e2', '00000000-0000-4000-8000-0000000034b2', 'G', 'pronta', '00000000-0000-4000-8000-0000000034e2/00000000-0000-4000-8000-000000034a04'),
  ('00000000-0000-4000-8000-000000034a05', '00000000-0000-4000-8000-0000000034e2', '00000000-0000-4000-8000-0000000034b2', 'G', 'falhou', '00000000-0000-4000-8000-0000000034e2/00000000-0000-4000-8000-000000034a05');
-- denúncias por motivo (quem denunciou nunca sai) e aviso por e-mail (só números)
insert into public.photo_reports (photo_id, user_id, reason) values
  ('00000000-0000-4000-8000-000000034a01', '00000000-0000-4000-8000-0000000034b1', 'nao_quero_aparecer'),
  ('00000000-0000-4000-8000-000000034a01', '00000000-0000-4000-8000-0000000034b2', 'constrangedora'),
  ('00000000-0000-4000-8000-000000034a02', '00000000-0000-4000-8000-0000000034b2', null);
insert into public.participant_emails (event_id, user_id, email, consent_at) values
  ('00000000-0000-4000-8000-0000000034e1', '00000000-0000-4000-8000-0000000034b2', 'segredo34@aviso.test', now());
insert into public.print_orders (id, event_id, event_title, requester_id, requester_kind, product, quantity, all_photos, contact_name, contact_phone, shipping) values
  ('00000000-0000-4000-8000-000000034c01', '00000000-0000-4000-8000-0000000034e1', 'Evento real 34', '00000000-0000-4000-8000-0000000034b1', 'anfitriao', 'album', 1, true,
   'Ana', '65999990000', '{"cep":"78000000","street":"Rua A","number":"1","neighborhood":"Centro","city":"Cuiabá","state":"MT"}');
insert into public.platform_settings (key, value) select 'x', '{}' where false;

-- ===================================================================== métricas: eventos de teste fora por padrão (mesmo critério da Visão geral)
select tests.login('00000000-0000-4000-8000-0000000034a1', 'master');
select is((public.admin_dashboard_metrics(now() - interval '2 days', now() + interval '1 minute') #>> '{photos,uploaded}')::int, 2, 'métricas: fotos de eventos reais (teste excluído)');
select is((public.admin_dashboard_metrics(now() - interval '2 days', now() + interval '1 minute') #>> '{uploads,failed}')::int, 1, 'métricas: falhas só de eventos reais');
select is((public.admin_dashboard_metrics(now() - interval '2 days', now() + interval '1 minute') #>> '{participants,joined}')::int, 1, 'métricas: entradas só de eventos reais');
select is((public.admin_dashboard_metrics(now() - interval '2 days', now() + interval '1 minute', 'America/Cuiaba', true) #>> '{photos,uploaded}')::int, 3, 'com p_include_tests: contam os de teste');
select is((public.admin_dashboard_metrics(now() - interval '2 days', now() + interval '1 minute', 'America/Cuiaba', true) #>> '{uploads,failed}')::int, 2, 'com p_include_tests: falhas dos de teste');
select is((select sum((d ->> 'photosUploaded')::int)::int from jsonb_array_elements(public.admin_dashboard_metrics(now() - interval '2 days', now() + interval '1 minute') -> 'series') d), 2, 'série diária sem teste');
select is((select sum((d ->> 'uploadsFailed')::int)::int from jsonb_array_elements(public.admin_dashboard_metrics(now() - interval '2 days', now() + interval '1 minute') -> 'series') d), 1, 'série de falhas sem teste');
select is((public.admin_dashboard_metrics(now() - interval '2 days', now() + interval '1 minute') #>> '{photos,uploaded}')::int,
          (select (k #>> '{value}')::int from (select public.admin_overview(3) -> 'kpis' -> 'photos' as k) q), 'mesmo total de fotos que admin_overview (critério unificado)');
reset role;
select tests.login('00000000-0000-4000-8000-0000000034a2', 'support');
select lives_ok($$select public.admin_dashboard_metrics()$$, 'support lê as métricas');
select lives_ok($$select public.admin_overview(7)$$, 'support lê a visão geral');
select is(public.admin_overview(7) #>> '{kpis,revenueCents,value}', null, 'support: receita nula (só master)');
reset role;
select tests.login('00000000-0000-4000-8000-0000000034a4');
select throws_ok($$select public.admin_dashboard_metrics()$$, 'MM004', null, 'sem papel não lê as métricas');
select throws_ok($$select public.admin_test_events()$$, 'MM004', null, 'sem papel não lê eventos de teste');
select throws_ok($$select public.admin_event_detail('00000000-0000-4000-8000-0000000034e1')$$, 'MM004', null, 'sem papel não lê o detalhe do evento');
reset role;

-- ===================================================================== chip "De teste" e lista M22
select tests.login('00000000-0000-4000-8000-0000000034a1', 'master');
select is((public.admin_events_board() #>> '{counts,teste}')::int, 4, 'board: chip De teste = 4');
select is((public.admin_events_board() #>> '{counts,todos}')::int, 2, 'board: Todos continua sem teste');
select is((public.admin_test_events() ->> 'total')::int, 4, 'lista de teste: 4');
select is((public.admin_test_events() ->> 'allEvents')::int, 6, 'lista de teste: total geral de eventos');
select ok((select bool_or(i ->> 'hostEmail' = 'ana34@dominio.test') from jsonb_array_elements(public.admin_test_events() -> 'items') i), 'master vê o e-mail completo do organizador');
select is((select i ->> 'payment' from jsonb_array_elements(public.admin_test_events() -> 'items') i where i ->> 'title' = 'Teste Pix pendente'), 'sandbox', 'pagamento: ambiente do pedido');
select is((select i ->> 'payment' from jsonb_array_elements(public.admin_test_events() -> 'items') i where i ->> 'title' = 'Teste livre A'), null, 'sem pedido: nulo');
select is((select (i ->> 'blocked')::boolean from jsonb_array_elements(public.admin_test_events() -> 'items') i where i ->> 'title' = 'Teste pago'), true, 'teste pago vem marcado como bloqueado');
select is((select (i ->> 'blocked')::boolean from jsonb_array_elements(public.admin_test_events() -> 'items') i where i ->> 'title' = 'Teste livre A'), false, 'teste livre não é bloqueado');
reset role;
select tests.login('00000000-0000-4000-8000-0000000034a2', 'support');
select ok((select bool_and(i ->> 'hostEmail' ~ '^.\*\*\*@') from jsonb_array_elements(public.admin_test_events() -> 'items') i), 'support: e-mail mascarado no servidor');
select is(public.admin_test_events(25, 0, 'ana34@dominio') ->> 'total', '0', 'support não busca por e-mail');
reset role;
select tests.login('00000000-0000-4000-8000-0000000034a3', 'auditor');
select ok((select bool_and(i ->> 'hostEmail' ~ '^.\*\*\*@') from jsonb_array_elements(public.admin_test_events() -> 'items') i), 'auditor: e-mail mascarado no servidor');
reset role;

-- ===================================================================== só master marca, desmarca e exclui
select tests.login('00000000-0000-4000-8000-0000000034a2', 'support');
select throws_ok($$select public.admin_set_test_flag(array['00000000-0000-4000-8000-0000000034e1']::uuid[], true, 'support tentando marcar teste')$$, 'MM004', null, 'support não marca');
select throws_ok($$select public.admin_set_test_flag(array['00000000-0000-4000-8000-0000000034e2']::uuid[], false, 'support tentando desmarcar teste')$$, 'MM004', null, 'support não desmarca');
select throws_ok($$select public.admin_soft_delete_test_events(array['00000000-0000-4000-8000-0000000034e2']::uuid[], 'support tentando excluir teste')$$, 'MM004', null, 'support não exclui');
reset role;
select tests.login('00000000-0000-4000-8000-0000000034a3', 'auditor');
select throws_ok($$select public.admin_set_test_flag(array['00000000-0000-4000-8000-0000000034e1']::uuid[], true, 'auditor tentando marcar teste')$$, 'MM004', null, 'auditor não marca');
select throws_ok($$select public.admin_soft_delete_test_events(array['00000000-0000-4000-8000-0000000034e2']::uuid[], 'auditor tentando excluir teste')$$, 'MM004', null, 'auditor não exclui');
reset role;
select tests.login('00000000-0000-4000-8000-0000000034b1');
select throws_ok($$select public.admin_set_test_flag(array['00000000-0000-4000-8000-0000000034e1']::uuid[], true, 'anfitrião tentando marcar teste')$$, 'MM004', null, 'anfitrião não marca o próprio evento');
reset role;
select tests.login('00000000-0000-4000-8000-0000000034a4');
select throws_ok($$select public.admin_soft_delete_test_events(array['00000000-0000-4000-8000-0000000034e2']::uuid[], 'sem papel tentando excluir')$$, 'MM004', null, 'sem papel não exclui');
reset role;
set local role anon;
select throws_ok($$select public.admin_test_events()$$, '42501', null, 'anon não executa a lista de teste');
reset role;

-- ===================================================================== motivo no servidor (10 a 500)
select tests.login('00000000-0000-4000-8000-0000000034a1', 'master');
select throws_ok($$select public.admin_set_test_flag(array['00000000-0000-4000-8000-0000000034e1']::uuid[], true, 'curto')$$, 'MM011', null, 'marcar: motivo com menos de 10 recusado');
select throws_ok($$select public.admin_set_test_flag(array['00000000-0000-4000-8000-0000000034e1']::uuid[], true, repeat('a', 501))$$, 'MM011', null, 'marcar: motivo com mais de 500 recusado');
select throws_ok($$select public.admin_set_test_flag(array['00000000-0000-4000-8000-0000000034e1']::uuid[], true, '         x         ')$$, 'MM011', null, 'marcar: espaços não contam');
select throws_ok($$select public.admin_soft_delete_test_events(array['00000000-0000-4000-8000-0000000034e2']::uuid[], 'curto')$$, 'MM011', null, 'excluir: motivo com menos de 10 recusado');
select throws_ok($$select public.admin_soft_delete_test_events(array['00000000-0000-4000-8000-0000000034e2']::uuid[], repeat('a', 501))$$, 'MM011', null, 'excluir: motivo com mais de 500 recusado');
select is((select is_test from public.events where id = '00000000-0000-4000-8000-0000000034e1'), false, 'motivo inválido não alterou nada');

-- evento pago não vira teste (e o lote é recusado inteiro, com o motivo)
select throws_ok($$select public.admin_set_test_flag(array['00000000-0000-4000-8000-0000000034e6']::uuid[], true, 'tentando marcar evento pago')$$, 'MM005', 'paid', 'evento pago não vira teste');
select is((select is_test from public.events where id = '00000000-0000-4000-8000-0000000034e6'), false, '... e continua real');
select throws_ok($$select public.admin_set_test_flag(array['00000000-0000-4000-8000-0000000034e1', '00000000-0000-4000-8000-0000000034e6']::uuid[], true, 'lote com um evento pago')$$, 'MM005', 'paid', 'lote de marcação com evento pago é recusado inteiro');
select is((select is_test from public.events where id = '00000000-0000-4000-8000-0000000034e1'), false, '... nenhum do lote foi marcado');
select throws_ok($$select public.admin_set_test_flag(array[gen_random_uuid()]::uuid[], true, 'evento que não existe')$$, 'MM005', 'missing', 'evento inexistente é recusado');
-- o detalhe da recusa leva o motivo de cada evento
do $$ declare d text; begin
  begin perform public.admin_set_test_flag(array['00000000-0000-4000-8000-0000000034e6']::uuid[], true, 'tentando marcar evento pago');
  exception when others then get stacked diagnostics d = pg_exception_detail; end;
  perform set_config('t34.detail', d, true);
end $$;
select is((current_setting('t34.detail')::jsonb -> 0 ->> 'reason'), 'Tem pagamento confirmado no ambiente de testes', 'recusa de marcação traz o motivo do evento (pedido pago em sandbox)');
select is((current_setting('t34.detail')::jsonb -> 0 ->> 'title'), 'Real pago', '... e o título');

-- marcar e desmarcar um evento livre: um registro de auditoria por evento
select is((public.admin_set_test_flag(array['00000000-0000-4000-8000-0000000034e1']::uuid[], true, 'marcando para a homologação')) ->> 'updated', '1', 'marca o evento real sem pagamento');
select is((select is_test from public.events where id = '00000000-0000-4000-8000-0000000034e1'), true, '... e ele virou teste');
select is((select count(*)::int from public.audit_logs where action = 'admin.set_test_flag' and event_id = '00000000-0000-4000-8000-0000000034e1'), 1, 'auditoria da marcação');
select is((public.admin_set_test_flag(array['00000000-0000-4000-8000-0000000034e1']::uuid[], false, 'voltando a ser evento real')) ->> 'updated', '1', 'desmarca');
select is((select count(*)::int from public.audit_logs where action = 'admin.unset_test_flag' and event_id = '00000000-0000-4000-8000-0000000034e1'), 1, 'auditoria da desmarcação');
select is((public.admin_set_test_flag(array['00000000-0000-4000-8000-0000000034e1']::uuid[], false, 'repetindo a desmarcação')) ->> 'updated', '0', 'desmarcar de novo não altera nada');

-- ===================================================================== exclusão em lote: recusada inteira se houver evento real ou pago
select throws_ok($$select public.admin_soft_delete_test_events(array['00000000-0000-4000-8000-0000000034e2', '00000000-0000-4000-8000-0000000034e1']::uuid[], 'lote com evento real no meio')$$, 'MM005', 'nottest', 'lote com evento real é recusado');
select throws_ok($$select public.admin_soft_delete_test_events(array['00000000-0000-4000-8000-0000000034e2', '00000000-0000-4000-8000-0000000034e4']::uuid[], 'lote com evento pago no meio')$$, 'MM005', 'paid', 'lote com evento pago é recusado');
select is((select count(*)::int from public.events where deleted_at is not null and id in ('00000000-0000-4000-8000-0000000034e2', '00000000-0000-4000-8000-0000000034e3', '00000000-0000-4000-8000-0000000034e4')), 0, 'lote recusado: NADA foi excluído (nem o evento livre)');
do $$ declare d text; begin
  begin perform public.admin_soft_delete_test_events(array['00000000-0000-4000-8000-0000000034e1', '00000000-0000-4000-8000-0000000034e2', '00000000-0000-4000-8000-0000000034e4']::uuid[], 'lote misto de teste');
  exception when others then get stacked diagnostics d = pg_exception_detail; end;
  perform set_config('t34.detail2', d, true);
end $$;
select is(jsonb_array_length(current_setting('t34.detail2')::jsonb), 2, 'a recusa lista os dois eventos que impedem (o livre não aparece)');
select is((select r ->> 'reason' from jsonb_array_elements(current_setting('t34.detail2')::jsonb) r where r ->> 'title' = 'Evento real 34'), 'Não é evento de teste', 'motivo do evento real');
select is((select r ->> 'reason' from jsonb_array_elements(current_setting('t34.detail2')::jsonb) r where r ->> 'title' = 'Teste pago'), 'Tem pagamento confirmado em produção', 'motivo do evento pago em produção');
select throws_ok($$select public.admin_soft_delete_test_events(array[]::uuid[], 'lote vazio não é permitido')$$, 'MM005', 'invalid', 'lote vazio recusado');
select throws_ok($$select public.admin_soft_delete_test_events(null, 'lote nulo não é permitido')$$, 'MM005', 'invalid', 'lote nulo recusado');
-- teste com Pix pendente em sandbox pode ser excluído; lote livre é aceito
select is((public.admin_soft_delete_test_events(array['00000000-0000-4000-8000-0000000034e2', '00000000-0000-4000-8000-0000000034e3', '00000000-0000-4000-8000-0000000034e5']::uuid[], 'limpeza da homologação de novembro')) ->> 'deleted', '3', 'lote livre (inclui Pix pendente em sandbox) é excluído');
select is((select count(*)::int from public.audit_logs where action = 'admin.soft_delete_test_events' and event_id in ('00000000-0000-4000-8000-0000000034e2', '00000000-0000-4000-8000-0000000034e3', '00000000-0000-4000-8000-0000000034e5')), 3, 'um registro de auditoria por evento excluído');
select is((public.admin_test_events() ->> 'total')::int, 1, 'a lista de teste agora só tem o teste pago');
reset role;

-- ===================================================================== detalhe do evento (M21)
select tests.login('00000000-0000-4000-8000-0000000034a1', 'master');
select is((public.admin_event_detail('00000000-0000-4000-8000-0000000034e1') #>> '{notices,subscribers}')::int, 1, 'avisos: 1 inscrito');
select is((public.admin_event_detail('00000000-0000-4000-8000-0000000034e1') #>> '{notices,queued}')::int, 1, 'avisos: 1 na fila');
select ok(not (public.admin_event_detail('00000000-0000-4000-8000-0000000034e1')::text ~ 'segredo34'), 'o detalhe nunca devolve o e-mail do aviso');
select ok(not (public.admin_event_detail('00000000-0000-4000-8000-0000000034e1')::text ~ 'optout'), 'nem token');
select is((public.admin_event_detail('00000000-0000-4000-8000-0000000034e1') #>> '{reportsByReason,naoQueroAparecer}')::int, 1, 'denúncias: não quero aparecer');
select is((public.admin_event_detail('00000000-0000-4000-8000-0000000034e1') #>> '{reportsByReason,constrangedora}')::int, 1, 'denúncias: constrangedora');
select is((public.admin_event_detail('00000000-0000-4000-8000-0000000034e1') #>> '{reportsByReason,outro}')::int, 1, 'denúncias: sem motivo conta em outro');
select ok(not (public.admin_event_detail('00000000-0000-4000-8000-0000000034e1')::text ~ '0000000034b2'), 'denúncias: ninguém que denunciou aparece (nem id)');
select is(public.admin_event_detail('00000000-0000-4000-8000-0000000034e6') #>> '{plan,paidMethod}', 'pix', 'master vê o método do pedido pago');
select is((public.admin_event_detail('00000000-0000-4000-8000-0000000034e6') #>> '{plan,paidCents}')::int, 18900, '... e o valor');
select is(jsonb_array_length(public.admin_event_detail('00000000-0000-4000-8000-0000000034e1') -> 'printOrders'), 0, 'chave printed_album desligada: sem pedidos de impressão');
select public.admin_set_feature_flag('printed_album', true, '{}'::jsonb, 'ligando para o teste do detalhe');
select is(jsonb_array_length(public.admin_event_detail('00000000-0000-4000-8000-0000000034e1') -> 'printOrders'), 1, 'chave ligada: master vê o pedido de impressão');
select ok((public.admin_event_detail('00000000-0000-4000-8000-0000000034e1') #>> '{printOrders,0,code}') ~ '^IMP-[0-9A-F]{4}$', '... com o código IMP-XXXX');
select is(public.admin_event_detail('00000000-0000-4000-8000-0000000034e1') #>> '{printOrders,0,product}', 'album', '... e o produto');
select ok(not (public.admin_event_detail('00000000-0000-4000-8000-0000000034e1')::text ~ '65999990000'), 'sem telefone nem endereço do pedido');
select ok(jsonb_array_length(public.admin_event_detail('00000000-0000-4000-8000-0000000034e1') -> 'audit') >= 1, 'linha do tempo da auditoria presente (a marcação de teste do bloco anterior)');
select is(public.admin_event_detail('00000000-0000-4000-8000-0000000034e1') #>> '{audit,0,actorName}', 'Master 34', 'auditoria traz o nome de quem agiu');
reset role;
select tests.login('00000000-0000-4000-8000-0000000034a2', 'support');
select is(jsonb_array_length(public.admin_event_detail('00000000-0000-4000-8000-0000000034e1') -> 'printOrders'), 0, 'support não vê pedidos de impressão (só master)');
select is(public.admin_event_detail('00000000-0000-4000-8000-0000000034e6') #>> '{plan,paidCents}', null, 'support não vê o valor pago');
select is((public.admin_event_detail('00000000-0000-4000-8000-0000000034e1') #>> '{notices,subscribers}')::int, 1, 'support vê os números dos avisos');
select throws_ok($$select public.admin_event_detail(gen_random_uuid())$$, 'MM005', 'invalid', 'evento inexistente: invalid');
reset role;
select tests.login('00000000-0000-4000-8000-0000000034a3', 'auditor');
select lives_ok($$select public.admin_event_detail('00000000-0000-4000-8000-0000000034e1')$$, 'auditor lê o detalhe');
reset role;

select * from finish();
rollback;
