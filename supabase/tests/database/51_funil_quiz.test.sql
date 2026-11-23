-- pgTAP · funil de quiz: o lead nasce sem dado pessoal, a oferta "Até 50 convidados" por R$ 19,90 vale 30 minutos de verdade, só para
-- o evento ligado ao lead, e o plano da oferta fica fora do catálogo público. O desconto de 20% do limite não se soma à oferta.
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

insert into auth.users (id, aud, role, email, is_anonymous) values
  ('00000000-0000-4000-8000-0000000051a1', 'authenticated', 'authenticated', 'host51@test.local', false),
  ('00000000-0000-4000-8000-0000000051a2', 'authenticated', 'authenticated', 'outro51@test.local', false);
insert into public.profiles (id, display_name) select id, 'Pessoa' from auth.users where email like '%51@test.local' on conflict (id) do nothing;

insert into public.events (id, title, category, host_id, host_name, duration_hours, capacity, shots_per_person, start_at) values
  ('00000000-0000-4000-8000-0000000051e1', 'Casamento do quiz', 'casamento', '00000000-0000-4000-8000-0000000051a1', 'Host', 6, 10, 10, now() + interval '30 days'),
  ('00000000-0000-4000-8000-0000000051e2', 'Outro casamento', 'casamento', '00000000-0000-4000-8000-0000000051a1', 'Host', 6, 10, 10, now() + interval '30 days'),
  ('00000000-0000-4000-8000-0000000051e3', 'Casamento de outra pessoa', 'casamento', '00000000-0000-4000-8000-0000000051a2', 'Outro', 6, 10, 10, now() + interval '30 days');

-- ===================================================== estrutura e privilégios
select has_table('public', 'funnel_leads', 'funnel_leads existe');
select ok(not has_table_privilege('anon', 'public.funnel_leads', 'select'), 'visitante não lê a tabela de leads');
select ok(not has_table_privilege('authenticated', 'public.funnel_leads', 'select'), 'cliente não lê a tabela de leads');
select ok(not has_function_privilege('anon', 'public.funnel_lead_create(text, text, int, text, text, text)', 'execute'), 'visitante não cria lead direto (só a função do servidor, que limita por IP)');
select ok(not has_function_privilege('authenticated', 'public.funnel_lead_confirm(uuid, timestamptz)', 'execute'), 'cliente não confirma contato');
select ok(not has_function_privilege('anon', 'public.funnel_offer_claim(uuid, uuid)', 'execute'), 'visitante não liga lead a evento');
select ok(has_function_privilege('anon', 'public.funnel_lead_view(uuid)', 'execute'), 'a página da oferta lê o lead pelo id');

-- ===================================================== plano só de oferta: fora do catálogo público
select is((select price_cents from public.plans where code = 'ate50'), 1990, 'plano da oferta custa R$ 19,90');
select is((select max_guests from public.plans where code = 'ate50'), 50, 'plano da oferta: até 50 convidados');
select ok(not exists (select 1 from jsonb_array_elements(public.list_public_plans()) p where p ->> 'code' = 'ate50'), 'catálogo público não mostra o plano da oferta');
select ok(exists (select 1 from jsonb_array_elements(public.list_public_plans()) p where p ->> 'code' = 'ate150'), 'catálogo público segue com as faixas normais');

-- ===================================================== lead: sem dado pessoal, 30 minutos
select public.funnel_lead_create('sinais', 'pista', 130, ' Instagram ', 'social', 'quiz<2>') ->> 'leadId' as l1 \gset
select ok((select offer_expires_at = created_at + interval '30 minutes' from public.funnel_leads where id = :'l1'::uuid), 'a oferta vale 30 minutos a partir do lead');
select is((select source || '|' || campaign from public.funnel_leads where id = :'l1'::uuid), 'Instagram|quiz2', 'origem limpa antes de gravar');
select throws_ok($$select public.funnel_lead_create('Com Espaço', null, null, null, null, null)$$, 'MM005', null, 'quiz com formato estranho é recusado');
select throws_ok($$select public.funnel_lead_create('sinais', null, 0, null, null, null)$$, 'MM005', null, 'convidados fora da faixa é recusado');

