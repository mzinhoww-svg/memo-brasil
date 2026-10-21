-- pgTAP · v2 (Event Studio + Master Admin): temas, assets/branding, papéis de plataforma, auditoria imutável,
-- acesso excepcional a foto, settings/flags, analytics, LGPD e saúde. Isolamento por evento e por papel.
begin;
select no_plan();

create schema tests;
grant usage on schema tests to authenticated, service_role; -- format(tests.palette()) roda como o usuário logado
create function tests.login(p_user uuid, p_anon boolean default false, p_role text default null) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated', 'is_anonymous', p_anon,
    'app_metadata', case when p_role is null then '{}'::json else json_build_object('role', p_role) end)::text, true);
  set local role authenticated;
end $$;
create function tests.fake_object(p_bucket text, p_path text, p_size int default 1000, p_mime text default 'image/jpeg') returns void language sql as $$
  insert into storage.objects (bucket_id, name, owner, metadata) values (p_bucket, p_path, null, jsonb_build_object('size', p_size, 'mimetype', p_mime))
$$;
create function tests.clear_branding() returns void language plpgsql as $$
begin -- o Storage bloqueia DELETE direto em storage.objects; o teste limpa como superusuário sem os triggers
  set local session_replication_role = replica;
  delete from storage.objects where bucket_id = 'event-branding';
  set local session_replication_role = origin;
end $$;
create function tests.palette(p_texto text default '#3A4660') returns jsonb language sql as $$
  select jsonb_build_object('superficie', '#FFFFFF', 'grafismo', '#2DB7C9', 'controle', '#FF5A5F', 'texto', p_texto, 'profundo', '#10204A')
$$;

-- pessoas: a1 host A · a2 host B (outro host) · b1 convidado membro de A · b3 convidado sem entrar
--          m1 master (claim + linha) · m2 claim sem linha · m4 linha sem claim · s1 support · u1 auditor
insert into auth.users (id, aud, role, email, is_anonymous) values
  ('00000000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated', 'emy@test.local', false),
  ('00000000-0000-4000-8000-0000000000a2', 'authenticated', 'authenticated', 'outro@test.local', false),
  ('00000000-0000-4000-8000-0000000000b1', 'authenticated', 'authenticated', null, true),
  ('00000000-0000-4000-8000-0000000000b3', 'authenticated', 'authenticated', null, true),
  ('00000000-0000-4000-8000-0000000000c1', 'authenticated', 'authenticated', 'master@test.local', false),
  ('00000000-0000-4000-8000-0000000000c2', 'authenticated', 'authenticated', 'semlinha@test.local', false),
  ('00000000-0000-4000-8000-0000000000c4', 'authenticated', 'authenticated', 'semclaim@test.local', false),
  ('00000000-0000-4000-8000-0000000000d1', 'authenticated', 'authenticated', 'suporte@test.local', false),
  ('00000000-0000-4000-8000-0000000000e1', 'authenticated', 'authenticated', 'auditor@test.local', false);

insert into public.platform_roles (user_id, role) values
  ('00000000-0000-4000-8000-0000000000c1', 'master'),
  ('00000000-0000-4000-8000-0000000000c4', 'master'),
  ('00000000-0000-4000-8000-0000000000d1', 'support'),
  ('00000000-0000-4000-8000-0000000000e1', 'auditor');

