-- pgTAP · COM-017: códigos de cortesia. O Master gera (admin_create_code devolve o código inteiro uma única vez; o banco
-- guarda só hash e code_hint), lista e revoga; o anfitrião resgata (redeem_code) e ganha um direito codigo/nenhum.
begin;
select no_plan();

create schema tests;
create function tests.login(p_user uuid, p_role text default null) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated', 'is_anonymous', false,
    'app_metadata', case when p_role is null then '{}'::json else json_build_object('role', p_role) end)::text, true);
  set local role authenticated;
end $$;
create function tests.set_env(p_env text) returns void language sql as $$
  update public.platform_settings set value = to_jsonb(p_env) where key = 'payments_env'
$$;
grant usage on schema tests to authenticated, service_role, anon;
grant execute on all functions in schema tests to authenticated, service_role, anon;

-- pessoas: h1 anfitrião · h2 outro organizador · h3 anfitrião do limite de tentativas · g1 convidado · m1 master
insert into auth.users (id, aud, role, email, is_anonymous) values
  ('00000000-0000-4000-8000-00000000a0a1', 'authenticated', 'authenticated', 'host10@test.local', false),
  ('00000000-0000-4000-8000-00000000a0a2', 'authenticated', 'authenticated', 'outro10@test.local', false),
  ('00000000-0000-4000-8000-00000000a0a3', 'authenticated', 'authenticated', 'tentativas10@test.local', false),
  ('00000000-0000-4000-8000-00000000a0b1', 'authenticated', 'authenticated', 'convidado10@test.local', false),
  ('00000000-0000-4000-8000-00000000a0c1', 'authenticated', 'authenticated', 'master10@test.local', false);
insert into public.profiles (id) select id from auth.users where id::text like '00000000-0000-4000-8000-00000000a0%' on conflict do nothing;
insert into public.platform_roles (user_id, role) values ('00000000-0000-4000-8000-00000000a0c1', 'master');

insert into public.events (id, title, category, host_id, host_name, duration_hours, capacity, shots_per_person, start_at) values
  ('00000000-0000-4000-8000-00000000a0e1', 'Resgate', 'festa', '00000000-0000-4000-8000-00000000a0a1', 'H', 6, 10, 10, now()),
  ('00000000-0000-4000-8000-00000000a0e2', 'Segundo', 'festa', '00000000-0000-4000-8000-00000000a0a1', 'H', 6, 10, 10, now()),
  ('00000000-0000-4000-8000-00000000a0e3', 'Já pago', 'festa', '00000000-0000-4000-8000-00000000a0a1', 'H', 6, 10, 10, now()),
  ('00000000-0000-4000-8000-00000000a0e4', 'Tentativas', 'festa', '00000000-0000-4000-8000-00000000a0a3', 'H', 6, 10, 10, now()),
  ('00000000-0000-4000-8000-00000000a0e5', 'Encerrado', 'festa', '00000000-0000-4000-8000-00000000a0a1', 'H', 6, 10, 10, now());
update public.events set ended_at = now() - interval '1 minute' where id = '00000000-0000-4000-8000-00000000a0e5';
insert into public.participants (event_id, user_id, name) values
  ('00000000-0000-4000-8000-00000000a0e1', '00000000-0000-4000-8000-00000000a0b1', 'Convidado');

-- ===================================================== estrutura e privilégios
select has_table('public', 'courtesy_codes', 'tabela courtesy_codes existe');
select has_table('public', 'courtesy_redemptions', 'tabela courtesy_redemptions existe');
select hasnt_column('public', 'courtesy_codes', 'code', 'courtesy_codes não tem coluna com o código em claro');
select col_is_unique('public', 'courtesy_codes', 'code_hash', 'code_hash é único');
select col_is_unique('public', 'courtesy_redemptions', array['code_id', 'event_id'], 'um resgate por código e evento');
select col_not_null('public', 'courtesy_redemptions', 'code_id', 'courtesy_redemptions.code_id not null');
select col_not_null('public', 'courtesy_redemptions', 'event_id', 'courtesy_redemptions.event_id not null');
select ok(exists (select 1 from pg_proc where proname = 'redeem_code' and prosrc like '%pg_advisory_xact_lock%'),
  'redeem_code serializa por usuário (advisory lock antes de contar tentativas)');
