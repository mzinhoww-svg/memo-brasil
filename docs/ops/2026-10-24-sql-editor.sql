-- Operações do dono no Supabase: Dashboard > projeto asyaegeodyttttaubvxh > SQL Editor > New query.
-- Rode um bloco por vez (selecione o bloco e clique Run). Nada aqui toca pagamento, payments_env ou webhook.

-- ============================================================ A. Contas anônimas órfãs
-- A1. Quantas existem hoje (só leitura; mesmas regras de purge_anon_orphans).
select count(*) as orfas from auth.users u
 where coalesce(u.is_anonymous, false) and u.created_at < now() - interval '7 days'
   and not exists (select 1 from public.participants p where p.user_id = u.id)
   and not exists (select 1 from public.events e where e.host_id = u.id)
   and not exists (select 1 from public.platform_roles r where r.user_id = u.id)
   and not exists (select 1 from public.account_deletion_requests d where d.user_id = u.id)
   and not exists (select 1 from public.user_consents c where c.user_id = u.id)
   and not exists (select 1 from public.reactions x where x.author_id = u.id)
   and not exists (select 1 from public.photo_reports x where x.user_id = u.id)
   and not exists (select 1 from public.photos x where x.author_id = u.id)
   and not exists (select 1 from public.event_assets x where x.created_by = u.id)
   and not exists (select 1 from public.audit_logs a where a.actor_id = u.id);

-- A2. Teste com até 10 contas (EXCLUI de vez essas contas anônimas vazias). Devolve quantas saíram.
select public.purge_anon_orphans(10);

-- A3. Conferir: a auditoria registra a contagem; A1 deve ter caído no mesmo número.
select at, actor_role, detail from public.audit_logs
 where action = 'system.anon_orphans_purged' order by id desc limit 3;

-- A4. Só depois de A2/A3 sem erro: ligar a rotina diária (04:41 UTC, até 500 contas por dia).
select cron.alter_job(jobid, active := true) from cron.job where jobname = 'mm-purge-anon-orphans';

-- ============================================================ B. Excluir os eventos de teste
-- Mesmo efeito do botão "Excluir testes selecionados" do console novo: lixeira (deleted_at), com auditoria.
-- Atenção: a rotina mm-purge-deleted apaga de vez o que está na lixeira há mais de 30 dias.
-- B1. Conferir a lista (só leitura). "bloqueado" = tem pedido pago/em disputa ou plano pago/cortesia/código: fica de fora.
select e.id, e.title, e.host_name, e.created_at,
       exists (select 1 from public.payment_orders o where o.event_id = e.id and o.status in ('pago', 'em_disputa'))
    or exists (select 1 from public.event_entitlements ee where ee.event_id = e.id and ee.status = 'ativo'
                 and ee.source in ('pago', 'cortesia', 'codigo')) as bloqueado
  from public.events e
 where e.is_test and e.deleted_at is null
 order by e.created_at;

-- B2. Mandar para a lixeira os de teste não bloqueados. Devolve quantos foram.
with alvo as (
  select e.id from public.events e
   where e.is_test and e.deleted_at is null
     and not exists (select 1 from public.payment_orders o where o.event_id = e.id and o.status in ('pago', 'em_disputa'))
     and not exists (select 1 from public.event_entitlements ee where ee.event_id = e.id and ee.status = 'ativo'
                       and ee.source in ('pago', 'cortesia', 'codigo'))
), del as (
  update public.events e set deleted_at = now() from alvo where e.id = alvo.id returning e.id
), log as (
  insert into public.audit_logs (actor_id, actor_role, event_id, action, target_type, target_id, reason, detail)
  select null, 'sistema', id, 'admin.soft_delete_test_events', 'event', id::text,
         'Limpeza dos eventos de teste pedida pelo dono (SQL Editor)', '{}'::jsonb from del
  returning 1
)
select count(*) as enviados_para_lixeira from log;

-- B3. Desfazer (dentro dos 30 dias): tira da lixeira o que B2 mandou.
-- update public.events e set deleted_at = null
--   from public.audit_logs a
--  where a.action = 'admin.soft_delete_test_events' and a.reason like 'Limpeza dos eventos de teste%' and e.id = a.event_id;
