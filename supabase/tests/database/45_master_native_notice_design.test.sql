begin;
select no_plan();
insert into auth.users(id,email,is_anonymous) values
 ('45000000-0000-4000-8000-000000000001','m45@test.local',false),
 ('45000000-0000-4000-8000-000000000002','g45@test.local',false),
 ('45000000-0000-4000-8000-000000000003','o45@test.local',false),
 ('45000000-0000-4000-8000-000000000004','s45@test.local',false);
insert into public.platform_roles(user_id,role) values ('45000000-0000-4000-8000-000000000001','master'),('45000000-0000-4000-8000-000000000004','support');
insert into public.events(id,title,category,host_id,host_name,duration_hours,capacity,shots_per_person,start_at,reveal_enabled,reveal_at) values
 ('45000000-0000-4000-8000-000000000100','Evento45','festa','45000000-0000-4000-8000-000000000001','Teste',6,10,10,now(),true,now()+interval '1 day');
insert into public.participants(event_id,user_id,name) values ('45000000-0000-4000-8000-000000000100','45000000-0000-4000-8000-000000000002','Convidado');
select set_config('request.jwt.claims','{"sub":"45000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$select public.record_reveal_native_notice('45000000-0000-4000-8000-000000000100',false)$$,'membro registra observação de permissão nativa');
select lives_ok($$select public.record_reveal_native_notice('45000000-0000-4000-8000-000000000100',false)$$,'reagendar não duplica inscrição');
select is((select count(*)::int from public.reveal_native_notices),1,'RLS permite só a própria observação');
select ok((select shown_at is null from public.reveal_native_notices),'inscrever não inventa exibição');
select throws_ok($$select public.record_reveal_native_notice('45000000-0000-4000-8000-000000000100',true)$$,'MM005','invalid','exibição antes da revelação recusada');
select throws_ok($$select public.record_reveal_native_notice('45000000-0000-4000-8000-000000000100',null)$$,'MM005','invalid','estado indefinido recusado');
select throws_ok($$select public.admin_master_native_notice_counts(array['45000000-0000-4000-8000-000000000100'::uuid])$$,'MM004','forbidden','membro não acessa contagem administrativa');
select throws_ok($$insert into public.reveal_native_notices(event_id,user_id) values('45000000-0000-4000-8000-000000000100','45000000-0000-4000-8000-000000000003')$$,'42501',null,'cliente não escreve diretamente na tabela');
reset role;
update public.events set revealed_at=now() where id='45000000-0000-4000-8000-000000000100';
set local role authenticated;
select lives_ok($$select public.record_reveal_native_notice('45000000-0000-4000-8000-000000000100',true)$$,'membro registra evento show depois da revelação');
select ok((select shown_at is not null from public.reveal_native_notices),'exibição observada tem horário');
reset role;
select set_config('test.native_shown',(select shown_at::text from public.reveal_native_notices where event_id='45000000-0000-4000-8000-000000000100'),true);
set local role authenticated;
select public.record_reveal_native_notice('45000000-0000-4000-8000-000000000100',true);
select is((select shown_at::text from public.reveal_native_notices),current_setting('test.native_shown'),'repetição preserva a primeira exibição');
reset role;
select set_config('request.jwt.claims','{"sub":"45000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select is((select count(*)::int from public.reveal_native_notices),0,'RLS esconde inscrições alheias');
select throws_ok($$select public.record_reveal_native_notice('45000000-0000-4000-8000-000000000100',false)$$,'MM004','forbidden','estranho não registra aviso');
reset role;
update public.participants set blocked_at=now() where user_id='45000000-0000-4000-8000-000000000002';
select set_config('request.jwt.claims','{"sub":"45000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$select public.record_reveal_native_notice('45000000-0000-4000-8000-000000000100',false)$$,'MM004','forbidden','participante bloqueado recusado');
reset role;
select set_config('request.jwt.claims','{"sub":"45000000-0000-4000-8000-000000000004","role":"authenticated","app_metadata":{"role":"support"}}',true);
set local role authenticated;
select is(public.admin_master_native_notice_counts(array['45000000-0000-4000-8000-000000000100'::uuid])->'45000000-0000-4000-8000-000000000100','{"enrolled":1,"shown":1}'::jsonb,'staff recebe apenas contagens reais sem PII');
select throws_ok($$select public.admin_master_native_notice_counts(null)$$,'MM005','invalid','lote nulo recusado');
reset role;
select ok(not has_function_privilege('anon','public.record_reveal_native_notice(uuid,boolean)','execute'),'anon não registra aviso');
select ok(not has_function_privilege('anon','public.admin_master_native_notice_counts(uuid[])','execute'),'anon não lê contagens');
select * from finish();
rollback;
