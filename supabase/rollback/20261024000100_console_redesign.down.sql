-- Reversão de supabase/migrations/20261024000100_console_redesign.sql (redesign do console master).
-- Rodar como dono (postgres) numa transação: psql -v ON_ERROR_STOP=1 -1 -f supabase/rollback/20261024000100_console_redesign.down.sql
-- Depois, remover a linha da migration do histórico: supabase migration repair --status reverted 20261024000100
-- Efeito: some a marca is_test (eventos/perfis voltam a ser indistinguíveis), somem as RPCs do console novo e o job inativo.
-- NÃO desfaz: linhas de auditoria gravadas no período (a trilha é imutável), eventos já apagados logicamente por
-- admin_soft_delete_test_events (deleted_at fica; a retenção segue normal), revelações liberadas por admin_reveal_now
-- (revelação é monotônica) e contas anônimas removidas por purge_anon_orphans (o job nasce inativo).

-- job
do $$
begin
  if to_regclass('cron.job') is not null and exists (select 1 from cron.job where jobname = 'mm-purge-anon-orphans') then
    perform cron.unschedule('mm-purge-anon-orphans');
  end if;
end $$;

-- reveal_due_events volta ao corpo original (20261021000400_jobs.sql) antes de remover release_reveal
create or replace function public.reveal_due_events() returns int
language plpgsql security definer set search_path = '' as $$
declare r record; n int := 0;
begin
  for r in
    select id, reveal_at from public.events
    where reveal_enabled and revealed_at is null and deleted_at is null and reveal_at <= now()
    for update skip locked
  loop
    update public.events set revealed_at = r.reveal_at, reveal_status = 'revelada' where id = r.id;
    insert into public.audit_logs (actor_id, event_id, action, detail) values (null, r.id, 'reveal.released', jsonb_build_object('at', r.reveal_at, 'ran_at', now()));
    n := n + 1;
  end loop;
  return n;
end $$;

-- RPCs
drop function if exists public.admin_overview(int, boolean);
drop function if exists public.admin_list_events_v2(int, int, text, text, boolean, text, text);
drop function if exists public.admin_event_detail(uuid);
drop function if exists public.admin_search(text);
drop function if exists public.admin_list_users_v2(int, int, text, boolean, text);
drop function if exists public.admin_list_audit_v2(int, int, text, uuid);
drop function if exists public.admin_storage_breakdown();
drop function if exists public.admin_health_history(int);
drop function if exists public.admin_reveal_now(uuid, text);
drop function if exists public.admin_set_test_flag(uuid[], boolean, text);
drop function if exists public.admin_soft_delete_test_events(uuid[], text);
drop function if exists public.purge_anon_orphans();
drop function if exists public.release_reveal(uuid, timestamptz, text);
drop function if exists public.audit_category_pattern(text);

-- trigger de auditoria (não é um dos triggers de imutabilidade: o event trigger de guarda permite)
drop trigger if exists audit_logs_fill_actor on public.audit_logs;
drop function if exists public.audit_logs_fill();
drop function if exists public.audit_actor_role_for(uuid, uuid);

-- is_test
drop trigger if exists events_is_test_guard on public.events;
drop trigger if exists profiles_is_test_guard on public.profiles;
drop function if exists public.is_test_guard();
drop function if exists public.console_backfill_test_flags();
drop index if exists public.events_is_test_idx;
alter table public.events drop column if exists is_test;
alter table public.profiles drop column if exists is_test;