select has_function('public', 'admin_create_code', array['text', 'integer', 'timestamp with time zone', 'text'], 'admin_create_code existe');
select has_function('public', 'admin_list_codes', array[]::text[], 'admin_list_codes existe');
select has_function('public', 'admin_revoke_code', array['uuid', 'text'], 'admin_revoke_code existe');
select has_function('public', 'redeem_code', array['uuid', 'text'], 'redeem_code existe');
select ok(not has_table_privilege('authenticated', 'public.courtesy_codes', 'select'), 'cliente não lê courtesy_codes');
select ok(not has_table_privilege('authenticated', 'public.courtesy_codes', 'insert'), 'cliente não grava courtesy_codes');
select ok(not has_table_privilege('authenticated', 'public.courtesy_redemptions', 'select'), 'cliente não lê courtesy_redemptions');
select ok(not has_table_privilege('anon', 'public.courtesy_codes', 'select'), 'anon não lê courtesy_codes');
select ok(not has_function_privilege('anon', 'public.redeem_code(uuid, text)', 'execute'), 'anon não executa redeem_code');
select ok(not has_function_privilege('anon', 'public.admin_create_code(text, int, timestamptz, text)', 'execute'), 'anon não executa admin_create_code');
select ok(has_function_privilege('authenticated', 'public.redeem_code(uuid, text)', 'execute'), 'authenticated executa redeem_code');

-- ===================================================== só o Master gera, lista e revoga
select tests.login('00000000-0000-4000-8000-00000000a0a1');
select throws_ok($$select public.admin_create_code('casamento', 1, now() + interval '30 days', 'Teste cerimonialista')$$,
  'MM004', 'forbidden', 'não-master chama admin_create_code: MM004');
select throws_ok($$select * from public.admin_list_codes()$$, 'MM004', 'forbidden', 'não-master lista códigos: MM004');
select throws_ok($$select public.admin_revoke_code(gen_random_uuid(), 'motivo longo o bastante')$$, 'MM004', 'forbidden', 'não-master revoga: MM004');
reset role;

select tests.login('00000000-0000-4000-8000-00000000a0c1', 'master');
select throws_ok($$select public.admin_create_code('casamento', 1, now() + interval '30 days', 'ab')$$, 'MM005', null, 'nota com menos de 3 caracteres: MM005');
select throws_ok(format('select public.admin_create_code(%L, 1, now() + interval %L, %L)', 'casamento', '30 days', repeat('x', 201)),
  'MM005', null, 'nota acima de 200 caracteres: MM005');
select throws_ok($$select public.admin_create_code('casamento', 0, now() + interval '30 days', 'Teste')$$, 'MM005', null, 'max_uses 0: MM005');
select throws_ok($$select public.admin_create_code('casamento', 1001, now() + interval '30 days', 'Teste')$$, 'MM005', null, 'max_uses 1001: MM005');
select throws_ok($$select public.admin_create_code('gratis', 1, now() + interval '30 days', 'Teste')$$, 'MM005', null, 'código do plano grátis: MM005');
select throws_ok($$select public.admin_create_code('inexistente', 1, now() + interval '30 days', 'Teste')$$, 'MM005', null, 'plano desconhecido: MM005');
select throws_ok($$select public.admin_create_code('casamento', 1, now() - interval '1 minute', 'Teste')$$, 'MM005', null, 'validade no passado: MM005');

select public.admin_create_code('casamento', 1, now() + interval '30 days', '  Teste · cerimonialista Júlia  ') as c1 \gset
select public.admin_create_code('festa', 5, now() + interval '30 days', 'Piloto · expirado') as c2 \gset
select public.admin_create_code('festa', 5, now() + interval '30 days', 'Ação de lançamento') as c3 \gset
select public.admin_create_code('festa', 5, now() + interval '30 days', 'Piloto · buffets parceiros') as c4 \gset
select public.admin_create_code('grande', 1, now() + interval '30 days', 'Presente · casamento da prima') as c5 \gset
select matches(:'c1'::text, '^MMT-[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{4}-[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{4}$', 'admin_create_code devolve MMT-XXXX-XXXX no alfabeto sem ambiguidade');
select ok(:'c1'::text <> :'c4'::text and :'c4'::text <> :'c5'::text, 'códigos diferentes a cada geração');
select ok((select count(*) from public.admin_list_codes() j where j::text like '%' || substr(:'c1', 9) || '%') = 0,
  'admin_list_codes não devolve o código inteiro');
