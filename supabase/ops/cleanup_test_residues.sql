-- QAV-004 · limpeza dos resíduos de teste. NÃO rodar sem backup do mesmo dia (OPERATIONAL-RECOVERY.md) e sem ler o dry-run.
-- Alvo exato (nada além disto): (1) contas @memoriesmt.test e os eventos que elas organizam; (2) sessões anônimas criadas antes de 2026-10-22
-- sem participação nem aceite; (3) objetos de event-photos sem foto correspondente (vão para a fila de purga, que o job mm-purge-storage esvazia).
-- Fora do alvo: contas reais (inclui o master), eventos organizados por elas, e tudo criado em 2026-10-22 ou depois.

-- ===== 1. DRY-RUN (somente leitura; rode e confira antes de continuar) =====
select 'contas_teste' alvo, count(*) n from auth.users where email like '%@memoriesmt.test'
union all select 'eventos_das_contas_teste', count(*) from public.events e join auth.users u on u.id = e.host_id where u.email like '%@memoriesmt.test'
union all select 'anonimas_sem_vinculo', count(*) from auth.users u where u.is_anonymous and u.created_at < timestamptz '2026-10-22 00:00+00'
  and not exists (select 1 from public.participants p where p.user_id = u.id) and not exists (select 1 from public.user_consents c where c.user_id = u.id)
  and not exists (select 1 from public.events e where e.host_id = u.id)
union all select 'objetos_orfaos', count(*) from storage.objects o where o.bucket_id = 'event-photos' and not exists (select 1 from public.photos p where p.storage_path = o.name);

-- ===== 2. EXECUÇÃO (descomente o bloco e rode UMA vez) =====
-- begin;
--   insert into public.storage_purge_queue (path)
--     select o.name from storage.objects o where o.bucket_id = 'event-photos' and not exists (select 1 from public.photos p where p.storage_path = o.name)
--     on conflict do nothing;
--   delete from public.events e using auth.users u where u.id = e.host_id and u.email like '%@memoriesmt.test';
--   delete from auth.users where email like '%@memoriesmt.test';
--   delete from auth.users u where u.is_anonymous and u.created_at < timestamptz '2026-10-22 00:00+00'
--     and not exists (select 1 from public.participants p where p.user_id = u.id) and not exists (select 1 from public.user_consents c where c.user_id = u.id)
--     and not exists (select 1 from public.events e where e.host_id = u.id);
--   -- guarda: o master e o evento sintético desta rodada não podem ter sido tocados
--   do $$ begin
--     if not exists (select 1 from auth.users where email = 'mazinhoww@gmail.com') then raise exception 'master removido: abortar'; end if;
--     if not exists (select 1 from public.events where code = '5YXYRX57') then raise exception 'evento sintético removido: abortar'; end if;
--   end $$;
-- commit;   -- se algo estranho: rollback;

-- ===== 3. CONFERÊNCIA (depois) =====
-- select count(*) filter (where email like '%@memoriesmt.test') contas_teste, count(*) filter (where is_anonymous) anonimas from auth.users;
-- select count(*) from public.storage_purge_queue;   -- tende a zero em até 30 min (mm-purge-storage)
