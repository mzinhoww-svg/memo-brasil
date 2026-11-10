-- pgTAP · pedido de impressão (sem pagamento): criação, validações, RLS, cancelamento, rate limit e telas do Master com auditoria.
begin;
select no_plan();

create schema tests;
create function tests.login(p_user uuid, p_master boolean default false) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated', 'is_anonymous', false, 'aal', 'aal1',
    'app_metadata', case when p_master then json_build_object('role', 'master') else '{}'::json end)::text, true);
  set local role authenticated;
end $$;
grant usage on schema tests to authenticated;

insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-4000-8000-0000000031a1', 'host31@test.local', false),
  ('00000000-0000-4000-8000-0000000031b1', 'guest31@test.local', false),
  ('00000000-0000-4000-8000-0000000031b2', 'other31@test.local', false),
  ('00000000-0000-4000-8000-0000000031c1', 'master31@test.local', false),
  ('00000000-0000-4000-8000-0000000031d1', 'stranger31@test.local', false);
insert into public.profiles (id) select id from auth.users where email like '%31@test.local' on conflict do nothing;
insert into public.platform_roles (user_id, role) values ('00000000-0000-4000-8000-0000000031c1', 'master');

insert into public.events (id, title, category, host_id, host_name, duration_hours, capacity, shots_per_person, reveal_enabled) values
  ('00000000-0000-4000-8000-0000000031e1', 'Impressão 31 revelado', 'casamento', '00000000-0000-4000-8000-0000000031a1', 'Host 31', 6, 20, 10, false);
insert into public.events (id, title, category, host_id, host_name, duration_hours, capacity, shots_per_person, reveal_enabled, reveal_anchor, reveal_at) values
  ('00000000-0000-4000-8000-0000000031e2', 'Impressão 31 pendente', 'outro', '00000000-0000-4000-8000-0000000031a1', 'Host 31', 6, 20, 10, true, 'data', now() + interval '30 days');
insert into public.participants (event_id, user_id, name) values
  ('00000000-0000-4000-8000-0000000031e1', '00000000-0000-4000-8000-0000000031b1', 'Ana 31'),
  ('00000000-0000-4000-8000-0000000031e1', '00000000-0000-4000-8000-0000000031b2', 'Bia 31'),
  ('00000000-0000-4000-8000-0000000031e2', '00000000-0000-4000-8000-0000000031b1', 'Ana 31');
update public.participants set blocked_at = now() where user_id = '00000000-0000-4000-8000-0000000031b2';
insert into public.photos (id, event_id, author_id, author_name, storage_path, upload_status) values
  ('00000000-0000-4000-8000-0000000031f1', '00000000-0000-4000-8000-0000000031e1', '00000000-0000-4000-8000-0000000031b1', 'Ana 31', '00000000-0000-4000-8000-0000000031e1/00000000-0000-4000-8000-0000000031f1', 'pronta'),
  ('00000000-0000-4000-8000-0000000031f2', '00000000-0000-4000-8000-0000000031e1', '00000000-0000-4000-8000-0000000031b1', 'Ana 31', '00000000-0000-4000-8000-0000000031e1/00000000-0000-4000-8000-0000000031f2', 'pronta'),
  ('00000000-0000-4000-8000-0000000031f3', '00000000-0000-4000-8000-0000000031e1', '00000000-0000-4000-8000-0000000031b1', 'Ana 31', '00000000-0000-4000-8000-0000000031e1/00000000-0000-4000-8000-0000000031f3', 'enviando'),
  ('00000000-0000-4000-8000-0000000031f4', '00000000-0000-4000-8000-0000000031e2', '00000000-0000-4000-8000-0000000031b1', 'Ana 31', '00000000-0000-4000-8000-0000000031e2/00000000-0000-4000-8000-0000000031f4', 'pronta');

create function tests.mk(p_id uuid, p_event uuid, p_photos uuid[] default array['00000000-0000-4000-8000-0000000031f1']::uuid[], p_all boolean default false,
                         p_product text default 'album', p_phone text default '(65) 99999-1234', p_email text default null,
                         p_ship jsonb default '{"cep":"78000-000","street":"Rua das Flores","number":"10","neighborhood":"Centro","city":"Cuiabá","state":"mt"}')