select is((select j ->> 'status' || '/' || (j ->> 'uses') || '/' || (j ->> 'maxUses') || '/' || (j ->> 'planCode') || '/' || (j ->> 'note')
           from public.admin_list_codes() j where j ->> 'hint' = left(:'c1', 8)),
  'ativo/0/1/casamento/Teste · cerimonialista Júlia', 'admin_list_codes: hint, plano, usos, nota aparada e status ativo');
reset role;

select is((select count(*)::int from public.courtesy_codes), 5, 'cinco códigos gravados');
select is((select count(*)::int from public.courtesy_codes c where to_jsonb(c)::text like '%' || substr(:'c1', 9) || '%'), 0,
  'a tabela não contém o texto do código (nem o final)');
select is((select code_hash from public.courtesy_codes where code_hint = left(:'c1', 8)),
  encode(extensions.digest(replace(:'c1', '-', ''), 'sha256'), 'hex'), 'code_hash = sha256 do código sem hífens, em maiúsculas');
select is((select code_hint || '/' || plan_code || '/' || max_uses || '/' || uses || '/' || note || '/' || created_by
           from public.courtesy_codes where code_hint = left(:'c1', 8)),
  left(:'c1', 8) || '/casamento/1/0/Teste · cerimonialista Júlia/00000000-0000-4000-8000-00000000a0c1', 'code_hint são os 8 primeiros caracteres');
select is((select count(*)::int from public.audit_logs where action = 'code.created' and actor_role = 'master'
           and actor_id = '00000000-0000-4000-8000-00000000a0c1'), 5, 'geração auditada com actor_role=master');
select is((select count(*)::int from public.audit_logs where action like 'code.%' and (detail::text || coalesce(reason, ''))
           like '%' || substr(:'c1', 9) || '%'), 0, 'a auditoria não contém o código');

-- ===================================================== resgate ok (pagamentos desligados)
select is(public.payments_env(), 'desligado', 'ambiente de pagamento desligado');
select tests.login('00000000-0000-4000-8000-00000000a0a1');
select is(public.redeem_code('00000000-0000-4000-8000-00000000a0e1', lower(replace(:'c1', '-', ''))),
  '{"applied": true, "planCode": "casamento", "reason": "ok"}'::jsonb, 'código em minúsculas e sem hífens: ok');
reset role;
select is((select source || '/' || env || '/' || plan_code || '/' || status || '/' || max_guests || '/' || max_shots
           from public.event_entitlements where event_id = '00000000-0000-4000-8000-00000000a0e1' and source = 'codigo'),
  'codigo/nenhum/casamento/ativo/250/36', 'direito codigo/nenhum com os limites do plano');
select is((select uses from public.courtesy_codes where code_hint = left(:'c1', 8)), 1, 'uses = 1');
select is((select capacity || '/' || shots_per_person from public.events where id = '00000000-0000-4000-8000-00000000a0e1'), '250/36',
  'resgate sobe os limites do evento como o pagamento');
select is((select plan_code || '/' || source from public.effective_entitlement('00000000-0000-4000-8000-00000000a0e1')), 'casamento/codigo',
  'direito codigo vale com payments_env=desligado');
select is((select count(*)::int from public.courtesy_redemptions r join public.courtesy_codes c on c.id = r.code_id
           where c.code_hint = left(:'c1', 8) and r.event_id = '00000000-0000-4000-8000-00000000a0e1'
             and r.user_id = '00000000-0000-4000-8000-00000000a0a1'
             and r.entitlement_id = (select id from public.event_entitlements where event_id = '00000000-0000-4000-8000-00000000a0e1' and source = 'codigo')), 1,
  'resgate registrado com usuário e direito');
select is((select count(*)::int from public.audit_logs where action = 'code.redeemed' and actor_role = 'organizador'
           and actor_id = '00000000-0000-4000-8000-00000000a0a1' and event_id = '00000000-0000-4000-8000-00000000a0e1'
           and detail ->> 'hint' = left(:'c1', 8) and detail ->> 'plan' = 'casamento'), 1, 'resgate auditado sem o código');

-- mesmo código, mesmo evento: ja_incluido, sem consumir
select tests.login('00000000-0000-4000-8000-00000000a0a1');
select is(public.redeem_code('00000000-0000-4000-8000-00000000a0e1', :'c1'),
  '{"applied": false, "planCode": "casamento", "reason": "ja_incluido"}'::jsonb, 'mesmo código no mesmo evento: ja_incluido');