-- ===================================================== estado vazio: zeros reais, nada inventado
select tests.login('00000000-0000-4000-8000-0000000000c1', false, 'master');
select is((public.admin_dashboard_metrics() -> 'events' ->> 'created')::int, 0, 'vazio: eventos criados = 0');
select is((public.admin_dashboard_metrics() #>> '{reveals,overdue}')::int, 0, 'vazio: revelações atrasadas = 0');
select is((public.admin_dashboard_metrics() #>> '{storage,photosBytes}')::bigint, 0::bigint, 'vazio: bytes em Storage = 0');
select is((public.admin_list_events() ->> 'total')::int, 0, 'vazio: lista de eventos');
select is((public.admin_list_organizers() -> 'items'), '[]'::jsonb, 'vazio: lista de organizadores');
select is((public.admin_lgpd_requests() #>> '{summary,pending}')::int, 0, 'vazio: solicitações LGPD');
reset role;

-- ===================================================== papéis de plataforma (MAD-001)
select is((select count(*)::int from public.audit_logs where action = 'platform_role.granted'), 4, 'concessão de papel é auditada por trigger');
select tests.login('00000000-0000-4000-8000-0000000000c1', false, 'master');
select is(public.is_master(), true, 'master: claim + linha ativa');
select is(public.is_platform_role('master'), true, 'is_platform_role(master)');
select is(public.is_platform_role('support'), false, 'master não é support');
select is(public.is_platform_role('root'), false, 'papel inexistente é falso');
reset role;
select tests.login('00000000-0000-4000-8000-0000000000c2', false, 'master');
select is(public.is_master(), false, 'claim master SEM linha ativa não é master');
reset role;
select tests.login('00000000-0000-4000-8000-0000000000c4');
select is(public.is_master(), false, 'linha ativa SEM claim não é master');
reset role;
select tests.login('00000000-0000-4000-8000-0000000000d1', false, 'master');
select is(public.is_master(), false, 'claim de master com linha de support não vale');
reset role;
select tests.login('00000000-0000-4000-8000-0000000000d1', false, 'support');
select is(public.is_platform_role('support'), true, 'support: claim + linha');
select is(public.is_master(), false, 'support não é master');
reset role;

-- escalada de privilégio: ninguém se promove
set local role anon;
select throws_ok($$insert into public.platform_roles (user_id, role) values ('00000000-0000-4000-8000-0000000000b3', 'master')$$, '42501', null, 'anon não insere papel');
select throws_ok($$select * from public.platform_roles$$, '42501', null, 'anon não lê papéis');
select throws_ok($$select public.is_master()$$, '42501', null, 'anon não chama is_master');
reset role;
select tests.login('00000000-0000-4000-8000-0000000000b3', true);
select throws_ok($$insert into public.platform_roles (user_id, role) values ('00000000-0000-4000-8000-0000000000b3', 'master')$$, '42501', null, 'convidado anônimo não se promove');
reset role;
select tests.login('00000000-0000-4000-8000-0000000000a1');
select throws_ok($$insert into public.platform_roles (user_id, role) values ('00000000-0000-4000-8000-0000000000a1', 'master')$$, '42501', null, 'authenticated comum/host não se promove (INSERT)');
select throws_ok($$update public.platform_roles set revoked_at = now()$$, '42501', null, 'authenticated comum não altera papéis (UPDATE)');
select throws_ok($$delete from public.platform_roles$$, '42501', null, 'authenticated comum não apaga papéis (DELETE)');
select is((select count(*)::int from public.platform_roles), 0, 'host não enxerga platform_roles (RLS)');
select throws_ok($$select public.admin_grant_platform_role('00000000-0000-4000-8000-0000000000a1', 'master', 'me promovendo sozinho')$$, 'MM004', 'forbidden', 'RPC de concessão exige master');
select throws_ok($$update auth.users set raw_app_meta_data = '{"role":"master"}'$$, '42501', null, 'host não escreve app_metadata via SQL');
reset role;
select tests.login('00000000-0000-4000-8000-0000000000c2', false, 'master');
select is((select count(*)::int from public.platform_roles), 0, 'claim forjada sem linha não lê papéis');
select throws_ok($$insert into public.platform_roles (user_id, role) values ('00000000-0000-4000-8000-0000000000c2', 'master')$$, '42501', null, 'claim forjada não insere linha');
select throws_ok($$select public.admin_grant_platform_role('00000000-0000-4000-8000-0000000000c2', 'master', 'claim forjada tentando linha')$$, 'MM004', 'forbidden', 'claim forjada não concede');
reset role;
select tests.login('00000000-0000-4000-8000-0000000000d1', false, 'support');
select is((select count(*)::int from public.platform_roles), 0, 'support não lê platform_roles (só master)');
reset role;
select tests.login('00000000-0000-4000-8000-0000000000c1', false, 'master');
select is((select count(*)::int from public.platform_roles), 4, 'master lê platform_roles');
select throws_ok($$insert into public.platform_roles (user_id, role) values ('00000000-0000-4000-8000-0000000000a1', 'master')$$, '42501', null, 'nem master escreve direto (só RPC)');
select throws_ok($$select public.admin_grant_platform_role('00000000-0000-4000-8000-0000000000a1', 'support', 'curto')$$, 'MM011', 'reasonrequired', 'concessão exige justificativa');
select throws_ok($$select public.admin_grant_platform_role('00000000-0000-4000-8000-0000000000b3', 'support', 'convidado anônimo não pode')$$, 'MM005', 'invalid', 'não concede a conta anônima');
select throws_ok($$select public.admin_grant_platform_role('00000000-0000-4000-8000-0000000000a1', 'root', 'papel inexistente aqui')$$, '23514', null, 'papel fora da lista é recusado');
select lives_ok($$select public.admin_grant_platform_role('00000000-0000-4000-8000-0000000000a1', 'auditor', 'novo auditor do time')$$, 'master concede papel com justificativa');
select lives_ok($$select public.admin_revoke_platform_role('00000000-0000-4000-8000-0000000000a1', 'auditor', 'saiu do time de auditoria')$$, 'master revoga papel');
select lives_ok($$select public.admin_revoke_platform_role('00000000-0000-4000-8000-0000000000c4', 'master', 'segundo master desligado')$$, 'revoga master quando há outro');
select throws_ok($$select public.admin_revoke_platform_role('00000000-0000-4000-8000-0000000000c1', 'master', 'tentando ficar sem nenhum master')$$, 'MM009', null, 'último master não é revogado');
reset role;
select is((select count(*)::int from public.audit_logs where action = 'platform_role.revoked' and reason is not null), 2, 'revogações auditadas com justificativa');
select throws_ok($$delete from public.platform_roles$$, 'MM010', null, 'histórico de papéis não é apagado (nem pelo dono)');
select throws_ok($$update public.platform_roles set role = 'master' where role = 'support'$$, 'MM010', null, 'papel não é reescrito, só revogado');

-- ===================================================== auditoria imutável (MAD-002)
select throws_ok($$update public.audit_logs set reason = 'x'$$, 'MM010', null, 'UPDATE em audit_logs bloqueado (dono)');
select throws_ok($$delete from public.audit_logs$$, 'MM010', null, 'DELETE em audit_logs bloqueado (dono)');
select throws_ok($$truncate public.audit_logs$$, 'MM010', null, 'TRUNCATE em audit_logs bloqueado');
set local role service_role;
select throws_ok($$update public.audit_logs set action = 'x'$$, '42501', null, 'UPDATE negado ao service_role (privilégio revogado; o trigger ENABLE ALWAYS é a segunda barreira)');
select throws_ok($$delete from public.audit_logs$$, '42501', null, 'DELETE negado ao service_role (privilégio revogado)');
reset role;
select tests.login('00000000-0000-4000-8000-0000000000a1');
select throws_ok($$update public.audit_logs set action = 'x'$$, '42501', null, 'cliente não altera auditoria');
select throws_ok($$delete from public.audit_logs$$, '42501', null, 'cliente não apaga auditoria');
select throws_ok($$select public.admin_log('settings.change', 'setting', 'x', 'tentativa de forjar auditoria')$$, 'MM004', 'forbidden', 'host não usa admin_log');
select is((select count(*)::int from public.audit_logs), 0, 'host só lê auditoria dos próprios eventos (nenhum ainda)');
reset role;
select tests.login('00000000-0000-4000-8000-0000000000d1', false, 'support');
select throws_ok($$select public.admin_log('settings.change', 'setting', 'x', 'support não audita como master')$$, 'MM004', 'forbidden', 'support não usa admin_log');
select is((select count(*)::int from public.audit_logs), 0, 'support não lê a trilha de auditoria');
reset role;
select tests.login('00000000-0000-4000-8000-0000000000c1', false, 'master');
select throws_ok($$select public.admin_log('event.suspend', 'event', 'x', '')$$, 'MM011', 'reasonrequired', 'ação sensível sem justificativa é recusada');
select throws_ok($$select public.admin_log('event.suspend', 'event', 'x', 'curto')$$, 'MM011', 'reasonrequired', 'justificativa curta é recusada');
select throws_ok($$select public.admin_log('Evento Suspenso!', 'event', 'x', 'nome de ação inválido aqui')$$, 'MM005', 'invalid', 'nome de ação inválido');
select lives_ok($$select public.admin_log('view.dashboard', 'dashboard', null, null)$$, 'consulta (view.*) dispensa justificativa');
select lives_ok($$select public.admin_log('event.suspend', 'event', 'abc', 'suspensão por denúncia grave de conteúdo')$$, 'ação sensível com justificativa');
select is((select actor_role || '|' || target_type || '|' || target_id from public.audit_logs where action = 'event.suspend'), 'master|event|abc', 'registro com actor_role/target');
reset role;
select tests.login('00000000-0000-4000-8000-0000000000e1', false, 'auditor');
select cmp_ok((select count(*)::int from public.audit_logs), '>', 5, 'auditor lê a trilha completa (somente leitura)');
select throws_ok($$select public.admin_log('event.suspend', 'event', 'x', 'auditor não escreve na trilha')$$, 'MM004', 'forbidden', 'auditor não usa admin_log');
reset role;

-- ===================================================== eventos de apoio (A do host a1, B do host a2)
insert into public.events (id, title, category, host_id, host_name, duration_hours) values
  ('10000000-0000-4000-8000-00000000000a', 'Evento A', 'casamento', '00000000-0000-4000-8000-0000000000a1', 'Emy', 6),
  ('10000000-0000-4000-8000-00000000000b', 'Evento B', 'aniversario', '00000000-0000-4000-8000-0000000000a2', 'Outro', 6);
insert into public.participants (event_id, user_id, name) values ('10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000b1', 'Bia');
select code as code_a from public.events where id = '10000000-0000-4000-8000-00000000000a' \gset

-- ===================================================== Event Theme: validação (CHECKs)
select is(round(public.contrast_ratio('#000000', '#FFFFFF')), 21::numeric, 'contraste preto/branco = 21');
select is(public.event_theme_contrast_ok(tests.palette()), true, 'paleta da marca passa AA');
select is(public.event_theme_contrast_ok('{"superficie":"zzz"}'), false, 'JSON inválido não explode: é falso');

-- presets da v1 (dia e noite) precisam passar no CHECK: regra única cliente × banco
select is(public.event_theme_contrast_ok('{"superficie":"#E8ECE4","grafismo":"#AAB4A2","controle":"#889082","texto":"#5B6752","profundo":"#4A5543"}'), true, 'preset v1 salvia dia passa no contraste');
select is(public.event_theme_contrast_ok('{"superficie":"#262D24","grafismo":"#5B6752","controle":"#889082","texto":"#AAB4A2","profundo":"#C9D1C1"}'), true, 'preset v1 salvia noite passa no contraste');
select is(public.event_theme_contrast_ok('{"superficie":"#F3E6DD","grafismo":"#D9A58A","controle":"#A8725A","texto":"#8C4A2F","profundo":"#6E3820"}'), true, 'preset v1 terracota dia passa no contraste');
select is(public.event_theme_contrast_ok('{"superficie":"#33261F","grafismo":"#8C4A2F","controle":"#A8725A","texto":"#D9A58A","profundo":"#EBC7B3"}'), true, 'preset v1 terracota noite passa no contraste');
select is(public.event_theme_contrast_ok('{"superficie":"#E2ECF1","grafismo":"#9DB8C6","controle":"#6F8F9F","texto":"#3F6275","profundo":"#2F4C5C"}'), true, 'preset v1 oceano dia passa no contraste');
select is(public.event_theme_contrast_ok('{"superficie":"#1F2A31","grafismo":"#3F6275","controle":"#6F8F9F","texto":"#9DB8C6","profundo":"#C3D6E0"}'), true, 'preset v1 oceano noite passa no contraste');
select is(public.event_theme_contrast_ok('{"superficie":"#EEE3EA","grafismo":"#B79BAE","controle":"#8B6C82","texto":"#6B4A61","profundo":"#523648"}'), true, 'preset v1 ameixa dia passa no contraste');
select is(public.event_theme_contrast_ok('{"superficie":"#2D2229","grafismo":"#6B4A61","controle":"#8B6C82","texto":"#B79BAE","profundo":"#D9C5D2"}'), true, 'preset v1 ameixa noite passa no contraste');
select is(public.event_theme_contrast_ok('{"superficie":"#FFFFFF","grafismo":"#2DB7C9","controle":"#FF5A5F","texto":"#3A4660","profundo":"#FAFAFA"}'), false, 'profundo sem contraste é rejeitado');

select tests.login('00000000-0000-4000-8000-0000000000a1');
select throws_ok(format($$insert into public.event_themes (event_id, colors) values ('10000000-0000-4000-8000-00000000000a', %L::jsonb)$$, tests.palette('#CCCCCC')),
  '23514', null, 'texto de baixo contraste sobre a superfície é rejeitado');
select throws_ok($$insert into public.event_themes (event_id, colors) values ('10000000-0000-4000-8000-00000000000a', '{"superficie":"#FFFFFF","grafismo":"#2DB7C9","controle":"#FF5A5F","texto":"#3A4660","profundo":"#FAFAFA"}')$$,
  '23514', null, 'profundo sem contraste com a superfície é rejeitado');
select throws_ok($$insert into public.event_themes (event_id, colors) values ('10000000-0000-4000-8000-00000000000a', '{"superficie":"FFFFFF","grafismo":"#2DB7C9","controle":"#FF5A5F","texto":"#3A4660","profundo":"#10204A"}')$$,
  '23514', null, 'hex sem # é rejeitado');
select throws_ok($$insert into public.event_themes (event_id, colors) values ('10000000-0000-4000-8000-00000000000a', '{"superficie":"#FFF","grafismo":"#2DB7C9","controle":"#FF5A5F","texto":"#3A4660","profundo":"#10204A"}')$$,
  '23514', null, 'hex de 3 dígitos é rejeitado');
select throws_ok($$insert into public.event_themes (event_id, colors) values ('10000000-0000-4000-8000-00000000000a', '{"superficie":"#GGGGGG","grafismo":"#2DB7C9","controle":"#FF5A5F","texto":"#3A4660","profundo":"#10204A"}')$$,
  '23514', null, 'hex com letras inválidas é rejeitado (sem erro de cast)');
select throws_ok($$insert into public.event_themes (event_id, colors) values ('10000000-0000-4000-8000-00000000000a', '{"superficie":"#FFFFFF","grafismo":"#2DB7C9","controle":"#FF5A5F","texto":"#3A4660"}')$$,
  '23514', null, 'faltando uma das 5 cores');
select throws_ok($$insert into public.event_themes (event_id, colors) values ('10000000-0000-4000-8000-00000000000a', '{"superficie":"#FFFFFF","grafismo":"#2DB7C9","controle":"#FF5A5F","texto":"#3A4660","profundo":"#10204A","css":"#000000"}')$$,
  '23514', null, 'cor extra não é aceita');
select throws_ok($$insert into public.event_themes (event_id, colors) values ('10000000-0000-4000-8000-00000000000a', '["#fff"]')$$, '23514', null, 'colors precisa ser objeto');
select throws_ok(format($$insert into public.event_themes (event_id, colors, font) values ('10000000-0000-4000-8000-00000000000a', %L::jsonb, 'comic-sans')$$, tests.palette()),
  '23514', null, 'fonte fora da lista fechada');
select throws_ok(format($$insert into public.event_themes (event_id, colors, welcome_message) values ('10000000-0000-4000-8000-00000000000a', %L::jsonb, %L)$$, tests.palette(), repeat('a', 281)),
  '23514', null, 'mensagem com 281 caracteres');
select throws_ok(format($$insert into public.event_themes (event_id, colors, welcome_message) values ('10000000-0000-4000-8000-00000000000a', %L::jsonb, %L)$$, tests.palette(), 'oi' || chr(7) || 'x'),
  '23514', null, 'mensagem com caractere de controle');
select throws_ok(format($$insert into public.event_themes (event_id, colors, qr_style) values ('10000000-0000-4000-8000-00000000000a', %L::jsonb, 'fractal')$$, tests.palette()),
  '23514', null, 'qr_style fora do enum');
select throws_ok(format($$insert into public.event_themes (event_id, colors, decor) values ('10000000-0000-4000-8000-00000000000a', %L::jsonb, '{"css":"body{display:none}"}')$$, tests.palette()),
  '23514', null, 'decor com chave não permitida');
select throws_ok(format($$insert into public.event_themes (event_id, colors, decor) values ('10000000-0000-4000-8000-00000000000a', %L::jsonb, '{"intensidade":9}')$$, tests.palette()),
  '23514', null, 'decor com valor fora do limite');
select throws_ok(format($$insert into public.event_themes (event_id, colors, preset) values ('10000000-0000-4000-8000-00000000000a', %L::jsonb, 'x;drop')$$, tests.palette()),
  '23514', null, 'preset fora do formato');

-- host grava tema válido (com \n permitido na mensagem)
select lives_ok(format($$insert into public.event_themes (event_id, preset, colors, font, welcome_message, qr_style, decor)
  values ('10000000-0000-4000-8000-00000000000a', 'salvia', %L::jsonb, 'pinyon', E'Bem-vindos!\nAproveitem.', 'pontos', '{"motivo":"folhas","intensidade":2,"bordas":true}')$$, tests.palette()),
  'host grava tema válido');
select is((select font from public.event_themes where event_id = '10000000-0000-4000-8000-00000000000a'), 'pinyon', 'tema lido pelo host');
select pg_sleep(0.01);
update public.event_themes set welcome_message = 'Oi', event_id = '10000000-0000-4000-8000-00000000000b' where event_id = '10000000-0000-4000-8000-00000000000a';
select is((select welcome_message from public.event_themes where event_id = '10000000-0000-4000-8000-00000000000a'), 'Oi', 'host atualiza o tema; event_id imutável');
select lives_ok($$delete from public.event_themes where event_id = '10000000-0000-4000-8000-00000000000a'$$, 'host restaura o tema padrão (apaga a linha)');
select is((select count(*)::int from public.event_themes where event_id = '10000000-0000-4000-8000-00000000000a'), 0, 'tema apagado');
select lives_ok(format($$insert into public.event_themes (event_id, preset, colors, font, welcome_message, qr_style, decor) values ('10000000-0000-4000-8000-00000000000a', 'salvia', %L::jsonb, 'pinyon', 'Oi', 'pontos', '{}')$$, tests.palette()), 'host volta a gravar o tema');
reset role;

-- ===================================================== Event Theme: RLS por papel e isolamento
select tests.login('00000000-0000-4000-8000-0000000000a2');
select is((select count(*)::int from public.event_themes), 0, 'outro host não lê o tema de A');
select throws_ok($$insert into public.event_themes (event_id, colors) values ('10000000-0000-4000-8000-00000000000a', '{"superficie":"#FFFFFF","grafismo":"#2DB7C9","controle":"#FF5A5F","texto":"#3A4660","profundo":"#10204A"}')$$,
  '42501', null, 'outro host não insere tema em A');
update public.event_themes set welcome_message = 'invadido' where event_id = '10000000-0000-4000-8000-00000000000a';
select lives_ok(format($$insert into public.event_themes (event_id, colors) values ('10000000-0000-4000-8000-00000000000b', %L::jsonb)$$, tests.palette()), 'host de B grava o tema do próprio evento');
reset role;
select is((select welcome_message from public.event_themes where event_id = '10000000-0000-4000-8000-00000000000a'), 'Oi', 'outro host não altera o tema de A');
select tests.login('00000000-0000-4000-8000-0000000000a1');
select is((select count(*)::int from public.event_themes), 1, 'host de A não lê o tema de B');
update public.event_themes set welcome_message = 'cruzado' where event_id = '10000000-0000-4000-8000-00000000000b';
reset role;
select is((select welcome_message from public.event_themes where event_id = '10000000-0000-4000-8000-00000000000b'), null, 'host de A não altera o tema de B');
select tests.login('00000000-0000-4000-8000-0000000000b1', true);
select is((select count(*)::int from public.event_themes), 1, 'convidado membro lê o tema do evento');
select throws_ok(format($$insert into public.event_themes (event_id, colors) values ('10000000-0000-4000-8000-00000000000a', %L::jsonb)$$, tests.palette()), '42501', null, 'convidado não escreve tema');
update public.event_themes set welcome_message = 'hack' where event_id = '10000000-0000-4000-8000-00000000000a';
reset role;
select is((select welcome_message from public.event_themes where event_id = '10000000-0000-4000-8000-00000000000a'), 'Oi', 'convidado não altera tema');
select tests.login('00000000-0000-4000-8000-0000000000b3', true);
select is((select count(*)::int from public.event_themes), 0, 'convidado que não entrou não lê tema (só pela prévia)');
reset role;
select tests.login('00000000-0000-4000-8000-0000000000c1', false, 'master');
select is((select count(*)::int from public.event_themes), 2, 'master lê temas');
select throws_ok(format($$insert into public.event_themes (event_id, colors) values ('10000000-0000-4000-8000-00000000000a', %L::jsonb)$$, tests.palette()), '42501', null, 'master não escreve tema por padrão');
reset role;
select tests.login('00000000-0000-4000-8000-0000000000c2', false, 'master');
select is((select count(*)::int from public.event_themes), 0, 'master sem linha não lê temas');
reset role;
select tests.login('00000000-0000-4000-8000-0000000000d1', false, 'support');
select is((select count(*)::int from public.event_themes), 0, 'support não lê temas');
reset role;
select tests.login('00000000-0000-4000-8000-0000000000e1', false, 'auditor');
select is((select count(*)::int from public.event_themes), 0, 'auditor não lê temas');
reset role;
set local role anon;
select throws_ok($$select * from public.event_themes$$, '42501', null, 'anon sem acesso a event_themes');
reset role;

-- bloqueio de edição: mesma regra da revelação (v1)
insert into public.events (id, title, category, host_id, host_name, duration_hours, reveal_enabled, reveal_anchor, reveal_offset_days) values
  ('10000000-0000-4000-8000-00000000000d', 'Evento D', 'formatura', '00000000-0000-4000-8000-0000000000a1', 'Emy', 6, true, 'fim', 0);
select tests.login('00000000-0000-4000-8000-0000000000a1');
select lives_ok(format($$insert into public.event_themes (event_id, colors) values ('10000000-0000-4000-8000-00000000000d', %L::jsonb)$$, tests.palette()), 'antes da revelação o host edita o tema');
reset role;
update public.events set start_at = now() - interval '7 hours' where id = '10000000-0000-4000-8000-00000000000d'; -- relógio andando: reveal_at no passado
select is(public.event_theme_locked('10000000-0000-4000-8000-00000000000d'), true, 'tema bloqueado quando a revelação venceu');
select tests.login('00000000-0000-4000-8000-0000000000a1');
update public.event_themes set welcome_message = 'tarde demais' where event_id = '10000000-0000-4000-8000-00000000000d';
reset role;
select is((select welcome_message from public.event_themes where event_id = '10000000-0000-4000-8000-00000000000d'), null, 'após o bloqueio o host não altera o tema');
select is(public.event_theme_locked('10000000-0000-4000-8000-00000000000a'), false, 'evento sem revelação nunca bloqueia o tema');

-- cascata e Realtime
delete from public.events where id = '10000000-0000-4000-8000-00000000000d';
select is((select count(*)::int from public.event_themes where event_id = '10000000-0000-4000-8000-00000000000d'), 0, 'tema some em cascata com o evento');
select is((select count(*)::int from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'event_themes'), 1, 'event_themes está no Realtime');
select is((select count(*)::int from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename in ('event_assets', 'platform_roles', 'audit_logs', 'platform_settings', 'feature_flags')), 0, 'demais tabelas v2 fora do Realtime');

-- ===================================================== prévia segura com tema
select tests.login('00000000-0000-4000-8000-0000000000b3', true);
select is((select array_agg(k order by k) from jsonb_object_keys(public.event_preview(:'code_a')) k),
  array['capacity','category','code','eventFont','full','hostName','palette','place','startAt','status','theme','title'], 'prévia: 11 campos da v1 + theme');
select is(public.event_preview(:'code_a') #>> '{theme,font}', 'pinyon', 'prévia devolve o tema ao convidado que ainda não entrou');
select is((select array_agg(k order by k) from jsonb_object_keys(public.event_preview(:'code_a') -> 'theme') k),
  array['colors','decor','font','preset','qrStyle','welcomeMessage'], 'tema na prévia: só campos de apresentação');
reset role;
select code as code_b from public.events where id = '10000000-0000-4000-8000-00000000000b' \gset
select tests.login('00000000-0000-4000-8000-0000000000b3', true);
select is(public.event_preview(:'code_b') -> 'theme' ->> 'preset', 'custom', 'prévia de B traz o tema de B (preset padrão)');
reset role;
insert into public.events (id, title, category, host_id, host_name, duration_hours) values
  ('10000000-0000-4000-8000-00000000000c', 'Sem tema', 'outro', '00000000-0000-4000-8000-0000000000a2', 'Outro', 6);
select code as code_c from public.events where id = '10000000-0000-4000-8000-00000000000c' \gset
select tests.login('00000000-0000-4000-8000-0000000000b3', true);
select is(public.event_preview(:'code_c') -> 'theme', 'null'::jsonb, 'evento sem tema: theme = null');
reset role;

-- ===================================================== branding: bucket e assets (EST-001)
select is((select public from storage.buckets where id = 'event-branding'), false, 'bucket event-branding é privado');
select is((select file_size_limit from storage.buckets where id = 'event-branding'), 5242880::bigint, 'limite de 5 MiB no bucket');
select is((select array_agg(m order by m) from storage.buckets b, unnest(b.allowed_mime_types) m where b.id = 'event-branding'),
  array['image/jpeg','image/png','image/webp'], 'bucket aceita só png/jpeg/webp (sem SVG)');
select is((select 'image/svg+xml' = any (allowed_mime_types) from storage.buckets where id = 'event-branding'), false, 'SVG negado no bucket');

select tests.login('00000000-0000-4000-8000-0000000000a1');
select is((public.begin_asset('20000000-0000-4000-8000-000000000a01', '10000000-0000-4000-8000-00000000000a', 'logo', 'image/png', 400, 400) ->> 'uploadStatus'), 'enviando', 'host abre envio do logo');
select is((public.begin_asset('20000000-0000-4000-8000-000000000a01', '10000000-0000-4000-8000-00000000000a', 'logo', 'image/png', 400, 400) ->> 'storagePath'),
  '10000000-0000-4000-8000-00000000000a/20000000-0000-4000-8000-000000000a01', 'begin_asset idempotente; caminho {event}/{asset}');
select throws_ok($$select public.begin_asset('20000000-0000-4000-8000-000000000a02', '10000000-0000-4000-8000-00000000000a', 'logo', 'image/svg+xml', 400, 400)$$, 'MM005', 'invalid', 'SVG recusado na RPC');
select throws_ok($$select public.begin_asset('20000000-0000-4000-8000-000000000a02', '10000000-0000-4000-8000-00000000000a', 'banner', 'image/png', 400, 400)$$, 'MM005', 'invalid', 'kind inválido');
select throws_ok($$select public.begin_asset('20000000-0000-4000-8000-000000000a02', '10000000-0000-4000-8000-00000000000a', 'cover', 'image/png', 0, 400)$$, 'MM005', 'invalid', 'dimensão inválida');
select throws_ok($$select public.begin_asset('20000000-0000-4000-8000-000000000a02', '10000000-0000-4000-8000-00000000000a', 'cover', 'image/png', 9000, 400)$$, 'MM005', 'invalid', 'dimensão acima do limite');
select throws_ok($$select public.begin_asset('20000000-0000-4000-8000-000000000a02', '10000000-0000-4000-8000-00000000000b', 'logo', 'image/png', 400, 400)$$, 'MM004', 'forbidden', 'host de A não abre asset em B');
select throws_ok($$select public.finalize_asset('20000000-0000-4000-8000-000000000a01')$$, '42501', null, 'cliente não finaliza (sem objeto no Storage): função revogada; a verificação do objeto é da Edge Function');
reset role;
select tests.login('00000000-0000-4000-8000-0000000000a2');
select throws_ok($$select public.begin_asset('20000000-0000-4000-8000-000000000a03', '10000000-0000-4000-8000-00000000000a', 'logo', 'image/png', 400, 400)$$, 'MM004', 'forbidden', 'outro host não abre asset em A');
select throws_ok($$select public.begin_asset('20000000-0000-4000-8000-000000000a01', '10000000-0000-4000-8000-00000000000a', 'logo', 'image/png', 400, 400)$$, 'MM004', 'forbidden', 'não se assume o asset de outro');
select throws_ok($$select public.finalize_asset('20000000-0000-4000-8000-000000000a01')$$, '42501', null, 'outro host não finaliza asset de A (função revogada ao cliente)');
select is((select count(*)::int from public.event_assets), 0, 'outro host não lê assets de A');
select is(public.can_upload_branding('10000000-0000-4000-8000-00000000000a/20000000-0000-4000-8000-000000000a01'), false, 'outro host não sobe no caminho de A');
reset role;
select tests.login('00000000-0000-4000-8000-0000000000b1', true);
select throws_ok($$select public.begin_asset('20000000-0000-4000-8000-000000000a04', '10000000-0000-4000-8000-00000000000a', 'logo', 'image/png', 400, 400)$$, 'MM004', 'forbidden', 'convidado não abre asset');
select is((select count(*)::int from public.event_assets), 0, 'membro não lê asset ainda em envio');
select is(public.can_read_branding('10000000-0000-4000-8000-00000000000a/20000000-0000-4000-8000-000000000a01'), false, 'membro não lê objeto não publicado');
reset role;

-- objeto com MIME errado (declarado png, subiu jpeg) e logo grande demais
select tests.fake_object('event-branding', '10000000-0000-4000-8000-00000000000a/20000000-0000-4000-8000-000000000a01', 1000, 'image/jpeg');
select tests.login('00000000-0000-4000-8000-0000000000a1');
select throws_ok($$select public.finalize_asset('20000000-0000-4000-8000-000000000a01')$$, '42501', null, 'MIME mentiroso não passa por finalize do cliente (revogado)');
reset role;
select tests.clear_branding();
select tests.fake_object('event-branding', '10000000-0000-4000-8000-00000000000a/20000000-0000-4000-8000-000000000a01', 3000000, 'image/png');
select tests.login('00000000-0000-4000-8000-0000000000a1');
select throws_ok($$select public.finalize_asset('20000000-0000-4000-8000-000000000a01')$$, '42501', null, 'logo grande não passa por finalize do cliente (revogado)');
reset role;
select tests.clear_branding();

-- Storage via policy real: só o host, só o caminho aberto, sem sobrescrever
select tests.login('00000000-0000-4000-8000-0000000000a2');
select throws_ok($$insert into storage.objects (bucket_id, name, metadata) values ('event-branding', '10000000-0000-4000-8000-00000000000a/20000000-0000-4000-8000-000000000a01', '{"size":1000,"mimetype":"image/png"}')$$,
  '42501', null, 'Storage: outro host não sobe no caminho de A');
reset role;
select tests.login('00000000-0000-4000-8000-0000000000b1', true);
select throws_ok($$insert into storage.objects (bucket_id, name, metadata) values ('event-branding', '10000000-0000-4000-8000-00000000000a/20000000-0000-4000-8000-000000000a01', '{"size":1000,"mimetype":"image/png"}')$$,
  '42501', null, 'Storage: convidado não sobe branding');
reset role;
select tests.login('00000000-0000-4000-8000-0000000000a1');
select throws_ok($$insert into storage.objects (bucket_id, name, metadata) values ('event-branding', '10000000-0000-4000-8000-00000000000a/20000000-0000-4000-8000-0000000000ff', '{"size":1000,"mimetype":"image/png"}')$$,
  '42501', null, 'Storage: caminho sem asset aberto é negado');
select lives_ok($$insert into storage.objects (bucket_id, name, metadata) values ('event-branding', '10000000-0000-4000-8000-00000000000a/20000000-0000-4000-8000-000000000a01', '{"size":1000,"mimetype":"image/png"}')$$,
  'Storage: host sobe no caminho aberto');
select throws_ok($$insert into storage.objects (bucket_id, name, metadata) values ('event-branding', '10000000-0000-4000-8000-00000000000a/20000000-0000-4000-8000-000000000a01', '{"size":1000,"mimetype":"image/png"}')$$,
  '23505', null, 'Storage: sem sobrescrever (nome já existe)');
update storage.objects set metadata = '{"size":1,"mimetype":"image/png"}' where bucket_id = 'event-branding';
select is((select (metadata ->> 'size')::int from storage.objects where bucket_id = 'event-branding'), 1000, 'Storage: sem UPDATE (ninguém altera objeto existente)');
set local role service_role;
select lives_ok($$select public.begin_asset_validation('20000000-0000-4000-8000-000000000a01', '00000000-0000-4000-8000-0000000000a1')$$, 'Edge Function trava o ativo para validar');
select lives_ok($$select public.mark_asset_validated('20000000-0000-4000-8000-000000000a01', '00000000-0000-4000-8000-0000000000a1', 200, 200, 1000, 'image/png')$$, 'validação do servidor publica o logo');
set local role authenticated;
select is((select upload_status from public.event_assets where id = '20000000-0000-4000-8000-000000000a01'), 'pronta', 'ativo publicado após validação do servidor');
select is((select bytes from public.event_assets where id = '20000000-0000-4000-8000-000000000a01'), 1000, 'bytes vêm da validação do servidor');
select throws_ok($$insert into storage.objects (bucket_id, name, metadata) values ('event-branding', '10000000-0000-4000-8000-00000000000a/20000000-0000-4000-8000-000000000a01', '{}')$$,
  '42501', null, 'Storage: depois de publicado não há mais upload no caminho');
reset role;

-- leitura (URL assinada = SELECT no objeto): host, membro, master; ninguém mais
select tests.login('00000000-0000-4000-8000-0000000000a1');
select is((select count(*)::int from storage.objects where bucket_id = 'event-branding'), 1, 'host lê o objeto de branding');
reset role;
select tests.login('00000000-0000-4000-8000-0000000000b1', true);
select is((select count(*)::int from storage.objects where bucket_id = 'event-branding'), 1, 'membro lê branding publicado');
select is((select count(*)::int from public.event_assets), 1, 'membro lê o registro do asset publicado');
reset role;
select tests.login('00000000-0000-4000-8000-0000000000c1', false, 'master');
select is((select count(*)::int from storage.objects where bucket_id = 'event-branding'), 1, 'master lê branding (quem vê o evento)');
reset role;
select tests.login('00000000-0000-4000-8000-0000000000c2', false, 'master');
select is((select count(*)::int from storage.objects where bucket_id = 'event-branding'), 0, 'master sem linha não lê branding');
reset role;
select tests.login('00000000-0000-4000-8000-0000000000a2');
select is((select count(*)::int from storage.objects where bucket_id = 'event-branding'), 0, 'IDOR: outro host não lê branding de A');
select is(public.can_delete_branding('10000000-0000-4000-8000-00000000000a/20000000-0000-4000-8000-000000000a01'), false, 'IDOR: outro host não apaga branding de A');
reset role;
select tests.login('00000000-0000-4000-8000-0000000000b3', true);
select is((select count(*)::int from storage.objects where bucket_id = 'event-branding'), 0, 'não-membro não lê branding');
reset role;
select tests.login('00000000-0000-4000-8000-0000000000a1');
select is(public.can_delete_branding('10000000-0000-4000-8000-00000000000a/20000000-0000-4000-8000-000000000a01'), true, 'host pode apagar o próprio branding');
select lives_ok($$select public.discard_asset('20000000-0000-4000-8000-000000000a01')$$, 'host descarta o asset');
reset role;
select is((select count(*)::int from public.event_assets), 0, 'registro removido');

-- limite por evento (10) e evento bloqueado
select tests.login('00000000-0000-4000-8000-0000000000a1');
select lives_ok(format($$select public.begin_asset(%L, '10000000-0000-4000-8000-00000000000a', 'cover', 'image/webp', 1200, 600)$$, ('20000000-0000-4000-8000-0000000b00' || lpad(i::text, 2, '0'))), 'envio ' || i)
  from generate_series(1, 10) i;
select throws_ok($$select public.begin_asset('20000000-0000-4000-8000-000000000b99', '10000000-0000-4000-8000-00000000000a', 'cover', 'image/webp', 1200, 600)$$, 'MM003', 'capacityfull', 'máximo de 10 assets por evento');
reset role;
delete from public.event_assets;
insert into public.events (id, title, category, host_id, host_name, duration_hours, reveal_enabled, reveal_anchor, reveal_offset_days) values
  ('10000000-0000-4000-8000-00000000000e', 'Evento E', 'formatura', '00000000-0000-4000-8000-0000000000a1', 'Emy', 6, true, 'fim', 0);
update public.events set start_at = now() - interval '7 hours' where id = '10000000-0000-4000-8000-00000000000e';
select tests.login('00000000-0000-4000-8000-0000000000a1');
select throws_ok($$select public.begin_asset('20000000-0000-4000-8000-000000000c01', '10000000-0000-4000-8000-00000000000e', 'logo', 'image/png', 400, 400)$$, 'MM008', 'revealed', 'asset bloqueado depois do bloqueio de edição');
reset role;
select is((select count(*)::int from public.event_assets where event_id = '10000000-0000-4000-8000-00000000000e'), 0, 'nenhum asset criado no evento bloqueado');
set local role anon;
select throws_ok($$select * from public.event_assets$$, '42501', null, 'anon sem acesso a event_assets');
reset role;

-- ===================================================== foto privada: acesso excepcional (MAD-004)
select tests.login('00000000-0000-4000-8000-0000000000b1', true);
select public.begin_photo('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-00000000000a', 'Brinde');
reset role;
select tests.fake_object('event-photos', '10000000-0000-4000-8000-00000000000a/30000000-0000-4000-8000-000000000001');
select tests.login('00000000-0000-4000-8000-0000000000b1', true);
select public.finalize_photo('30000000-0000-4000-8000-000000000001');
reset role;

select tests.login('00000000-0000-4000-8000-0000000000c1', false, 'master');
select is((select count(*)::int from public.photos), 0, 'master não lê fotos por padrão');
select is((select count(*)::int from storage.objects where bucket_id = 'event-photos'), 0, 'master sem justificativa não consegue ler/assinar o objeto');
select is(public.can_read_object('10000000-0000-4000-8000-00000000000a/30000000-0000-4000-8000-000000000001'), false, 'can_read_object nega ao master');
select is(public.can_see_photo('30000000-0000-4000-8000-000000000001'), false, 'can_see_photo nega ao master');
select throws_ok($$select public.admin_request_photo_access('30000000-0000-4000-8000-000000000001', 'curto')$$, 'MM011', 'reasonrequired', 'justificativa < 10 caracteres é recusada');
select throws_ok($$select public.admin_request_photo_access('30000000-0000-4000-8000-000000000001', null)$$, 'MM011', 'reasonrequired', 'sem justificativa é recusada');
select throws_ok($$select public.admin_request_photo_access('30000000-0000-4000-8000-0000000000ff', 'foto que não existe aqui')$$, 'MM005', 'invalid', 'foto inexistente');
select is((select count(*)::int from public.audit_logs where action = 'photo.access_requested'), 0, 'tentativas recusadas não geram acesso nem auditoria falsa');
select is((public.admin_request_photo_access('30000000-0000-4000-8000-000000000001', 'denúncia #123 de conteúdo impróprio') ->> 'storagePath'),
  '10000000-0000-4000-8000-00000000000a/30000000-0000-4000-8000-000000000001', 'com justificativa devolve o caminho para assinatura');
select is((public.admin_request_photo_access('30000000-0000-4000-8000-000000000001', 'denúncia #123 de conteúdo impróprio') ->> 'expiresInSeconds')::int, 60, 'validade de 60 s');
select is((select count(*)::int from storage.objects where bucket_id = 'event-photos'), 0, 'mesmo após a RPC o master não tem policy de leitura no Storage');
reset role;
select is((select count(*)::int from public.audit_logs where action = 'photo.access_requested' and target_id = '30000000-0000-4000-8000-000000000001'
           and event_id = '10000000-0000-4000-8000-00000000000a' and actor_role = 'master' and reason like 'denúncia%'), 2, 'auditoria gravada com evento, alvo, papel e motivo');
select tests.login('00000000-0000-4000-8000-0000000000a1');
select is((select count(*)::int from public.audit_logs where action = 'photo.access_requested'), 2, 'o organizador enxerga o acesso do master ao próprio evento');
select throws_ok($$select public.admin_request_photo_access('30000000-0000-4000-8000-000000000001', 'sou o host e quero assinar')$$, 'MM004', 'forbidden', 'host não usa a RPC administrativa');
reset role;
select tests.login('00000000-0000-4000-8000-0000000000a2');
select is((select count(*)::int from public.audit_logs where action = 'photo.access_requested'), 0, 'outro host não vê auditoria de A');
reset role;
select tests.login('00000000-0000-4000-8000-0000000000c2', false, 'master');
select throws_ok($$select public.admin_request_photo_access('30000000-0000-4000-8000-000000000001', 'claim sem linha ativa tentando')$$, 'MM004', 'forbidden', 'master sem linha não acessa foto');
reset role;
select tests.login('00000000-0000-4000-8000-0000000000d1', false, 'support');
select throws_ok($$select public.admin_request_photo_access('30000000-0000-4000-8000-000000000001', 'support não acessa foto privada')$$, 'MM004', 'forbidden', 'support não acessa foto');
reset role;
select tests.login('00000000-0000-4000-8000-0000000000e1', false, 'auditor');
select throws_ok($$select public.admin_request_photo_access('30000000-0000-4000-8000-000000000001', 'auditor não acessa foto privada')$$, 'MM004', 'forbidden', 'auditor não acessa foto');
reset role;

-- ===================================================== settings e feature flags (SCV-001)
select tests.login('00000000-0000-4000-8000-0000000000c1', false, 'master');
select throws_ok($$select public.admin_set_setting('limites.fotos', '{"max":100}', 'curto')$$, 'MM011', 'reasonrequired', 'setting exige justificativa');
select lives_ok($$select public.admin_set_setting('limites.fotos', '{"max":100}', 'ajuste do limite padrão de fotos')$$, 'master grava setting');
select lives_ok($$select public.admin_set_setting('limites.fotos', '{"max":200}', 'aumento após análise de uso')$$, 'master atualiza setting');
select lives_ok($$select public.admin_set_feature_flag('studio.v2', true, '{"percent":50}', 'liberação gradual do studio')$$, 'master liga flag');
select lives_ok($$select public.admin_set_feature_flag('master.experimental', false, '{}', 'flag desligada para testes')$$, 'master cria flag desligada');
select throws_ok($$select public.admin_set_feature_flag('Chave Inválida', true, '{}', 'chave com espaços e maiúsculas')$$, '23514', null, 'chave fora do formato');
select throws_ok($$select public.admin_set_feature_flag('x.y', true, '[1]', 'rollout precisa ser objeto')$$, '23514', null, 'rollout não-objeto recusado');
select throws_ok($$insert into public.platform_settings (key, value) values ('a.b', '1')$$, '42501', null, 'master não escreve setting direto (só RPC auditada)');
select is((select count(*)::int from public.platform_settings), 1, 'master lê settings');
select is((select count(*)::int from public.feature_flags), 2, 'master lê todas as flags');
reset role;
select is((select count(*)::int from public.audit_logs where action in ('platform_settings.insert', 'platform_settings.update', 'feature_flags.insert') and reason is not null and actor_role = 'master'), 4, 'escritas de setting/flag auditadas com motivo');
select is((select detail ->> 'value_bytes' from public.audit_logs where action = 'platform_settings.update'), '12', 'log guarda só o tamanho do valor (não o conteúdo)');
select tests.login('00000000-0000-4000-8000-0000000000b1', true);
select is((select array_agg(key) from public.get_enabled_flags()), array['studio.v2'], 'convidado/authenticated lê só as flags habilitadas pela RPC (key+enabled)');
select is((select count(*)::int from public.feature_flags), 0, 'authenticated comum não lê a tabela de flags (rollout é só do staff)');
select is((select count(*)::int from public.platform_settings), 0, 'authenticated comum não lê platform_settings');
select throws_ok($$insert into public.feature_flags (key, enabled) values ('hack', true)$$, '42501', null, 'authenticated não escreve flag');
select throws_ok($$update public.feature_flags set enabled = false$$, '42501', null, 'authenticated não altera flag');
select throws_ok($$select public.admin_set_feature_flag('studio.v2', false, '{}', 'convidado tentando desligar')$$, 'MM004', 'forbidden', 'convidado não usa RPC de flags');
reset role;
select tests.login('00000000-0000-4000-8000-0000000000d1', false, 'support');
select is((select count(*)::int from public.platform_settings), 1, 'support lê settings (somente leitura)');
select throws_ok($$select public.admin_set_setting('limites.fotos', '{"max":1}', 'support não altera configurações')$$, 'MM004', 'forbidden', 'support não altera settings');
select throws_ok($$select public.admin_set_feature_flag('studio.v2', false, '{}', 'support não altera flags aqui')$$, 'MM004', 'forbidden', 'support não altera flags');
reset role;
select tests.login('00000000-0000-4000-8000-0000000000e1', false, 'auditor');
select throws_ok($$select public.admin_set_setting('limites.fotos', '{"max":1}', 'auditor não altera configurações')$$, 'MM004', 'forbidden', 'auditor não altera settings');
reset role;
select tests.login('00000000-0000-4000-8000-0000000000c2', false, 'master');
select throws_ok($$select public.admin_set_setting('limites.fotos', '{"max":1}', 'claim sem linha tentando gravar')$$, 'MM004', 'forbidden', 'master sem linha não altera settings');
select is((select count(*)::int from public.feature_flags), 0, 'master sem linha não lê a tabela de flags');
select is((select count(*)::int from public.get_enabled_flags()), 1, 'master sem linha só vê as habilitadas pela RPC');
reset role;
-- caminho de operador (service_role) também é auditado
set local role service_role;
insert into public.feature_flags (key, enabled) values ('ops.manual', true);
reset role;
select is((select actor_role from public.audit_logs where action = 'feature_flags.insert' and target_id = 'ops.manual'), 'operador', 'escrita via service_role é auditada como operador');
set local role anon;
select throws_ok($$select * from public.feature_flags$$, '42501', null, 'anon sem acesso a flags');
reset role;

-- ===================================================== analytics (ANL-001) com dados reais
-- cenário: A (a1, 1 membro, 1 foto pronta), B (a2), C (a2, sem tema), E (a1, revelação vencida)
insert into public.photos (id, event_id, author_id, author_name, storage_path, upload_status, created_at)
  values ('30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000b1', 'Bia',
          '10000000-0000-4000-8000-00000000000a/30000000-0000-4000-8000-000000000002', 'falhou', now());
insert into public.photos (id, event_id, author_id, author_name, storage_path, upload_status, created_at)
  values ('30000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000b1', 'Bia',
          '10000000-0000-4000-8000-00000000000a/30000000-0000-4000-8000-000000000003', 'enviando', now());
update public.photos set created_at = now() - interval '2 hours' where id = '30000000-0000-4000-8000-000000000003'; -- 'enviando' parado
select tests.fake_object('event-photos', '10000000-0000-4000-8000-00000000000a/30000000-0000-4000-8000-000000000009', 4000);
select tests.fake_object('event-branding', '10000000-0000-4000-8000-00000000000a/20000000-0000-4000-8000-0000000000aa', 700, 'image/png');

select tests.login('00000000-0000-4000-8000-0000000000e1', false, 'auditor');
select is((public.admin_dashboard_metrics(now() - interval '30 days', now() + interval '1 minute') #>> '{events,total}')::int, 4, 'auditor lê métricas: 4 eventos não apagados (A,B,C,E)');
select is((public.admin_dashboard_metrics(now() - interval '30 days', now() + interval '1 minute') #>> '{events,created}')::int, 4, 'eventos criados no período');
select is((public.admin_dashboard_metrics(now() - interval '30 days', now() + interval '1 minute') #>> '{events,active}')::int, 3, 'eventos ativos');
select is((public.admin_dashboard_metrics(now() - interval '30 days', now() + interval '1 minute') #>> '{events,ended}')::int, 1, 'eventos encerrados (E começou há 7 h, duração 6 h)');
select is((public.admin_dashboard_metrics(now() - interval '30 days', now() + interval '1 minute') #>> '{organizers,total}')::int, 2, 'organizadores com evento');
select is((public.admin_dashboard_metrics(now() - interval '30 days', now() + interval '1 minute') #>> '{participants,joined}')::int, 1, 'participantes');
select is((public.admin_dashboard_metrics(now() - interval '30 days', now() + interval '1 minute') #>> '{photos,uploaded}')::int, 1, 'fotos enviadas (prontas)');
select is((public.admin_dashboard_metrics(now() - interval '30 days', now() + interval '1 minute') #>> '{uploads,failed}')::int, 2, 'uploads com falha = falhou + enviando parado há > 1 h');
select is((public.admin_dashboard_metrics(now() - interval '30 days', now() + interval '1 minute') #>> '{reveals,pending}')::int, 1, 'revelações pendentes (E)');
select is((public.admin_dashboard_metrics(now() - interval '30 days', now() + interval '1 minute') #>> '{reveals,overdue}')::int, 1, 'revelações atrasadas (E: reveal_at < now e sem revealed_at)');
select is((public.admin_dashboard_metrics(now() - interval '30 days', now() + interval '1 minute') #>> '{storage,photosBytes}')::bigint, 5000::bigint, 'bytes reais em event-photos (1000 + 4000)');
select is((public.admin_dashboard_metrics(now() - interval '30 days', now() + interval '1 minute') #>> '{storage,brandingBytes}')::bigint, 1700::bigint, 'bytes reais em event-branding (700 + 1000 de um objeto órfão do teste de descarte)');
select is((select sum((d ->> 'eventsCreated')::int)::int from jsonb_array_elements(public.admin_dashboard_metrics(now() - interval '30 days', now() + interval '1 minute') -> 'series') d), 4, 'série diária soma o total do período');
select is((select sum((d ->> 'photosUploaded')::int)::int from jsonb_array_elements(public.admin_dashboard_metrics(now() - interval '30 days', now() + interval '1 minute') -> 'series') d), 1, 'série de fotos');
select is(jsonb_array_length(public.admin_dashboard_metrics(now() - interval '6 days', now()) -> 'series'), 7, 'série cobre cada dia do período');
select is((public.admin_dashboard_metrics(now() + interval '1 day', now() + interval '3 days') #>> '{events,created}')::int, 0, 'período futuro devolve zeros');
select throws_ok($$select public.admin_dashboard_metrics(now(), now() - interval '1 day')$$, 'MM005', 'invalid', 'período invertido recusado');
select throws_ok($$select public.admin_dashboard_metrics(now() - interval '400 days', now())$$, 'MM005', 'invalid', 'período > 366 dias recusado');
select is((public.admin_list_events() ->> 'total')::int, 4, 'lista de eventos: total');
select is(jsonb_array_length(public.admin_list_events(2, 0) -> 'items'), 2, 'paginação: limite 2');
select is(jsonb_array_length(public.admin_list_events(2, 3) -> 'items'), 1, 'paginação: última página');
select is(jsonb_array_length(public.admin_list_events(2, 10) -> 'items'), 0, 'paginação: além do fim é vazio, total preservado');
select is((public.admin_list_events(1000, 0) ->> 'limit')::int, 100, 'limite máximo 100');
select is((public.admin_list_events(25, 0, 'evento a') ->> 'total')::int, 1, 'busca por título');
select is((public.admin_list_events(25, 0, '%') ->> 'total')::int, 0, 'busca trata % como literal');
select is((public.admin_list_events(25, 0, null, 'encerrado') ->> 'total')::int, 1, 'filtro por status');
select is((select array_agg(k order by k) from jsonb_object_keys((public.admin_list_events(1, 0) -> 'items') -> 0) k),
  array['capacity','category','createdAt','deletedAt','endAt','failedUploads','hostId','hostName','id','participants','photos','revealAt','revealEnabled','revealState','startAt','status','title'],
  'lista de eventos: sem código de convite, sem caminhos, sem legendas');
select is((select (i ->> 'revealState') from jsonb_array_elements(public.admin_list_events(25, 0, 'Evento E') -> 'items') i), 'atrasada', 'revelação atrasada exposta na lista');
select is(public.admin_list_organizers() ->> 'total', '2', 'lista de organizadores: total');
select is(public.admin_list_organizers(25, 0, 'emy@test') ->> 'total', '0', 'auditor NÃO busca por e-mail (impede reconstruir e-mail mascarado por prefixo)');
select is((select i ->> 'email' from jsonb_array_elements(public.admin_list_organizers(25, 0) -> 'items') i where i ->> 'email' like 'e***%' limit 1), 'e***@test.local', 'auditor vê e-mail mascarado');
select is((select (i ->> 'eventsCount')::int from jsonb_array_elements(public.admin_list_organizers(25, 0) -> 'items') i where i ->> 'email' like 'e***%' limit 1), 2, 'contagem de eventos não apagados do organizador (A e E)');
select throws_ok($$select public.admin_list_events(10, 0, null, 'revelado')$$, 'MM005', 'invalid', 'status inválido recusado');
reset role;
select tests.login('00000000-0000-4000-8000-0000000000c1', false, 'master');
select is((select i ->> 'email' from jsonb_array_elements(public.admin_list_organizers(25, 0, 'emy') -> 'items') i), 'emy@test.local', 'master vê o e-mail completo');
reset role;
select tests.login('00000000-0000-4000-8000-0000000000a1');
select throws_ok($$select public.admin_dashboard_metrics()$$, 'MM004', 'forbidden', 'host não lê métricas');
select throws_ok($$select public.admin_list_events()$$, 'MM004', 'forbidden', 'host não lista eventos de todos');
select throws_ok($$select public.admin_list_organizers()$$, 'MM004', 'forbidden', 'host não lista organizadores');
select throws_ok($$select public.admin_lgpd_requests()$$, 'MM004', 'forbidden', 'host não lê pedidos LGPD');
select throws_ok($$select public.admin_health()$$, 'MM004', 'forbidden', 'host não lê saúde');
reset role;
select tests.login('00000000-0000-4000-8000-0000000000c2', false, 'master');
select throws_ok($$select public.admin_dashboard_metrics()$$, 'MM004', 'forbidden', 'master sem linha não lê métricas');
reset role;
set local role anon;
select throws_ok($$select public.admin_dashboard_metrics()$$, '42501', null, 'anon não executa métricas');
select throws_ok($$select public.admin_health()$$, '42501', null, 'anon não executa admin_health');
select throws_ok($$select public.admin_request_photo_access('30000000-0000-4000-8000-000000000001', 'anon tentando acessar foto')$$, '42501', null, 'anon não executa acesso a foto');
select throws_ok($$select public.admin_log('x.y.z', 'a', 'b', 'anon tentando auditar')$$, '42501', null, 'anon não executa admin_log');
reset role;

-- ===================================================== LGPD e saúde
select tests.login('00000000-0000-4000-8000-0000000000b1', true);
select lives_ok($$select public.request_account_deletion()$$, 'convidado pede exclusão da conta (v1)');
reset role;
select tests.login('00000000-0000-4000-8000-0000000000e1', false, 'auditor');
select is((public.admin_lgpd_requests() #>> '{summary,pending}')::int, 1, 'LGPD: 1 pedido pendente');
select is((public.admin_lgpd_requests() #>> '{summary,overdue}')::int, 0, 'LGPD: nenhum atrasado');
select is((public.admin_lgpd_requests() -> 'items' -> 0 ->> 'status'), 'pendente', 'LGPD: status do pedido');
reset role;
update public.account_deletion_requests set requested_at = now() - interval '20 days';
select tests.login('00000000-0000-4000-8000-0000000000d1', false, 'support');
select is((public.admin_lgpd_requests() #>> '{summary,overdue}')::int, 1, 'LGPD: pedido além de 15 dias é sinalizado');
select is((public.admin_lgpd_requests() -> 'items' -> 0 ->> 'daysOpen')::int, 20, 'LGPD: dias em aberto');
select is((public.admin_health() #>> '{reveals,overdue}')::int, 1, 'saúde: revelação atrasada');
select cmp_ok((public.admin_health() #>> '{reveals,maxDelaySeconds}')::bigint, '>', 3000::bigint, 'saúde: atraso máximo em segundos');
select is((public.admin_health() #>> '{uploads,stalled}')::int, 1, 'saúde: envio parado');
select is((public.admin_health() #>> '{purgeQueue,size}')::int >= 0, true, 'saúde: fila de limpeza');
select is((public.admin_health() ->> 'cronAvailable')::boolean, true, 'saúde: pg_cron disponível');
select is(jsonb_array_length(public.admin_health() -> 'jobs'), 4, 'saúde: os 4 jobs mm-* agendados');
select is((select array_agg(j ->> 'name' order by j ->> 'name') from jsonb_array_elements(public.admin_health() -> 'jobs') j), array['mm-expire-assets', 'mm-expire-uploads', 'mm-purge-deleted', 'mm-reveal-due'], 'saúde: nomes dos jobs');
reset role;

-- ===================================================== listagens do console (usuários, participantes, convites, auditoria)
select tests.login('00000000-0000-4000-8000-0000000000e1', false, 'auditor');
select cmp_ok((public.admin_list_users() ->> 'total')::int, '>=', 1, 'auditor lista usuários');
select is((select bool_and(i ->> 'email' is null or i ->> 'email' ~ '\*\*\*@') from jsonb_array_elements(public.admin_list_users() -> 'items') i), true, 'auditor só vê e-mail mascarado');
select is((select count(*)::int from jsonb_array_elements(public.admin_list_users() -> 'items') i where i ? 'phone' or i ? 'metadata'), 0, 'usuários sem telefone nem metadata');
select cmp_ok((public.admin_list_participants() ->> 'total')::int, '>=', 1, 'auditor lista participantes');
select is((select count(*)::int from jsonb_array_elements(public.admin_list_invites() -> 'items') i where i ? 'tokenHash' or i ? 'token' or i ? 'token_hash'), 0, 'convites nunca expõem o token nem o hash');
select cmp_ok((public.admin_list_audit(10, 0) ->> 'total')::int, '>=', 1, 'auditor lê a auditoria');
select is(jsonb_array_length(public.admin_list_audit(3, 0) -> 'items') <= 3, true, 'paginação limitada');
reset role;
select tests.login('00000000-0000-4000-8000-0000000000c1', false, 'master');
select is((select count(*)::int from jsonb_array_elements(public.admin_list_users() -> 'items') i where i ->> 'email' = 'emy@test.local'), 1, 'master vê o e-mail completo');
reset role;
select tests.login('00000000-0000-4000-8000-0000000000a1');
select throws_ok($$select public.admin_list_users()$$, 'MM004', 'forbidden', 'host não lista usuários');
select throws_ok($$select public.admin_list_participants()$$, 'MM004', 'forbidden', 'host não lista participantes');
select throws_ok($$select public.admin_list_invites()$$, 'MM004', 'forbidden', 'host não lista convites');
select throws_ok($$select public.admin_list_audit()$$, 'MM004', 'forbidden', 'host não lê a auditoria');
reset role;
select tests.login('00000000-0000-4000-8000-0000000000c2', false, 'master');
select throws_ok($$select public.admin_list_users()$$, 'MM004', 'forbidden', 'claim master sem linha ativa é negada');
reset role;
select tests.login('00000000-0000-4000-8000-0000000000b1', true);
select throws_ok($$select public.admin_list_audit()$$, 'MM004', 'forbidden', 'convidado anônimo não lê a auditoria');
reset role;

-- ===================================================== endurecimento (revisão A4) — NÃO VALIDADO em banco nesta sessão
select is((select count(*)::int from pg_trigger where tgrelid = 'public.audit_logs'::regclass and tgname like 'audit_logs_no_%' and tgenabled = 'A'), 3, 'triggers de imutabilidade da auditoria valem sempre (ENABLE ALWAYS)');
select is(has_table_privilege('service_role', 'public.audit_logs', 'UPDATE') or has_table_privilege('service_role', 'public.audit_logs', 'DELETE') or has_table_privilege('service_role', 'public.audit_logs', 'TRUNCATE'), false, 'service_role não altera nem apaga a auditoria');
select has_column('public', 'storage_purge_queue', 'bucket', 'fila de purga conhece o bucket');
select is(has_function_privilege('authenticated', 'public.expire_pending_assets()', 'EXECUTE'), false, 'expiração de assets não é chamável pelo cliente');

-- ===================================================== validação real de logo/capa (migration 0800)
select is(has_function_privilege('authenticated', 'public.mark_asset_validated(uuid, uuid, int, int, int, text)', 'EXECUTE'), false, 'cliente não confirma ativo (só a Edge Function / service_role)');
select is(has_function_privilege('anon', 'public.mark_asset_validated(uuid, uuid, int, int, int, text)', 'EXECUTE'), false, 'anon não confirma ativo');
select is(has_function_privilege('service_role', 'public.mark_asset_validated(uuid, uuid, int, int, int, text)', 'EXECUTE'), true, 'service_role confirma ativo');
select is(has_function_privilege('authenticated', 'public.finalize_asset(uuid)', 'EXECUTE'), false, 'finalize_asset não é mais chamável pelo cliente');

-- mark_asset_validated / begin_asset_validation (chamadas só pela Edge Function): regras do servidor, sem confiar no cliente
reset role;
insert into public.event_assets (id, event_id, kind, storage_path, mime, width, height, created_by)
values ('20000000-0000-4000-8000-000000000b01', '10000000-0000-4000-8000-00000000000a', 'logo', '10000000-0000-4000-8000-00000000000a/20000000-0000-4000-8000-000000000b01', 'image/png', 200, 200, '00000000-0000-4000-8000-0000000000a1');
select tests.fake_object('event-branding', '10000000-0000-4000-8000-00000000000a/20000000-0000-4000-8000-000000000b01', 5000, 'image/webp');
set local role service_role;
select throws_ok($$select public.mark_asset_validated('20000000-0000-4000-8000-000000000b01', '00000000-0000-4000-8000-0000000000a1', 320, 240, 5000, 'image/webp')$$, 'MM005', 'invalid', 'sem a trava de validação o ativo não é confirmado');
select throws_ok($$select public.begin_asset_validation('20000000-0000-4000-8000-000000000b01', '00000000-0000-4000-8000-0000000000a2')$$, 'MM004', 'forbidden', 'trava em nome de outro host é recusada');
select throws_ok($$select public.mark_asset_validated('20000000-0000-4000-8000-000000000b01', '00000000-0000-4000-8000-0000000000a2', 200, 200, 1000, 'image/png')$$, 'MM004', 'forbidden', 'validação em nome de outro host é recusada');
select is(public.begin_asset_validation('20000000-0000-4000-8000-000000000b01', '00000000-0000-4000-8000-0000000000a1'), true, 'Edge Function trava o ativo');
select throws_ok($$select public.begin_asset_validation('20000000-0000-4000-8000-000000000b01', '00000000-0000-4000-8000-0000000000a1')$$, 'MM009', 'busy', 'segunda validação concorrente é recusada (busy)');
-- TOCTOU: durante a validação o host não troca nem apaga o objeto
reset role;
select tests.login('00000000-0000-4000-8000-0000000000a1');
select is(public.can_upload_branding('10000000-0000-4000-8000-00000000000a/20000000-0000-4000-8000-000000000b01'), false, 'durante a validação o host não insere objeto no caminho');
select is(public.can_delete_branding('10000000-0000-4000-8000-00000000000a/20000000-0000-4000-8000-000000000b01'), false, 'durante a validação o host não apaga o objeto');
reset role;
set local role service_role;
select throws_ok($$select public.mark_asset_validated('20000000-0000-4000-8000-000000000b01', '00000000-0000-4000-8000-0000000000a1', 200, 200, 1000, 'image/gif')$$, 'MM005', 'invalid', 'tipo fora da lista é recusado (gif)');
select throws_ok($$select public.mark_asset_validated('20000000-0000-4000-8000-000000000b01', '00000000-0000-4000-8000-0000000000a1', 200, 200, 2097153, 'image/webp')$$, 'MM005', 'invalid', 'logo acima de 2 MiB é recusado');
select throws_ok($$select public.mark_asset_validated('20000000-0000-4000-8000-000000000b01', '00000000-0000-4000-8000-0000000000a1', 8, 200, 5000, 'image/webp')$$, 'MM005', 'invalid', 'dimensão real fora de 16–8192 é recusada');
select throws_ok($$select public.mark_asset_validated('20000000-0000-4000-8000-000000000b01', '00000000-0000-4000-8000-0000000000a1', 320, 240, 4999, 'image/webp')$$, 'MM005', 'invalid', 'tamanho validado diferente do objeto real no Storage é recusado (objeto trocado)');
select throws_ok($$select public.mark_asset_validated('20000000-0000-4000-8000-000000000b01', '00000000-0000-4000-8000-0000000000a1', 320, 240, 5000, 'image/png')$$, 'MM005', 'invalid', 'tipo validado diferente do Content-Type armazenado é recusado');
select lives_ok($$select public.mark_asset_validated('20000000-0000-4000-8000-000000000b01', '00000000-0000-4000-8000-0000000000a1', 320, 240, 5000, 'image/webp')$$, 'validação correta publica o ativo');
select is((select upload_status || ':' || width || 'x' || height || ':' || mime from public.event_assets where id = '20000000-0000-4000-8000-000000000b01'), 'pronta:320x240:image/webp', 'dimensões e tipo gravados são os REAIS, não os declarados');
select is((select validating_at is null from public.event_assets where id = '20000000-0000-4000-8000-000000000b01'), true, 'trava liberada após publicar');
select is((select count(*)::int from public.audit_logs where action = 'asset.published' and target_id = '20000000-0000-4000-8000-000000000b01' and (detail ->> 'validated')::boolean), 1, 'publicação validada auditada');
select lives_ok($$select public.mark_asset_validated('20000000-0000-4000-8000-000000000b01', '00000000-0000-4000-8000-0000000000a1', 320, 240, 5000, 'image/webp')$$, 'confirmar de novo é idempotente');
reset role;

select is(has_function_privilege('authenticated', 'public.begin_asset_validation(uuid, uuid)', 'EXECUTE'), false, 'cliente não trava ativo para validação');
select is(has_function_privilege('service_role', 'public.begin_asset_validation(uuid, uuid)', 'EXECUTE'), true, 'service_role trava ativo para validação');

select * from finish();
rollback;
