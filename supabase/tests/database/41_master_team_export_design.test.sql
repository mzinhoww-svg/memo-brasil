-- M10: exporta a mesma equipe filtrada e deduplicada, sem mudar a RPC de dois argumentos.
begin;
select no_plan();
insert into auth.users(id,aud,role,email,is_anonymous,created_at) values
 ('41000000-0000-4000-8000-000000000001','authenticated','authenticated','team41master@test.local',false,'2026-01-02T13:00:00Z'),
 ('41000000-0000-4000-8000-000000000002','authenticated','authenticated','team41support@test.local',false,'2026-01-03T13:00:00Z'),
 ('41000000-0000-4000-8000-000000000003','authenticated','authenticated','team41revoked@test.local',false,'2026-01-04T13:00:00Z');
insert into public.platform_roles(user_id,role,granted_at,revoked_at) values
 ('41000000-0000-4000-8000-000000000001','master','2026-02-01T13:00:00Z',null),
 ('41000000-0000-4000-8000-000000000001','auditor','2026-02-02T13:00:00Z',null),
 ('41000000-0000-4000-8000-000000000002','support','2026-02-03T13:00:00Z',null),
 ('41000000-0000-4000-8000-000000000003','auditor','2026-02-04T13:00:00Z',now());
select set_config('request.jwt.claims','{"sub":"41000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"role":"master"}}',true);
set local role authenticated;
select is((public.admin_export_csv('pessoas','{"aba":"equipe","q":"  team41master@  "}',2)->>'rows')::int,1,'busca aplicada antes de exportar e conta com dois papéis aparece uma vez');
select is(public.admin_export_csv('pessoas','{"aba":"equipe","q":"team41master@"}',2)->>'csv',E'"email","papel","desde"\r\n"team41master@test.local","master",2026-01-02T13:00:00Z\r\n','papel prioritário e criação da conta iguais à tela, em vez da data da concessão');
select is((public.admin_export_csv('pessoas','{"aba":"equipe","q":"team41"}',2)->>'rows')::int,2,'papel revogado excluído e equipe deduplicada');
select is((public.admin_export_csv('pessoas','{"aba":"equipe","q":"semresultado41"}',2)->>'rows')::int,0,'busca sem resultado não exporta a equipe inteira');
select is((public.admin_export_csv('pessoas','{"aba":"equipe","q":"team41master@"}',2)->>'rows')::int,(public.admin_master_people('equipe',25,0,'team41master@')->>'total')::int,'exportação e lista usam a mesma população filtrada');
select throws_ok($$select public.admin_export_csv('pessoas','{"aba":"equipe"}',1)$$,'MM005','invalid','versão desconhecida recusada');
select throws_ok($$select public.admin_export_csv('pessoas','{"aba":"equipe","inesperado":true}',2)$$,'MM005','invalid','filtros desconhecidos recusados');
reset role;
select ok(exists(select 1 from public.audit_logs where actor_id='41000000-0000-4000-8000-000000000001' and action='export.csv' and detail->'filters'='{"aba":"equipe","q":"team41master@"}'::jsonb and detail->>'rows'='1' and detail->>'designVersion'='2'),'auditoria registra busca normalizada, quantidade e versão');

select set_config('request.jwt.claims','{"sub":"41000000-0000-4000-8000-000000000002","role":"authenticated","app_metadata":{"role":"support"}}',true);
set local role authenticated;
select is(public.admin_export_csv('pessoas','{"aba":"equipe","q":"41000000-0000-4000-8000-000000000001"}',2)->>'csv',E'"email","papel","desde"\r\n"t***@test.local","master",2026-01-02T13:00:00Z\r\n','support só recebe e-mail mascarado');
select is((public.admin_export_csv('pessoas','{"aba":"equipe","q":"team41master@"}',2)->>'rows')::int,0,'support não pode buscar e-mail oculto');
select throws_ok($$select public.admin_export_csv('pagamentos','{}',2)$$,'MM004','forbidden','delegação preserva pagamentos só para master');
reset role;
select set_config('request.jwt.claims','{}',true);
set local role authenticated;
select throws_ok($$select public.admin_export_csv('pessoas','{"aba":"equipe"}',2)$$,'MM004','forbidden','sem papel não pode exportar');
reset role;
select ok(not has_function_privilege('anon','public.admin_export_csv(text,jsonb,integer)','execute'),'anon sem grant');
select ok(has_function_privilege('authenticated','public.admin_export_csv(text,jsonb,integer)','execute'),'autenticado depende da autorização interna');
select ok(has_function_privilege('authenticated','public.admin_export_csv(text,jsonb)','execute'),'contrato anterior continua disponível');
select * from finish();
rollback;