-- segundo evento com código de max_uses=1 (esgotado): invalido
select is(public.redeem_code('00000000-0000-4000-8000-00000000a0e2', :'c1'),
  '{"applied": false, "planCode": null, "reason": "invalido"}'::jsonb, 'segundo evento com código de max_uses=1: invalido');
reset role;
select is((select uses from public.courtesy_codes where code_hint = left(:'c1', 8)), 1, 'uses continua 1');

-- expirado e revogado: invalido (mesma resposta do inexistente)
update public.courtesy_codes set expires_at = now() - interval '1 second' where code_hint = left(:'c2', 8);
select tests.login('00000000-0000-4000-8000-00000000a0c1', 'master');
select (select j ->> 'id' from public.admin_list_codes() j where j ->> 'hint' = left(:'c3', 8)) as c3id \gset
select throws_ok(format('select public.admin_revoke_code(%L, %L)', :'c3id', 'curto'), 'MM011', 'reasonrequired', 'revogar sem motivo: MM011');
select lives_ok(format('select public.admin_revoke_code(%L, %L)', :'c3id', 'Ação de lançamento encerrada'), 'Master revoga com motivo');
select throws_ok(format('select public.admin_revoke_code(%L, %L)', :'c3id', 'Ação de lançamento encerrada'), 'MM005', null, 'revogar de novo: MM005');
select throws_ok(format('select public.admin_revoke_code(%L, %L)', gen_random_uuid(), 'Ação de lançamento encerrada'), 'MM005', null, 'revogar inexistente: MM005');
select is((select string_agg(j ->> 'hint' || ':' || (j ->> 'status'), ',' order by j ->> 'hint')
           from public.admin_list_codes() j where j ->> 'hint' in (left(:'c1', 8), left(:'c2', 8), left(:'c3', 8))),
  (select string_agg(h, ',' order by split_part(h, ':', 1)) from unnest(array[left(:'c1', 8) || ':usado', left(:'c2', 8) || ':expirado', left(:'c3', 8) || ':revogado']) h),
  'status usado, expirado e revogado');
reset role;
select is((select count(*)::int from public.audit_logs where action = 'code.revoked' and actor_role = 'master'
           and reason = 'Ação de lançamento encerrada' and target_id = :'c3id'), 1, 'revogação auditada com motivo');

select tests.login('00000000-0000-4000-8000-00000000a0a1');
select is(public.redeem_code('00000000-0000-4000-8000-00000000a0e2', :'c2'),
  '{"applied": false, "planCode": null, "reason": "invalido"}'::jsonb, 'código expirado: invalido');
select is(public.redeem_code('00000000-0000-4000-8000-00000000a0e2', :'c3'),
  '{"applied": false, "planCode": null, "reason": "invalido"}'::jsonb, 'código revogado: invalido');
select is(public.redeem_code('00000000-0000-4000-8000-00000000a0e2', 'MMT-AAAA-BBBB'),
  '{"applied": false, "planCode": null, "reason": "invalido"}'::jsonb, 'código inexistente: invalido');
select is(public.redeem_code('00000000-0000-4000-8000-00000000a0e5', :'c4'),
  '{"applied": false, "planCode": null, "reason": "evento_encerrado"}'::jsonb, 'evento encerrado: evento_encerrado, sem consumir');
reset role;
select is((select uses from public.courtesy_codes where code_hint = left(:'c2', 8)) + (select uses from public.courtesy_codes where code_hint = left(:'c3', 8))
          + (select uses from public.courtesy_codes where code_hint = left(:'c4', 8)), 0, 'nenhum uso consumido nas recusas');
select is((select count(*)::int from public.event_entitlements where event_id = '00000000-0000-4000-8000-00000000a0e2' and source = 'codigo'), 0,
  'nenhum direito criado nas recusas');
select is((select count(*)::int from public.audit_logs where action = 'code.redeem_invalid' and actor_id = '00000000-0000-4000-8000-00000000a0a1'), 4,
  'evento encerrado não conta como tentativa inválida');

-- ===================================================== ja_incluido: evento com Casamento pago resgata Festa
select tests.set_env('sandbox');
insert into public.event_entitlements (event_id, plan_code, max_guests, max_shots, source, env, reason)
values ('00000000-0000-4000-8000-00000000a0e3', 'casamento', 250, 36, 'pago', 'sandbox', 'teste');
select tests.login('00000000-0000-4000-8000-00000000a0a1');
select is(public.redeem_code('00000000-0000-4000-8000-00000000a0e3', :'c4'),
  '{"applied": false, "planCode": "festa", "reason": "ja_incluido"}'::jsonb, 'Casamento pago resgata Festa: ja_incluido');
