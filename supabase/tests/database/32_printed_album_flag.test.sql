-- pgTAP · chave `printed_album` (álbum impresso) e papel de plataforma atual: nasce desligada, só master liga (com motivo, auditado),
-- authenticated lê, anônimo não, e o pedido de impressão é recusado no servidor enquanto desligada.
begin;
select no_plan();

create schema tests;
create function tests.login(p_user uuid, p_role text default null, p_aal text default 'aal1') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated', 'is_anonymous', false, 'aal', p_aal,
    'app_metadata', case when p_role is not null then json_build_object('role', p_role) else '{}'::json end)::text, true);
  set local role authenticated;
end $$;
grant usage on schema tests to authenticated;

insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-4000-8000-0000000032a1', 'master32@test.local', false),
  ('00000000-0000-4000-8000-0000000032a2', 'host32@test.local', false),
  ('00000000-0000-4000-8000-0000000032a3', 'support32@test.local', false);
insert into public.profiles (id) select id from auth.users where email like '%32@test.local' on conflict do nothing;
insert into public.platform_roles (user_id, role) values ('00000000-0000-4000-8000-0000000032a1', 'master'), ('00000000-0000-4000-8000-0000000032a3', 'support');
insert into public.events (id, title, category, host_id, host_name, duration_hours, capacity, shots_per_person, reveal_enabled) values
  ('00000000-0000-4000-8000-0000000032e1', 'Álbum 32', 'casamento', '00000000-0000-4000-8000-0000000032a2', 'Host 32', 6, 20, 10, false);
insert into public.photos (id, event_id, author_id, author_name, storage_path, upload_status) values
  ('00000000-0000-4000-8000-0000000032f1', '00000000-0000-4000-8000-0000000032e1', '00000000-0000-4000-8000-0000000032a2', 'Host 32', '00000000-0000-4000-8000-0000000032e1/00000000-0000-4000-8000-0000000032f1', 'pronta');

-- ===================================================================== a chave
select is((select count(*)::int from public.feature_flags where key = 'printed_album'), 0, 'sem linha: o álbum impresso nasce desligado');
select tests.login('00000000-0000-4000-8000-0000000032a2');
select is(public.printed_album_enabled(), false, 'authenticated lê: desligado');
select throws_ok($$select public.create_print_order('00000000-0000-4000-8000-000000032b01', '00000000-0000-4000-8000-0000000032e1', 'album', 1, '{00000000-0000-4000-8000-0000000032f1}', false, 'Maria Souza', '65999991234', null, '{"cep":"78000000","street":"Rua","number":"1","neighborhood":"Centro","city":"Cuiabá","state":"MT"}', null)$$,
  'MM004', null, 'com a chave desligada o pedido de impressão é recusado no servidor');
select throws_ok($$select public.admin_set_feature_flag('printed_album', true, '{}'::jsonb, 'anfitrião tentando ligar a chave')$$, 'MM004', null, 'anfitrião não liga a chave');
reset role;
set local role anon;
select throws_ok($$select public.printed_album_enabled()$$, '42501', null, 'anônimo (sem sessão) não lê a chave');
reset role;

select tests.login('00000000-0000-4000-8000-0000000032a3', 'support');
select throws_ok($$select public.admin_set_feature_flag('printed_album', true, '{}'::jsonb, 'support tentando ligar a chave')$$, 'MM004', null, 'support não liga a chave');
reset role;
select tests.login('00000000-0000-4000-8000-0000000032a1', 'master');
select throws_ok($$select public.admin_set_feature_flag('printed_album', true, '{}'::jsonb, 'curto')$$, 'MM011', null, 'sem motivo suficiente a chave não muda');
select lives_ok($$select public.admin_set_feature_flag('printed_album', true, '{}'::jsonb, 'Liberar o álbum impresso para o piloto')$$, 'master liga a chave com motivo');
reset role;
select ok(exists(select 1 from public.audit_logs where action like 'feature_flags.%' and target_id = 'printed_album'), 'a gravação da chave foi auditada');

select tests.login('00000000-0000-4000-8000-0000000032a2');
select is(public.printed_album_enabled(), true, 'ligada: o anfitrião passa a ver');
select is((public.create_print_order('00000000-0000-4000-8000-000000032b01', '00000000-0000-4000-8000-0000000032e1', 'album', 1, '{00000000-0000-4000-8000-0000000032f1}', false, 'Maria Souza', '65999991234', null,
  '{"cep":"78000000","street":"Rua","number":"1","neighborhood":"Centro","city":"Cuiabá","state":"MT"}', null) ->> 'status'), 'solicitado', 'com a chave ligada o pedido é criado');
reset role;
select tests.login('00000000-0000-4000-8000-0000000032a1', 'master');
select lives_ok($$select public.admin_set_feature_flag('printed_album', false, '{}'::jsonb, 'Voltar ao álbum impresso desligado')$$, 'master desliga de novo');
select is(public.printed_album_enabled(), false, 'desligada outra vez');
reset role;

select * from finish();
rollback;
