-- pgTAP · Master: Impressões (M29/M30) e Configurações (M31). Permissão por papel e por ação, status só avança na ordem, cancelar pede motivo e não desfaz,
-- nota interna só do master, fotos só como números, validade do Pix de 5 a 1.440, motivo de 10 a 500, ambiente do pagamento somente leitura, auditoria.
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
  ('00000000-0000-4000-8000-0000000036a1', 'master36@test.local', false),
  ('00000000-0000-4000-8000-0000000036a2', 'host36@test.local', false),
  ('00000000-0000-4000-8000-0000000036a3', 'support36@test.local', false),
  ('00000000-0000-4000-8000-0000000036a4', 'auditor36@test.local', false),
  ('00000000-0000-4000-8000-0000000036a5', 'sempapel36@test.local', false);
insert into public.profiles (id, display_name) select id, case when email like 'master%' then 'Marcos Master' else '' end from auth.users where email like '%36@test.local' on conflict do nothing;
update public.profiles set display_name = 'Marcos Master' where id = '00000000-0000-4000-8000-0000000036a1';
insert into public.platform_roles (user_id, role) values
  ('00000000-0000-4000-8000-0000000036a1', 'master'), ('00000000-0000-4000-8000-0000000036a3', 'support'), ('00000000-0000-4000-8000-0000000036a4', 'auditor');
insert into public.events (id, title, category, host_id, host_name, duration_hours, capacity, shots_per_person, reveal_enabled) values
  ('00000000-0000-4000-8000-0000000036e1', 'Álbum 36', 'casamento', '00000000-0000-4000-8000-0000000036a2', 'Host 36', 6, 20, 10, false);
insert into public.photos (id, event_id, author_id, author_name, storage_path, upload_status, created_at)
select ('00000000-0000-4000-8000-00000036f' || lpad(g::text, 3, '0'))::uuid, '00000000-0000-4000-8000-0000000036e1', null, 'Host 36',
       '00000000-0000-4000-8000-0000000036e1/00000000-0000-4000-8000-00000036f' || lpad(g::text, 3, '0'), case when g = 5 then 'enviando' else 'pronta' end::public.upload_status, now() - (30 - g) * interval '1 minute'
  from generate_series(1, 24) g;
-- pedidos criados direto (a criação em si é testada em 31_print_orders)
insert into public.print_orders (id, event_id, event_title, requester_id, requester_kind, product, quantity, photo_ids, all_photos, contact_name, contact_phone, contact_email, shipping, note, note_internal) values
  ('00000000-0000-4000-8000-000000036b01', '00000000-0000-4000-8000-0000000036e1', 'Álbum 36', '00000000-0000-4000-8000-0000000036a2', 'anfitriao', 'album', 1,
   '{00000000-0000-4000-8000-00000036f003,00000000-0000-4000-8000-00000036f007,00000000-0000-4000-8000-00000036f005}', false, 'Ana Ribeiro', '65998124077', 'ana.ribeiro@email.com',
   '{"cep":"78060000","street":"Rua das Mangueiras","number":"480","neighborhood":"Jardim Itália","city":"Cuiabá","state":"MT"}', 'Entregar na portaria', 'Conferir o papel fosco'),
  ('00000000-0000-4000-8000-000000036b02', '00000000-0000-4000-8000-0000000036e1', 'Álbum 36', '00000000-0000-4000-8000-0000000036a2', 'convidado', 'caixa', 2,
   '{}', true, 'Bia Moraes', null, 'bia@email.com',
   '{"cep":"78060000","street":"Rua Um","number":"1","neighborhood":"Centro","city":"Cuiabá","state":"MT"}', null, null);

-- ===================================================================== código do pedido
create table tests.codes as select id, public.print_order_code(seq) as code from public.print_orders;
grant select on tests.codes to authenticated;
select matches((select code from tests.codes where id = '00000000-0000-4000-8000-000000036b01'), '^IMP-[2-9A-HJ-NP-Z]{4}$', 'código curto do pedido');
select is((select count(distinct public.print_order_code(g))::int from generate_series(1, 5000) g), 5000, 'códigos não se repetem');

