-- MemoriesMT — caminho aditivo para Checkout Transparente (Pix / cartão incorporados).
-- NEVER replaces the existing Checkout Pro preference/webhook/entitlement contract.
-- Migration NOT APPLIED by this PR. Test locally and explicitly approve remote application first.

alter table public.payment_orders
  add column if not exists embedded_method text
  check (embedded_method is null or embedded_method in ('pix', 'card'));

comment on column public.payment_orders.embedded_method is
  'Método escolhido no Payment Brick, NULL nos pedidos Checkout Pro históricos. Não armazena token/cartão/CPF.';

-- Reservar o método em uma transação com lock antes de criar pagamento externo.
-- Somente JWT service_role pode executar; o chamador com sessão de organizador é verificado
-- na Edge Function por payments_open_order. O token service_role nunca chega ao web.
create or replace function public.payments_reserve_embedded(p_order uuid, p_method text)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  o public.payment_orders;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'forbidden' using errcode = 'MM004';
  end if;
  if p_method not in ('pix','card') then raise exception 'invalid' using errcode = 'MM005'; end if;

  select * into o from public.payment_orders where id = p_order for update;
  if not found or o.provider <> 'mercadopago' or o.status <> 'criado'
     or o.mp_preference_id is not null or o.checkout_url is not null then
    return false;
  end if;
  if o.embedded_method is not null and o.embedded_method <> p_method then return false; end if;

  update public.payment_orders
     set embedded_method = p_method,
         expires_at = coalesce(expires_at, now() + interval '60 minutes')
   where id = o.id;

  return true;
end $$;

revoke all on function public.payments_reserve_embedded(uuid,text) from public, anon, authenticated;
grant execute on function public.payments_reserve_embedded(uuid,text) to service_role;

-- Pagamento recusado já foi verificado no MP e registrado por payments_apply_payment.
-- Este fechamento permite que o organizador faça nova tentativa com NOVO pedido/idempotência.
-- Aprovação tardia ainda passa pela conciliação e pelas proteções de cobrança extra.
create or replace function public.payments_close_rejected_embedded(p_order uuid, p_payment_id text)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare o public.payment_orders;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'forbidden' using errcode = 'MM004';
  end if;
  select * into o from public.payment_orders where id = p_order for update;
  if not found or o.embedded_method is null or o.mp_preference_id is not null
     or o.mp_payment_id is not null or o.status not in ('criado','pendente') then return false; end if;

  if not exists (
    select 1 from public.payment_charges c
     where c.order_id = p_order and c.payment_id = p_payment_id
       and c.status in ('rejected','cancelled') and c.role = 'attempt'
  ) then return false; end if;

  update public.payment_orders set status = 'falhou', expires_at = now() where id = p_order;
  perform public.audit(o.event_id, 'payment.falhou',
      jsonb_build_object('orderId', o.id, 'source', 'embedded', 'paymentId', p_payment_id));
  return true;
end $$;

revoke all on function public.payments_close_rejected_embedded(uuid,text) from public, anon, authenticated;
grant execute on function public.payments_close_rejected_embedded(uuid,text) to service_role;


-- Prevent the legacy Checkout Pro creator from attaching a preference to an
-- order already reserved by the embedded flow. The inverse guard is in
-- payments_reserve_embedded above. Migration is backwards-compatible.
create or replace function public.payments_attach_preference(
  p_order uuid, p_preference_id text, p_checkout_url text, p_expires_at timestamptz
) returns void language plpgsql security definer set search_path = ''
as $$
declare o public.payment_orders;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'forbidden' using errcode = 'MM004';
  end if;
  if coalesce(btrim(p_preference_id), '') = '' or p_checkout_url is null or p_checkout_url !~ '^https://' then
    raise exception 'invalid' using errcode = 'MM005';
  end if;
  select * into o from public.payment_orders where id = p_order for update;
  if not found or o.provider <> 'mercadopago' then raise exception 'invalid' using errcode = 'MM005'; end if;
  if o.mp_preference_id is not null then return; end if;
  if o.status <> 'criado' or o.embedded_method is not null then
    raise exception 'incompatible order' using errcode = 'MM005';
  end if;
  update public.payment_orders
    set mp_preference_id = p_preference_id, checkout_url = p_checkout_url,
        expires_at = p_expires_at, status = 'pendente'
   where id = o.id;
  perform public.audit(o.event_id, 'payment.pendente',
    jsonb_build_object('orderId', o.id, 'plan', o.plan_code,
      'amountCents', o.amount_cents, 'env', o.provider_env));
end $$;

revoke all on function public.payments_attach_preference(uuid,text,text,timestamptz)
  from public, anon, authenticated;
grant execute on function public.payments_attach_preference(uuid,text,text,timestamptz)
  to service_role;
