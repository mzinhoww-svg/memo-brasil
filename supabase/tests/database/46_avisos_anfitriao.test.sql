-- pgTAP · avisos ao anfitrião por WhatsApp (recuperação de pedido): opt-in próprio do anfitrião, fila com agendamento e as regras de
-- elegibilidade que cancelam o envio (pago, pedido mais novo, evento passou, teste/equipe, sem opt-in).
begin;
select no_plan();

insert into auth.users (id, aud, role, email, is_anonymous) values
  ('00000000-0000-4000-8000-0000000046a1', 'authenticated', 'authenticated', 'host46@test.local', false),
  ('00000000-0000-4000-8000-0000000046a2', 'authenticated', 'authenticated', 'semoptin46@test.local', false);
insert into public.profiles (id, display_name) values ('00000000-0000-4000-8000-0000000046a1', 'Ana Souza') on conflict (id) do update set display_name = excluded.display_name;
insert into public.profiles (id) values ('00000000-0000-4000-8000-0000000046a2') on conflict do nothing;
insert into public.feature_flags (key, enabled) values ('whatsapp_avisos', true) on conflict (key) do update set enabled = true;

insert into public.events (id, title, category, host_id, host_name, duration_hours, capacity, shots_per_person, start_at) values
  ('00000000-0000-4000-8000-0000000046e1', 'Casamento Ana', 'casamento', '00000000-0000-4000-8000-0000000046a1', 'Ana', 6, 10, 10, now() + interval '10 days'),
  ('00000000-0000-4000-8000-0000000046e2', 'Já passou', 'festa', '00000000-0000-4000-8000-0000000046a1', 'Ana', 6, 10, 10, now() - interval '3 days'),
  ('00000000-0000-4000-8000-0000000046e3', 'Sem opt-in', 'festa', '00000000-0000-4000-8000-0000000046a2', 'B', 6, 10, 10, now() + interval '10 days');

-- ===================================================== estrutura e privilégios
select has_table('public', 'host_whatsapp', 'host_whatsapp existe');
select has_table('public', 'host_outbox', 'host_outbox existe');
select ok(not has_table_privilege('anon', 'public.host_outbox', 'select'), 'anon não lê a fila');
select ok(not has_table_privilege('authenticated', 'public.host_outbox', 'select'), 'authenticated não lê a fila');
select ok(not has_function_privilege('authenticated', 'public.host_claim_batch(int, int)', 'execute'), 'só o serviço retira da fila');
select ok(not has_function_privilege('authenticated', 'public.host_whatsapp_apply_event(text, uuid, text, timestamptz)', 'execute'), 'só o serviço aplica opt-in');

-- ===================================================== opt-in do anfitrião (vem do gateway)
select is(public.host_whatsapp_apply_event('optin.confirmed', '00000000-0000-4000-8000-0000000046a1', '+55 (65) 99999-0000', now()), 'applied', 'opt-in confirmado');
select is((select whatsapp_phone from public.host_whatsapp where user_id = '00000000-0000-4000-8000-0000000046a1'), '5565999990000', 'telefone só com dígitos');
select is(public.host_whatsapp_apply_event('optin.confirmed', '00000000-0000-4000-8000-0000000046b9', '5565999990000', now()), 'unknown_subject', 'usuário inexistente');

-- ===================================================== pedido de produção agenda 1 h e 24 h; sandbox não agenda
insert into public.payment_orders (id, event_id, host_id, plan_code, amount_cents, status, provider, provider_env, idempotency_key, created_at)
values ('00000000-0000-4000-8000-0000000046c1', '00000000-0000-4000-8000-0000000046e1', '00000000-0000-4000-8000-0000000046a1', 'ate150', 14700, 'expirado', 'validapay', 'production', gen_random_uuid(), now() - interval '2 hours');
select is((select array_agg(kind order by send_after) from public.host_outbox where order_id = '00000000-0000-4000-8000-0000000046c1'),
          array['pedido_1h', 'pedido_24h'], 'pedido agenda 1 h e 24 h');
select ok((select send_after from public.host_outbox where order_id = '00000000-0000-4000-8000-0000000046c1' and kind = 'pedido_1h')
          = (select created_at + interval '1 hour' from public.payment_orders where id = '00000000-0000-4000-8000-0000000046c1'), '1 h depois do pedido');
insert into public.payment_orders (id, event_id, host_id, plan_code, amount_cents, status, provider, provider_env, idempotency_key)
values ('00000000-0000-4000-8000-0000000046c9', '00000000-0000-4000-8000-0000000046e3', '00000000-0000-4000-8000-0000000046a2', 'ate150', 14700, 'expirado', 'mercadopago', 'sandbox', gen_random_uuid());
select is((select count(*)::int from public.host_outbox where order_id = '00000000-0000-4000-8000-0000000046c9'), 0, 'sandbox não agenda');

