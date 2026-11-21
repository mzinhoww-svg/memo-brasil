-- pgTAP · aviso de limite do grátis com desconto: a oferta nasce quando o evento chega a 80% dos convidados, vale 48 h de verdade,
-- entra na cotação do servidor (o mesmo valor vai para o pedido), é usada uma vez só e manda o aviso pelo WhatsApp na hora.
begin;
select no_plan();

create schema tests;
create function tests.login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated', 'is_anonymous', false, 'app_metadata', '{}'::json)::text, true);
  set local role authenticated;
end $$;
grant usage on schema tests to authenticated;
grant execute on all functions in schema tests to authenticated;

update public.platform_settings set value = to_jsonb('sandbox'::text) where key = 'payments_env';
insert into public.feature_flags (key, enabled) values ('whatsapp_avisos', true) on conflict (key) do update set enabled = true;

insert into auth.users (id, aud, role, email, is_anonymous) values
  ('00000000-0000-4000-8000-0000000048a1', 'authenticated', 'authenticated', 'host48@test.local', false),
  ('00000000-0000-4000-8000-0000000048a2', 'authenticated', 'authenticated', 'outro48@test.local', false);
insert into auth.users (id, aud, role, email, is_anonymous)
select ('00000000-0000-4000-8000-0000000048' || lpad(g::text, 2, '0'))::uuid, 'authenticated', 'authenticated', 'g' || g || '@t48.local', false
from generate_series(10, 19) g;
insert into public.profiles (id, display_name) select id, 'Pessoa' from auth.users where email like '%48@test.local' or email like '%@t48.local'
  on conflict (id) do nothing;
select public.host_whatsapp_apply_event('optin.confirmed', '00000000-0000-4000-8000-0000000048a1', '5565911112222', now());
update public.host_outbox set status = 'cancelado' where status = 'pendente';

-- evento grátis acontecendo agora
insert into public.events (id, title, category, host_id, host_name, duration_hours, capacity, shots_per_person, start_at) values
  ('00000000-0000-4000-8000-0000000048e1', 'Festa cheia', 'festa', '00000000-0000-4000-8000-0000000048a1', 'Host', 6, 10, 10, now() - interval '1 hour'),
  ('00000000-0000-4000-8000-0000000048e2', 'Outra festa', 'festa', '00000000-0000-4000-8000-0000000048a1', 'Host', 6, 10, 10, now() - interval '1 hour');
update public.host_outbox set status = 'cancelado' where status = 'pendente'; -- os lembretes do QR não são o assunto aqui

-- ===================================================== estrutura e privilégios
select has_table('public', 'upgrade_offers', 'upgrade_offers existe');
select ok(not has_table_privilege('authenticated', 'public.upgrade_offers', 'select'), 'cliente não lê a tabela de ofertas');
select ok(not has_function_privilege('authenticated', 'public.upgrade_offer_check(uuid)', 'execute'), 'cliente não cria oferta');

-- ===================================================== 7 convidados (70%): sem oferta; o 8º (80%) cria a oferta e o aviso
insert into public.participants (event_id, user_id, name) values ('00000000-0000-4000-8000-0000000048e1', '00000000-0000-4000-8000-0000000048a1', 'Host');
insert into public.participants (event_id, user_id, name)
select '00000000-0000-4000-8000-0000000048e1', ('00000000-0000-4000-8000-0000000048' || lpad(g::text, 2, '0'))::uuid, 'C' || g from generate_series(10, 16) g;
select is((select count(*)::int from public.upgrade_offers where event_id = '00000000-0000-4000-8000-0000000048e1'), 0, '7 de 10 (o anfitrião não conta): sem oferta');
insert into public.participants (event_id, user_id, name) values ('00000000-0000-4000-8000-0000000048e1', '00000000-0000-4000-8000-000000004817', 'C17');
select is((select percent from public.upgrade_offers where event_id = '00000000-0000-4000-8000-0000000048e1'), 20, '8 de 10: oferta de 20%');
select ok((select expires_at = created_at + interval '48 hours' from public.upgrade_offers where event_id = '00000000-0000-4000-8000-0000000048e1'), 'vale 48 h');
select is((select status from public.host_outbox where event_id = '00000000-0000-4000-8000-0000000048e1' and kind = 'ativ_limite'), 'pendente', 'aviso de limite na fila');
insert into public.participants (event_id, user_id, name) values ('00000000-0000-4000-8000-0000000048e1', '00000000-0000-4000-8000-000000004818', 'C18');
select is((select count(*)::int from public.upgrade_offers where event_id = '00000000-0000-4000-8000-0000000048e1'), 1, 'uma oferta por evento');

