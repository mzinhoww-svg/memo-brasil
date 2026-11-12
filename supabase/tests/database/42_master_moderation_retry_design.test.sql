begin;
select no_plan();
insert into auth.users(id,email,is_anonymous) values
 ('42000000-0000-4000-8000-000000000001','m42@test.local',false),
 ('42000000-0000-4000-8000-000000000002','s42@test.local',false),
 ('42000000-0000-4000-8000-000000000003','g42@test.local',false),
 ('42000000-0000-4000-8000-000000000004','out42@test.local',false);
insert into public.profiles(id,display_name) select id,'Teste42' from auth.users where email like '%42@test.local' on conflict do nothing;
insert into public.platform_roles(user_id,role) values ('42000000-0000-4000-8000-000000000001','master'),('42000000-0000-4000-8000-000000000002','support');
insert into public.events(id,title,category,host_id,host_name,duration_hours,capacity,shots_per_person,start_at,reveal_enabled) values
 ('42000000-0000-4000-8000-000000000100','Evento42','festa','42000000-0000-4000-8000-000000000001','Teste',6,10,36,now(),true);
update public.events set revealed_at=now() where id='42000000-0000-4000-8000-000000000100';
insert into public.participants(event_id,user_id,name) values
 ('42000000-0000-4000-8000-000000000100','42000000-0000-4000-8000-000000000003','Convidado'),
 ('42000000-0000-4000-8000-000000000100','42000000-0000-4000-8000-000000000004','Saiu');
insert into public.participant_emails(event_id,user_id,email,consent_at,opt_out_at) values
 ('42000000-0000-4000-8000-000000000100','42000000-0000-4000-8000-000000000003','g42@test.local',now(),null),
 ('42000000-0000-4000-8000-000000000100','42000000-0000-4000-8000-000000000004','out42@test.local',now(),now());
insert into public.reveal_email_queue(event_id,user_id,email,optout_token,event_title,event_code,attempts,last_error) select event_id,user_id,email,optout_token,'Evento42','TEST42',5,'falha' from public.participant_emails where event_id='42000000-0000-4000-8000-000000000100';
insert into public.photos(id,event_id,author_id,author_name,storage_path,reports) values
 ('42000000-0000-4000-8000-000000000200','42000000-0000-4000-8000-000000000100','42000000-0000-4000-8000-000000000003','Convidado','42000000-0000-4000-8000-000000000100/42000000-0000-4000-8000-000000000200',3);
select set_config('request.jwt.claims','{"sub":"42000000-0000-4000-8000-000000000002","role":"authenticated","app_metadata":{"role":"support"}}',true);
set local role authenticated;
select throws_ok($$select public.admin_master_moderate_photo('42000000-0000-4000-8000-000000000200','esconder','Motivo válido de teste')$$,'MM004','forbidden','support não modera foto');
select throws_ok($$select public.admin_master_retry_reveal_emails('42000000-0000-4000-8000-000000000100','Motivo válido de teste')$$,'MM004','forbidden','support não reenvia avisos');
reset role;
select set_config('request.jwt.claims','{"sub":"42000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"role":"master"}}',true);
set local role authenticated;
select throws_ok($$select public.admin_master_moderate_photo('42000000-0000-4000-8000-000000000200','esconder','curto')$$,'MM011',null,'motivo obrigatório na foto');
select throws_ok($$select public.admin_master_retry_reveal_emails('42000000-0000-4000-8000-000000000100',repeat('x',501))$$,'MM011',null,'motivo de reenvio tem limite de 500');
select lives_ok($$select public.admin_master_moderate_photo('42000000-0000-4000-8000-000000000200','esconder','Motivo válido de teste')$$,'master esconde sem solicitar bytes');
reset role;
select is((select status::text from public.photos where id='42000000-0000-4000-8000-000000000200'),'oculta','foto escondida');
set local role authenticated;
select lives_ok($$select public.admin_master_moderate_photo('42000000-0000-4000-8000-000000000200','mostrar','Motivo válido de teste')$$,'master mantém foto');
reset role;
select is((select reports from public.photos where id='42000000-0000-4000-8000-000000000200'),0,'manter zera denúncias');
set local role authenticated;
select is(public.admin_master_retry_reveal_emails('42000000-0000-4000-8000-000000000100','Motivo válido de teste'),1,'só falha consentida retorna à fila');
reset role;
select is((select attempts from public.reveal_email_queue where user_id='42000000-0000-4000-8000-000000000003' and event_id='42000000-0000-4000-8000-000000000100'),0,'tentativas resetadas para permitir novo lote');
select is((select attempts from public.reveal_email_queue where user_id='42000000-0000-4000-8000-000000000004' and event_id='42000000-0000-4000-8000-000000000100'),5,'opt-out preservado');
update public.reveal_email_queue set sent_at=now(),last_error='erro antigo' where user_id='42000000-0000-4000-8000-000000000003' and event_id='42000000-0000-4000-8000-000000000100';
set local role authenticated;
select is(public.admin_master_retry_reveal_emails('42000000-0000-4000-8000-000000000100','Motivo válido de teste'),0,'já enviado nunca é reenfileirado');
select lives_ok($$select public.admin_master_moderate_photo('42000000-0000-4000-8000-000000000200','remover','Motivo válido de teste')$$,'remoção lógica com fila de purge');
reset role;
select ok(exists(select 1 from public.storage_purge_queue where path='42000000-0000-4000-8000-000000000100/42000000-0000-4000-8000-000000000200'),'storage só é limpo pelo worker existente');
select ok(exists(select 1 from public.audit_logs where actor_id='42000000-0000-4000-8000-000000000001' and action='admin.photo_remover' and reason='Motivo válido de teste'),'foto auditada com motivo');
select ok(exists(select 1 from public.audit_logs where actor_id='42000000-0000-4000-8000-000000000001' and action='admin.reveal_emails_retried' and reason='Motivo válido de teste'),'reenvio auditado sem e-mail nem token no retorno');
select ok(not has_function_privilege('anon','public.admin_master_moderate_photo(uuid,text,text)','execute'),'anon sem ação de foto');
select ok(not has_function_privilege('anon','public.admin_master_retry_reveal_emails(uuid,text)','execute'),'anon sem reenvio');
select * from finish();
rollback;