returns jsonb language sql as $$
  select public.create_print_order(p_id, p_event, p_product, 2, p_photos, p_all, 'Maria Souza', p_phone, p_email, p_ship, 'Entregar à tarde')
$$;
grant execute on function tests.mk(uuid, uuid, uuid[], boolean, text, text, text, jsonb) to authenticated;

-- ===================================================================== criar
select tests.login('00000000-0000-4000-8000-0000000031a1');
select is((tests.mk('00000000-0000-4000-8000-000000031a01', '00000000-0000-4000-8000-0000000031e1') ->> 'status'), 'solicitado', 'anfitrião cria o pedido: nasce solicitado');
select is((select requester_kind from public.print_orders where id = '00000000-0000-4000-8000-000000031a01'), 'anfitriao', 'marcado como pedido de anfitrião');
select is((select contact_phone from public.print_orders where id = '00000000-0000-4000-8000-000000031a01'), '65999991234', 'telefone normalizado para dígitos');
select is((select shipping ->> 'state' from public.print_orders where id = '00000000-0000-4000-8000-000000031a01'), 'MT', 'UF em maiúsculas');
select is((select shipping ->> 'cep' from public.print_orders where id = '00000000-0000-4000-8000-000000031a01'), '78000000', 'CEP só com dígitos');
select is((tests.mk('00000000-0000-4000-8000-000000031a01', '00000000-0000-4000-8000-0000000031e1') ->> 'id'), '00000000-0000-4000-8000-000000031a01', 'reenvio com o mesmo id devolve o mesmo pedido');
select is((select count(*)::int from public.print_orders where requester_id = '00000000-0000-4000-8000-0000000031a1'), 1, '... sem duplicar');
select lives_ok($$select tests.mk('00000000-0000-4000-8000-000000031a02', '00000000-0000-4000-8000-0000000031e1', '{}', true, 'caixa', null, 'maria@exemplo.com')$$, 'todas as fotos, só com e-mail');
select is((select all_photos from public.print_orders where id = '00000000-0000-4000-8000-000000031a02'), true, 'pedido de todas as fotos');
select throws_ok($$select tests.mk('00000000-0000-4000-8000-000000031a03', '00000000-0000-4000-8000-0000000031e2', '{00000000-0000-4000-8000-0000000031f4}')$$, 'MM005', null, 'evento ainda não revelado é recusado');
select throws_ok($$select tests.mk('00000000-0000-4000-8000-000000031a04', '00000000-0000-4000-8000-0000000031e1', '{00000000-0000-4000-8000-0000000031f3}')$$, 'MM005', null, 'foto que não está pronta é recusada');
select throws_ok($$select tests.mk('00000000-0000-4000-8000-000000031a05', '00000000-0000-4000-8000-0000000031e1', '{00000000-0000-4000-8000-0000000031f4}')$$, 'MM005', null, 'foto de outro evento é recusada');
select throws_ok($$select tests.mk('00000000-0000-4000-8000-000000031a06', '00000000-0000-4000-8000-0000000031e1', '{}')$$, 'MM005', null, 'sem fotos e sem "todas" é recusado');
select throws_ok($$select tests.mk('00000000-0000-4000-8000-000000031a07', '00000000-0000-4000-8000-0000000031e1', null, false, 'poster')$$, 'MM005', null, 'produto fora do desenho é recusado');
select throws_ok($$select tests.mk('00000000-0000-4000-8000-000000031a08', '00000000-0000-4000-8000-0000000031e1', null, false, 'album', null, null)$$, 'MM005', null, 'sem telefone nem e-mail é recusado');
select throws_ok($$select tests.mk('00000000-0000-4000-8000-000000031a09', '00000000-0000-4000-8000-0000000031e1', null, false, 'album', '123')$$, 'MM005', null, 'telefone curto é recusado');
select throws_ok($$select tests.mk('00000000-0000-4000-8000-000000031a0a', '00000000-0000-4000-8000-0000000031e1', null, false, 'album', null, 'sem-arroba')$$, 'MM005', null, 'e-mail inválido é recusado');
select throws_ok($$select tests.mk('00000000-0000-4000-8000-000000031a0b', '00000000-0000-4000-8000-0000000031e1', null, false, 'album', '65999991234', null, '{"cep":"123","street":"Rua","number":"1","neighborhood":"Centro","city":"Cuiabá","state":"MT"}')$$, 'MM005', null, 'CEP inválido é recusado');
select throws_ok($$select tests.mk('00000000-0000-4000-8000-000000031a0c', '00000000-0000-4000-8000-0000000031e1', null, false, 'album', '65999991234', null, '{"cep":"78000000","street":"Rua Um","number":"1","neighborhood":"Centro","city":"Cuiabá","state":"MT","x":"1"}')$$, 'MM005', null, 'campo desconhecido no endereço é recusado');
reset role;
select tests.login('00000000-0000-4000-8000-0000000031d1');
select throws_ok($$select tests.mk('00000000-0000-4000-8000-000000031a0d', '00000000-0000-4000-8000-0000000031e1')$$, 'MM004', null, 'quem não é do evento não cria');
reset role;
select tests.login('00000000-0000-4000-8000-0000000031b2');
select throws_ok($$select tests.mk('00000000-0000-4000-8000-000000031a0e', '00000000-0000-4000-8000-0000000031e1')$$, 'MM004', null, 'convidado bloqueado não cria');
reset role;

