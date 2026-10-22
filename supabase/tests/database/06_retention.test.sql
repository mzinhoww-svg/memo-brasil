-- pgTAP · retenção: fotos disponíveis por 90 dias após o encerramento; depois acesso retirado e exclusão em até 30 dias.
-- Só vale para eventos criados sob a política (retention_policy); eventos anteriores ficam como estavam (sem encurtar prazo, sem rotina destrutiva).
begin;
select no_plan();

create schema tests;
create function tests.login(p_user uuid, p_anon boolean default false) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated', 'is_anonymous', p_anon)::text, true);
  set local role authenticated;
end $$;
grant usage on schema tests to authenticated;

insert into auth.users (id, aud, role, email, is_anonymous) values
  ('00000000-0000-4000-8000-0000000000e1', 'authenticated', 'authenticated', 'host-e1@test.local', false),
  ('00000000-0000-4000-8000-0000000000e2', 'authenticated', 'authenticated', null, true);
insert into public.profiles (id) values ('00000000-0000-4000-8000-0000000000e1'), ('00000000-0000-4000-8000-0000000000e2') on conflict do nothing;

-- A: evento novo (política), terminou há 89 d | B: novo, terminou há 91 d | C: LEGADO (sem política), terminou há 400 d
-- D: novo, terminou há 200 d e já excluído há 29 d | E: novo, ainda em andamento
insert into public.events (id, title, category, host_id, host_name, start_at, duration_hours) values
  ('00000000-0000-4000-8000-0000000000a1', 'A', 'casamento', '00000000-0000-4000-8000-0000000000e1', 'H', now() - interval '89 days' - interval '6 hours', 6),
  ('00000000-0000-4000-8000-0000000000a2', 'B', 'casamento', '00000000-0000-4000-8000-0000000000e1', 'H', now() - interval '91 days' - interval '6 hours', 6),
  ('00000000-0000-4000-8000-0000000000a3', 'C', 'casamento', '00000000-0000-4000-8000-0000000000e1', 'H', now() - interval '400 days' - interval '6 hours', 6),
  ('00000000-0000-4000-8000-0000000000a4', 'D', 'casamento', '00000000-0000-4000-8000-0000000000e1', 'H', now() - interval '200 days' - interval '6 hours', 6),
  ('00000000-0000-4000-8000-0000000000a5', 'E', 'casamento', '00000000-0000-4000-8000-0000000000e1', 'H', now() - interval '1 hour', 6);
-- C é legado: simula o evento criado antes da política
set local session_replication_role = replica; -- simula linha anterior à política (o trigger, de propósito, nunca deixa o cliente nem o app zerar)
update public.events set retention_policy = null where id = '00000000-0000-4000-8000-0000000000a3';
set local session_replication_role = origin;
update public.events set deleted_at = now() - interval '29 days' where id = '00000000-0000-4000-8000-0000000000a4';
insert into public.participants (event_id, user_id, name) select id, '00000000-0000-4000-8000-0000000000e2', 'Conv' from public.events where id in ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-0000000000a3');
set local session_replication_role = replica; -- fotos em eventos já encerrados (photos_guard bloquearia o INSERT)
insert into public.photos (id, event_id, author_id, author_name, upload_status, storage_path)
  select ('00000000-0000-4000-8000-0000000000f' || right(e.id::text, 1))::uuid, e.id, '00000000-0000-4000-8000-0000000000e2', 'Conv', 'pronta', e.id::text || '/' || ('00000000-0000-4000-8000-0000000000f' || right(e.id::text, 1))
  from public.events e where e.id::text like '00000000-0000-4000-8000-0000000000a%';
set local session_replication_role = origin;

-- política gravada no servidor
select has_column('public', 'events', 'retention_policy', 'eventos guardam a política de retenção sob a qual foram criados');
select is((select retention_policy from public.events where id = '00000000-0000-4000-8000-0000000000a1'), '2026-10-22-v1', 'evento novo nasce com a política v1');
select is((select retention_policy from public.events where id = '00000000-0000-4000-8000-0000000000a3'), null, 'evento legado fica sem política (nada muda para ele)');

-- o cliente não escolhe nem altera a política
select tests.login('00000000-0000-4000-8000-0000000000e1');
update public.events set title = 'A2', retention_policy = null where id = '00000000-0000-4000-8000-0000000000a1';
reset role;
select is((select retention_policy from public.events where id = '00000000-0000-4000-8000-0000000000a1'), '2026-10-22-v1', 'UPDATE do host não remove a política');
select tests.login('00000000-0000-4000-8000-0000000000e1');
insert into public.events (id, title, category, host_id, host_name, duration_hours, retention_policy)
  values ('00000000-0000-4000-8000-0000000000a6', 'F', 'casamento', '00000000-0000-4000-8000-0000000000e1', 'H', 6, 'invento');
