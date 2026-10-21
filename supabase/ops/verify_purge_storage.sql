-- Verificação do agendamento de purga (somente leitura). Rodar antes e depois de agendar; a cada execução do job, 30 min.
select jobname, schedule, active from cron.job where jobname like 'mm-%' order by 1;                         -- 6 jobs, todos active
select count(*) as pg_net_instalada from pg_extension where extname = 'pg_net';                              -- 1
select count(*) as segredo_no_vault from vault.secrets where name = 'mm_purge_service_role';                 -- 1 (só a contagem; nunca o valor)
select bucket, count(*) as na_fila, min(queued_at) as mais_antigo from public.storage_purge_queue group by 1; -- tende a zero
-- a execução do cron só ENFILEIRA a chamada HTTP; o resultado real fica em net._http_response (~6 h de retenção)
select r.status_code, left(r.content, 160) as corpo, r.error_msg, r.created
  from net._http_response r order by r.created desc limit 5;                                                  -- 200 e {"ok":true,...}; 403 = chave errada
select j.jobname, d.status, left(d.return_message, 80) as msg, d.start_time
  from cron.job_run_details d join cron.job j using (jobid) where j.jobname = 'mm-purge-storage' order by d.start_time desc limit 5;