-- convidado
select tests.login('00000000-0000-4000-8000-0000000031b1');
select is((tests.mk('00000000-0000-4000-8000-000000031b01', '00000000-0000-4000-8000-0000000031e1') ->> 'status'), 'solicitado', 'convidado cria pedido de evento revelado');
select is((select requester_kind from public.print_orders where id = '00000000-0000-4000-8000-000000031b01'), 'convidado', 'marcado como convidado');
select throws_ok($$select tests.mk('00000000-0000-4000-8000-000000031a01', '00000000-0000-4000-8000-0000000031e1')$$, 'MM004', null, 'não reaproveita o id de pedido de outra pessoa');

-- ===================================================================== leitura / RLS
select is(jsonb_array_length(public.list_my_print_orders('00000000-0000-4000-8000-0000000031e1')), 1, 'convidado vê só o seu');
select is((public.list_my_print_orders('00000000-0000-4000-8000-0000000031e1') -> 0 ->> 'mine')::boolean, true, 'marcado como meu');
select ok(not (public.list_my_print_orders() -> 0 ? 'noteInternal'), 'lista do usuário não traz nota interna');
select is((select count(id)::int from public.print_orders), 1, 'RLS: select direto só mostra o do convidado');
select throws_ok($$select note_internal from public.print_orders$$, '42501', null, 'nota interna não é legível pelo cliente');
select throws_ok($$insert into public.print_orders (event_id, requester_kind, product, quantity, contact_name, contact_phone, shipping) values (null, 'convidado', 'album', 1, 'Fulano', '65999991234', '{}')$$, '42501', null, 'sem escrita direta na tabela');
select throws_ok($$select public.admin_print_orders()$$, 'MM004', null, 'convidado não usa a lista do Master');
reset role;
select tests.login('00000000-0000-4000-8000-0000000031a1');
select is(jsonb_array_length(public.list_my_print_orders('00000000-0000-4000-8000-0000000031e1')), 3, 'anfitrião vê os pedidos do próprio evento (dele e do convidado)');
select is((select count(id)::int from public.print_orders), 3, 'RLS: anfitrião lê os 3 do evento');
reset role;
select tests.login('00000000-0000-4000-8000-0000000031d1');
select is(jsonb_array_length(public.list_my_print_orders()), 0, 'estranho não vê nada');
select is((select count(id)::int from public.print_orders), 0, 'RLS: estranho não lê a tabela');
select throws_ok($$select public.cancel_print_order('00000000-0000-4000-8000-000000031a01')$$, 'MM004', null, 'estranho não cancela');
reset role;

-- ===================================================================== cancelar
select tests.login('00000000-0000-4000-8000-0000000031b1');
select is((public.cancel_print_order('00000000-0000-4000-8000-000000031b01') ->> 'status'), 'cancelado', 'convidado cancela o próprio pedido solicitado');
select is((public.cancel_print_order('00000000-0000-4000-8000-000000031b01') ->> 'status'), 'cancelado', 'cancelar de novo é idempotente');
select throws_ok($$select public.cancel_print_order('00000000-0000-4000-8000-000000031a01')$$, 'MM004', null, 'convidado não cancela o pedido do anfitrião');
reset role;

