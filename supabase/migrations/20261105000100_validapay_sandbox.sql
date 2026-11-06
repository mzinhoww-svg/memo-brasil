-- Additive sandbox implementation. No existing financial rows are rewritten.
-- Disabled by default, master-only, and refuses payments_env=production.
alter table public.payment_orders drop constraint payment_orders_provider_chk;
alter table public.payment_orders add constraint payment_orders_provider_chk
  check (provider in ('abacatepay','mercadopago','validapay'));

-- Missing validapay_checkout flag means disabled. Do not add/enable platform settings here.

create table public.validapay_webhook_inbox (
  event_id text primary key check (length(event_id) between 1 and 200),
  charge_id text not null check (charge_id ~ '^(SANDBOX_)?cha_[A-Za-z0-9_-]+$'),
  event_type text not null check (length(event_type) between 1 and 100),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  attempts int not null default 0,
  next_attempt_at timestamptz not null default now(),
  outcome text
);
alter table public.validapay_webhook_inbox enable row level security;
revoke all on public.validapay_webhook_inbox from public,anon,authenticated;
grant all on public.validapay_webhook_inbox to service_role;

create function public.payments_validapay_claim_inbox(p_limit int default 50)
returns setof public.validapay_webhook_inbox language sql security definer set search_path='' as $$
  update public.validapay_webhook_inbox i set attempts=i.attempts+1,
    next_attempt_at=now()+make_interval(secs=>least(43200,power(2,least(i.attempts,12))*60)::int)
  where i.event_id in (
    select event_id from public.validapay_webhook_inbox where processed_at is null and next_attempt_at<=now()
    order by next_attempt_at,received_at,event_id limit least(greatest(p_limit,1),100) for update skip locked
  ) returning i.*
$$;
revoke all on function public.payments_validapay_claim_inbox(int) from public,anon,authenticated;
grant execute on function public.payments_validapay_claim_inbox(int) to service_role;

create table public.validapay_refund_requests (
  order_id uuid primary key references public.payment_orders,
  request_id uuid not null unique,
  amount_cents int not null check(amount_cents>=100),
  state text not null default 'reserved' check(state in ('reserved','uncertain','processing','confirmed')),
  refund_id text unique,
  requested_at timestamptz not null default now(),
  checked_at timestamptz,
  requested_by uuid
);
alter table public.validapay_refund_requests enable row level security;
revoke all on public.validapay_refund_requests from public,anon,authenticated;
grant all on public.validapay_refund_requests to service_role;

