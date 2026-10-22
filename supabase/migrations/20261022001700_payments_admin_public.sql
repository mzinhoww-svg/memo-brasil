-- MemoriesMT · COM-007 (mínimo) · Master de pagamentos, cortesia auditada, catálogo de planos, configuração pública e
-- job de conciliação. ADITIVA (só funções novas e, se houver segredo no Vault, um job).
--
-- RPCs do Master: is_master() e motivo de 10 a 500 caracteres (MM011). Erros: MM004 forbidden · MM005 invalid ·
-- MM011 reasonrequired. Toda escrita grava audit_logs com actor_role='master'.
-- Públicas (anon + authenticated): get_public_settings (allowlist de chaves) e list_public_plans.

-- ---------------------------------------------------------------- auxiliares
-- Motivo obrigatório: 10 a 500 caracteres depois de aparar. Devolve o motivo aparado.
create function public.admin_reason(p_reason text) returns text
language plpgsql immutable set search_path = '' as $$
declare why text := btrim(coalesce(p_reason, ''));
begin
  if char_length(why) < 10 or char_length(why) > 500 then raise exception 'reasonrequired' using errcode = 'MM011'; end if;
  return why;
end $$;

create function public.admin_payment_json(o public.payment_orders, p_title text, p_plan_name text) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'orderId', o.id, 'createdAt', o.created_at, 'updatedAt', o.updated_at, 'eventId', o.event_id, 'eventTitle', p_title,
    'hostId', o.host_id, 'planCode', o.plan_code, 'planName', p_plan_name, 'fromPlanCode', o.from_plan_code,
    'amountCents', o.amount_cents, 'status', o.status, 'provider', o.provider, 'providerEnv', o.provider_env,
    'providerChargeId', o.provider_charge_id, 'needsRefund', o.needs_refund, 'refundRequestedAt', o.refund_requested_at,
    'refundReason', o.refund_reason, 'paidAt', o.paid_at, 'expiresAt', o.expires_at)
$$;

-- ---------------------------------------------------------------- pagamentos (leitura)
create function public.admin_list_payments(p_status text default null, p_limit int default 100) returns setof jsonb
language plpgsql stable security definer set search_path = '' as $$
declare lim int := least(greatest(coalesce(p_limit, 100), 1), 500);
begin
  if not public.is_master() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if p_status is not null and p_status not in (select unnest(enum_range(null::public.payment_status))::text) then
    raise exception 'invalid' using errcode = 'MM005';
  end if;
  return query
    select public.admin_payment_json(o, e.title, p.name)
    from public.payment_orders o
    left join public.events e on e.id = o.event_id -- evento purgado: título null, pedido continua listado
    left join public.plans p on p.code = o.plan_code
    where p_status is null or o.status::text = p_status
    order by o.created_at desc, o.id desc
    limit lim;
end $$;