-- ===================================================================== Master
select tests.login('00000000-0000-4000-8000-0000000031a1');
select throws_ok($$select public.admin_set_print_order_status('00000000-0000-4000-8000-000000031a01', 'em_producao')$$, 'MM004', null, 'anfitrião não muda status');
reset role;
select tests.login('00000000-0000-4000-8000-0000000031c1', true);
select is((public.admin_print_orders(null, 'Impressão 31') ->> 'total')::int, 3, 'Master vê todos');
select is((public.admin_print_orders('solicitado', 'Impressão 31') ->> 'total')::int, 2, 'filtro por status');
select is((public.admin_print_orders(null, 'Impressão 31') -> 'counts' ->> 'cancelado')::int, 1, 'contagem dos chips');
select is((public.admin_print_orders(null, 'maria@exemplo') ->> 'total')::int, 1, 'busca por e-mail de contato');
select throws_ok($$select public.admin_print_orders('xx')$$, 'MM005', null, 'filtro inválido');
select is((public.admin_set_print_order_status('00000000-0000-4000-8000-000000031a01', 'em_producao', 'Arte aprovada') ->> 'status'), 'em_producao', 'Master põe em produção');
select is((select i ->> 'noteInternal' from jsonb_array_elements(public.admin_print_orders(null, 'Impressão 31') -> 'items') i where i ->> 'id' = '00000000-0000-4000-8000-000000031a01'), 'Arte aprovada', 'nota interna gravada e visível ao Master');
select throws_ok($$select public.admin_set_print_order_status('00000000-0000-4000-8000-000000031a01', 'entregue')$$, 'MM009', null, 'não pula etapas');
select throws_ok($$select public.admin_set_print_order_status('00000000-0000-4000-8000-000000031a01', 'cancelado', 'curto')$$, 'MM011', null, 'cancelar exige motivo');
select is((public.admin_set_print_order_status('00000000-0000-4000-8000-000000031a01', 'enviado') ->> 'status'), 'enviado', 'enviado');
select is((public.admin_set_print_order_status('00000000-0000-4000-8000-000000031a01', 'entregue') ->> 'status'), 'entregue', 'entregue');
select throws_ok($$select public.admin_set_print_order_status('00000000-0000-4000-8000-000000031a01', 'cancelado', 'motivo suficiente')$$, 'MM009', null, 'entregue é final');
select is((select count(*)::int from public.audit_logs where target_type = 'print_order' and action = 'print_order.status_changed' and target_id = '00000000-0000-4000-8000-000000031a01'), 3, 'cada mudança de status foi auditada');
select is((select detail ->> 'to' from public.audit_logs where target_id = '00000000-0000-4000-8000-000000031a01' and action = 'print_order.status_changed' order by id desc limit 1), 'entregue', 'com origem e destino');
reset role;
-- anfitrião: pedido já em produção não cancela
select tests.login('00000000-0000-4000-8000-0000000031a1');
select throws_ok($$select public.cancel_print_order('00000000-0000-4000-8000-000000031a01')$$, 'MM009', null, 'depois de solicitado não cancela mais');
select is((public.cancel_print_order('00000000-0000-4000-8000-000000031a02') ->> 'status'), 'cancelado', 'anfitrião cancela pedido solicitado do próprio evento');
reset role;
select ok(exists (select 1 from public.audit_logs where action = 'print_order.created' and target_id = '00000000-0000-4000-8000-000000031a01'), 'criação auditada');
select ok(not exists (select 1 from public.audit_logs where action like 'print_order.%' and detail::text ~ '(Maria|99999|Rua das)'), 'a auditoria não guarda contato nem endereço');

-- ===================================================================== rate limit
select tests.login('00000000-0000-4000-8000-0000000031b1');
select tests.mk(('00000000-0000-4000-8000-000000031c0' || g)::uuid, '00000000-0000-4000-8000-0000000031e1') from generate_series(1, 5) g;
select throws_ok($$select tests.mk('00000000-0000-4000-8000-000000031c0f', '00000000-0000-4000-8000-0000000031e1')$$, 'MM006', null, 'limite de pedidos por hora');
reset role;

select * from finish();
rollback;