-- aviso sai pelo WhatsApp
select results_eq($$select h.kind, h.event_title from public.host_claim_batch(10, 55) h$$, $$values ('ativ_limite'::text, 'Festa cheia'::text)$$, 'aviso de limite sai');

-- ===================================================== painel e cotação (só o anfitrião)
select tests.login('00000000-0000-4000-8000-0000000048a2');
select throws_ok($$select public.event_upgrade_offer('00000000-0000-4000-8000-0000000048e1')$$, 'MM004', null, 'outra pessoa não vê a oferta');
reset role;
select tests.login('00000000-0000-4000-8000-0000000048a1');
select is((public.event_upgrade_offer('00000000-0000-4000-8000-0000000048e1') ->> 'percent')::int, 20, 'anfitrião vê a oferta');
select is(public.payments_quote('00000000-0000-4000-8000-0000000048e1', 'ate150') - 'offerExpiresAt',
          '{"planCode":"ate150","fromPlanCode":"gratis","amountCents":11760,"payable":true,"reason":"ok","listCents":14700,"discountPct":20}'::jsonb,
          'cotação com 20%: R$ 117,60 em vez de R$ 147');
select is(public.payments_quote('00000000-0000-4000-8000-0000000048e2', 'ate150') ->> 'amountCents', '14700', 'evento sem oferta: preço de tabela');

-- pedido com desconto leva a marca da oferta
select public.payments_open_order('00000000-0000-4000-8000-0000000048e1', 'ate150', gen_random_uuid()) ->> 'orderId' as o1 \gset
reset role;
select is((select amount_cents from public.payment_orders where id = :'o1'::uuid), 11760, 'pedido com o valor da cotação');
select is((select price_cents from public.plans where code = 'ate150'), 14700, 'preço de tabela não muda');
select is((select offer_id from public.payment_orders where id = :'o1'::uuid), (select id from public.upgrade_offers where event_id = '00000000-0000-4000-8000-0000000048e1'), 'pedido marcado com a oferta');

-- pago: oferta usada; nova cotação volta ao preço de tabela (uso único)
update public.payment_orders set status = 'pago', paid_at = now() where id = :'o1'::uuid;
select ok((select redeemed_at is not null and order_id = :'o1'::uuid from public.upgrade_offers where event_id = '00000000-0000-4000-8000-0000000048e1'), 'oferta usada no pagamento');
select tests.login('00000000-0000-4000-8000-0000000048a1');
select is(public.event_upgrade_offer('00000000-0000-4000-8000-0000000048e1'), null, 'usada: some do painel');
select is(public.payments_quote('00000000-0000-4000-8000-0000000048e1', 'ate300') ->> 'amountCents', '29700', 'usada: sem desconto de novo');
reset role;

-- ===================================================== prazo real: venceu, acabou o desconto
insert into public.participants (event_id, user_id, name)
select '00000000-0000-4000-8000-0000000048e2', ('00000000-0000-4000-8000-0000000048' || lpad(g::text, 2, '0'))::uuid, 'C' || g from generate_series(10, 17) g;
select is((select count(*)::int from public.upgrade_offers where event_id = '00000000-0000-4000-8000-0000000048e2'), 1, 'segundo evento ganha a própria oferta');
update public.upgrade_offers set expires_at = now() - interval '1 second' where event_id = '00000000-0000-4000-8000-0000000048e2';
select tests.login('00000000-0000-4000-8000-0000000048a1');
select is(public.payments_quote('00000000-0000-4000-8000-0000000048e2', 'ate150') ->> 'amountCents', '14700', 'vencida: preço de tabela');
select is(public.event_upgrade_offer('00000000-0000-4000-8000-0000000048e2'), null, 'vencida: some do painel');
reset role;
select is((select count(*)::int from public.host_claim_batch(10, 55)), 0, 'vencida: aviso não sai');
select is((select last_error from public.host_outbox where event_id = '00000000-0000-4000-8000-0000000048e2' and kind = 'ativ_limite'), 'sem_oferta', 'motivo: sem oferta');

-- ===================================================== o "dia seguinte" saiu da fila
select ok(not exists (select 1 from public.host_outbox where kind = 'ativ_dia_seguinte' and status = 'pendente'), 'dia seguinte não é mais agendado');

select * from finish();
rollback;
