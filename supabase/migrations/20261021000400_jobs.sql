-- MemoriesMT · 4/6 · tarefas no servidor: revelação, envios órfãos, retenção. Idempotentes e reprocessáveis.

-- Libera as revelações vencidas. Roda sem navegador aberto. Reexecutar é seguro: só toca eventos ainda sem revealed_at.
create function public.reveal_due_events() returns int
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

-- Envio que não terminou em 1 h vira 'falhou' (deixa de contar... a menos que reenviado); 'falhou' com mais de 24 h é apagado.
create function public.expire_pending_uploads() returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  update public.photos set upload_status = 'falhou' where upload_status = 'enviando' and created_at < now() - interval '1 hour';
  with gone as (
    delete from public.photos where upload_status = 'falhou' and created_at < now() - interval '24 hours' returning storage_path
  ), q as (
    insert into public.storage_purge_queue (path) select storage_path from gone union all select storage_path || '.thumb' from gone on conflict do nothing
  )
  select count(*) into n from gone;
  return n;
end $$;

-- Retenção: evento apagado há mais de 30 dias sai de vez (as fotos saem junto, por cascata); a fila de Storage já foi alimentada.
create function public.purge_deleted_events() returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  insert into public.storage_purge_queue (path)
    select ph.storage_path from public.photos ph join public.events e on e.id = ph.event_id where e.deleted_at < now() - interval '30 days'
    union all
    select ph.storage_path || '.thumb' from public.photos ph join public.events e on e.id = ph.event_id where e.deleted_at < now() - interval '30 days'
  on conflict do nothing;
  with gone as (delete from public.events where deleted_at < now() - interval '30 days' returning id) select count(*) into n from gone;
  delete from public.rate_limits where window_start < now() - interval '1 day';
  return n;
end $$;

-- Realtime: eventos, fotos, reações e participantes (a RLS vale para o Realtime: bloqueada continua bloqueada)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.events, public.photos, public.reactions, public.participants;
  end if;
exception when duplicate_object then null;
end $$;

-- Agendamento (pg_cron). Se a extensão não puder ser criada neste ambiente, a migration segue e o runbook manda ativá-la.
do $$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron indisponível (%): agende reveal_due_events() a cada minuto por outro meio', sqlerrm;
    return;
  end;
  perform cron.schedule('mm-reveal-due', '* * * * *', 'select public.reveal_due_events()');
  perform cron.schedule('mm-expire-uploads', '*/10 * * * *', 'select public.expire_pending_uploads()');
  perform cron.schedule('mm-purge-deleted', '17 3 * * *', 'select public.purge_deleted_events()');
end $$;
