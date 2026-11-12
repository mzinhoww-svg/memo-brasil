begin;
select no_plan();
insert into auth.users(id,email,is_anonymous) values
 ('46000000-0000-4000-8000-000000000001','m46@test.local',false),
 ('46000000-0000-4000-8000-000000000002','h46@test.local',false),
 ('46000000-0000-4000-8000-000000000003','s46@test.local',false);
insert into public.platform_roles(user_id,role) values ('46000000-0000-4000-8000-000000000001','master'),('46000000-0000-4000-8000-000000000003','support');
insert into public.events(id,title,category,host_id,host_name,duration_hours,capacity,shots_per_person,start_at) values
 ('46000000-0000-4000-8000-000000000100','Evento46','festa','46000000-0000-4000-8000-000000000002','Teste',6,10,10,now());
select set_config('request.jwt.claims','{"sub":"46000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"role":"master"}}',true);
set local role authenticated;
select is(public.admin_master_create_code('  festa-julia-46  ','festa',2,now()+interval '1 day','Cortesia aprovada para o evento'),'FESTA-JULIA-46','nome escolhido é o código devolvido');
select throws_ok($$select public.admin_master_create_code('FESTAJULIA46','festa',2,now()+interval '1 day','Cortesia aprovada para o evento')$$,'MM005','invalid','duplicata normalizada recusada');
select throws_ok($$select public.admin_master_create_code('curto','festa',2,now()+interval '1 day','Cortesia aprovada para o evento')$$,'MM005','invalid','código curto recusado');
select throws_ok($$select public.admin_master_create_code('FESTA-INVALIDA','gratis',2,now()+interval '1 day','Cortesia aprovada para o evento')$$,'MM005','invalid','plano grátis recusado');
select throws_ok($$select public.admin_master_create_code('FESTA-INVALIDA','festa',0,now()+interval '1 day','Cortesia aprovada para o evento')$$,'MM005','invalid','limite inválido recusado');
select throws_ok($$select public.admin_master_create_code('FESTA-INVALIDA','festa',2,now()-interval '1 day','Cortesia aprovada para o evento')$$,'MM005','invalid','validade passada recusada');
select throws_ok($$select public.admin_master_create_code('FESTA-INVALIDA','festa',2,now()+interval '1 day','curto')$$,'MM011',null,'motivo obrigatório validado pelo servidor');
reset role;
select is((select count(*)::int from public.courtesy_codes where code_hash=public.courtesy_code_hash('FESTA-JULIA-46')),1,'só o hash normalizado é persistido');
select ok((select code_hint !~ 'JULIA' and note not like '%FESTA-JULIA-46%' from public.courtesy_codes where code_hash=public.courtesy_code_hash('FESTA-JULIA-46')),'identificação e nota não expõem o código');
select ok((select reason='Cortesia aprovada para o evento' and detail::text not like '%FESTA-JULIA-46%' from public.audit_logs where actor_id='46000000-0000-4000-8000-000000000001' and action='code.created'),'auditoria guarda motivo sem código inteiro');
select set_config('request.jwt.claims','{"sub":"46000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select is(public.redeem_code('46000000-0000-4000-8000-000000000100','festa-julia-46')->>'reason','ok','código escolhido funciona no resgate existente');
select throws_ok($$select public.admin_master_create_code('OUTRO-CODIGO46','festa',2,now()+interval '1 day','Cortesia aprovada para o evento')$$,'MM004','forbidden','organizador não cria código');
reset role;
select set_config('request.jwt.claims','{"sub":"46000000-0000-4000-8000-000000000003","role":"authenticated","app_metadata":{"role":"support"}}',true);
set local role authenticated;
select throws_ok($$select public.admin_master_create_code('OUTRO-CODIGO46','festa',2,now()+interval '1 day','Cortesia aprovada para o evento')$$,'MM004','forbidden','support não cria código');
reset role;
select ok(not has_function_privilege('anon','public.admin_master_create_code(text,text,integer,timestamptz,text)','execute'),'anon sem grant');
select ok(to_regprocedure('public.admin_create_code(text,integer,timestamptz,text)') is not null,'gerador anterior continua disponível');
select * from finish();
rollback;
