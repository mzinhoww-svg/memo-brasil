-- Add safe receipt disposition without changing money, entitlements or authorization.
-- CREATE OR REPLACE preserves the existing authenticated-only execution grants.
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
                            'provider', o.provider, 'paymentMethod', o.payment_method,
                            'needsRefund', o.needs_refund,
                            'entitlementActive', exists (
                              select 1 from public.event_entitlements e
                               where e.order_id = o.id and e.event_id = o.event_id and e.status = 'ativo'
                                 and public.entitlement_env_valid(e.env)
                            ));
end $$;