reset role;
select is((select uses from public.courtesy_codes where code_hint = left(:'c4', 8)), 0, 'ja_incluido não consome uso');
select is((select count(*)::int from public.courtesy_redemptions where event_id = '00000000-0000-4000-8000-00000000a0e3'), 0, 'ja_incluido não registra resgate');
select tests.set_env('desligado');

-- ===================================================== só o anfitrião resgata
select tests.login('00000000-0000-4000-8000-00000000a0b1');
select throws_ok(format('select public.redeem_code(%L, %L)', '00000000-0000-4000-8000-00000000a0e1', :'c4'), 'MM004', 'forbidden', 'convidado resgata: MM004');
reset role;
select tests.login('00000000-0000-4000-8000-00000000a0a2');
select throws_ok(format('select public.redeem_code(%L, %L)', '00000000-0000-4000-8000-00000000a0e1', :'c4'), 'MM004', 'forbidden', 'outro organizador resgata: MM004');
reset role;
set local role anon;
select throws_ok(format('select public.redeem_code(%L, %L)', '00000000-0000-4000-8000-00000000a0e1', :'c4'), '42501', null, 'anon não resgata');
reset role;
select is((select uses from public.courtesy_codes where code_hint = left(:'c4', 8)), 0, 'tentativas sem permissão não consomem');

-- ===================================================== limite de tentativas: 5 invalido em 10 min por usuário
select tests.login('00000000-0000-4000-8000-00000000a0a3');
select is(public.redeem_code('00000000-0000-4000-8000-00000000a0e4', 'MMT-ZZZZ-ZZZ' || n) ->> 'reason', 'invalido', format('tentativa inválida %s', n))
  from generate_series(2, 6) n;
select is(public.redeem_code('00000000-0000-4000-8000-00000000a0e4', 'MMT-ZZZZ-ZZZ7'),
  '{"applied": false, "planCode": null, "reason": "muitas_tentativas"}'::jsonb, '6ª tentativa inválida em 10 min: muitas_tentativas');
select is(public.redeem_code('00000000-0000-4000-8000-00000000a0e4', :'c4') ->> 'reason', 'muitas_tentativas',
  'bloqueado: até um código válido recebe muitas_tentativas');
reset role;
select is((select uses from public.courtesy_codes where code_hint = left(:'c4', 8)), 0, 'bloqueio não consome uso');
select is((select count(*)::int from public.audit_logs where action = 'code.redeem_invalid' and actor_id = '00000000-0000-4000-8000-00000000a0a3'), 5,
  'tentativas inválidas auditadas (as bloqueadas não renovam a janela)');
select is((select count(*)::int from public.audit_logs where action like 'code.%' and actor_id = '00000000-0000-4000-8000-00000000a0a3'
           and detail::text like '%ZZZZ%'), 0, 'a auditoria não guarda o texto tentado');

-- o limite é por usuário: o anfitrião h1 continua resgatando (Festa no evento grátis)
select tests.login('00000000-0000-4000-8000-00000000a0a1');
select is(public.redeem_code('00000000-0000-4000-8000-00000000a0e2', :'c4'),
  '{"applied": true, "planCode": "festa", "reason": "ok"}'::jsonb, 'outro usuário não é afetado pelo bloqueio');
-- só o corpo de 8 caracteres, em minúsculas, também resgata (prefixo MMT opcional)
select is(public.redeem_code('00000000-0000-4000-8000-00000000a0e2', lower(substr(:'c5', 5, 4) || ' ' || substr(:'c5', 10, 4))),
  '{"applied": true, "planCode": "grande", "reason": "ok"}'::jsonb, 'corpo sem prefixo: ok (upgrade de Festa para Grande)');
reset role;
select is((select uses from public.courtesy_codes where code_hint = left(:'c4', 8)), 1, 'código de 5 usos: uses = 1');
select is((select capacity || '/' || coalesce(shots_per_person::text, 'null') from public.events where id = '00000000-0000-4000-8000-00000000a0e2'), '500/null',
  'Grande: 500 convidados e fotos sem limite');
select is((select plan_code || '/' || source from public.effective_entitlement('00000000-0000-4000-8000-00000000a0e2')), 'grande/codigo', 'plano efetivo Grande');

select * from finish();
rollback;
