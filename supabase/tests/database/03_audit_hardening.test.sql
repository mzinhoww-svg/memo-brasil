-- pgTAP · SCV-005: event trigger contra DISABLE/DROP TRIGGER, último master e prefixos reservados.
begin;
select no_plan();

create schema tests;
create function tests.login(p_user uuid, p_role text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated', 'is_anonymous', false,
    'app_metadata', json_build_object('role', p_role))::text, true);
  set local role authenticated;
end $$;
grant usage on schema tests to authenticated;

insert into auth.users (id, aud, role, email, is_anonymous) values
  ('00000000-0000-4000-8000-0000000000e1', 'authenticated', 'authenticated', 'm1@test.local', false),
  ('00000000-0000-4000-8000-0000000000e2', 'authenticated', 'authenticated', 'm2@test.local', false);
insert into public.platform_roles (user_id, role) values ('00000000-0000-4000-8000-0000000000e1', 'master');

-- (3) event trigger
select ok(exists (select 1 from pg_event_trigger where evtname = 'audit_ddl_end'), 'event trigger de ALTER TABLE existe');
select ok(exists (select 1 from pg_event_trigger where evtname = 'audit_ddl_drop'), 'event trigger de DROP existe');
select throws_ok($$alter table public.audit_logs disable trigger audit_logs_no_update$$, 'MM010', null, 'DISABLE TRIGGER na trilha é bloqueado');
select throws_ok($$alter table public.audit_logs disable trigger audit_logs_no_delete$$, 'MM010', null, 'DISABLE TRIGGER (delete) é bloqueado');
select throws_ok($$alter table public.audit_logs disable trigger user$$, 'MM010', null, 'DISABLE TRIGGER USER é bloqueado');
select throws_ok($$drop trigger audit_logs_no_truncate on public.audit_logs$$, 'MM010', null, 'DROP TRIGGER na trilha é bloqueado');
select throws_ok($$drop trigger platform_roles_keep_last_master on public.platform_roles$$, 'MM010', null, 'DROP TRIGGER do último master é bloqueado');
select throws_ok($$drop table public.platform_roles cascade$$, 'MM010', null, 'DROP TABLE platform_roles é bloqueado');
select lives_ok($$alter table public.audit_logs add column tmp_check int$$, 'ALTER TABLE comum continua permitido');
select lives_ok($$alter table public.audit_logs drop column tmp_check$$, 'e revertido');
select is((select count(*)::int from pg_trigger where tgrelid = 'public.audit_logs'::regclass and tgname like 'audit_logs_no_%' and tgenabled = 'A'), 3, 'três triggers seguem ENABLE ALWAYS');

-- (2) último master
select throws_ok($$update public.platform_roles set revoked_at = now() where role = 'master' and revoked_at is null$$, 'MM009', null, 'SQL direto não revoga o último master');
insert into public.platform_roles (user_id, role) values ('00000000-0000-4000-8000-0000000000e2', 'master');
select lives_ok($$update public.platform_roles set revoked_at = now() where user_id = '00000000-0000-4000-8000-0000000000e2' and role = 'master'$$, 'com outro master ativo, revogar é permitido');
select throws_ok($$update public.platform_roles set revoked_at = now() where user_id = '00000000-0000-4000-8000-0000000000e1' and role = 'master'$$, 'MM009', null, 'o remanescente volta a ser protegido');

-- (1) prefixo reservado
select tests.login('00000000-0000-4000-8000-0000000000e1', 'master');
select throws_ok($$select public.admin_log('platform_role.granted', 'user', 'x', 'tentativa de forjar entrada do sistema')$$, 'MM005', null, 'master não forja platform_role.*');
select throws_ok($$select public.admin_log('audit.purged', 'user', 'x', 'tentativa de forjar entrada do sistema')$$, 'MM005', null, 'nem audit.*');
select throws_ok($$select public.admin_log('lgpd.exported', 'user', 'x', 'tentativa de forjar entrada do sistema')$$, 'MM005', null, 'nem lgpd.*');
select lives_ok($$select public.admin_log('event.note', 'event', 'x', 'anotação operacional legítima')$$, 'ação comum continua válida');

select * from finish();
rollback;
