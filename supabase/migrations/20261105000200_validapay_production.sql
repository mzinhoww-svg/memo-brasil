-- Additive production support. No flags or platform settings are enabled here.
alter table public.payment_orders add column validapay_attempted_at timestamptz;
-- Existing unattached orders may already have had an uncertain financial POST.
update public.payment_orders set validapay_attempted_at=created_at
where provider='validapay';

create function public.payments_validapay_mark_attempt(p_order uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare o public.payment_orders;
begin
  select * into o from public.payment_orders where id=p_order for update;
  if not found or o.provider<>'validapay' or o.status<>'criado' or o.provider_charge_id is not null then return false; end if;
  update public.payment_orders set validapay_attempted_at=coalesce(validapay_attempted_at,now()) where id=p_order;
  return true;
end $$;

create function public.payments_validapay_abandon(p_order uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare o public.payment_orders;
begin
  select * into o from public.payment_orders where id=p_order for update;
  if not found or o.provider<>'validapay' or o.status<>'criado' or o.provider_charge_id is not null or o.validapay_attempted_at is not null then return false; end if;
  update public.payment_orders set status='cancelado' where id=p_order;
  return true;
end $$;
revoke all on function public.payments_validapay_mark_attempt(uuid),public.payments_validapay_abandon(uuid) from public,anon,authenticated;
grant execute on function public.payments_validapay_mark_attempt(uuid),public.payments_validapay_abandon(uuid) to service_role;

create or replace function public.payments_validapay_open(p_event uuid,p_plan text,p_idempotency_key uuid,p_method text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.payment_orders; ev public.events; q jsonb; uid uuid := auth.uid(); selected_env text := public.payments_env();
begin
  if uid is null or not exists(select 1 from auth.users where id=uid and not coalesce(is_anonymous,false)) or (selected_env='sandbox' and not public.is_master()) then raise exception 'forbidden' using errcode='MM004'; end if;
  if selected_env is null or selected_env not in ('sandbox','production') or not exists(select 1 from public.feature_flags where key='validapay_checkout' and enabled) then
    raise exception 'pagamentoindisponivel' using errcode='MM014';
  end if;
  if p_method is null or p_method not in ('pix','card') or p_idempotency_key is null then raise exception 'invalid' using errcode='MM005'; end if;
  select * into ev from public.events where id=p_event and deleted_at is null for update;
  if not found or ev.host_id<>uid then raise exception 'forbidden' using errcode='MM004'; end if;
  select * into o from public.payment_orders where host_id=uid and idempotency_key=p_idempotency_key;
  if found then
    if o.event_id is distinct from p_event or o.plan_code<>p_plan or o.provider<>'validapay' or o.provider_env is distinct from selected_env or o.payment_method<>p_method then
      raise exception 'invalid' using errcode='MM005';
    end if;
    return public.payments_order_json(o,true);
  end if;
  select * into o from public.payment_orders where event_id=p_event and status in ('criado','pendente') for update;
  if found then
    if o.provider='validapay' and o.provider_env=selected_env and o.plan_code=p_plan and o.payment_method=p_method then
      return public.payments_order_json(o,true);
    end if;
    raise exception 'pedidoaberto' using errcode='MM013';
  end if;
  q:=public.payments_quote_internal(p_event,p_plan);
  if q->>'reason'<>'ok' then raise exception 'invalid' using errcode='MM005'; end if;
  insert into public.payment_orders(event_id,host_id,plan_code,from_plan_code,amount_cents,provider,provider_env,idempotency_key,payment_method)
  values(p_event,uid,p_plan,q->>'fromPlanCode',(q->>'amountCents')::int,'validapay',selected_env,p_idempotency_key,p_method) returning * into o;
  perform public.audit(p_event,'payment.criado',jsonb_build_object('orderId',o.id,'provider','validapay','env',selected_env));
  return public.payments_order_json(o,false);
end $$;

create or replace function public.payments_validapay_attach(p_order uuid,p_charge text,p_method text)
returns void language plpgsql security definer set search_path='' as $$
declare o public.payment_orders;
begin
  select * into o from public.payment_orders where id=p_order for update;
  if not found or o.provider<>'validapay' or o.provider_env not in ('sandbox','production') or p_method is distinct from o.payment_method
     or (o.provider_env='production' and p_charge like 'SANDBOX_%')
     or p_charge is null or p_charge !~ '^(SANDBOX_)?cha_[A-Za-z0-9_-]{1,150}$'
     or (o.provider_charge_id is not null and o.provider_charge_id<>p_charge) then raise exception 'invalid' using errcode='MM005'; end if;
  if o.provider_charge_id=p_charge then return; end if;
  if o.status<>'criado' then raise exception 'invalid' using errcode='MM005'; end if;
  update public.payment_orders set provider_charge_id=p_charge,status='pendente' where id=o.id;
end $$;

create or replace function public.payments_validapay_confirm(p_order uuid,p_charge jsonb,p_source text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.payment_orders; target public.payment_status;
begin
  -- Same lock order as all existing entitlement writers: event, then order.
  perform 1 from public.events where id=(select event_id from public.payment_orders where id=p_order) for update;
  select * into o from public.payment_orders where id=p_order for update;
  if not found or o.provider<>'validapay' or o.provider_env not in ('sandbox','production') or o.currency<>'BRL' or o.provider_charge_id is null
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
      'apply.'||p_source,o.id,'divergencia_valor',jsonb_build_object('expectedCents',o.amount_cents,'observedCents',p_charge->'amountCents','paidCents',p_charge->'paidAmountCents','env',o.provider_env))
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
  return public.payments_apply_status(o.id,o.provider_charge_id,target,o.amount_cents,o.provider_env='sandbox',p_source);
end $$;

create or replace function public.payments_validapay_confirm_refund(p_order uuid,p_refund jsonb,p_source text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.payment_orders; refunded int; result jsonb; entitlement_id uuid;
begin
  perform 1 from public.events where id=(select event_id from public.payment_orders where id=p_order) for update;
  select * into o from public.payment_orders where id=p_order for update;
  refunded:=(p_refund->>'refundedCents')::int;
  if not found or o.provider<>'validapay' or o.provider_env not in ('sandbox','production') or o.currency<>'BRL' or o.provider_charge_id is null
    or p_refund->>'chargeId' is distinct from o.provider_charge_id or p_refund->>'merchantReference' is distinct from o.id::text
    or p_refund->>'environment' is distinct from o.provider_env or p_refund->>'currency' is distinct from 'BRL'
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
    perform public.audit(o.event_id,'payment.estornado',jsonb_build_object('orderId',o.id,'source',p_source,'outcome','refunded_before_paid_confirmation','env',o.provider_env));
    return jsonb_build_object('applied',true,'from',o.status,'to','estornado');
  end if;
  result:=public.payments_apply_status(o.id,o.provider_charge_id,'estornado',o.amount_cents,o.provider_env='sandbox',p_source);
  return result;
end $$;

-- Keep authenticated deliveries and worker leases inside their trusted deployment environment.
alter table public.validapay_webhook_inbox add column provider_env text not null default 'sandbox'
  check(provider_env in ('sandbox','production'));
alter table public.validapay_webhook_inbox drop constraint validapay_webhook_inbox_pkey;
alter table public.validapay_webhook_inbox add primary key(provider_env,event_id);
create function public.payments_validapay_claim_inbox_env(p_environment text,p_limit int default 50)
returns setof public.validapay_webhook_inbox language sql security definer set search_path='' as $$
  update public.validapay_webhook_inbox i set attempts=i.attempts+1,
    next_attempt_at=now()+make_interval(secs=>least(43200,power(2,least(i.attempts,12))*60)::int)
  where i.provider_env=p_environment and i.event_id in (
    select event_id from public.validapay_webhook_inbox where provider_env=p_environment and processed_at is null and next_attempt_at<=now()
    order by next_attempt_at,received_at,event_id limit least(greatest(p_limit,1),100) for update skip locked
  ) returning i.*
$$;
revoke all on function public.payments_validapay_claim_inbox_env(text,int) from public,anon,authenticated;
grant execute on function public.payments_validapay_claim_inbox_env(text,int) to service_role;
-- Preserve the legacy sandbox worker signature without letting it lease production inbox rows.
create or replace function public.payments_validapay_claim_inbox(p_limit int default 50)
returns setof public.validapay_webhook_inbox language sql security definer set search_path='' as $$
  select * from public.payments_validapay_claim_inbox_env('sandbox',p_limit)
$$;
