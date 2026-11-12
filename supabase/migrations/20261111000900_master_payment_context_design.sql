-- M06: detalhe por UUID, allowlist financeira e fatos operacionais, sem payload do comprador ou credencial.
-- A inbox recebe o registro depois da verificação HMAC no endpoint existente.
create function public.admin_master_payment_context(p_order uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare o public.payment_orders; receipt timestamptz; grant_data jsonb; order_data jsonb; host_name text;
begin
 if not public.is_master() then raise exception 'forbidden' using errcode='MM004'; end if;
 select * into o from public.payment_orders where id=p_order;
 if not found then raise exception 'invalid' using errcode='MM005'; end if;
 select public.admin_payment_json(o,e.title,p.name),e.host_name into order_data,host_name
 from public.plans p left join public.events e on e.id=o.event_id where p.code=o.plan_code;
 if o.provider='validapay' then
  select min(received_at) into receipt from public.validapay_webhook_inbox
  where provider_env=o.provider_env and charge_id=o.provider_charge_id and event_type='payment.success';
 end if;
 select jsonb_build_object('at',e.created_at,'maxGuests',e.max_guests,'maxShots',e.max_shots) into grant_data from public.event_entitlements e where e.order_id=o.id;
 return jsonb_build_object('order',order_data,'hostName',host_name,'webhookAt',receipt,'grant',grant_data);
end $$;
revoke all on function public.admin_master_payment_context(uuid) from public,anon;
grant execute on function public.admin_master_payment_context(uuid) to authenticated;