set local role anon;
select is(public.funnel_lead_view(:'l1'::uuid) ->> 'active', 'true', 'visitante vê a oferta ativa pelo id do lead');
select is(public.funnel_lead_view(:'l1'::uuid) ->> 'priceCents', '1990', 'a página recebe o preço do servidor');
select is(public.funnel_lead_view(:'l1'::uuid) ->> 'eventId', null, 'visitante não vê evento');
select is(public.funnel_lead_view(gen_random_uuid()), null, 'lead desconhecido: nada');
reset role;

-- contato confirmado pelo WhatsApp: uma vez só, sem telefone
select is(public.funnel_lead_confirm(:'l1'::uuid, now()), 'applied', 'contato confirmado');
select is(public.funnel_lead_confirm(:'l1'::uuid, now()), 'stale', 'repetição do webhook não muda nada');
select is(public.funnel_lead_confirm(gen_random_uuid(), now()), 'unknown_subject', 'lead desconhecido');

-- ===================================================== sem lead ligado, o plano da oferta não é vendido
select tests.login('00000000-0000-4000-8000-0000000051a1');
select is(public.payments_quote('00000000-0000-4000-8000-0000000051e1', 'ate50') ->> 'reason', 'plano_inativo', 'evento sem oferta: plano da oferta não é vendido');
select is(public.event_funnel_offer('00000000-0000-4000-8000-0000000051e1'), null, 'painel sem oferta');
select throws_ok($$select public.payments_open_order('00000000-0000-4000-8000-0000000051e1', 'ate50', gen_random_uuid())$$, null, null, 'pedido do plano da oferta sem oferta é recusado');

-- só o anfitrião do evento liga o lead
select throws_ok(format($$select public.funnel_offer_claim(%L, '00000000-0000-4000-8000-0000000051e3')$$, :'l1'), 'MM004', null, 'não liga o lead ao evento de outra pessoa');
select is(public.funnel_offer_claim(:'l1'::uuid, '00000000-0000-4000-8000-0000000051e1') ->> 'planCode', 'ate50', 'anfitrião liga o lead ao próprio evento');
select is(public.funnel_offer_claim(:'l1'::uuid, '00000000-0000-4000-8000-0000000051e1') ->> 'planCode', 'ate50', 'ligar de novo ao mesmo evento não quebra');
select is(public.funnel_offer_claim(:'l1'::uuid, '00000000-0000-4000-8000-0000000051e2'), null, 'um lead vale para um evento só');

-- ===================================================== com a oferta: R$ 19,90, e só para aquele evento
select is(public.payments_quote('00000000-0000-4000-8000-0000000051e1', 'ate50') - 'offerExpiresAt',
          '{"planCode":"ate50","fromPlanCode":"gratis","amountCents":1990,"payable":true,"reason":"ok"}'::jsonb, 'cotação da oferta: R$ 19,90');
select is(public.payments_quote('00000000-0000-4000-8000-0000000051e2', 'ate50') ->> 'reason', 'plano_inativo', 'outro evento do mesmo anfitrião não ganha a oferta');
select is(public.payments_quote('00000000-0000-4000-8000-0000000051e1', 'ate150') ->> 'amountCents', '14700', 'as outras faixas seguem no preço de tabela');
select is(public.event_funnel_offer('00000000-0000-4000-8000-0000000051e1') ->> 'priceCents', '1990', 'painel mostra a oferta');
select is(public.funnel_lead_view(:'l1'::uuid) ->> 'eventId', '00000000-0000-4000-8000-0000000051e1', 'o dono do lead vê o próprio evento');
reset role;
select tests.login('00000000-0000-4000-8000-0000000051a2');
select is(public.funnel_lead_view(:'l1'::uuid) ->> 'eventId', null, 'outra pessoa com o link não vê o evento');
select throws_ok($$select public.event_funnel_offer('00000000-0000-4000-8000-0000000051e1')$$, 'MM004', null, 'outra pessoa não lê a oferta do evento');
reset role;

