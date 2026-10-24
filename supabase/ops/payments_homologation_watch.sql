-- Acompanhamento SOMENTE LEITURA da homologação do Mercado Pago. Rode no SQL Editor ou:
--   supabase db query --linked -f supabase/ops/payments_homologation_watch.sql
-- Mostra só metadados (sem token, segredo, brcode ou dados de cartão). Evento sintético: 17ffe926-b276-4ed1-88e1-7c5d3c739647.
-- Cada bloco devolve uma consulta; a CLI imprime o último. Rode um por vez (comente os demais) ou use o SQL Editor.

-- 1) Pedidos do evento sintético (status, ambiente, provedor, valor)
select o.id, o.status, o.provider, o.provider_env, o.plan_code, o.amount_cents, o.paid_at, o.needs_refund, o.created_at
  from public.payment_orders o where o.event_id = '17ffe926-b276-4ed1-88e1-7c5d3c739647' order by o.created_at desc;

-- 2) Pagamentos (payment_charges): live_mode PROVA o ambiente real do pagamento; collector_id deve ser a conta esperada
-- select c.payment_id, c.order_id, c.role, c.status, c.amount_cents, c.currency, c.live_mode, c.collector_id, c.payment_method, c.refunded_cents, c.provider_updated_at
--   from public.payment_charges c join public.payment_orders o on o.id = c.order_id
--  where o.event_id = '17ffe926-b276-4ed1-88e1-7c5d3c739647' order by c.id;

-- 3) Notificações recebidas (webhook) e o desfecho de cada uma
-- select e.id, e.provider, e.event_type, e.outcome, e.received_at, e.order_id
--   from public.payment_events e join public.payment_orders o on o.id = e.order_id
--  where o.event_id = '17ffe926-b276-4ed1-88e1-7c5d3c739647' order by e.id;

-- 4) Direitos concedidos: deve haver NO MÁXIMO 1 linha ativa por pedido (concessão única)
-- select ee.event_id, ee.plan_code, ee.order_id, ee.env, ee.source, ee.status, ee.created_at
--   from public.event_entitlements ee where ee.event_id = '17ffe926-b276-4ed1-88e1-7c5d3c739647' order by ee.created_at;
-- select order_id, count(*) as ativas from public.event_entitlements where event_id = '17ffe926-b276-4ed1-88e1-7c5d3c739647' and status = 'ativo' group by order_id having count(*) > 1; -- esperado: 0 linhas

-- 5) Execuções recentes da conciliação (job mm-payments-reconcile)
-- select r.status, r.start_time from cron.job_run_details r join cron.job j using (jobid) where j.jobname = 'mm-payments-reconcile' order by r.start_time desc limit 5;
