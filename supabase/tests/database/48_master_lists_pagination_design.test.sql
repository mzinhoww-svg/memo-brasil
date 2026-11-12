begin;
select no_plan();
insert into auth.users(id,email,is_anonymous) values ('48000000-0000-4000-8000-000000000001','m48@test.local',false),('48000000-0000-4000-8000-000000000002','s48@test.local',false);
insert into public.platform_roles(user_id,role) values ('48000000-0000-4000-8000-000000000001','master'),('48000000-0000-4000-8000-000000000002','support');
insert into public.events(id,title,category,host_id,host_name,duration_hours,capacity,shots_per_person,start_at,reveal_enabled,reveal_at) values
 ('48000000-0000-4000-8000-000000000100','Pagina48Alvo','festa','48000000-0000-4000-8000-000000000001','Teste',6,1000,1000,now(),true,now()+interval '2 days');
insert into public.events(title,category,host_id,host_name,duration_hours,capacity,shots_per_person,start_at,reveal_enabled,reveal_at)
 select 'Pagina48 '||n,'festa','48000000-0000-4000-8000-000000000001','Teste',6,10,10,now(),true,now()+interval '1 day' from generate_series(1,210)n;
insert into public.payment_orders(event_id,host_id,plan_code,amount_cents,provider_env,idempotency_key,status,payment_method)
 select '48000000-0000-4000-8000-000000000100','48000000-0000-4000-8000-000000000001','festa',2900,'production',gen_random_uuid(),'pago','pix' from generate_series(1,530);
insert into public.payment_orders(id,event_id,host_id,plan_code,amount_cents,provider_env,idempotency_key,status,payment_method,created_at,needs_refund) values
 ('48000000-0000-4000-8000-000000000200','48000000-0000-4000-8000-000000000100','48000000-0000-4000-8000-000000000001','festa',2900,'production',gen_random_uuid(),'pago','card',now()-interval '10 days',true);
insert into public.courtesy_codes(code_hash,code_hint,plan_code,max_uses,expires_at,note,created_by)
 select public.courtesy_code_hash('PAGINA48-'||n),'MMT-R48X','festa',1,now()+interval '1 day','Codigo48 '||n,'48000000-0000-4000-8000-000000000001' from generate_series(1,530)n;
insert into public.courtesy_codes(code_hash,code_hint,plan_code,max_uses,expires_at,note,created_by,created_at)
 values(public.courtesy_code_hash('PAGINA48-ALVO'),'MMT-R48X','festa',1,now()+interval '1 day','Codigo48Alvo','48000000-0000-4000-8000-000000000001',now()-interval '10 days');
create temp table test48_photos as select gen_random_uuid() id from generate_series(1,106);
insert into public.photos(id,event_id,author_name,storage_path,reports)
 select id,'48000000-0000-4000-8000-000000000100','Teste','48000000-0000-4000-8000-000000000100/'||id,1 from test48_photos;
insert into public.photo_comments(photo_id,event_id,author_name,body,reports)
 select id,'48000000-0000-4000-8000-000000000100','Sigilo48','Corpo privado48',1 from test48_photos;
