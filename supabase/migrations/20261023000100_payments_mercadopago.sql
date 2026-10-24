-- MemoriesMT · migração AbacatePay → Mercado Pago (Checkout Pro por Preferences). ADITIVA: não edita migrations
-- anteriores; pedidos históricos AbacatePay ficam intactos (visíveis no Master e reembolsáveis).
--
-- Modelo: payment_orders.mp_payment_id = pagamento VINCULADO ao pedido (primeiro 'approved' válido). Todo outro pagamento
-- aprovado do mesmo pedido (duplicado, valor/moeda/recebedor/ambiente divergente, pago após cancelamento) vira
-- payment_charges.role='extra' + needs_refund e só é reembolsado por solicitação explícita (PAY-001).
-- Toda decisão financeira vive aqui (payments_apply_payment); as Edge Functions só normalizam o pagamento da API.
--
-- Correções: PAY-001 (alvo de reembolso nunca é a cobrança divergente), PAY-002 (admin_clear_needs_refund),
-- PAY-003 (waiver de valor só para pedido ainda não pago), PAY-004 (conciliação com teto de idade e sem regravar eventos),
-- PAY-005 (divergência em pedido pago não expira em 30 dias).

-- ---------------------------------------------------------------- colunas
alter table public.payment_orders
  add column mp_preference_id text,
  add column mp_payment_id text,
  add column checkout_url text,
  add column payment_method text,
  add column refunded_cents int not null default 0 check (refunded_cents >= 0),
  add column refund_amount_cents int check (refund_amount_cents is null or refund_amount_cents >= 1),
  add constraint payment_orders_provider_chk check (provider in ('abacatepay', 'mercadopago'));
alter table public.payment_orders alter column provider set default 'mercadopago';
create unique index payment_orders_mp_payment_uq on public.payment_orders (provider, mp_payment_id) where mp_payment_id is not null;
create unique index payment_orders_mp_pref_uq on public.payment_orders (mp_preference_id) where mp_preference_id is not null;
create index payment_orders_reconcile_idx on public.payment_orders (provider, provider_env, status, created_at)
  where status in ('criado', 'pendente', 'expirado');

alter table public.payment_events alter column provider set default 'mercadopago';
alter table public.payment_events add column resolved_at timestamptz, add column resolved_by uuid;

-- Um registro por pagamento do provedor visto para um pedido. role: primary (vinculado) | extra (dinheiro a devolver, nunca
-- vinculado) | attempt (sem dinheiro retido ou ainda não decidido).
create table public.payment_charges (
  id bigint generated always as identity primary key,
  provider text not null default 'mercadopago' check (provider in ('abacatepay', 'mercadopago')),
  payment_id text not null,
  order_id uuid null references public.payment_orders on delete set null,
  role text not null default 'attempt' check (role in ('primary', 'extra', 'attempt')),
  status text not null,
  amount_cents int,
  currency text,
  live_mode boolean,
  collector_id text,
  payment_method text,
  refunded_cents int not null default 0 check (refunded_cents >= 0),
  provider_updated_at timestamptz,
  refund_requested_at timestamptz,
  refund_reason text check (refund_reason is null or char_length(refund_reason) <= 500),
  refund_amount_cents int check (refund_amount_cents is null or refund_amount_cents >= 1),
  resolved_at timestamptz,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (provider, payment_id)
);
create index payment_charges_order_idx on public.payment_charges (order_id, role);
alter table public.payment_charges enable row level security;
revoke all on public.payment_charges from public, anon, authenticated;

-- ---------------------------------------------------------------- contrato do pedido para o web (OrderView)
create or replace function public.payments_order_json(o public.payment_orders, p_reused boolean) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('orderId', o.id, 'status', o.status, 'amountCents', o.amount_cents, 'checkoutUrl', o.checkout_url,
                            'expiresAt', o.expires_at, 'provider', o.provider, 'paymentMethod', o.payment_method, 'reused', p_reused)
$$;