reset role;
select is((select retention_policy from public.events where id = '00000000-0000-4000-8000-0000000000a6'), '2026-10-22-v1', 'INSERT ignora política enviada pelo cliente');

-- acesso: aos 89 dias ainda vê (host e convidado); aos 91 retira; legado não é afetado
select tests.login('00000000-0000-4000-8000-0000000000e1');
select is((select count(*)::int from public.photos where event_id = '00000000-0000-4000-8000-0000000000a1'), 1, 'host vê a foto aos 89 dias do encerramento');
select is((select count(*)::int from public.photos where event_id = '00000000-0000-4000-8000-0000000000a2'), 0, 'host não vê a foto aos 91 dias');
select is((select count(*)::int from public.photos where event_id = '00000000-0000-4000-8000-0000000000a3'), 1, 'evento legado continua acessível (prazo não encurtado retroativamente)');
reset role;
select tests.login('00000000-0000-4000-8000-0000000000e2', true);
select is((select count(*)::int from public.photos where event_id = '00000000-0000-4000-8000-0000000000a1'), 1, 'convidado vê aos 89 dias');
select is((select count(*)::int from public.photos where event_id = '00000000-0000-4000-8000-0000000000a2'), 0, 'convidado não vê aos 91 dias');
select is(public.can_read_object('00000000-0000-4000-8000-0000000000a2/00000000-0000-4000-8000-0000000000f2'), false, 'o Storage também nega a leitura após 90 dias');
select is(public.can_read_object('00000000-0000-4000-8000-0000000000a1/00000000-0000-4000-8000-0000000000f1'), true, 'e libera dentro dos 90 dias');
reset role;

-- rotina de expiração: só eventos sob a política, vencidos e ainda não excluídos
select is(public.expire_retained_events(), 1, 'expira exatamente 1 evento (B): A ainda no prazo, C legado, D já excluído, E em andamento');
select ok((select deleted_at is not null from public.events where id = '00000000-0000-4000-8000-0000000000a2'), 'B foi marcado como excluído (acesso retirado)');
select ok((select deleted_at is null from public.events where id = '00000000-0000-4000-8000-0000000000a1'), 'A segue ativo');
select ok((select deleted_at is null from public.events where id = '00000000-0000-4000-8000-0000000000a3'), 'C (legado) NUNCA é tocado pela rotina');
select is(public.expire_retained_events(), 0, 'reexecutar não repete nem duplica');
select is((select count(*)::int from public.audit_logs where action = 'retention.expired' and event_id = '00000000-0000-4000-8000-0000000000a2'), 1, 'a expiração é auditada uma vez');

-- exclusão: evento sob a política sai do armazenamento ativo em até 30 dias; legado mantém o prazo antigo (30 d)
update public.events set deleted_at = now() - interval '29 days' where id = '00000000-0000-4000-8000-0000000000a3'; -- legado excluído há 29 d: NÃO sai ainda
select is(public.purge_deleted_events(), 1, 'purga 1 evento: D (política, excluído há 29 d, limite de 28 d)');
select is((select count(*)::int from public.events where id = '00000000-0000-4000-8000-0000000000a4'), 0, 'D foi removido (com as fotos, por cascata)');
select is((select count(*)::int from public.events where id = '00000000-0000-4000-8000-0000000000a3'), 1, 'legado excluído há 29 d segue com o prazo antigo de 30 d');
select ok(exists (select 1 from public.storage_purge_queue where path = '00000000-0000-4000-8000-0000000000a4/00000000-0000-4000-8000-0000000000f4') and exists (select 1 from public.storage_purge_queue where path = '00000000-0000-4000-8000-0000000000a4/00000000-0000-4000-8000-0000000000f4.thumb'), 'foto e miniatura de D entraram na fila de remoção do Storage');
select ok((select deleted_at is not null and now() - deleted_at < interval '1 minute' from public.events where id = '00000000-0000-4000-8000-0000000000a2'), 'B (expirado agora) ainda aguarda os 28 dias');

-- a rotina não é executável pelo cliente
select tests.login('00000000-0000-4000-8000-0000000000e1');
select throws_ok($$select public.expire_retained_events()$$, '42501', null, 'cliente autenticado não executa a expiração');
select throws_ok($$select public.purge_deleted_events()$$, '42501', null, 'nem a purga');
reset role;

-- agendamento
select ok(not exists (select 1 from pg_extension where extname = 'pg_cron') or exists (select 1 from cron.job where jobname = 'mm-expire-retention' and active), 'a expiração está agendada (quando pg_cron existe)');

select * from finish();
rollback;