-- ===================================================================== permissão por papel (lista, detalhe, nota, status)
select tests.login('00000000-0000-4000-8000-0000000036a1', 'master');
select is((public.admin_print_orders(null, 'Álbum 36') ->> 'total')::int, 2, 'master lista');
select is((public.admin_print_orders(null, (select code from tests.codes where id = '00000000-0000-4000-8000-000000036b01')) ->> 'total')::int, 1, 'busca pelo código do pedido');
select matches((public.admin_print_orders(null, 'Ana Ribeiro') -> 'items' -> 0 ->> 'code'), '^IMP-', 'a lista traz o código');
reset role;
select tests.login('00000000-0000-4000-8000-0000000036a3', 'support');
select throws_ok($$select public.admin_print_orders()$$, 'MM004', null, 'support não lista');
select throws_ok($$select public.admin_print_order_detail('00000000-0000-4000-8000-000000036b01')$$, 'MM004', null, 'support não abre o detalhe');
select throws_ok($$select public.admin_set_print_order_note('00000000-0000-4000-8000-000000036b01', 'x')$$, 'MM004', null, 'support não grava a nota');
select throws_ok($$select public.admin_set_print_order_status('00000000-0000-4000-8000-000000036b01', 'em_producao')$$, 'MM004', null, 'support não muda status');
reset role;
select tests.login('00000000-0000-4000-8000-0000000036a4', 'auditor');
select throws_ok($$select public.admin_print_orders()$$, 'MM004', null, 'auditor não lista');
select throws_ok($$select public.admin_print_order_detail('00000000-0000-4000-8000-000000036b01')$$, 'MM004', null, 'auditor não abre o detalhe');
select throws_ok($$select public.admin_set_print_order_note('00000000-0000-4000-8000-000000036b01', 'x')$$, 'MM004', null, 'auditor não grava a nota');
select throws_ok($$select public.admin_set_print_order_status('00000000-0000-4000-8000-000000036b01', 'em_producao')$$, 'MM004', null, 'auditor não muda status');
reset role;
select tests.login('00000000-0000-4000-8000-0000000036a2');
select throws_ok($$select public.admin_print_order_detail('00000000-0000-4000-8000-000000036b01')$$, 'MM004', null, 'nem o anfitrião do pedido abre o detalhe do Master');
select throws_ok($$select public.admin_set_print_order_note('00000000-0000-4000-8000-000000036b01', 'x')$$, 'MM004', null, 'anfitrião não grava a nota interna');
select ok(not (public.list_my_print_orders() -> 0 ? 'noteInternal'), 'o anfitrião nunca recebe a nota interna');
reset role;
select tests.login('00000000-0000-4000-8000-0000000036a5');
select throws_ok($$select public.admin_print_order_detail('00000000-0000-4000-8000-000000036b01')$$, 'MM004', null, 'conta sem papel não abre o detalhe');
reset role;
set local role anon;
select throws_ok($$select public.admin_print_order_detail('00000000-0000-4000-8000-000000036b01')$$, '42501', null, 'sem sessão não abre o detalhe');
reset role;

