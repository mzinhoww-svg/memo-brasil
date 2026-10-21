-- MemoriesMT · 5/6 · endurecimento. Funções de tarefa/serviço nunca são chamáveis por clientes.
-- funções criadas depois da migration 2 (storage, jobs) também nascem com EXECUTE para PUBLIC: fecha para public e anon
revoke execute on all functions in schema public from public, anon;
revoke all on function public.reveal_due_events(), public.expire_pending_uploads(), public.purge_deleted_events() from public, anon, authenticated;
revoke all on function public.process_account_deletion(uuid), public.check_rate_limit(text, int, interval) from public, anon, authenticated;
grant execute on function public.reveal_due_events(), public.expire_pending_uploads(), public.purge_deleted_events(), public.process_account_deletion(uuid) to service_role;

-- rls_auto_enable() é um event trigger da plataforma (liga RLS em tabela nova de public). Clientes não precisam chamá-lo:
-- o Security Advisor alerta SECURITY DEFINER executável por anon/authenticated. Revogar EXECUTE não impede o gatilho de disparar.
do $$
begin
  if to_regproc('public.rls_auto_enable()') is not null then
    revoke all on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;
