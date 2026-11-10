-- Revela 2.0 · Master M05: botão "Conciliar agora". ADITIVA.
--
-- admin_request_reconcile(): autoriza e registra o pedido. Só Master com sessão de segundo fator (aal2, MM016) e no máximo uma
-- conciliação manual por minuto (MM006). Grava `payments.reconcile_requested` em audit_logs e devolve o horário do pedido.
-- Quem dispara a conciliação de fato é a Edge Function `payments-reconcile-now`, que chama esta RPC com a sessão do Master (a decisão
-- fica no banco) e só então fala com `payments-validapay-reconcile` usando o token que existe apenas no servidor. Sem o token configurado
-- a função responde "indisponível" e a rotina automática do agendador (a cada 5 minutos) continua sendo quem concilia.
create function public.admin_request_reconcile() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null or not public.is_master() then raise exception 'forbidden' using errcode = 'MM004'; end if;
  if coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then raise exception 'stepup' using errcode = 'MM016'; end if;
  perform public.check_rate_limit('reconcile:' || uid, 0, interval '1 minute');
  insert into public.audit_logs (actor_id, actor_role, action, target_type, target_id, detail)
  values (uid, 'master', 'payments.reconcile_requested', 'payments', 'validapay', '{}');
  return jsonb_build_object('requestedAt', now());
end $$;
revoke all on function public.admin_request_reconcile() from public, anon;
grant execute on function public.admin_request_reconcile() to authenticated;