-- ===================================================================== detalhe: contato, endereço, fotos só como números, nota interna
select tests.login('00000000-0000-4000-8000-0000000036a1', 'master');
select is(public.admin_print_order_detail('00000000-0000-4000-8000-000000036b01') ->> 'contactEmail', 'ana.ribeiro@email.com', 'master vê o contato completo');
select is(public.admin_print_order_detail('00000000-0000-4000-8000-000000036b01') #>> '{shipping,street}', 'Rua das Mangueiras', 'e o endereço');
select is(public.admin_print_order_detail('00000000-0000-4000-8000-000000036b01') ->> 'note', 'Entregar na portaria', 'e a observação');
select is(public.admin_print_order_detail('00000000-0000-4000-8000-000000036b01') ->> 'noteInternal', 'Conferir o papel fosco', 'e a nota interna');
select is(public.admin_print_order_detail('00000000-0000-4000-8000-000000036b01') -> 'photoNums', '[3,6]'::jsonb, 'fotos como números (posição no evento; a foto 5 não está pronta e some, a 7 vira 6)');
select is((public.admin_print_order_detail('00000000-0000-4000-8000-000000036b01') ->> 'photoCount')::int, 2, 'contagem das fotos escolhidas que existem');
select is(public.admin_print_order_detail('00000000-0000-4000-8000-000000036b01') ->> 'code', (select code from tests.codes where id = '00000000-0000-4000-8000-000000036b01'), 'o detalhe traz o código');
select ok(public.admin_print_order_detail('00000000-0000-4000-8000-000000036b01')::text !~ '36f0', 'nenhum id de foto sai no detalhe');
select ok(public.admin_print_order_detail('00000000-0000-4000-8000-000000036b01')::text !~* 'storage|http', 'nenhum caminho nem URL de foto');
select is((public.admin_print_order_detail('00000000-0000-4000-8000-000000036b02') ->> 'photoCount')::int, 23, '"todas as fotos": conta as prontas do evento');
select is(jsonb_array_length(public.admin_print_order_detail('00000000-0000-4000-8000-000000036b02') -> 'photoNums'), 18, 'mostra só os 18 primeiros números');
select is(public.admin_print_order_detail('00000000-0000-4000-8000-000000036b99'), null, 'pedido que não existe devolve null');
select is(jsonb_array_length(public.admin_print_order_detail('00000000-0000-4000-8000-000000036b01') -> 'history'), 1, 'histórico começa só com "solicitado"');
select is(public.admin_print_order_detail('00000000-0000-4000-8000-000000036b01') #>> '{history,0,by}', 'Ana Ribeiro', 'quem pediu');

-- nota interna
select is(public.admin_set_print_order_note('00000000-0000-4000-8000-000000036b01', '  Arte aprovada  ') ->> 'noteInternal', 'Arte aprovada', 'master grava a nota interna (aparada)');
select throws_ok($$select public.admin_set_print_order_note('00000000-0000-4000-8000-000000036b01', repeat('x', 501))$$, 'MM005', null, 'nota acima de 500 é recusada');
select lives_ok($$select public.admin_set_print_order_note('00000000-0000-4000-8000-000000036b01', repeat('x', 500))$$, 'nota de 500 passa');
select is(public.admin_set_print_order_note('00000000-0000-4000-8000-000000036b01', '   ') ->> 'noteInternal', null, 'nota em branco limpa');
select throws_ok($$select public.admin_set_print_order_note('00000000-0000-4000-8000-000000036b99', 'x')$$, 'MM005', null, 'nota de pedido que não existe');
select public.admin_set_print_order_note('00000000-0000-4000-8000-000000036b01', 'Conferir o papel fosco');

-- ===================================================================== status: só avança na ordem; cancelar pede motivo e não desfaz
select throws_ok($$select public.admin_set_print_order_status('00000000-0000-4000-8000-000000036b01', 'entregue')$$, 'MM009', null, 'não pula de solicitado para entregue');
select throws_ok($$select public.admin_set_print_order_status('00000000-0000-4000-8000-000000036b01', 'enviado')$$, 'MM009', null, 'não pula de solicitado para enviado');
select throws_ok($$select public.admin_set_print_order_status('00000000-0000-4000-8000-000000036b01', 'solicitado')$$, 'MM005', null, 'não volta para solicitado');
select is(public.admin_set_print_order_status('00000000-0000-4000-8000-000000036b01', 'em_producao') ->> 'status', 'em_producao', 'solicitado → em produção');
select is(public.admin_print_order_detail('00000000-0000-4000-8000-000000036b01') ->> 'noteInternal', 'Conferir o papel fosco', 'avançar sem texto mantém a nota interna');
select throws_ok($$select public.admin_set_print_order_status('00000000-0000-4000-8000-000000036b01', 'solicitado')$$, 'MM005', null, 'não volta');
select throws_ok($$select public.admin_set_print_order_status('00000000-0000-4000-8000-000000036b01', 'entregue')$$, 'MM009', null, 'não pula de em produção para entregue');
select is(public.admin_set_print_order_status('00000000-0000-4000-8000-000000036b01', 'enviado') ->> 'status', 'enviado', 'em produção → enviado');
select throws_ok($$select public.admin_set_print_order_status('00000000-0000-4000-8000-000000036b01', 'cancelado', 'motivo suficiente')$$, 'MM009', null, 'enviado não cancela');
select throws_ok($$select public.admin_set_print_order_status('00000000-0000-4000-8000-000000036b01', 'em_producao')$$, 'MM009', null, 'enviado não volta');
select is(public.admin_set_print_order_status('00000000-0000-4000-8000-000000036b01', 'entregue') ->> 'status', 'entregue', 'enviado → entregue');
select throws_ok($$select public.admin_set_print_order_status('00000000-0000-4000-8000-000000036b01', 'cancelado', 'motivo suficiente')$$, 'MM009', null, 'entregue é final');
select is(jsonb_array_length(public.admin_print_order_detail('00000000-0000-4000-8000-000000036b01') -> 'history'), 4, 'histórico: solicitado, produção, enviado, entregue');
select is(public.admin_print_order_detail('00000000-0000-4000-8000-000000036b01') #>> '{history,1,by}', 'Marcos Master', 'e quem mudou');

-- cancelar
select throws_ok($$select public.admin_set_print_order_status('00000000-0000-4000-8000-000000036b02', 'cancelado')$$, 'MM011', null, 'cancelar sem motivo é recusado');
select throws_ok($$select public.admin_set_print_order_status('00000000-0000-4000-8000-000000036b02', 'cancelado', '123456789')$$, 'MM011', null, 'motivo de 9 caracteres é recusado');
select throws_ok($$select public.admin_set_print_order_status('00000000-0000-4000-8000-000000036b02', 'cancelado', repeat('x', 501))$$, 'MM011', null, 'motivo de 501 caracteres é recusado');
select is(public.admin_print_order_detail('00000000-0000-4000-8000-000000036b02') ->> 'status', 'solicitado', 'nada mudou com as recusas');
select is(public.admin_set_print_order_status('00000000-0000-4000-8000-000000036b02', 'cancelado', 'Anfitrião pediu o cancelamento por telefone') ->> 'status', 'cancelado', 'cancelar com motivo');
select is(public.admin_print_order_detail('00000000-0000-4000-8000-000000036b02') #>> '{history,1,reason}', 'Anfitrião pediu o cancelamento por telefone', 'o motivo aparece no histórico');
select is(public.admin_print_order_detail('00000000-0000-4000-8000-000000036b02') ->> 'noteInternal', null, 'o motivo do cancelamento não vira nota interna');
select throws_ok($$select public.admin_set_print_order_status('00000000-0000-4000-8000-000000036b02', 'em_producao')$$, 'MM009', null, 'cancelado não reabre');
select throws_ok($$select public.admin_set_print_order_status('00000000-0000-4000-8000-000000036b02', 'solicitado')$$, 'MM005', null, 'cancelado não volta a solicitado');
select throws_ok($$select public.admin_set_print_order_status('00000000-0000-4000-8000-000000036b02', 'cancelado', 'cancelar de novo, sem efeito')$$, 'MM009', null, 'cancelar de novo é recusado');
select is((select reason from public.audit_logs where target_id = '00000000-0000-4000-8000-000000036b02' and action = 'print_order.status_changed'), 'Anfitrião pediu o cancelamento por telefone', 'motivo na auditoria');
select is((select count(*)::int from public.audit_logs where target_id = '00000000-0000-4000-8000-000000036b01' and action = 'print_order.status_changed'), 3, 'cada mudança foi auditada');
select is((select detail ->> 'length' from public.audit_logs where target_id = '00000000-0000-4000-8000-000000036b01' and action = 'print_order.note_updated' order by id limit 1), '13', 'auditoria da nota guarda só o tamanho');
select ok(not exists (select 1 from public.audit_logs where action = 'print_order.note_updated' and detail::text ~ 'Arte aprovada'), 'e nunca o texto da nota');
reset role;

-- ===================================================================== Configurações: permissão por papel
select tests.login('00000000-0000-4000-8000-0000000036a3', 'support');
select throws_ok($$select public.admin_config_overview()$$, 'MM004', null, 'support não lê a visão de configurações');
select throws_ok($$select public.admin_set_setting('validapay_pix_expiry_minutes', '30'::jsonb, 'support tentando mudar')$$, 'MM004', null, 'support não muda parâmetro');
select throws_ok($$select public.admin_set_feature_flag('printed_album', true, '{}'::jsonb, 'support tentando ligar')$$, 'MM004', null, 'support não liga chave');
reset role;
select tests.login('00000000-0000-4000-8000-0000000036a4', 'auditor');
select throws_ok($$select public.admin_config_overview()$$, 'MM004', null, 'auditor não lê a visão de configurações');
select throws_ok($$select public.admin_set_setting('support_email', '"x@y.com"'::jsonb, 'auditor tentando mudar')$$, 'MM004', null, 'auditor não muda parâmetro');
select throws_ok($$select public.admin_set_feature_flag('validapay_card', true, '{}'::jsonb, 'auditor tentando ligar')$$, 'MM004', null, 'auditor não liga chave');
reset role;
select tests.login('00000000-0000-4000-8000-0000000036a2');
select throws_ok($$select public.admin_config_overview()$$, 'MM004', null, 'anfitrião não lê a visão de configurações');
select throws_ok($$select public.admin_set_setting('validapay_pix_expiry_minutes', '30'::jsonb, 'anfitrião tentando mudar')$$, 'MM004', null, 'anfitrião não muda parâmetro');
reset role;
select tests.login('00000000-0000-4000-8000-0000000036a5');
select throws_ok($$select public.admin_set_feature_flag('printed_album', true, '{}'::jsonb, 'sem papel tentando ligar')$$, 'MM004', null, 'conta sem papel não liga chave');
reset role;
set local role anon;
select throws_ok($$select public.admin_config_overview()$$, '42501', null, 'sem sessão não lê a visão de configurações');
reset role;

-- ===================================================================== Configurações: master
select tests.login('00000000-0000-4000-8000-0000000036a1', 'master');
select is(public.admin_config_overview() ->> 'paymentsEnv', public.payments_env(), 'o ambiente do pagamento vem do servidor');
select is(public.admin_config_overview() #>> '{flags,printed_album}', 'false', 'álbum impresso nasce desligado');
select is((public.admin_config_overview() #>> '{settings,pixMinutes}')::int, 15, 'validade do Pix padrão: 15');
select is(public.admin_config_overview() #>> '{webhook,pending}', '0', 'webhook: nada pendente');
select is(public.admin_config_overview() #>> '{webhook,lastAt}', null, 'webhook: sem evento ainda');

-- ambiente do pagamento é somente leitura
select throws_ok($$select public.admin_set_setting('payments_env', '"production"'::jsonb, 'tentando mudar o ambiente')$$, 'MM005', null, 'payments_env não muda por aqui');

-- validade do Pix: 5 a 1.440, inteiro, número
select throws_ok($$select public.admin_set_setting('validapay_pix_expiry_minutes', '4'::jsonb, 'validade fora da faixa')$$, 'MM005', null, 'Pix com 4 minutos é recusado');
select throws_ok($$select public.admin_set_setting('validapay_pix_expiry_minutes', '1441'::jsonb, 'validade fora da faixa')$$, 'MM005', null, 'Pix com 1.441 minutos é recusado');
select throws_ok($$select public.admin_set_setting('validapay_pix_expiry_minutes', '0'::jsonb, 'validade fora da faixa')$$, 'MM005', null, 'Pix com 0 é recusado');
select throws_ok($$select public.admin_set_setting('validapay_pix_expiry_minutes', '-30'::jsonb, 'validade fora da faixa')$$, 'MM005', null, 'Pix negativo é recusado');
select throws_ok($$select public.admin_set_setting('validapay_pix_expiry_minutes', '10.5'::jsonb, 'validade fora da faixa')$$, 'MM005', null, 'Pix fracionado é recusado');
select throws_ok($$select public.admin_set_setting('validapay_pix_expiry_minutes', '"30"'::jsonb, 'validade como texto')$$, 'MM005', null, 'Pix como texto é recusado');
select is((public.admin_config_overview() #>> '{settings,pixMinutes}')::int, 15, 'as recusas não mudaram nada');
select lives_ok($$select public.admin_set_setting('validapay_pix_expiry_minutes', '5'::jsonb, 'validade mínima permitida')$$, 'Pix com 5 minutos passa');
select lives_ok($$select public.admin_set_setting('validapay_pix_expiry_minutes', '1440'::jsonb, 'validade máxima permitida')$$, 'Pix com 1.440 minutos passa');
select lives_ok($$select public.admin_set_setting('validapay_pix_expiry_minutes', '30'::jsonb, 'Anfitriões relataram pouco tempo para pagar')$$, 'Pix com 30 minutos passa');
select is((public.admin_config_overview() #>> '{settings,pixMinutes}')::int, 30, 'e a visão mostra o novo valor');
reset role;
select is((select detail ->> 'old' from public.audit_logs where target_id = 'validapay_pix_expiry_minutes' and reason = 'Anfitriões relataram pouco tempo para pagar'), '1440', 'auditoria guarda o valor antigo');
select is((select detail ->> 'new' from public.audit_logs where target_id = 'validapay_pix_expiry_minutes' and reason = 'Anfitriões relataram pouco tempo para pagar'), '30', 'o novo');
select tests.login('00000000-0000-4000-8000-0000000036a1', 'master');

-- motivo de 10 a 500, no servidor
select throws_ok($$select public.admin_set_setting('validapay_pix_expiry_minutes', '20'::jsonb, '123456789')$$, 'MM011', null, 'motivo de 9 caracteres é recusado (parâmetro)');
select throws_ok($$select public.admin_set_setting('validapay_pix_expiry_minutes', '20'::jsonb, '         ')$$, 'MM011', null, 'motivo em branco é recusado');
select throws_ok($$select public.admin_set_setting('validapay_pix_expiry_minutes', '20'::jsonb, repeat('x', 501))$$, 'MM011', null, 'motivo de 501 caracteres é recusado (parâmetro)');
select lives_ok($$select public.admin_set_setting('validapay_pix_expiry_minutes', '20'::jsonb, repeat('x', 500))$$, 'motivo de 500 caracteres passa');
select throws_ok($$select public.admin_set_feature_flag('validapay_card', true, '{}'::jsonb, '123456789')$$, 'MM011', null, 'motivo de 9 caracteres é recusado (chave)');
select throws_ok($$select public.admin_set_feature_flag('validapay_card', true, '{}'::jsonb, repeat('x', 501))$$, 'MM011', null, 'motivo de 501 caracteres é recusado (chave)');
select is(public.admin_config_overview() #>> '{flags,validapay_card}', 'false', 'as recusas não ligaram a chave');

-- demais parâmetros
select lives_ok($$select public.admin_set_setting('support_email', '"suporte@revela.app"'::jsonb, 'E-mail oficial do suporte')$$, 'e-mail do suporte');
select throws_ok($$select public.admin_set_setting('support_email', '"sem-arroba"'::jsonb, 'E-mail oficial do suporte')$$, 'MM005', null, 'e-mail inválido é recusado');
select throws_ok($$select public.admin_set_setting('support_email', '42'::jsonb, 'E-mail oficial do suporte')$$, 'MM005', null, 'e-mail que não é texto é recusado');
select lives_ok($$select public.admin_set_setting('support_phone', '"(65) 3000-0000"'::jsonb, 'Telefone oficial do suporte')$$, 'telefone do suporte');
select lives_ok($$select public.admin_set_setting('company_legal_name', '"Revela Tecnologia Ltda."'::jsonb, 'Razão social da empresa')$$, 'razão social');
select lives_ok($$select public.admin_set_setting('company_cnpj', '"11.222.333/0001-81"'::jsonb, 'CNPJ real da empresa')$$, 'CNPJ');
select throws_ok($$select public.admin_set_setting('company_cnpj', to_jsonb(repeat('1', 25)), 'CNPJ longo demais')$$, 'MM005', null, 'CNPJ longo demais');
select lives_ok($$select public.admin_set_setting('capacity_grace_pct', '10'::jsonb, 'Folga para convidados de última hora')$$, 'folga de capacidade');
select throws_ok($$select public.admin_set_setting('capacity_grace_pct', '101'::jsonb, 'Folga fora da faixa')$$, 'MM005', null, 'folga acima de 100 é recusada');
select throws_ok($$select public.admin_set_setting('capacity_grace_pct', '-1'::jsonb, 'Folga fora da faixa')$$, 'MM005', null, 'folga negativa é recusada');
select is(public.admin_config_overview() #>> '{settings,supportEmail}', 'suporte@revela.app', 'visão: e-mail');
select is(public.admin_config_overview() #>> '{settings,companyCnpj}', '11.222.333/0001-81', 'visão: CNPJ');
select is((public.admin_config_overview() #>> '{settings,capacityGracePct}')::int, 10, 'visão: folga');
select is(public.get_public_settings() ->> 'support_email', 'suporte@revela.app', 'e o app público lê o mesmo valor');
select lives_ok($$select public.admin_set_setting('limites.fotos', '{"max":100}'::jsonb, 'chave desconhecida segue aceita')$$, 'chave sem regra segue como antes');

-- chaves
select lives_ok($$select public.admin_set_feature_flag('printed_album', true, '{}'::jsonb, 'Liberar o álbum impresso para o piloto')$$, 'liga o álbum impresso');
select is(public.admin_config_overview() #>> '{flags,printed_album}', 'true', 'visão: ligado');
select is(public.printed_album_enabled(), true, 'e o app enxerga a chave');
select lives_ok($$select public.admin_set_feature_flag('validapay_checkout', true, '{}'::jsonb, 'Abrir o checkout para os anfitriões')$$, 'liga o checkout');
select lives_ok($$select public.admin_set_feature_flag('validapay_checkout', false, '{}'::jsonb, 'Instabilidade na ValidaPay; religar depois')$$, 'desliga o checkout');
select is(public.admin_config_overview() #>> '{flags,validapay_checkout}', 'false', 'visão: checkout desligado');
reset role;
select is((select detail ->> 'old' from public.audit_logs where action = 'feature_flags.update' and target_id = 'validapay_checkout' and reason like 'Instabilidade%'), 'true', 'auditoria da chave: antes');
select is((select detail ->> 'enabled' from public.audit_logs where action = 'feature_flags.update' and target_id = 'validapay_checkout' and reason like 'Instabilidade%'), 'false', 'auditoria da chave: depois');
select is((select actor_role from public.audit_logs where action = 'feature_flags.update' and target_id = 'validapay_checkout' and reason like 'Instabilidade%'), 'master', 'e quem fez');

-- webhook (a tabela só o serviço lê; a visão resume)
insert into public.validapay_webhook_inbox (event_id, charge_id, event_type, received_at, processed_at, attempts) values
  ('evt36a', 'cha_36a', 'charge.paid', now() - interval '1 hour', now(), 1), ('evt36b', 'cha_36b', 'charge.paid', now() - interval '5 minutes', null, 4);
select tests.login('00000000-0000-4000-8000-0000000036a1', 'master');
select is(public.admin_config_overview() #>> '{webhook,pending}', '1', 'webhook: um pendente');
select is(public.admin_config_overview() #>> '{webhook,failing}', '1', 'webhook: um com falhas repetidas');
select isnt(public.admin_config_overview() #>> '{webhook,lastAt}', null, 'webhook: horário do último evento');
reset role;

select * from finish();
rollback;