-- ===================================================== retirada: só o vencido, com opt-in, elegível
select is((select count(*)::int from public.host_claim_batch(10, 55)), 1, 'só o aviso de 1 h está vencido');
select is((select kind from public.host_outbox where order_id = '00000000-0000-4000-8000-0000000046c1' and attempts = 1), 'pedido_1h', 'retirou o de 1 h');
select results_eq($$select h.kind, h.phone, h.host_name, h.event_title, h.plan_code from public.host_claim_batch(10, 55) h$$,
                  $$select null::text, null::text, null::text, null::text, null::text where false$$, 'nada mais vencido');
-- conteúdo devolvido ao worker (refaz a retirada do mesmo item para conferir as colunas)
update public.host_outbox set next_attempt_at = now() - interval '1 minute' where order_id = '00000000-0000-4000-8000-0000000046c1' and kind = 'pedido_1h';
select results_eq($$select h.kind, h.phone, h.host_name, h.event_title, h.plan_code from public.host_claim_batch(10, 55) h$$,
                  $$values ('pedido_1h'::text, '5565999990000'::text, 'Ana'::text, 'Casamento Ana'::text, 'ate150'::text)$$, 'colunas para a mensagem');

-- pago depois: o de 24 h é cancelado
update public.host_outbox set send_after = now() - interval '1 minute' where order_id = '00000000-0000-4000-8000-0000000046c1' and kind = 'pedido_24h';
update public.payment_orders set status = 'pago', paid_at = now() where id = '00000000-0000-4000-8000-0000000046c1';
select is((select count(*)::int from public.host_claim_batch(10, 55)), 0, 'pago não recebe aviso');
select is((select status || ':' || last_error from public.host_outbox where order_id = '00000000-0000-4000-8000-0000000046c1' and kind = 'pedido_24h'), 'cancelado:pago', 'cancelado com motivo');

-- evento que já passou: cancelado
insert into public.payment_orders (id, event_id, host_id, plan_code, amount_cents, status, provider, provider_env, idempotency_key, created_at)
values ('00000000-0000-4000-8000-0000000046c2', '00000000-0000-4000-8000-0000000046e2', '00000000-0000-4000-8000-0000000046a1', 'ate150', 14700, 'expirado', 'validapay', 'production', gen_random_uuid(), now() - interval '2 hours');
select is((select count(*)::int from public.host_claim_batch(10, 55)), 0, 'evento passado não recebe aviso');
select is((select last_error from public.host_outbox where order_id = '00000000-0000-4000-8000-0000000046c2' and kind = 'pedido_1h'), 'evento_passou', 'motivo: evento passou');

-- sem opt-in: cancelado (não acumula fila)
insert into public.payment_orders (id, event_id, host_id, plan_code, amount_cents, status, provider, provider_env, idempotency_key, created_at)
values ('00000000-0000-4000-8000-0000000046c3', '00000000-0000-4000-8000-0000000046e3', '00000000-0000-4000-8000-0000000046a2', 'ate150', 14700, 'expirado', 'validapay', 'production', gen_random_uuid(), now() - interval '2 hours');
select is((select count(*)::int from public.host_claim_batch(10, 55)), 0, 'sem opt-in não recebe aviso');
select is((select last_error from public.host_outbox where order_id = '00000000-0000-4000-8000-0000000046c3' and kind = 'pedido_1h'), 'sem_optin', 'motivo: sem opt-in');

-- equipe (master) não recebe: são testes
insert into public.payment_orders (id, event_id, host_id, plan_code, amount_cents, status, provider, provider_env, idempotency_key, created_at)
values ('00000000-0000-4000-8000-0000000046c4', '00000000-0000-4000-8000-0000000046e1', '00000000-0000-4000-8000-0000000046a1', 'ate300', 29700, 'expirado', 'validapay', 'production', gen_random_uuid(), now() - interval '2 hours');
select set_config('mm.audit_reason', 'teste 46', true);
insert into public.platform_roles (user_id, role) values ('00000000-0000-4000-8000-0000000046a1', 'master');
select is((select count(*)::int from public.host_claim_batch(10, 55)), 0, 'equipe não recebe aviso');
select is((select last_error from public.host_outbox where order_id = '00000000-0000-4000-8000-0000000046c4' and kind = 'pedido_1h'), 'teste', 'motivo: teste');

-- opt-out pelo gateway (SAIR)
select is(public.host_whatsapp_apply_event('optin.revoked', '00000000-0000-4000-8000-0000000046a1', null, now() + interval '1 second'), 'applied', 'opt-out aplicado');
select is((select whatsapp_optin::text || ':' || coalesce(whatsapp_phone, '-') from public.host_whatsapp where user_id = '00000000-0000-4000-8000-0000000046a1'), 'false:-', 'saiu: sem telefone');

select * from finish();
rollback;