-- Divergências, uma linha por (pedido, tipo). Tipos:
--   pago_sem_direito (só evento existente e sem needs_refund, que já tem linha própria) · direito_sem_pedido_pago · pendente_1h · needs_refund · em_disputa (estado atual), e, a partir de
--   payment_events dos últimos 30 dias (agrupados, com occurrences; os com destino 'pago' de pedido com needs_refund
--   ficam sem prazo, até o estorno): pago_ignorado_reembolsar · upgrade_base_estornado ·
--   divergencia_valor · divergencia_ambiente (a spec chama de 'ambiente_divergente'; aceitos os dois) ·
--   divergencia_cobranca · transicao_ignorada (só quando o destino era 'pago': dinheiro possivelmente recebido).
-- Pedidos de evento purgado (event_id null) entram nos demais tipos. refundInProgress: reembolso já solicitado e ainda não
-- estornado (a página mostra "reembolso em andamento" e não conta em "precisa de ação").
create function public.admin_payment_divergences() returns setof jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_master() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  return query
  with d as (
    select 'pago_sem_direito'::text as kind, o.id as order_id, coalesce(o.paid_at, o.updated_at) as detected_at, 1 as occurrences
      from public.payment_orders o
     where o.status = 'pago' and o.event_id is not null and not o.needs_refund -- purgado: o direito saiu com o evento
       and not exists (select 1 from public.event_entitlements z where z.order_id = o.id and z.status = 'ativo')
    union all
    select 'direito_sem_pedido_pago', o.id, z.created_at, 1
      from public.event_entitlements z join public.payment_orders o on o.id = z.order_id
     where z.source = 'pago' and z.status = 'ativo' and o.status not in ('pago', 'em_disputa')
    union all
    select 'pendente_1h', o.id, o.created_at, 1
      from public.payment_orders o where o.status = 'pendente' and o.created_at < now() - interval '1 hour'
    union all
    select 'needs_refund', o.id, o.updated_at, 1 from public.payment_orders o where o.needs_refund
    union all
    select 'em_disputa', o.id, o.updated_at, 1 from public.payment_orders o where o.status = 'em_disputa'
    union all
    select case when pe.outcome = 'ambiente_divergente' then 'divergencia_ambiente' else pe.outcome end,
           pe.order_id, max(pe.received_at), count(*)::int
      from public.payment_events pe
      join public.payment_orders po on po.id = pe.order_id
     -- 30 dias, exceto divergência com destino 'pago' em pedido que ainda precisa de reembolso: fica até o estorno
     where (pe.received_at > now() - interval '30 days' or (po.needs_refund and pe.detail ->> 'to' = 'pago'))
       and (pe.outcome in ('pago_ignorado_reembolsar', 'upgrade_base_estornado', 'divergencia_valor', 'divergencia_ambiente',
                           'ambiente_divergente', 'divergencia_cobranca')
            or (pe.outcome = 'transicao_ignorada' and pe.detail ->> 'to' = 'pago'))
     group by 1, 2
  )
  select jsonb_build_object(
      'kind', d.kind, 'orderId', o.id, 'eventId', o.event_id, 'eventTitle', e.title, 'planCode', o.plan_code,
      'amountCents', o.amount_cents, 'status', o.status, 'providerChargeId', o.provider_charge_id,
      'needsRefund', o.needs_refund, 'refundRequestedAt', o.refund_requested_at,
      -- disputa/perda não se esconde; os mesmos estados que admin_request_refund aceita
      'refundInProgress', o.refund_requested_at is not null
                          and (o.status = 'pago' or (o.needs_refund and o.status in ('criado', 'pendente', 'expirado', 'cancelado', 'falhou'))),
      'detectedAt', d.detected_at, 'occurrences', d.occurrences)
    from d join public.payment_orders o on o.id = d.order_id
    left join public.events e on e.id = o.event_id
   order by d.detected_at desc, o.id, d.kind;
end $$;

-- Totais da página M1 (ambiente vigente, por status, pagos em 30 dias, pendentes há mais de 1 h, divergências que
-- precisam de ação: sem reembolso em andamento).
create function public.admin_payments_summary() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare by_status jsonb; paid jsonb;
begin
  if not public.is_master() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  select coalesce(jsonb_object_agg(s, jsonb_build_object('count', n, 'amountCents', v)), '{}') into by_status
    from (select status::text s, count(*) n, coalesce(sum(amount_cents), 0) v from public.payment_orders group by 1) x;
  select jsonb_build_object('count', count(*), 'amountCents', coalesce(sum(amount_cents), 0)) into paid
    from public.payment_orders where status = 'pago' and paid_at > now() - interval '30 days';
  return jsonb_build_object(
    'env', public.payments_env(), 'byStatus', by_status, 'paid30d', paid,
    'pendingOver1h', (select count(*) from public.payment_orders where status = 'pendente' and created_at < now() - interval '1 hour'),
    'divergences', (select count(*) from public.admin_payment_divergences() d where not (d ->> 'refundInProgress')::boolean));
end $$;