create function public.payments_validapay_claim_refund(p_order uuid,p_request uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.payment_orders; n int;
begin
  select * into o from public.payment_orders where id=p_order for update;
  if not found or o.provider<>'validapay' or o.provider_env<>'sandbox' or o.currency<>'BRL' or o.provider_charge_id is null
     or o.status not in ('pago','em_disputa','estornado') or p_request is null then raise exception 'invalid' using errcode='MM005'; end if;
  insert into public.validapay_refund_requests(order_id,request_id,amount_cents) values(o.id,p_request,o.amount_cents) on conflict(order_id) do nothing;
  get diagnostics n=row_count;
  return jsonb_build_object('claimed',n=1,'amountCents',o.amount_cents,'chargeId',o.provider_charge_id);
end $$;

create function public.payments_validapay_confirm_refund(p_order uuid,p_refund jsonb,p_source text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.payment_orders; refunded int; result jsonb; entitlement_id uuid;
begin
  perform 1 from public.events where id=(select event_id from public.payment_orders where id=p_order) for update;
  select * into o from public.payment_orders where id=p_order for update;
  refunded:=(p_refund->>'refundedCents')::int;
  if not found or o.provider<>'validapay' or o.provider_env<>'sandbox' or o.currency<>'BRL' or o.provider_charge_id is null
    or p_refund->>'chargeId' is distinct from o.provider_charge_id or p_refund->>'merchantReference' is distinct from o.id::text
    or p_refund->>'environment' is distinct from 'sandbox' or p_refund->>'currency' is distinct from 'BRL'
    or (p_refund->>'amountCents')::int is distinct from o.amount_cents or refunded is null or refunded<0 or refunded>o.amount_cents
    or p_source is null or p_source not in ('webhook','status','reconcile') then raise exception 'invalid refund evidence' using errcode='MM005'; end if;
  update public.validapay_refund_requests set checked_at=now(),state=case when refunded=o.amount_cents then 'confirmed' else state end where order_id=o.id;
  update public.payment_orders set refunded_cents=greatest(refunded_cents,refunded),last_checked_at=now() where id=o.id;
  if refunded<o.amount_cents then return jsonb_build_object('applied',false,'outcome','partial_or_pending'); end if;
  update public.payment_orders set needs_refund=false where id=o.id;
  if o.status in ('criado','pendente','expirado','falhou','cancelado') then
    update public.event_entitlements set status='estornado' where order_id=o.id and status='ativo' returning id into entitlement_id;
    update public.payment_orders set status='estornado' where id=o.id;
    if entitlement_id is not null and o.event_id is not null then perform public.payments_reapply_limits(o.event_id); end if;
    perform public.audit(o.event_id,'payment.estornado',jsonb_build_object('orderId',o.id,'source',p_source,'outcome','refunded_before_paid_confirmation','env','sandbox'));
    return jsonb_build_object('applied',true,'from',o.status,'to','estornado');
  end if;
  result:=public.payments_apply_status(o.id,o.provider_charge_id,'estornado',o.amount_cents,true,p_source);
  return result;
end $$;
revoke all on function public.payments_validapay_claim_refund(uuid,uuid),public.payments_validapay_confirm_refund(uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.payments_validapay_claim_refund(uuid,uuid),public.payments_validapay_confirm_refund(uuid,jsonb,text) to service_role;

create function public.payments_validapay_open(p_event uuid,p_plan text,p_idempotency_key uuid,p_method text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.payment_orders; ev public.events; q jsonb; uid uuid := auth.uid();
begin
  if uid is null or not public.is_master() then raise exception 'forbidden' using errcode='MM004'; end if;
  if public.payments_env()<>'sandbox' or not exists(select 1 from public.feature_flags where key='validapay_checkout' and enabled) then
    raise exception 'pagamentoindisponivel' using errcode='MM014';
  end if;
  if p_method is null or p_method not in ('pix','card') or p_idempotency_key is null then raise exception 'invalid' using errcode='MM005'; end if;
  select * into ev from public.events where id=p_event and deleted_at is null for update;
  if not found or ev.host_id<>uid then raise exception 'forbidden' using errcode='MM004'; end if;
  select * into o from public.payment_orders where host_id=uid and idempotency_key=p_idempotency_key;
  if found then
    if o.event_id is distinct from p_event or o.plan_code<>p_plan or o.provider<>'validapay' or o.payment_method<>p_method then
      raise exception 'invalid' using errcode='MM005';
    end if;
    return public.payments_order_json(o,true);
  end if;
  select * into o from public.payment_orders where event_id=p_event and status in ('criado','pendente') for update;
  if found then
    if o.provider='validapay' and o.provider_env='sandbox' and o.plan_code=p_plan and o.payment_method=p_method then
      return public.payments_order_json(o,true);
    end if;
    raise exception 'pedidoaberto' using errcode='MM013';
  end if;
  q:=public.payments_quote_internal(p_event,p_plan);
  if q->>'reason'<>'ok' then raise exception 'invalid' using errcode='MM005'; end if;
  insert into public.payment_orders(event_id,host_id,plan_code,from_plan_code,amount_cents,provider,provider_env,idempotency_key,payment_method)
  values(p_event,uid,p_plan,q->>'fromPlanCode',(q->>'amountCents')::int,'validapay','sandbox',p_idempotency_key,p_method) returning * into o;
  perform public.audit(p_event,'payment.criado',jsonb_build_object('orderId',o.id,'provider','validapay','env','sandbox'));
  return public.payments_order_json(o,false);
end $$;

create function public.payments_validapay_attach(p_order uuid,p_charge text,p_method text)
returns void language plpgsql security definer set search_path='' as $$
declare o public.payment_orders;
begin
  select * into o from public.payment_orders where id=p_order for update;
  if not found or o.provider<>'validapay' or o.provider_env<>'sandbox' or p_method is distinct from o.payment_method
     or p_charge is null or p_charge !~ '^(SANDBOX_)?cha_[A-Za-z0-9_-]{1,150}$'
     or (o.provider_charge_id is not null and o.provider_charge_id<>p_charge) then raise exception 'invalid' using errcode='MM005'; end if;
  if o.provider_charge_id=p_charge then return; end if;
  if o.status<>'criado' then raise exception 'invalid' using errcode='MM005'; end if;
  update public.payment_orders set provider_charge_id=p_charge,status='pendente' where id=o.id;
end $$;

-- Called only with details fetched from the sandbox OAuth account, never a webhook body.
create function public.payments_validapay_confirm(p_order uuid,p_charge jsonb,p_source text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.payment_orders; target public.payment_status;
begin
  -- Same lock order as all existing entitlement writers: event, then order.
  perform 1 from public.events where id=(select event_id from public.payment_orders where id=p_order) for update;
  select * into o from public.payment_orders where id=p_order for update;
  if not found or o.provider<>'validapay' or o.provider_env<>'sandbox' or o.currency<>'BRL' or o.provider_charge_id is null
     or p_source is null or p_source not in ('status','webhook','reconcile')
     or p_charge->>'environment' is distinct from o.provider_env
     or p_charge->>'currency' is distinct from 'BRL'
     or p_charge->>'chargeId' is distinct from o.provider_charge_id
     or p_charge->>'merchantReference' is distinct from o.id::text
     or p_charge->>'method' is distinct from o.payment_method
  then raise exception 'invalid financial confirmation' using errcode='MM005'; end if;
  if o.status='estornado' and o.refunded_cents>=o.amount_cents then return jsonb_build_object('applied',false,'outcome','duplicado'); end if;
  if (p_charge->>'amountCents')::int is distinct from o.amount_cents
     or (p_charge->>'status'='PAID' and (p_charge->>'paidAmountCents')::int is distinct from o.amount_cents) then
    update public.payment_orders set last_checked_at=now(),needs_refund=needs_refund or p_charge->>'status'='PAID' where id=o.id;
    insert into public.payment_events(provider,provider_event_id,event_type,order_id,outcome,detail)
    values('validapay','amount:'||o.id||':'||coalesce(p_charge->>'amountCents','null')||':'||coalesce(p_charge->>'paidAmountCents','null'),
      'apply.'||p_source,o.id,'divergencia_valor',jsonb_build_object('expectedCents',o.amount_cents,'observedCents',p_charge->'amountCents','paidCents',p_charge->'paidAmountCents','env','sandbox'))
    on conflict(provider,provider_event_id) do nothing;
    return jsonb_build_object('applied',false,'outcome','divergencia_valor');
  end if;
  target:=case p_charge->>'status'
    when 'PAID' then 'pago'::public.payment_status
    when 'PENDING' then 'pendente'::public.payment_status
    when 'PROCESSING' then 'pendente'::public.payment_status
    when 'AWAITING_PAYMENT' then 'pendente'::public.payment_status
    when 'EXPIRED' then 'expirado'::public.payment_status
    when 'FAILED' then 'falhou'::public.payment_status
    when 'CHARGE_FAILED' then 'falhou'::public.payment_status
    when 'CANCELED' then 'cancelado'::public.payment_status
    when 'CANCELLED' then 'cancelado'::public.payment_status
    else null end;
  -- Refund/dispute states need separate verified refund evidence. Never infer them.
  if target is null then raise exception 'unsupported financial state' using errcode='MM005'; end if;
  return public.payments_apply_status(o.id,o.provider_charge_id,target,o.amount_cents,true,p_source);
end $$;

-- Guard legacy open_order without replacing its financial implementation.
-- Legacy code otherwise cancels every non-Mercado-Pago open order when starting.
alter function public.payments_open_order(uuid,text,uuid) rename to payments_open_order_mercadopago;
revoke all on function public.payments_open_order_mercadopago(uuid,text,uuid) from public,anon,authenticated,service_role;
create function public.payments_open_order(p_event uuid,p_plan text,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not exists(select 1 from public.events where id=p_event and host_id=auth.uid() and deleted_at is null) then
    raise exception 'forbidden' using errcode='MM004';
  end if;
  perform 1 from public.events where id=p_event for update;
  if exists(select 1 from public.payment_orders where event_id=p_event and provider='validapay' and status in ('criado','pendente')) then
    raise exception 'pedidoaberto' using errcode='MM013';
  end if;
  return public.payments_open_order_mercadopago(p_event,p_plan,p_idempotency_key);
end $$;

revoke all on function public.payments_validapay_open(uuid,text,uuid,text),public.payments_open_order(uuid,text,uuid),
 public.payments_validapay_attach(uuid,text,text),public.payments_validapay_confirm(uuid,jsonb,text) from public,anon,authenticated,service_role;
grant execute on function public.payments_validapay_open(uuid,text,uuid,text),public.payments_open_order(uuid,text,uuid) to authenticated;
grant execute on function public.payments_validapay_attach(uuid,text,text),public.payments_validapay_confirm(uuid,jsonb,text) to service_role;
