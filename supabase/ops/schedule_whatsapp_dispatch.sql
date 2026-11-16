-- Revela · agenda o worker `whatsapp-dispatch` (a cada minuto). Rodar no SQL Editor do projeto, DEPOIS de criar o segredo no Vault
-- e de publicar a função. Nenhuma chave neste arquivo: o token vem de vault.decrypted_secrets em tempo de execução do job.
--
-- Pré-requisito (painel, não SQL): Integrations > Vault > o MESMO segredo `mm_purge_service_role` já usado pelo purge-storage
-- (a service_role legada que a função enxerga em SUPABASE_SERVICE_ROLE_KEY). Não crie outro: um só ponto de rotação.

create extension if not exists pg_net with schema extensions;

do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'mm_purge_service_role' and length(decrypted_secret) > 20) then
    raise exception 'segredo mm_purge_service_role ausente no Vault: crie-o antes de agendar';
  end if;
  -- idempotente: cron.schedule com o mesmo nome ATUALIZA o job existente
  perform cron.schedule('mm-whatsapp-dispatch', '* * * * *', $job$
    select net.http_post(
      url := 'https://asyaegeodyttttaubvxh.supabase.co/functions/v1/whatsapp-dispatch',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'mm_purge_service_role' limit 1),
        'Content-Type', 'application/json'),
      body := '{}'::jsonb,
      timeout_milliseconds := 20000
    ) $job$);
end $$;

select jobid, jobname, schedule, active from cron.job where jobname = 'mm-whatsapp-dispatch';
-- Para pausar: select cron.unschedule('mm-whatsapp-dispatch');