create or replace function public.payments_order_status(p_order uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare o public.payment_orders;
begin
  select * into o from public.payment_orders where id = p_order;
  if auth.uid() is null or not found or o.host_id <> auth.uid() or not public.is_host(o.event_id) then
    raise exception 'forbidden' using errcode = 'MM004';
  end if;
  return jsonb_build_object('orderId', o.id, 'status', o.status, 'planCode', o.plan_code, 'amountCents', o.amount_cents,
                            'checkoutUrl', o.checkout_url, 'expiresAt', o.expires_at, 'paidAt', o.paid_at,
                            'provider', o.provider, 'paymentMethod', o.payment_method);
end $$;

-- Igual à anterior, com: pedidos novos 'mercadopago'; pedido aberto histórico (AbacatePay) é cancelado, nunca reusado;
-- 'criado' sem preferência e sem cobrança há > 30 min vence.
create or replace function public.payments_open_order(p_event uuid, p_plan text, p_idempotency_key uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  ev public.events;
  o public.payment_orders;
  q jsonb;
  env text;
  stale text;
begin
  if uid is null or p_idempotency_key is null then raise exception 'forbidden' using errcode = 'MM004'; end if;
  select * into ev from public.events where id = p_event and deleted_at is null for update;
  if not found or ev.host_id <> uid then raise exception 'forbidden' using errcode = 'MM004'; end if;
  env := public.payments_env();
  if env = 'desligado' then raise exception 'pagamentoindisponivel' using errcode = 'MM014'; end if;

  select * into o from public.payment_orders where host_id = uid and idempotency_key = p_idempotency_key;
  if found then
    if o.event_id is distinct from p_event or o.plan_code <> p_plan then raise exception 'invalid' using errcode = 'MM005'; end if;
    return public.payments_order_json(o, true);
  end if;

  for o in select * from public.payment_orders
           where event_id = p_event and status in ('criado', 'pendente')
             and (provider_env <> env or provider <> 'mercadopago' or expires_at <= now()
                  or (expires_at is null and provider_charge_id is null and mp_preference_id is null
                      and created_at < now() - interval '30 minutes'))
           for update loop
    stale := case when o.provider_env <> env or o.provider <> 'mercadopago' then 'cancelado' else 'expirado' end;
    update public.payment_orders set status = stale::public.payment_status where id = o.id;
    perform public.audit(p_event, 'payment.' || stale,
      jsonb_build_object('orderId', o.id, 'plan', o.plan_code, 'amountCents', o.amount_cents, 'env', o.provider_env, 'source', 'open_order'));
  end loop;

  select * into o from public.payment_orders where event_id = p_event and status in ('criado', 'pendente') for update;
  if found then
    if o.plan_code <> p_plan then raise exception 'pedidoaberto' using errcode = 'MM013'; end if;
    return public.payments_order_json(o, true);
  end if;

  q := public.payments_quote_internal(p_event, p_plan);
  case q ->> 'reason'
    when 'ok' then null;
    when 'evento_encerrado' then raise exception 'eventended' using errcode = 'MM002';
    when 'plano_inativo' then raise exception 'pagamentoindisponivel' using errcode = 'MM014';
    else raise exception 'invalid' using errcode = 'MM005';
  end case;

  begin
    insert into public.payment_orders (event_id, host_id, plan_code, from_plan_code, amount_cents, provider, provider_env, idempotency_key)
    values (p_event, uid, p_plan, q ->> 'fromPlanCode', (q ->> 'amountCents')::int, 'mercadopago', env, p_idempotency_key)
    returning * into o;
  exception when unique_violation then
    raise exception 'invalid' using errcode = 'MM005';
  end;
  perform public.audit(p_event, 'payment.criado',
    jsonb_build_object('orderId', o.id, 'plan', o.plan_code, 'amountCents', o.amount_cents, 'env', o.provider_env));
  return public.payments_order_json(o, false);
end $$;

-- ---------------------------------------------------------------- serviço: preferência, eventos, conciliação
-- Liga a preferência ao pedido 'criado' → 'pendente'. Idempotente: pedido que já tem preferência não muda (a segunda
-- preferência de uma corrida fica sem uso; o pagamento sempre volta pelo external_reference = pedido).
create function public.payments_attach_preference(p_order uuid, p_preference_id text, p_checkout_url text, p_expires_at timestamptz)
returns void
language plpgsql security definer set search_path = '' as $$
declare o public.payment_orders;
begin
  if coalesce(btrim(p_preference_id), '') = '' or p_checkout_url is null or p_checkout_url !~ '^https://' then
    raise exception 'invalid' using errcode = 'MM005';
  end if;
  select * into o from public.payment_orders where id = p_order for update;
  if not found or o.provider <> 'mercadopago' then raise exception 'invalid' using errcode = 'MM005'; end if;
  if o.mp_preference_id is not null then return; end if;
  if o.status <> 'criado' then raise exception 'invalid' using errcode = 'MM005'; end if;
  update public.payment_orders
     set mp_preference_id = p_preference_id, checkout_url = p_checkout_url, expires_at = p_expires_at, status = 'pendente'
   where id = o.id;
  perform public.audit(o.event_id, 'payment.pendente',
    jsonb_build_object('orderId', o.id, 'plan', o.plan_code, 'amountCents', o.amount_cents, 'env', o.provider_env));
end $$;

create function public.payments_record_event(p_provider text, p_provider_event_id text, p_type text, p_order uuid, p_outcome text,
                                             p_detail jsonb) returns boolean
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if coalesce(btrim(p_provider_event_id), '') = '' or p_provider not in ('abacatepay', 'mercadopago') then
    raise exception 'invalid' using errcode = 'MM005';
  end if;
  insert into public.payment_events (provider, provider_event_id, event_type, order_id, outcome, detail)
  values (p_provider, left(p_provider_event_id, 200), left(p_type, 100),
          (select id from public.payment_orders where id = p_order), left(p_outcome, 100), p_detail)
  on conflict (provider, provider_event_id) do nothing;
  get diagnostics n = row_count;
  return n = 1;
end $$;

create function public.payments_touch_checked(p_order uuid) returns void
language sql security definer set search_path = '' as $$
  update public.payment_orders set last_checked_at = now() where id = p_order
$$;

-- Fila da conciliação (PAY-004). 'search': pedidos criado|pendente|expirado do ambiente da chave, criados nos últimos 7 dias
-- e não consultados há 60 s (expirado entra porque pagamento tardio é aceito). 'payment': pagamento com reembolso solicitado e
-- ainda não 'refunded' (sem teto de idade: dinheiro nunca é esquecido). Histórico AbacatePay fica fora.
create function public.payments_reconcile_candidates(p_env text, p_limit int default 50)
returns table (order_id uuid, kind text, payment_id text)
language sql stable security definer set search_path = '' as $$
  select x.order_id, x.kind, x.payment_id from (
    (select o.id as order_id, 'search'::text as kind, null::text as payment_id, o.last_checked_at as ck
       from public.payment_orders o
      where o.provider = 'mercadopago' and o.provider_env = p_env
        and o.status in ('criado', 'pendente', 'expirado')
        and o.created_at > now() - interval '7 days' and o.created_at < now() - interval '60 seconds'
        and (o.last_checked_at is null or o.last_checked_at < now() - interval '60 seconds')
      order by o.last_checked_at nulls first limit 200)
    union all
    (select o.id, 'payment', o.mp_payment_id, o.last_checked_at
       from public.payment_orders o
      where o.provider = 'mercadopago' and o.provider_env = p_env and o.mp_payment_id is not null
        and o.refund_requested_at is not null and o.status in ('pago', 'em_disputa')
        and (o.last_checked_at is null or o.last_checked_at < now() - interval '60 seconds')
      order by o.last_checked_at nulls first limit 200)
    union all
    (select o.id, 'payment', c.payment_id, o.last_checked_at
       from public.payment_charges c join public.payment_orders o on o.id = c.order_id
      where c.provider = 'mercadopago' and o.provider = 'mercadopago' and o.provider_env = p_env
        and c.role = 'extra' and c.refund_requested_at is not null and c.status <> 'refunded'
        and (o.last_checked_at is null or o.last_checked_at < now() - interval '60 seconds')
      order by o.last_checked_at nulls first limit 200)
  ) x order by x.ck nulls first, x.order_id limit greatest(least(coalesce(p_limit, 50), 200), 1)
$$;

-- Pendente vencido (expires_at + 5 min de tolerância) → expirado; pagamento tardio continua aceito (expirado → pago).
create function public.payments_expire_stale() returns int
language plpgsql security definer set search_path = '' as $$
declare o public.payment_orders; n int := 0;
begin
  for o in select * from public.payment_orders
            where provider = 'mercadopago' and status = 'pendente' and expires_at is not null
              and expires_at < now() - interval '5 minutes' for update skip locked loop
    update public.payment_orders set status = 'expirado' where id = o.id;
    insert into public.payment_events (provider, event_type, order_id, outcome, detail)
    values ('mercadopago', 'apply.reconcile', o.id, 'aplicado', jsonb_build_object('from', o.status, 'to', 'expirado', 'env', o.provider_env));
    perform public.audit(o.event_id, 'payment.expirado',
      jsonb_build_object('orderId', o.id, 'plan', o.plan_code, 'amountCents', o.amount_cents, 'env', o.provider_env, 'from', o.status, 'source', 'reconcile'));
    n := n + 1;
  end loop;
  return n;
end $$;

-- 'criado' sem preferência nem cobrança há > 5 min → 'falhou' (libera novo checkout).
create or replace function public.payments_fail_unattached(p_order uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare o public.payment_orders;
begin
  select * into o from public.payment_orders where id = p_order for update;
  if not found or o.status <> 'criado' or o.provider_charge_id is not null or o.mp_preference_id is not null
     or o.created_at >= now() - interval '5 minutes' then
    return false;
  end if;
  update public.payment_orders set status = 'falhou', last_checked_at = now() where id = o.id;
  insert into public.payment_events (provider, event_type, order_id, outcome, detail)
  values (o.provider, 'apply.reconcile', o.id, 'sem_cobranca', jsonb_build_object('from', o.status, 'to', 'falhou', 'env', o.provider_env));
  perform public.audit(o.event_id, 'payment.falhou',
    jsonb_build_object('orderId', o.id, 'plan', o.plan_code, 'amountCents', o.amount_cents, 'env', o.provider_env,
                       'from', o.status, 'source', 'reconcile'));
  return true;
end $$;

-- ---------------------------------------------------------------- aplicação do pagamento (decisão financeira)
-- p_payment (normalizado pela função): id, status (do Mercado Pago), amountCents, currency, liveMode, collectorId,
-- externalReference, method, updatedAt, refundedCents. p_expected_collector vem de GET /users/me (nunca de parâmetro do web).
-- Resultados (payment_events.outcome): aplicado | duplicado (não grava evento) | obsoleto | pagamento_duplicado |
-- pago_ignorado_reembolsar | reembolso_parcial | cobranca_extra_atualizada | tentativa_recusada | transicao_ignorada |
-- status_desconhecido | divergencia_cobranca | divergencia_valor | divergencia_moeda | divergencia_recebedor | divergencia_ambiente.
create function public.payments_apply_payment(p_order uuid, p_payment jsonb, p_expected_collector text, p_source text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  o public.payment_orders;
  ev public.events;
  pl public.plans;
  u public.payment_orders;
  ch public.payment_charges;
  pid text := nullif(btrim(p_payment ->> 'id'), '');
  pst text := p_payment ->> 'status';
  cur text := p_payment ->> 'currency';
  coll text := nullif(btrim(p_payment ->> 'collectorId'), '');
  ext text := p_payment ->> 'externalReference';
  meth text := nullif(p_payment ->> 'method', '');
  amt int; live boolean; upd timestamptz; refd int := 0;
  target text;
  v_out text;
  new_role text;
  refund boolean := false;
  event_live boolean := false;
  known boolean; is_primary boolean; partial boolean := false;
  ent_id uuid;
  from_status public.payment_status;
  became_flagged boolean := false;
begin
  if p_source is null or p_source not in ('webhook', 'status', 'reconcile') or pid is null or pst is null then
    raise exception 'invalid' using errcode = 'MM005';
  end if;
  begin amt := (p_payment ->> 'amountCents')::int; exception when others then amt := null; end;
  live := case when jsonb_typeof(p_payment -> 'liveMode') = 'boolean' then (p_payment ->> 'liveMode')::boolean end;
  begin upd := (p_payment ->> 'updatedAt')::timestamptz; exception when others then upd := null; end;
  begin refd := greatest(coalesce((p_payment ->> 'refundedCents')::int, 0), 0); exception when others then refd := 0; end;

  select * into ev from public.events e where e.id = (select x.event_id from public.payment_orders x where x.id = p_order) for update;
  select * into o from public.payment_orders where id = p_order for update;
  if not found or o.provider <> 'mercadopago' then raise exception 'invalid' using errcode = 'MM005'; end if;
  if o.event_id is not null and ev.id = o.event_id then
    event_live := ev.deleted_at is null and now() < public.event_end(ev.start_at, ev.duration_hours, ev.ended_at);
  end if;
  from_status := o.status;

  target := case pst when 'approved' then 'pago' when 'pending' then 'pendente' when 'in_process' then 'pendente'
                     when 'authorized' then 'pendente' when 'in_mediation' then 'em_disputa' when 'charged_back' then 'perdido'
                     when 'refunded' then 'estornado' else null end;
  select * into ch from public.payment_charges where provider = 'mercadopago' and payment_id = pid for update;
  known := found;
  is_primary := o.mp_payment_id is not null and o.mp_payment_id = pid;

  if ext is distinct from o.id::text or (known and ch.order_id is distinct from o.id) then
    v_out := 'divergencia_cobranca'; -- o pagamento não é deste pedido: nada é gravado neste pedido além do evento
  elsif known and upd is not null and ch.provider_updated_at is not null and upd < ch.provider_updated_at then
    v_out := 'obsoleto'; -- notificação fora de ordem: o estado gravado é mais novo
  elsif known and ch.role = 'extra' then
    -- cobrança extra já registrada: só acompanha o reembolso
    v_out := case when ch.status = pst and ch.refunded_cents = refd then 'duplicado' else 'cobranca_extra_atualizada' end;
  elsif pst not in ('approved', 'pending', 'in_process', 'authorized', 'in_mediation', 'charged_back', 'refunded', 'rejected', 'cancelled') then
    v_out := 'status_desconhecido';
  elsif pst in ('rejected', 'cancelled') then
    v_out := case when known and ch.status = pst then 'duplicado' else 'tentativa_recusada' end;
  elsif p_expected_collector is null or coll is distinct from p_expected_collector then
    v_out := 'divergencia_recebedor';
  elsif cur is distinct from 'BRL' then
    v_out := 'divergencia_moeda';
  elsif live is null or live <> (o.provider_env = 'production') then
    v_out := 'divergencia_ambiente';
  elsif amt is distinct from o.amount_cents then
    v_out := 'divergencia_valor';
  elsif pst = 'approved' then
    partial := refd > 0 and refd < amt;
    if o.status in ('pago', 'em_disputa') and o.mp_payment_id is not null and not is_primary then
      v_out := 'pagamento_duplicado'; refund := true;
    elsif o.status in ('cancelado', 'estornado', 'perdido') and not is_primary then
      v_out := 'pago_ignorado_reembolsar'; refund := true;
    elsif is_primary then
      if o.status = 'pago' then
        v_out := case when partial and refd > o.refunded_cents then 'reembolso_parcial' else 'duplicado' end;
      elsif o.status = 'em_disputa' then v_out := 'aplicado';
      else v_out := 'transicao_ignorada';
      end if;
    elsif o.status in ('criado', 'pendente', 'expirado', 'falhou') then
      v_out := 'aplicado';
    else
      v_out := 'transicao_ignorada';
    end if;
  elsif pst in ('refunded', 'in_mediation', 'charged_back') then
    if not is_primary then v_out := 'transicao_ignorada';
    elsif o.status::text = target then v_out := 'duplicado';
    elsif (o.status, target) in (('pago', 'estornado'), ('pago', 'em_disputa'), ('pago', 'perdido'),
                                 ('em_disputa', 'estornado'), ('em_disputa', 'perdido')) then v_out := 'aplicado';
    else v_out := 'transicao_ignorada';
    end if;
  else -- pending | in_process | authorized
    v_out := case when o.status = 'criado' then 'aplicado' else 'duplicado' end;
  end if;

  -- dinheiro aprovado que não é do vínculo do pedido: extra + needs_refund (nunca substitui o pagamento vinculado)
  if v_out in ('divergencia_valor', 'divergencia_moeda', 'divergencia_recebedor', 'divergencia_ambiente')
     and pst = 'approved' and not is_primary then
    refund := true;
  end if;

  new_role := case when known then ch.role else 'attempt' end;
  if is_primary or (v_out = 'aplicado' and pst = 'approved') then new_role := 'primary';
  elsif refund then new_role := 'extra';
  end if;

  became_flagged := refund and not o.needs_refund;

  -- registro do pagamento (sem criar linha para pagamento de outro pedido nem para status desconhecido)
  if v_out not in ('divergencia_cobranca', 'obsoleto', 'status_desconhecido') then
    insert into public.payment_charges (provider, payment_id, order_id, role, status, amount_cents, currency, live_mode, collector_id,
                                        payment_method, refunded_cents, provider_updated_at)
    values ('mercadopago', pid, o.id, new_role, pst, amt, cur, live, coll, meth, refd, upd)
    on conflict (provider, payment_id) do update
      set role = excluded.role, status = excluded.status, amount_cents = excluded.amount_cents, currency = excluded.currency,
          live_mode = excluded.live_mode, collector_id = excluded.collector_id,
          payment_method = coalesce(excluded.payment_method, public.payment_charges.payment_method),
          refunded_cents = greatest(excluded.refunded_cents, public.payment_charges.refunded_cents),
          provider_updated_at = greatest(excluded.provider_updated_at, public.payment_charges.provider_updated_at),
          last_seen_at = now();
  end if;

  if v_out <> 'duplicado' then
    update public.payment_orders set last_checked_at = now(), needs_refund = needs_refund or refund where id = o.id;
  end if;
  if became_flagged then
    perform public.audit(o.event_id, 'payment.divergencia_reembolsar',
      jsonb_build_object('orderId', o.id, 'plan', o.plan_code, 'amountCents', o.amount_cents, 'env', o.provider_env,
                         'from', o.status, 'source', p_source, 'outcome', v_out, 'paymentId', pid, 'needsRefund', true));
  end if;

  if v_out = 'aplicado' then
    select * into pl from public.plans where code = o.plan_code;
    if pst = 'approved' then
      select id into ent_id from public.event_entitlements where order_id = o.id;
      if ent_id is null then
        if not event_live or public.payments_plan_covered(o.event_id, o.plan_code) then
          refund := true; -- evento excluído/encerrado ou plano já coberto (cortesia, substituição): sem direito novo
        else
          insert into public.event_entitlements (event_id, plan_code, max_guests, max_shots, source, order_id, env, created_by, reason)
          values (o.event_id, o.plan_code, pl.max_guests, pl.max_shots, 'pago', o.id, o.provider_env, o.host_id, 'pedido ' || o.id)
          returning id into ent_id;
          if public.entitlement_env_valid(o.provider_env) then
            perform public.entitlement_raise_limits(o.event_id, o.plan_code);
          end if;
        end if;
      end if;
      update public.payment_orders set status = 'pago', paid_at = coalesce(paid_at, now()), mp_payment_id = pid,
             payment_method = coalesce(meth, payment_method), needs_refund = needs_refund or refund where id = o.id;
    elsif target in ('estornado', 'perdido') then
      update public.event_entitlements set status = 'estornado' where order_id = o.id and status = 'ativo' returning id into ent_id;
      update public.payment_orders set status = target::public.payment_status, refunded_cents = greatest(refunded_cents, refd),
             needs_refund = exists (select 1 from public.payment_charges c where c.order_id = o.id and c.role = 'extra'
                                      and c.status = 'approved' and c.refunded_cents < coalesce(c.amount_cents, 0))
       where id = o.id;
      if ent_id is not null and o.event_id is not null then perform public.payments_reapply_limits(o.event_id); end if;
      if o.event_id is not null and o.status in ('pago', 'em_disputa') then
        for u in select x.* from public.payment_orders x
                 where x.event_id = o.event_id and x.id <> o.id and x.from_plan_code = o.plan_code
                   and (x.status in ('criado', 'pendente')
                        or exists (select 1 from public.event_entitlements z where z.order_id = x.id and z.status = 'ativo')) loop
          insert into public.payment_events (provider, event_type, order_id, outcome, detail)
          values (u.provider, 'apply.' || p_source, u.id, 'upgrade_base_estornado',
                  jsonb_build_object('baseOrderId', o.id, 'baseTo', target, 'upgradeStatus', u.status, 'env', u.provider_env));
          perform public.audit(o.event_id, 'payment.upgrade_base_estornado',
            jsonb_build_object('orderId', u.id, 'baseOrderId', o.id, 'plan', u.plan_code, 'amountCents', u.amount_cents, 'env', u.provider_env));
        end loop;
      end if;
    elsif target = 'em_disputa' then
      update public.payment_orders set status = 'em_disputa' where id = o.id;
    else
      update public.payment_orders set status = 'pendente', payment_method = coalesce(meth, payment_method) where id = o.id;
    end if;
    perform public.audit(o.event_id, 'payment.' || target,
      jsonb_build_object('orderId', o.id, 'plan', o.plan_code, 'amountCents', o.amount_cents, 'env', o.provider_env,
                         'from', o.status, 'source', p_source, 'paymentId', pid)
      || case when refund then jsonb_build_object('needsRefund', true) else '{}'::jsonb end);
  elsif v_out = 'reembolso_parcial' then
    update public.payment_orders
       set refunded_cents = refd,
           refund_requested_at = case when refund_requested_at is not null and refd >= refunded_cents + coalesce(refund_amount_cents, 0)
                                      then null else refund_requested_at end,
           refund_amount_cents = case when refund_requested_at is not null and refd >= refunded_cents + coalesce(refund_amount_cents, 0)
                                      then null else refund_amount_cents end
     where id = o.id;
    perform public.audit(o.event_id, 'payment.reembolso_parcial',
      jsonb_build_object('orderId', o.id, 'plan', o.plan_code, 'amountCents', o.amount_cents, 'refundedCents', refd, 'paymentId', pid));
  elsif v_out = 'cobranca_extra_atualizada' then
    -- cobrança extra reembolsada: fecha o needs_refund quando não sobra extra a devolver e o pedido não é "pago sem direito"
    if not exists (select 1 from public.payment_charges c where c.order_id = o.id and c.role = 'extra'
                      and c.status = 'approved' and c.refunded_cents < coalesce(c.amount_cents, 0))
       and (o.status <> 'pago' or exists (select 1 from public.event_entitlements z where z.order_id = o.id and z.status = 'ativo')) then
      update public.payment_orders set needs_refund = false where id = o.id;
      perform public.audit(o.event_id, 'payment.extra_reembolsada',
        jsonb_build_object('orderId', o.id, 'plan', o.plan_code, 'amountCents', o.amount_cents, 'paymentId', pid));
    end if;
  elsif v_out = 'pago_ignorado_reembolsar' then
    perform public.audit(o.event_id, 'payment.pago_ignorado_reembolsar',
      jsonb_build_object('orderId', o.id, 'plan', o.plan_code, 'amountCents', o.amount_cents, 'env', o.provider_env,
                         'from', o.status, 'source', p_source, 'paymentId', pid, 'needsRefund', true));
  end if;

  -- um evento por resultado novo; repetições (mesmo pedido, resultado, pagamento e status) não regravam (PAY-004)
  if v_out <> 'duplicado' and (v_out = 'aplicado' or not exists (
       select 1 from public.payment_events e
        where e.order_id = o.id and e.outcome = v_out and e.detail ->> 'paymentId' = pid and e.detail ->> 'providerStatus' = pst
          and e.resolved_at is null)) then
    insert into public.payment_events (provider, event_type, order_id, outcome, detail)
    values ('mercadopago', 'apply.' || p_source, o.id, v_out,
            jsonb_build_object('from', from_status, 'to', coalesce(target, pst), 'paymentId', pid, 'providerStatus', pst,
                               'amountCents', amt, 'expectedCents', o.amount_cents, 'currency', cur, 'liveMode', live,
                               'env', o.provider_env, 'refundedCents', refd, 'needsRefund', refund));
  end if;

  return jsonb_build_object('applied', v_out = 'aplicado', 'outcome', v_out, 'from', from_status,
                            'to', case when v_out = 'aplicado' then target else from_status::text end, 'entitlementId', ent_id);
end $$;

-- ---------------------------------------------------------------- reembolso: alvo, solicitação e limpeza (PAY-001/002)
-- Qual pagamento um reembolso do pedido atinge. Padrão: o pagamento VINCULADO de pedido 'pago'; pedido ainda não pago com
-- needs_refund só tem alvo padrão se houver exatamente uma cobrança extra aprovada. Cobrança extra de pedido pago só por pedido
-- explícito. Nunca aceita id que o banco não conhece como deste pedido. Histórico AbacatePay: só provider_charge_id.
create function public.payments_refund_target(p_order uuid, p_payment text default null) returns table (payment_id text, kind text)
language plpgsql stable security definer set search_path = '' as $$
declare o public.payment_orders; n int; one text;
begin
  select * into o from public.payment_orders where id = p_order;
  if not found then raise exception 'invalid' using errcode = 'MM005'; end if;
  if o.provider = 'abacatepay' then
    if o.provider_charge_id is null or (p_payment is not null and p_payment <> o.provider_charge_id) then
      raise exception 'invalid' using errcode = 'MM005';
    end if;
    return query select o.provider_charge_id, 'primary'::text;
    return;
  end if;
  if p_payment is not null then
    if o.mp_payment_id is not null and p_payment = o.mp_payment_id then
      if o.status <> 'pago' then raise exception 'invalid' using errcode = 'MM005'; end if;
      return query select p_payment, 'primary'::text;
    elsif exists (select 1 from public.payment_charges c where c.provider = 'mercadopago' and c.order_id = o.id and c.payment_id = p_payment
                     and c.role = 'extra' and c.status = 'approved' and c.refunded_cents < coalesce(c.amount_cents, 0)) then
      return query select p_payment, 'extra'::text;
    else
      raise exception 'invalid' using errcode = 'MM005';
    end if;
    return;
  end if;
  if o.status = 'pago' and o.mp_payment_id is not null then
    return query select o.mp_payment_id, 'primary'::text;
    return;
  end if;
  if o.needs_refund and o.status in ('criado', 'pendente', 'expirado', 'cancelado', 'falhou') then
    select count(*), min(c.payment_id) into n, one from public.payment_charges c
     where c.provider = 'mercadopago' and c.order_id = o.id and c.role = 'extra' and c.status = 'approved'
       and c.refunded_cents < coalesce(c.amount_cents, 0);
    if n = 1 then
      return query select one, 'extra'::text;
      return;
    end if;
  end if;
  raise exception 'invalid' using errcode = 'MM005';
end $$;

create function public.admin_request_payment_refund(p_order uuid, p_payment text, p_reason text, p_amount_cents int default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare why text; o public.payment_orders; t record; c public.payment_charges; remaining int;
begin
  if not public.is_master() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  why := public.admin_reason(p_reason);
  select * into o from public.payment_orders where id = p_order for update;
  if not found then raise exception 'invalid' using errcode = 'MM005'; end if;
  if o.provider = 'abacatepay' and (p_amount_cents is not null
     or not (o.status = 'pago' or (o.needs_refund and o.status in ('criado', 'pendente', 'expirado', 'cancelado', 'falhou')))) then
    raise exception 'invalid' using errcode = 'MM005'; -- histórico: reembolso total, e só nos estados antigos
  end if;
  select * into t from public.payments_refund_target(o.id, p_payment);
  if t.kind = 'primary' then
    if o.refund_requested_at is not null then raise exception 'invalid' using errcode = 'MM005'; end if;
    remaining := o.amount_cents - o.refunded_cents;
    if p_amount_cents is not null and (p_amount_cents < 1 or p_amount_cents > remaining) then raise exception 'invalid' using errcode = 'MM005'; end if;
    update public.payment_orders set refund_requested_at = now(), refund_reason = why, refund_amount_cents = p_amount_cents where id = o.id;
  else
    select * into c from public.payment_charges where provider = 'mercadopago' and payment_id = t.payment_id for update;
    if c.refund_requested_at is not null then raise exception 'invalid' using errcode = 'MM005'; end if;
    remaining := coalesce(c.amount_cents, 0) - c.refunded_cents;
    if p_amount_cents is not null and (p_amount_cents < 1 or p_amount_cents > remaining) then raise exception 'invalid' using errcode = 'MM005'; end if;
    update public.payment_charges set refund_requested_at = now(), refund_reason = why, refund_amount_cents = p_amount_cents where id = c.id;
  end if;
  insert into public.audit_logs (actor_id, actor_role, event_id, action, target_type, target_id, reason, detail)
  values (auth.uid(), 'master', o.event_id, 'payment.refund_requested', 'payment_order', o.id::text, why,
          jsonb_build_object('orderId', o.id, 'plan', o.plan_code, 'amountCents', o.amount_cents, 'env', o.provider_env,
                             'status', o.status, 'needsRefund', o.needs_refund, 'paymentId', t.payment_id, 'kind', t.kind,
                             'refundAmountCents', p_amount_cents));
end $$;

-- Mesma assinatura de antes (a página do Master continua chamando igual): pedido pago → pagamento vinculado.
create or replace function public.admin_request_refund(p_order uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.admin_request_payment_refund(p_order, null, p_reason, null);
end $$;

-- PAY-002: o Master limpa needs_refund (ex.: reembolso feito no painel do provedor) com motivo, auditado; marca como
-- resolvidas as divergências do pedido (não apaga nada) para que saiam da lista (PAY-005).
create function public.admin_clear_needs_refund(p_order uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare why text; o public.payment_orders; n int;
begin
  if not public.is_master() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  why := public.admin_reason(p_reason);
  select * into o from public.payment_orders where id = p_order for update;
  if not found then raise exception 'invalid' using errcode = 'MM005'; end if;
  select count(*) into n from public.payment_events e
   where e.order_id = o.id and e.resolved_at is null
     and e.outcome in ('pago_ignorado_reembolsar', 'divergencia_valor', 'divergencia_ambiente', 'ambiente_divergente',
                       'divergencia_cobranca', 'divergencia_moeda', 'divergencia_recebedor', 'pagamento_duplicado');
  if not o.needs_refund and n = 0 then raise exception 'invalid' using errcode = 'MM005'; end if;
  update public.payment_orders set needs_refund = false where id = o.id;
  update public.payment_events set resolved_at = now(), resolved_by = auth.uid()
   where order_id = o.id and resolved_at is null
     and outcome in ('pago_ignorado_reembolsar', 'divergencia_valor', 'divergencia_ambiente', 'ambiente_divergente',
                     'divergencia_cobranca', 'divergencia_moeda', 'divergencia_recebedor', 'pagamento_duplicado');
  update public.payment_charges set resolved_at = now() where order_id = o.id and role = 'extra' and resolved_at is null;
  insert into public.audit_logs (actor_id, actor_role, event_id, action, target_type, target_id, reason, detail)
  values (auth.uid(), 'master', o.event_id, 'payment.needs_refund_cleared', 'payment_order', o.id::text, why,
          jsonb_build_object('orderId', o.id, 'plan', o.plan_code, 'amountCents', o.amount_cents, 'status', o.status,
                             'hadNeedsRefund', o.needs_refund, 'resolvedEvents', n));
end $$;

-- ---------------------------------------------------------------- Master: listagem e divergências
create or replace function public.admin_payment_json(o public.payment_orders, p_title text, p_plan_name text) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'orderId', o.id, 'createdAt', o.created_at, 'updatedAt', o.updated_at, 'eventId', o.event_id, 'eventTitle', p_title,
    'hostId', o.host_id, 'planCode', o.plan_code, 'planName', p_plan_name, 'fromPlanCode', o.from_plan_code,
    'amountCents', o.amount_cents, 'status', o.status, 'provider', o.provider, 'providerEnv', o.provider_env,
    'providerChargeId', coalesce(o.mp_payment_id, o.provider_charge_id), 'needsRefund', o.needs_refund,
    'refundRequestedAt', o.refund_requested_at, 'refundReason', o.refund_reason, 'paidAt', o.paid_at, 'expiresAt', o.expires_at,
    'paymentMethod', o.payment_method, 'refundedCents', o.refunded_cents)
$$;

-- PAY-005: divergência em pedido 'pago' ou 'em_disputa' não some em 30 dias: fica até o tratamento (resolved_at).
-- Novos tipos: divergencia_moeda · divergencia_recebedor · pagamento_duplicado.
create or replace function public.admin_payment_divergences() returns setof jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_master() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  return query
  with d as (
    select 'pago_sem_direito'::text as kind, o.id as order_id, coalesce(o.paid_at, o.updated_at) as detected_at, 1 as occurrences
      from public.payment_orders o
     where o.status = 'pago' and o.event_id is not null and not o.needs_refund
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
     where pe.resolved_at is null
       and (pe.received_at > now() - interval '30 days'
            or (po.needs_refund and pe.detail ->> 'to' = 'pago')
            or (po.status in ('pago', 'em_disputa') and pe.outcome in ('divergencia_cobranca', 'divergencia_valor', 'divergencia_moeda',
                  'divergencia_recebedor', 'divergencia_ambiente', 'ambiente_divergente', 'pagamento_duplicado')))
       and (pe.outcome in ('pago_ignorado_reembolsar', 'upgrade_base_estornado', 'divergencia_valor', 'divergencia_ambiente',
                           'ambiente_divergente', 'divergencia_cobranca', 'divergencia_moeda', 'divergencia_recebedor',
                           'pagamento_duplicado')
            or (pe.outcome = 'transicao_ignorada' and pe.detail ->> 'to' = 'pago'))
     group by 1, 2
  )
  select jsonb_build_object(
      'kind', d.kind, 'orderId', o.id, 'eventId', o.event_id, 'eventTitle', e.title, 'planCode', o.plan_code,
      'amountCents', o.amount_cents, 'status', o.status, 'providerChargeId', coalesce(o.mp_payment_id, o.provider_charge_id),
      'needsRefund', o.needs_refund, 'refundRequestedAt', o.refund_requested_at,
      'refundInProgress', (o.refund_requested_at is not null
                           and (o.status = 'pago' or (o.needs_refund and o.status in ('criado', 'pendente', 'expirado', 'cancelado', 'falhou'))))
                          or exists (select 1 from public.payment_charges c where c.order_id = o.id and c.role = 'extra'
                                       and c.refund_requested_at is not null and c.status <> 'refunded'),
      'detectedAt', d.detected_at, 'occurrences', d.occurrences)
    from d join public.payment_orders o on o.id = d.order_id
    left join public.events e on e.id = o.event_id
   order by d.detected_at desc, o.id, d.kind;
end $$;

-- ---------------------------------------------------------------- AbacatePay histórico: PAY-003 e PAY-004
-- Histórico AbacatePay (cópia da 001600 com PAY-003 e PAY-004). Aplica o estado reconsultado no provedor. Toda chamada grava uma linha em payment_events com o resultado:
-- aplicado | duplicado | transicao_ignorada | pago_ignorado_reembolsar | divergencia_valor | divergencia_ambiente |
-- divergencia_cobranca; e, no estorno/perda de um plano base, upgrade_base_estornado no pedido de upgrade apoiado nele.
-- Dinheiro recebido sem direito concedido sempre marca needs_refund: plano já coberto, evento excluído/encerrado/purgado,
-- PAID reconsultado num pedido já cancelado/estornado/perdido, ou PAID com divergencia_valor/divergencia_cobranca num
-- pedido que ainda não estava pago (criado/pendente/expirado/cancelado/falhou; o status é mantido). Pedido ainda não pago
-- com needs_refund aceita o estorno (o reembolso do Master o fecha), inclusive com o valor divergente do provedor.
create or replace function public.payments_apply_status(p_order uuid, p_charge_id text, p_status public.payment_status, p_amount_cents int,
                                             p_dev_mode boolean, p_source text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  o public.payment_orders;
  ev public.events;
  pl public.plans;
  u public.payment_orders;
  outcome text;
  ent_id uuid;
  refund boolean := false;
  allowed boolean;
  event_live boolean := false;
begin
  if p_source is null or p_source not in ('webhook', 'status', 'reconcile') or p_status is null then
    raise exception 'invalid' using errcode = 'MM005';
  end if;
  -- mesma ordem de travas de payments_open_order (evento → pedido): evita deadlock e serializa direitos do evento.
  -- Pedido de evento purgado (event_id null): sem trava de evento e sem direito, mas o status continua sendo aplicado.
  select * into ev from public.events e where e.id = (select x.event_id from public.payment_orders x where x.id = p_order) for update;
  select * into o from public.payment_orders where id = p_order for update;
  if not found then raise exception 'invalid' using errcode = 'MM005'; end if;
  if o.event_id is not null and ev.id = o.event_id then
    event_live := ev.deleted_at is null and now() < public.event_end(ev.start_at, ev.duration_hours, ev.ended_at);
  end if;

  allowed := (o.status, p_status) in (
    ('criado', 'pendente'), ('criado', 'falhou'),
    ('pendente', 'pago'), ('pendente', 'expirado'), ('pendente', 'cancelado'), ('pendente', 'falhou'),
    ('expirado', 'pago'), ('falhou', 'pago'),
    ('pago', 'estornado'), ('pago', 'em_disputa'),
    ('em_disputa', 'pago'), ('em_disputa', 'perdido'), ('em_disputa', 'estornado'))
    -- Ruling 16: Pix recebido em pedido cancelado (needs_refund) é reembolsado pelo Master; o estorno fecha o pedido.
    -- Sem needs_refund não houve dinheiro: continua ignorado. Não há direito a revogar (pedido cancelado não concede).
    -- Generalizado a todo pedido ainda não pago com needs_refund (inclui PAID divergente: valor ou cobrança).
    or (p_status = 'estornado' and o.needs_refund and o.status in ('criado', 'pendente', 'expirado', 'cancelado', 'falhou'));

  if o.provider_charge_id is null or p_charge_id is distinct from o.provider_charge_id then
    outcome := 'divergencia_cobranca';
  elsif p_dev_mode is null or p_dev_mode <> (o.provider_env = 'sandbox') then
    outcome := 'divergencia_ambiente';
  -- PAY-003: o waiver de valor do estorno só vale para pedido ainda não pago (dinheiro divergente); pedido pago não o aceita
  elsif not (p_status = 'estornado' and o.needs_refund and o.status in ('criado', 'pendente', 'expirado', 'cancelado', 'falhou'))
        and ((p_status = 'pago' and p_amount_cents is distinct from o.amount_cents)
             or (p_amount_cents is not null and p_amount_cents <> o.amount_cents)) then
    outcome := 'divergencia_valor';
  elsif o.status = p_status then
    outcome := 'duplicado';
  elsif p_status = 'pago' and o.status = 'cancelado' and o.needs_refund then
    outcome := 'duplicado'; -- PAID já registrado e marcado para reembolso: a reconsulta a cada 5 min não reaudita nem remarca
  elsif p_status = 'pago' and o.status in ('cancelado', 'estornado', 'perdido') then
    outcome := 'pago_ignorado_reembolsar'; -- transição não aplicada, mas o dinheiro entrou
    refund := true;
  elsif not allowed then
    outcome := 'transicao_ignorada';
  else
    outcome := 'aplicado';
  end if;

  -- PAID divergente (valor ou cobrança) em pedido ainda não pago: o dinheiro pode ter entrado e nenhum direito foi
  -- concedido. Marca needs_refund (o Master reembolsa após reconsultar a cobrança PAID), sem mudar o status.
  if outcome in ('divergencia_valor', 'divergencia_cobranca') and p_status = 'pago'
     and o.status in ('criado', 'pendente', 'expirado', 'cancelado', 'falhou') then
    refund := true;
    if not o.needs_refund then
      perform public.audit(o.event_id, 'payment.divergencia_reembolsar',
        jsonb_build_object('orderId', o.id, 'plan', o.plan_code, 'amountCents', o.amount_cents, 'env', o.provider_env,
                           'from', o.status, 'source', p_source, 'outcome', outcome, 'needsRefund', true));
    end if;
  end if;

  update public.payment_orders set last_checked_at = now(), needs_refund = needs_refund or refund where id = o.id;
  if outcome = 'pago_ignorado_reembolsar' then
    perform public.audit(o.event_id, 'payment.pago_ignorado_reembolsar',
      jsonb_build_object('orderId', o.id, 'plan', o.plan_code, 'amountCents', o.amount_cents, 'env', o.provider_env,
                         'from', o.status, 'source', p_source, 'needsRefund', true));
  end if;

  if outcome = 'aplicado' then
    select * into pl from public.plans where code = o.plan_code;
    if p_status = 'pago' then
      select id into ent_id from public.event_entitlements where order_id = o.id;
      if ent_id is null then
        if not event_live or public.payments_plan_covered(o.event_id, o.plan_code) then
          -- evento excluído/encerrado/purgado, ou já tem o plano (pagamento tardio, cortesia no meio): sem direito novo
          refund := true;
        else
          insert into public.event_entitlements (event_id, plan_code, max_guests, max_shots, source, order_id, env, created_by, reason)
          values (o.event_id, o.plan_code, pl.max_guests, pl.max_shots, 'pago', o.id, o.provider_env, o.host_id, 'pedido ' || o.id)
          returning id into ent_id;
          -- direito que não vale agora (sandbox fora da homologação) não mexe no evento; produção vale mesmo 'desligado'
          if public.entitlement_env_valid(o.provider_env) then
            perform public.entitlement_raise_limits(o.event_id, o.plan_code);
          end if;
        end if;
      end if;
      update public.payment_orders set status = 'pago', paid_at = coalesce(paid_at, now()),
             needs_refund = needs_refund or refund where id = o.id;
    elsif p_status in ('estornado', 'perdido') then
      update public.event_entitlements set status = 'estornado' where order_id = o.id and status = 'ativo' returning id into ent_id;
      update public.payment_orders set status = p_status, needs_refund = false where id = o.id;
      if ent_id is not null and o.event_id is not null then perform public.payments_reapply_limits(o.event_id); end if;
      -- upgrade apoiado neste plano (cotado com desconto dele) ainda vale ou está aberto: não revoga (Task 7 decide), mas sinaliza.
      -- Estorno de pedido que nunca foi pago (Ruling 16, PAID divergente) não era base de nada: sem sinal.
      if o.event_id is not null and o.status in ('pago', 'em_disputa') then
        for u in select x.* from public.payment_orders x
                 where x.event_id = o.event_id and x.id <> o.id and x.from_plan_code = o.plan_code
                   and (x.status in ('criado', 'pendente')
                        or exists (select 1 from public.event_entitlements z where z.order_id = x.id and z.status = 'ativo')) loop
          insert into public.payment_events (provider, event_type, order_id, outcome, detail)
          values (u.provider, 'apply.' || p_source, u.id, 'upgrade_base_estornado',
                  jsonb_build_object('baseOrderId', o.id, 'baseTo', p_status, 'upgradeStatus', u.status, 'env', u.provider_env));
          perform public.audit(o.event_id, 'payment.upgrade_base_estornado',
            jsonb_build_object('orderId', u.id, 'baseOrderId', o.id, 'plan', u.plan_code, 'amountCents', u.amount_cents,
                               'env', u.provider_env));
        end loop;
      end if;
    else
      update public.payment_orders set status = p_status where id = o.id;
    end if;
    perform public.audit(o.event_id, 'payment.' || p_status::text,
      jsonb_build_object('orderId', o.id, 'plan', o.plan_code, 'amountCents', o.amount_cents, 'env', o.provider_env,
                         'from', o.status, 'source', p_source)
      || case when refund then jsonb_build_object('needsRefund', true) else '{}'::jsonb end);
  end if;

  -- PAY-004: repetição sem mudança não regrava payment_events
  if outcome <> 'duplicado' then
    insert into public.payment_events (provider, event_type, order_id, outcome, detail)
    values (o.provider, 'apply.' || p_source, o.id, outcome,
            jsonb_build_object('from', o.status, 'to', p_status, 'amountCents', p_amount_cents, 'expectedCents', o.amount_cents,
                               'devMode', p_dev_mode, 'env', o.provider_env, 'needsRefund', refund));
  end if;

  return jsonb_build_object('applied', outcome = 'aplicado', 'from', o.status, 'to', p_status, 'entitlementId', ent_id);
end $$;


-- ---------------------------------------------------------------- privilégios
revoke execute on function
  public.payments_attach_preference(uuid, text, text, timestamptz),
  public.payments_record_event(text, text, text, uuid, text, jsonb),
  public.payments_touch_checked(uuid), public.payments_reconcile_candidates(text, int), public.payments_expire_stale(),
  public.payments_apply_payment(uuid, jsonb, text, text), public.payments_refund_target(uuid, text),
  public.admin_request_payment_refund(uuid, text, text, int), public.admin_clear_needs_refund(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function
  public.payments_attach_preference(uuid, text, text, timestamptz),
  public.payments_record_event(text, text, text, uuid, text, jsonb),
  public.payments_touch_checked(uuid), public.payments_reconcile_candidates(text, int), public.payments_expire_stale(),
  public.payments_apply_payment(uuid, jsonb, text, text), public.payments_refund_target(uuid, text)
  to service_role;
grant execute on function public.admin_request_payment_refund(uuid, text, text, int), public.admin_clear_needs_refund(uuid, text)
  to authenticated;
