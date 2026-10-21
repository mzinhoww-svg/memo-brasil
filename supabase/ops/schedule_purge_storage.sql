-- A.3.5 · agenda o worker `purge-storage` (SCV-004). Rodar no SQL Editor do projeto asyaegeodyttttaubvxh, DEPOIS de criar o segredo no Vault.
-- Nenhuma chave neste arquivo: o token vem de vault.decrypted_secrets em tempo de execução do job.
--
-- Pré-requisito (painel, não SQL, para a chave não ficar no histórico do editor):
--   Integrations > Vault > Add new secret   name: mm_purge_service_role
--   value: a MESMA chave que a função enxerga em SUPABASE_SERVICE_ROLE_KEY (service_role legada, JWT que começa com "eyJ").
--   A chave nova "sb_secret_..." NÃO serve: a função compara o Bearer com a variável de ambiente por igualdade.

create extension if not exists pg_net with schema extensions;

do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'mm_purge_service_role' and length(decrypted_secret) > 20) then
    raise exception 'segredo mm_purge_service_role ausente no Vault: crie-o antes de agendar';
  end if;
  -- idempotente: cron.schedule com o mesmo nome ATUALIZA o job existente (não cria um segundo)
  perform cron.schedule('mm-purge-storage', '*/30 * * * *', $job$
    select net.http_post(
      url := 'https://asyaegeodyttttaubvxh.supabase.co/functions/v1/purge-storage',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'mm_purge_service_role' limit 1),
        'Content-Type', 'application/json'),
      body := '{}'::jsonb,
      timeout_milliseconds := 20000
    ) $job$);
end $$;

select jobid, jobname, schedule, active from cron.job where jobname = 'mm-purge-storage';