-- o desconto de 20% do limite do grátis não se soma ao preço de oferta
insert into public.upgrade_offers (event_id) values ('00000000-0000-4000-8000-0000000051e1');
select tests.login('00000000-0000-4000-8000-0000000051a1');
select is(public.payments_quote('00000000-0000-4000-8000-0000000051e1', 'ate50') ->> 'amountCents', '1990', 'oferta do funil não acumula com os 20%');
select is(public.payments_quote('00000000-0000-4000-8000-0000000051e1', 'ate150') ->> 'amountCents', '11760', 'os 20% seguem valendo nas faixas normais');
reset role;
delete from public.upgrade_offers where event_id = '00000000-0000-4000-8000-0000000051e1';

-- pedido aberto dentro do prazo leva o valor da oferta
select tests.login('00000000-0000-4000-8000-0000000051a1');
select public.payments_open_order('00000000-0000-4000-8000-0000000051e1', 'ate50', gen_random_uuid()) ->> 'orderId' as o1 \gset
reset role;
select is((select amount_cents from public.payment_orders where id = :'o1'::uuid), 1990, 'pedido com R$ 19,90');

-- ===================================================== prazo real: passou de 30 minutos, acabou
update public.payment_orders set status = 'cancelado' where id = :'o1'::uuid;
update public.funnel_leads set offer_expires_at = now() - interval '1 second' where id = :'l1'::uuid;
select tests.login('00000000-0000-4000-8000-0000000051a1');
select is(public.payments_quote('00000000-0000-4000-8000-0000000051e1', 'ate50') ->> 'reason', 'plano_inativo', 'vencida: plano da oferta não é mais vendido');
select is(public.event_funnel_offer('00000000-0000-4000-8000-0000000051e1'), null, 'vencida: some do painel');
select is(public.funnel_lead_view(:'l1'::uuid) ->> 'active', 'false', 'vencida: a página mostra o caminho normal');
reset role;
select public.funnel_lead_create('rapido', null, 40, null, null, null) ->> 'leadId' as l2 \gset
update public.funnel_leads set offer_expires_at = now() - interval '1 second' where id = :'l2'::uuid;
select tests.login('00000000-0000-4000-8000-0000000051a1');
select is(public.funnel_offer_claim(:'l2'::uuid, '00000000-0000-4000-8000-0000000051e2'), null, 'lead vencido não liga a evento nenhum');
reset role;

-- ===================================================== pago: quem comprou a oferta sobe de faixa pagando só a diferença
insert into public.event_entitlements (event_id, plan_code, max_guests, max_shots, source, env) values
  ('00000000-0000-4000-8000-0000000051e1', 'ate50', 50, 36, 'pago', 'sandbox');
select is((select max_guests from public.effective_entitlement('00000000-0000-4000-8000-0000000051e1')), 50, 'pago: evento liberado para 50 convidados');
select tests.login('00000000-0000-4000-8000-0000000051a1');
select is(public.payments_quote('00000000-0000-4000-8000-0000000051e1', 'ate50') ->> 'reason', 'ja_incluido', 'pago: não vende de novo');
select is(public.payments_quote('00000000-0000-4000-8000-0000000051e1', 'ate150') ->> 'amountCents', '12710', 'subir para 150 custa só a diferença (R$ 147 - R$ 19,90)');
select is(public.funnel_lead_view(:'l1'::uuid) ->> 'paid', 'true', 'a página da oferta sabe que foi pago');
reset role;

-- ===================================================== relatório por quiz (só a equipe)
select tests.login('00000000-0000-4000-8000-0000000051a1');
select throws_ok($$select public.admin_funnel_report(30)$$, 'MM004', null, 'anfitrião não lê o relatório do funil');
reset role;

select * from finish();
rollback;