create temp table test48_users as select n,gen_random_uuid() id from generate_series(1,106)n;
insert into auth.users(id,email,is_anonymous) select id,'pagina48_'||n||'@test.local',false from test48_users;
insert into public.participants(event_id,user_id,name,blocked_at) select '48000000-0000-4000-8000-000000000100',id,'Sigilo48',now() from test48_users;
insert into public.account_deletion_requests(user_id) select id from test48_users;
select set_config('request.jwt.claims','{"sub":"48000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"role":"master"}}',true);
set local role authenticated;
select is((public.admin_master_list('pagamentos',null,'Pagina48',0)->>'total')::int,531,'total financeiro inclui todos os pedidos');
select is(jsonb_array_length(public.admin_master_list('pagamentos',null,'Pagina48',0)->'items'),25,'pagamentos têm 25 por página');
select is(jsonb_array_length(public.admin_master_list('pagamentos',null,'Pagina48',525)->'items'),6,'última página financeira alcança além do limite antigo');
select is((public.admin_master_list('pagamentos','cartao','Pagina48',0)->>'total')::int,1,'filtro de cartão antes da página encontra pedido antigo');
select is(public.admin_master_list('pagamentos',null,'48000000-0000-4000-8000-000000000200',0)->'items'->0->>'orderId','48000000-0000-4000-8000-000000000200','busca por pedido além dos primeiros 500');
select is(jsonb_array_length(public.admin_master_list('codigos',null,'Codigo48',0)->'items'),25,'códigos têm 25 por página');
select is((public.admin_master_list('codigos',null,'Codigo48Alvo',0)->>'total')::int,1,'busca de código alcança registro além dos primeiros 500');
select is(jsonb_array_length(public.admin_master_list('codigos',null,'Codigo48',525)->'items'),6,'códigos não são truncados no gerador antigo');
select is((public.admin_master_list('revelacoes',null,'Pagina48',0)->>'total')::int,211,'fila contabiliza além de 200 eventos');
select is(jsonb_array_length(public.admin_master_list('revelacoes',null,'Pagina48',0)->'items'),25,'revelações têm 25 por página');
select is(public.admin_master_list('revelacoes',null,'Pagina48Alvo',0)->'items'->0->>'id','48000000-0000-4000-8000-000000000100','busca encontra evento depois dos primeiros 200');
select is(jsonb_array_length(public.admin_master_list('fotos',null,'Pagina48',100)->'items'),6,'fotos de moderação ultrapassam limite antigo de 100');
select is(jsonb_array_length(public.admin_master_list('comentarios',null,'Pagina48',100)->'items'),6,'comentários de moderação ultrapassam 100');
select is(jsonb_array_length(public.admin_master_list('bloqueados',null,'Pagina48',100)->'items'),6,'bloqueados ultrapassam 100');
select is(jsonb_array_length(public.admin_master_list('lgpd',null,null,0)->'items'),25,'LGPD tem 25 por página');
select ok((public.admin_master_list('lgpd',null,null,100)->>'total')::int>=106 and jsonb_array_length(public.admin_master_list('lgpd',null,null,100)->'items')>=6,'LGPD mantém pedidos além de 100');
select throws_ok($$select public.admin_master_list('pagamentos',null,null,-1)$$,'MM005','invalid','offset negativo recusado');
select throws_ok($$select public.admin_master_list('qualquer')$$,'MM005','invalid','lista desconhecida recusada');
reset role;
select set_config('request.jwt.claims','{"sub":"48000000-0000-4000-8000-000000000002","role":"authenticated","app_metadata":{"role":"support"}}',true);
set local role authenticated;
select throws_ok($$select public.admin_master_list('pagamentos')$$,'MM004','forbidden','support não vê pagamentos');
select throws_ok($$select public.admin_master_list('codigos')$$,'MM004','forbidden','support não vê códigos');
select is(public.admin_master_list('comentarios',null,'Pagina48',0)->'items'->0->'body','null'::jsonb,'staff sem master não recebe corpo privado');
select is((public.admin_master_list('comentarios',null,'Sigilo48',0)->>'total')::int,0,'busca não vira oráculo para nome mascarado');
select is(public.admin_master_list('bloqueados',null,'Pagina48',0)->'items'->0->'name','null'::jsonb,'nome de bloqueado mascarado para support');
reset role;
select set_config('request.jwt.claims','{"sub":"48000000-0000-4000-8000-000000000099","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$select public.admin_master_list('revelacoes')$$,'MM004','forbidden','conta comum não acessa listas');
reset role;
select ok(not has_function_privilege('anon','public.admin_master_list(text,text,text,integer)','execute'),'anon sem grant');
select * from finish();
rollback;