-- ---------------------------------------------------------------- cortesia
-- Direito cortesia/nenhum (vale em qualquer ambiente, inclusive com pagamentos desligados) com os limites do plano, e
-- sobe capacity/shots_per_person do evento por entitlement_raise_limits (a mesma regra de payments_apply_status).
create function public.admin_grant_courtesy(p_event uuid, p_plan text, p_reason text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare why text; ev public.events; pl public.plans; ent_id uuid;
begin
  if not public.is_master() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  why := public.admin_reason(p_reason);
  select * into ev from public.events where id = p_event and deleted_at is null for update;
  if not found then raise exception 'invalid' using errcode = 'MM005'; end if;
  select * into pl from public.plans where code = p_plan;
  if not found or pl.is_free then raise exception 'invalid' using errcode = 'MM005'; end if;

  insert into public.event_entitlements (event_id, plan_code, max_guests, max_shots, source, env, created_by, reason)
  values (ev.id, pl.code, pl.max_guests, pl.max_shots, 'cortesia', 'nenhum', auth.uid(), why)
  returning id into ent_id;
  perform public.entitlement_raise_limits(ev.id, pl.code);
  insert into public.audit_logs (actor_id, actor_role, event_id, action, target_type, target_id, reason, detail)
  values (auth.uid(), 'master', ev.id, 'entitlement.courtesy_granted', 'event', ev.id::text, why,
          jsonb_build_object('entitlementId', ent_id, 'plan', pl.code, 'maxGuests', pl.max_guests, 'maxShots', pl.max_shots));
  return ent_id;
end $$;

-- ---------------------------------------------------------------- reembolso
-- Só marca a solicitação (refund_requested_at/refund_reason) e audita; a página chama a função payments-refund com o JWT
-- do Master, que fala com o provedor e reconsulta a cobrança (PAID) antes de reembolsar. Aceita pedido 'pago' com cobrança
-- (o provedor recusa reembolso de cobrança em disputa) e qualquer pedido ainda não pago com needs_refund e cobrança:
-- 'cancelado' (Ruling 16, Pix pago depois do cancelamento) e criado/pendente/expirado/falhou com PAID divergente (valor
-- ou cobrança). Nunca em_disputa, estornado ou perdido.
-- Contra reembolso duplo: recusa pedido com reembolso já solicitado (pendente).
create function public.admin_request_refund(p_order uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare why text; o public.payment_orders;
begin
  if not public.is_master() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  why := public.admin_reason(p_reason);
  select * into o from public.payment_orders where id = p_order for update;
  if not found or not (o.status = 'pago' or (o.needs_refund and o.status in ('criado', 'pendente', 'expirado', 'cancelado', 'falhou')))
     or o.provider_charge_id is null or o.refund_requested_at is not null then
    raise exception 'invalid' using errcode = 'MM005';
  end if;
  update public.payment_orders set refund_requested_at = now(), refund_reason = why where id = o.id;
  insert into public.audit_logs (actor_id, actor_role, event_id, action, target_type, target_id, reason, detail)
  values (auth.uid(), 'master', o.event_id, 'payment.refund_requested', 'payment_order', o.id::text, why,
          jsonb_build_object('orderId', o.id, 'plan', o.plan_code, 'amountCents', o.amount_cents, 'env', o.provider_env,
                             'status', o.status, 'needsRefund', o.needs_refund));
end $$;

-- ---------------------------------------------------------------- catálogo
-- Muda SÓ preço e os dois interruptores de ativação (nunca limites nem is_free). Plano pago: preço >= 100 centavos.
-- O grátis não muda (nem preço nem ativação: list_public_plans sempre o inclui). Pedidos existentes mantêm o valor
-- gravado neles na criação. Audita valor anterior e novo.
create function public.admin_set_plan(p_code text, p_price_cents int, p_sandbox_active boolean, p_production_active boolean,
                                      p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare why text; pl public.plans;
begin
  if not public.is_master() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  why := public.admin_reason(p_reason);
  if p_price_cents is null or p_sandbox_active is null or p_production_active is null then
    raise exception 'invalid' using errcode = 'MM005';
  end if;
  select * into pl from public.plans where code = p_code for update;
  if not found then raise exception 'invalid' using errcode = 'MM005'; end if;
  if pl.is_free then
    if p_price_cents <> pl.price_cents or p_sandbox_active <> pl.sandbox_active or p_production_active <> pl.production_active then
      raise exception 'invalid' using errcode = 'MM005';
    end if;
  elsif p_price_cents < 100 or p_price_cents > 10000000 then
    raise exception 'invalid' using errcode = 'MM005';
  end if;
  update public.plans set price_cents = p_price_cents, sandbox_active = p_sandbox_active, production_active = p_production_active
   where code = pl.code;
  insert into public.audit_logs (actor_id, actor_role, action, target_type, target_id, reason, detail)
  values (auth.uid(), 'master', 'plan.updated', 'plan', pl.code, why, jsonb_build_object(
    'old', jsonb_build_object('priceCents', pl.price_cents, 'sandboxActive', pl.sandbox_active, 'productionActive', pl.production_active),
    'new', jsonb_build_object('priceCents', p_price_cents, 'sandboxActive', p_sandbox_active, 'productionActive', p_production_active)));
end $$;

-- Todos os planos (ativos ou não), com updated_at e as 10 últimas alterações auditadas de cada um (M2).
create function public.admin_list_plans() returns setof jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_master() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  return query
    select jsonb_build_object(
      'code', p.code, 'name', p.name, 'maxGuests', p.max_guests, 'maxShots', p.max_shots, 'priceCents', p.price_cents,
      'sort', p.sort, 'isFree', p.is_free, 'sandboxActive', p.sandbox_active, 'productionActive', p.production_active,
      'features', p.features, 'updatedAt', p.updated_at,
      'history', (select coalesce(jsonb_agg(jsonb_build_object('at', a.at, 'actorId', a.actor_id, 'actorRole', a.actor_role,
                                                               'reason', a.reason, 'old', a.detail -> 'old', 'new', a.detail -> 'new')
                                            order by a.at desc, a.id desc), '[]')
                    from (select * from public.audit_logs l
                           where l.target_type = 'plan' and l.target_id = p.code and l.action = 'plan.updated'
                           order by l.at desc, l.id desc limit 10) a))
    from public.plans p
    order by p.sort, p.code;
end $$;

-- ---------------------------------------------------------------- públicas
-- Allowlist fixa (Ruling 1 inclui capacity_grace_pct, número, normalizado como em capacity_grace_slots: 0 a 100).
create function public.get_public_settings() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'support_email', coalesce((select s.value from public.platform_settings s where s.key = 'support_email'), 'null'::jsonb),
    'support_phone', coalesce((select s.value from public.platform_settings s where s.key = 'support_phone'), 'null'::jsonb),
    'company_legal_name', coalesce((select s.value from public.platform_settings s where s.key = 'company_legal_name'), 'null'::jsonb),
    'company_cnpj', coalesce((select s.value from public.platform_settings s where s.key = 'company_cnpj'), 'null'::jsonb),
    'payments_env', public.payments_env(),
    'capacity_grace_pct', coalesce((select least(greatest((s.value #>> '{}')::numeric, 0), 100) from public.platform_settings s
                                     where s.key = 'capacity_grace_pct' and jsonb_typeof(s.value) = 'number'), 0))
$$;

-- Planos ativos no ambiente vigente, mais o grátis (sempre). Pagamentos desligados: só o grátis.
create function public.list_public_plans() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'code', p.code, 'name', p.name, 'maxGuests', p.max_guests, 'maxShots', p.max_shots, 'priceCents', p.price_cents,
      'sort', p.sort, 'isFree', p.is_free, 'features', p.features) order by p.sort, p.code), '[]')
  from public.plans p
  where p.is_free
     or (public.payments_env() = 'sandbox' and p.sandbox_active)
     or (public.payments_env() = 'production' and p.production_active)
$$;

-- ---------------------------------------------------------------- job de conciliação
-- mm-payments-reconcile a cada 5 min chama a Edge Function payments-reconcile com Authorization: Bearer lido do Vault
-- (mm_payments_cron_token) e URL lida do Vault (mm_payments_reconcile_url), ambos em tempo de execução: nada de segredo
-- nem de URL fixa no texto do job (sem fallback para produção). Só agenda se os dois segredos existirem; senão notice e
-- false (o runbook manda criá-los e rodar `select public.payments_schedule_reconcile()`). Idempotente: desagenda o anterior.
create function public.payments_schedule_reconcile() returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if to_regclass('cron.job') is null or to_regclass('vault.decrypted_secrets') is null then
    raise notice 'pg_cron ou Vault indisponível: mm-payments-reconcile não agendado';
    return false;
  end if;
  if not exists (select 1 from vault.decrypted_secrets where name = 'mm_payments_cron_token' and length(decrypted_secret) > 20) then
    raise notice 'segredo mm_payments_cron_token ausente no Vault: mm-payments-reconcile não agendado (ver runbook)';
    return false;
  end if;
  if not exists (select 1 from vault.decrypted_secrets where name = 'mm_payments_reconcile_url' and decrypted_secret ~ '^https?://') then
    raise notice 'segredo mm_payments_reconcile_url ausente no Vault: mm-payments-reconcile não agendado (ver runbook)';
    return false;
  end if;
  create extension if not exists pg_net with schema extensions;
  if exists (select 1 from cron.job where jobname = 'mm-payments-reconcile') then
    perform cron.unschedule('mm-payments-reconcile');
  end if;
  perform cron.schedule('mm-payments-reconcile', '*/5 * * * *', $job$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'mm_payments_reconcile_url' limit 1),
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'mm_payments_cron_token' limit 1),
        'Content-Type', 'application/json'),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    ) $job$);
  return true;
end $$;

select public.payments_schedule_reconcile();

-- ---------------------------------------------------------------- privilégios
revoke execute on function
  public.admin_reason(text), public.admin_payment_json(public.payment_orders, text, text),
  public.admin_list_payments(text, int), public.admin_payment_divergences(), public.admin_payments_summary(),
  public.admin_grant_courtesy(uuid, text, text), public.admin_request_refund(uuid, text),
  public.admin_set_plan(text, int, boolean, boolean, text), public.admin_list_plans(),
  public.get_public_settings(), public.list_public_plans(), public.payments_schedule_reconcile()
  from public, anon, authenticated, service_role;
grant execute on function
  public.admin_list_payments(text, int), public.admin_payment_divergences(), public.admin_payments_summary(),
  public.admin_grant_courtesy(uuid, text, text), public.admin_request_refund(uuid, text),
  public.admin_set_plan(text, int, boolean, boolean, text), public.admin_list_plans()
  to authenticated;
grant execute on function public.get_public_settings(), public.list_public_plans() to anon, authenticated, service_role;
