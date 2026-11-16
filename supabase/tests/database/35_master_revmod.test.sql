-- pgTAP · Master: Moderação com motivos (M26), Storage e saúde (M27) e Auditoria com filtros (M28).
-- Fila de moderação sem URL de foto nem denunciante; moderar foto só pelo master e com motivo de 10 a 500 caracteres; auditoria por categoria e por evento
-- com o e-mail do autor mascarado no servidor para o auditor; exportação filtrada; storage com os campos novos.
begin;
select no_plan();

create schema tests;
create function tests.login(p_user uuid, p_role text default null, p_aal text default 'aal2') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated', 'is_anonymous', false, 'aal', p_aal,
    'app_metadata', case when p_role is not null then json_build_object('role', p_role) else '{}'::json end)::text, true);
  set local role authenticated;
end $$;
create function tests.q(p_sql text) returns text language plpgsql security definer as $$
declare r text; begin execute p_sql into r; return r; end $$;
grant usage on schema tests to authenticated;
grant execute on function tests.q(text) to authenticated;

insert into auth.users (id, aud, role, email, is_anonymous) values
  ('00000000-0000-4000-8000-000000003501', 'authenticated', 'authenticated', 'master35@dominio.test', false),
  ('00000000-0000-4000-8000-000000003502', 'authenticated', 'authenticated', 'support35@dominio.test', false),
  ('00000000-0000-4000-8000-000000003503', 'authenticated', 'authenticated', 'auditor35@dominio.test', false),
  ('00000000-0000-4000-8000-000000003504', 'authenticated', 'authenticated', 'semrole35@dominio.test', false),
  ('00000000-0000-4000-8000-000000003505', 'authenticated', 'authenticated', 'ana35@dominio.test', false),
  ('00000000-0000-4000-8000-000000003506', 'authenticated', 'authenticated', 'denuncia35@dominio.test', false),
  ('00000000-0000-4000-8000-000000003507', 'authenticated', 'authenticated', 'outra35@dominio.test', false);
insert into public.profiles (id, display_name) select id, split_part(email, '@', 1) from auth.users where email like '%35@dominio.test' on conflict do nothing;
insert into public.platform_roles (user_id, role) values
  ('00000000-0000-4000-8000-000000003501', 'master'), ('00000000-0000-4000-8000-000000003502', 'support'), ('00000000-0000-4000-8000-000000003503', 'auditor');
insert into public.events (id, title, category, host_id, host_name, duration_hours, capacity, shots_per_person, reveal_enabled, reveal_anchor) values
  ('00000000-0000-4000-8000-0000000035e1', 'Evento 35', 'casamento', '00000000-0000-4000-8000-000000003505', 'Ana 35', 6, 20, 10, false, 'fim'),
  ('00000000-0000-4000-8000-0000000035e2', 'Outro 35', 'outro', '00000000-0000-4000-8000-000000003505', 'Ana 35', 6, 20, 10, false, 'fim');
insert into public.participants (event_id, user_id, name) values
  ('00000000-0000-4000-8000-0000000035e1', '00000000-0000-4000-8000-000000003506', 'Denunciante 35'),
  ('00000000-0000-4000-8000-0000000035e1', '00000000-0000-4000-8000-000000003507', 'Outra 35');
insert into public.photos (id, event_id, author_id, author_name, storage_path, upload_status) values
  ('00000000-0000-4000-8000-0000000035f1', '00000000-0000-4000-8000-0000000035e1', '00000000-0000-4000-8000-000000003505', 'Ana 35',
   '00000000-0000-4000-8000-0000000035e1/00000000-0000-4000-8000-0000000035f1', 'pronta'),
  ('00000000-0000-4000-8000-0000000035f2', '00000000-0000-4000-8000-0000000035e1', '00000000-0000-4000-8000-000000003505', 'Ana 35',
   '00000000-0000-4000-8000-0000000035e1/00000000-0000-4000-8000-0000000035f2', 'pronta'),
  ('00000000-0000-4000-8000-0000000035f3', '00000000-0000-4000-8000-0000000035e1', '00000000-0000-4000-8000-000000003505', 'Ana 35',
   '00000000-0000-4000-8000-0000000035e1/00000000-0000-4000-8000-0000000035f3', 'enviando');

-- denúncias de foto com motivo
select tests.login('00000000-0000-4000-8000-000000003506');
select lives_ok($$select public.report_photo('00000000-0000-4000-8000-0000000035f1', 'improprio')$$, 'denúncia 1');
select lives_ok($$select public.report_photo('00000000-0000-4000-8000-0000000035f2', 'outro')$$, 'denúncia 2');
reset role;
select tests.login('00000000-0000-4000-8000-000000003507');
select lives_ok($$select public.report_photo('00000000-0000-4000-8000-0000000035f1', 'improprio')$$, 'denúncia 3');
reset role;

-- ===================================================================== fila de moderação: sem URL de foto nem denunciante
select tests.login('00000000-0000-4000-8000-000000003501', 'master');
select is(jsonb_array_length(public.admin_moderation_queue() -> 'photos'), 2, 'master: duas fotos na fila');
select is((public.admin_moderation_queue() -> 'photos' -> 0 -> 'reasons'), '{"improprio": 2}'::jsonb, 'motivos agregados (2 Conteúdo impróprio)');
select is((select array_agg(k order by k) from jsonb_object_keys(public.admin_moderation_queue() -> 'photos' -> 0) k),
          array['eventId', 'eventTitle', 'hidden', 'photoId', 'reasons', 'reports'], 'a foto na fila tem só id, evento, total, situação e motivos');
select ok(public.admin_moderation_queue()::text !~* '(storage_path|storagePath|signed|https?:|\.thumb|user_id|userId|reporter|denunciante|/event-photos)',
          'a fila não traz caminho nem URL de foto nem quem denunciou');
select ok(public.admin_moderation_queue()::text !~* '(denuncia35|outra35|003506|003507)', 'nem o e-mail nem o id de quem denunciou aparecem');
reset role;
select tests.login('00000000-0000-4000-8000-000000003502', 'support');
select ok(public.admin_moderation_queue()::text !~* '(storage_path|signed|https?:|user_id|userId|reporter|denuncia35|outra35|003506|003507)', 'support: a mesma fila, sem URL nem denunciante');
reset role;

-- ===================================================================== moderar foto: só master, motivo de 10 a 500
select tests.login('00000000-0000-4000-8000-000000003502', 'support');
select throws_ok($$select public.admin_moderate_photo('00000000-0000-4000-8000-0000000035f1', 'esconder', 'Motivo longo o bastante')$$, 'MM004', null, 'support não modera foto');
reset role;
select tests.login('00000000-0000-4000-8000-000000003503', 'auditor');
select throws_ok($$select public.admin_moderate_photo('00000000-0000-4000-8000-0000000035f1', 'esconder', 'Motivo longo o bastante')$$, 'MM004', null, 'auditor não modera foto');
reset role;
select tests.login('00000000-0000-4000-8000-000000003504');
select throws_ok($$select public.admin_moderate_photo('00000000-0000-4000-8000-0000000035f1', 'esconder', 'Motivo longo o bastante')$$, 'MM004', null, 'sem papel não modera foto');
reset role;
select tests.login('00000000-0000-4000-8000-000000003501', 'master');
select throws_ok($$select public.admin_moderate_photo('00000000-0000-4000-8000-0000000035f1', 'esconder', 'curto')$$, 'MM011', null, 'motivo com menos de 10 caracteres é recusado no servidor');
select throws_ok($$select public.admin_moderate_photo('00000000-0000-4000-8000-0000000035f1', 'esconder', '          x          ')$$, 'MM011', null, 'espaços não contam');
select throws_ok($$select public.admin_moderate_photo('00000000-0000-4000-8000-0000000035f1', 'esconder', repeat('a', 501))$$, 'MM011', null, 'motivo com mais de 500 caracteres é recusado');
select throws_ok($$select public.admin_moderate_photo('00000000-0000-4000-8000-0000000035f1', 'apagar', 'Motivo longo o bastante')$$, 'MM005', null, 'ação fora da lista');
select throws_ok($$select public.admin_moderate_photo('00000000-0000-4000-8000-0000000035ff', 'esconder', 'Motivo longo o bastante')$$, 'MM005', null, 'foto que não existe');
select is(tests.q($q$select status::text from public.photos where id = '00000000-0000-4000-8000-0000000035f1'$q$), 'visivel', 'recusas não mudam a foto');
select lives_ok($$select public.admin_moderate_photo('00000000-0000-4000-8000-0000000035f1', 'esconder', repeat('a', 500))$$, 'motivo de 500 caracteres vale');
select is(tests.q($q$select status::text from public.photos where id = '00000000-0000-4000-8000-0000000035f1'$q$), 'oculta', 'esconder: status oculta');
select is(tests.q($q$select reason from public.audit_logs where action = 'photo.hidden' and target_id = '00000000-0000-4000-8000-0000000035f1'$q$), repeat('a', 500), 'auditoria photo.hidden com o motivo');
select is(tests.q($q$select actor_role from public.audit_logs where action = 'photo.hidden' and target_id = '00000000-0000-4000-8000-0000000035f1'$q$), 'master', 'e o papel do autor');
select is((public.admin_moderation_queue() -> 'photos' -> 0 ->> 'hidden')::boolean, true, 'a fila mostra a foto como escondida');
select lives_ok($$select public.admin_moderate_photo('00000000-0000-4000-8000-0000000035f1', 'manter', 'Anfitriã confirmou que está tudo certo.')$$, 'manter');
select is(tests.q($q$select status::text || '/' || reports from public.photos where id = '00000000-0000-4000-8000-0000000035f1'$q$), 'visivel/0', 'manter: visível e sem denúncias');
select is(tests.q($q$select count(*) from public.photo_reports where photo_id = '00000000-0000-4000-8000-0000000035f1'$q$), '0', 'manter: as denúncias saem');
select lives_ok($$select public.admin_moderate_photo('00000000-0000-4000-8000-0000000035f2', 'excluir', 'Conteúdo impróprio confirmado pela equipe.')$$, 'excluir');
select is(tests.q($q$select status::text from public.photos where id = '00000000-0000-4000-8000-0000000035f2'$q$), 'removida', 'excluir: status removida');
select ok(tests.q($q$select deleted_at is not null from public.photos where id = '00000000-0000-4000-8000-0000000035f2'$q$)::boolean, 'excluir: carimba deleted_at');
select ok(tests.q($q$select count(*) from public.storage_purge_queue where path like '%0035f2%'$q$)::int > 0, 'excluir: arquivo vai para a fila de limpeza');
select is(tests.q($q$select count(*) from public.audit_logs where action in ('photo.kept', 'photo.hidden', 'photo.removed') and detail::text ~* '(http|storage_path|user_id)'$q$), '0', 'a auditoria não guarda URL nem denunciante');
select throws_ok($$select public.admin_moderate_photo('00000000-0000-4000-8000-0000000035f2', 'manter', 'Motivo longo o bastante')$$, 'MM005', null, 'foto já excluída não volta');
reset role;

-- ===================================================================== auditoria por categoria
insert into public.audit_logs (actor_id, actor_role, event_id, action, target_type, target_id, reason) values
  ('00000000-0000-4000-8000-000000003501', 'master', '00000000-0000-4000-8000-0000000035e1', 'admin.reveal_now', 'event', '00000000-0000-4000-8000-0000000035e1', 'Pedido da anfitriã por chamado'),
  (null, 'sistema', '00000000-0000-4000-8000-0000000035e1', 'reveal.released', null, null, null),
  ('00000000-0000-4000-8000-000000003506', 'convidado', '00000000-0000-4000-8000-0000000035e1', 'participant.joined', null, null, null),
  ('00000000-0000-4000-8000-000000003506', 'convidado', '00000000-0000-4000-8000-0000000035e1', 'consent.recorded', null, null, null),
  (null, 'sistema', '00000000-0000-4000-8000-0000000035e2', 'payment.pendente', 'order', 'o35', null),
  ('00000000-0000-4000-8000-000000003501', 'master', null, 'platform_role.granted', 'user', '00000000-0000-4000-8000-000000003502', 'Entrada no time de atendimento');

select tests.login('00000000-0000-4000-8000-000000003503', 'auditor');
select is((public.admin_list_audit_v2(200, 0, 'participante') -> 'items' -> 0 ->> 'action'), 'participant.joined', 'categoria participante');
select is((public.admin_list_audit_v2(200, 0, 'consentimento') -> 'items' -> 0 ->> 'action'), 'consent.recorded', 'categoria consentimento');
select is((public.admin_list_audit_v2(200, 0, 'revelacao') -> 'items' -> 0 ->> 'action'), 'reveal.released', 'categoria revelação');
select is((public.admin_list_audit_v2(200, 0, 'pagamento') -> 'items' -> 0 ->> 'action'), 'payment.pendente', 'categoria pagamento');
select ok((select bool_and(i ->> 'action' ~ '^(admin|platform_role|platform_settings|feature_flags|plan|entitlement|audit|code|system|retention|event)\.|^photo\.access')
             from jsonb_array_elements(public.admin_list_audit_v2(200, 0, 'admin') -> 'items') i), 'categoria admin só traz ações de admin');
select ok((public.admin_list_audit_v2(200, 0, 'admin') ->> 'total')::int >= 2, 'categoria admin conta as ações');
select is((public.admin_list_audit_v2(200, 0, null) ->> 'total')::int, tests.q($q$select count(*) from public.audit_logs$q$)::int, 'sem categoria: todas');
select is((public.admin_list_audit_v2(200, 0, 'pagamento', '00000000-0000-4000-8000-0000000035e1') ->> 'total')::int, 0, 'categoria e evento combinam (e-1 não tem pagamento)');
select is((public.admin_list_audit_v2(200, 0, null, '00000000-0000-4000-8000-0000000035e2') ->> 'total')::int, 1, 'filtro por evento');
select throws_ok($$select public.admin_list_audit_v2(10, 0, 'inventada')$$, 'MM005', null, 'categoria inválida');
select is((select i ->> 'actorEmail' from jsonb_array_elements(public.admin_list_audit_v2(200, 0, 'admin') -> 'items') i where i ->> 'action' = 'admin.reveal_now'),
          'm***@dominio.test', 'o auditor vê o e-mail do autor mascarado, pelo servidor');
select is((select i ->> 'targetLabel' from jsonb_array_elements(public.admin_list_audit_v2(200, 0, 'admin') -> 'items') i where i ->> 'action' = 'platform_role.granted' and i ->> 'reason' = 'Entrada no time de atendimento'),
          's***@dominio.test', 'o alvo que é e-mail também vem mascarado');
select is((select i ->> 'targetLabel' from jsonb_array_elements(public.admin_list_audit_v2(200, 0, 'admin') -> 'items') i where i ->> 'action' = 'admin.reveal_now'),
          'Evento 35', 'o alvo que é evento vem com o título');
select ok(public.admin_list_audit_v2(200, 0, null)::text !~ 'master35@dominio.test', 'o e-mail completo do master não sai para o auditor');
select is(jsonb_array_length(public.admin_audit_events()), 2, 'lista de eventos do filtro (só os que têm registro)');
reset role;

select tests.login('00000000-0000-4000-8000-000000003501', 'master');
select is((select i ->> 'actorEmail' from jsonb_array_elements(public.admin_list_audit_v2(200, 0, 'admin') -> 'items') i where i ->> 'action' = 'admin.reveal_now'),
          'master35@dominio.test', 'o master vê o e-mail completo');
reset role;

select tests.login('00000000-0000-4000-8000-000000003502', 'support');
select throws_ok($$select public.admin_list_audit_v2(10, 0, null)$$, 'MM004', null, 'support não lê a auditoria');
select throws_ok($$select public.admin_audit_events()$$, 'MM004', null, 'support não lê a lista de eventos da auditoria');
select throws_ok($$select public.admin_export_audit_csv(null, null)$$, 'MM004', null, 'support não exporta a auditoria');
reset role;
select tests.login('00000000-0000-4000-8000-000000003504');
select throws_ok($$select public.admin_list_audit_v2(10, 0, null)$$, 'MM004', null, 'sem papel não lê a auditoria');
select throws_ok($$select public.admin_export_audit_csv(null, null)$$, 'MM004', null, 'sem papel não exporta');
reset role;

-- ===================================================================== exportar a auditoria filtrada
select tests.login('00000000-0000-4000-8000-000000003503', 'auditor');
select is((public.admin_export_audit_csv('revelacao', null) ->> 'rows')::int, 1, 'exporta só a categoria filtrada');
select ok((public.admin_export_audit_csv('revelacao', null) ->> 'csv') like '"id"%reveal.released%', 'o arquivo tem o cabeçalho e a linha');
select ok((public.admin_export_audit_csv('revelacao', null) ->> 'csv') !~ 'dominio.test', 'o arquivo não leva e-mail');
select is((public.admin_export_audit_csv(null, '00000000-0000-4000-8000-0000000035e2') ->> 'rows')::int, 1, 'exporta só o evento filtrado');
select throws_ok($$select public.admin_export_audit_csv('inventada', null)$$, 'MM005', null, 'categoria inválida na exportação');
reset role;
select is((select count(*) from public.audit_logs where action = 'export.csv' and target_id = 'auditoria' and actor_role = 'auditor'), 4::bigint, 'toda exportação entra na auditoria (quem e filtros)');
select is((select detail -> 'filters' ->> 'categoria' from public.audit_logs where action = 'export.csv' and detail ->> 'rows' = '1' and detail -> 'filters' ? 'categoria' limit 1), 'revelacao', 'com a categoria filtrada');


-- ===================================================================== exportar a moderação
select tests.login('00000000-0000-4000-8000-000000003502', 'support');
select throws_ok($$select public.admin_export_moderation_csv('fotos')$$, 'MM004', null, 'support não exporta a moderação');
reset role;
select tests.login('00000000-0000-4000-8000-000000003503', 'auditor');
select throws_ok($$select public.admin_export_moderation_csv('segredos')$$, 'MM005', null, 'aba inválida');
select ok((public.admin_export_moderation_csv('fotos') ->> 'csv') like '"foto","evento","denuncias","motivos","situacao"%', 'auditor exporta a moderação de fotos');
select ok((public.admin_export_moderation_csv('comentarios') ->> 'csv') !~* '(comentário 35|dominio.test|http|storage)', 'sem texto de comentário, e-mail nem URL');
select ok((public.admin_export_moderation_csv('bloqueados') ->> 'csv') like '"evento"%', 'bloqueados');
reset role;
select is(tests.q($q$select count(*) from public.audit_logs where action = 'export.csv' and target_id = 'moderacao'$q$), '3', 'a exportação da moderação entra na auditoria');

-- ===================================================================== storage e saúde
select tests.login('00000000-0000-4000-8000-000000003502', 'support');
select ok(public.admin_storage_breakdown() ? 'uploads' and public.admin_storage_breakdown() ? 'purgeQueue' and public.admin_storage_breakdown() ? 'growth', 'support lê o storage com uploads, fila e crescimento');
select is(jsonb_array_length(public.admin_storage_breakdown() -> 'growth'), 30, 'crescimento: 30 dias');
select is((public.admin_storage_breakdown() -> 'uploads' ->> 'inProgress')::int, 1, 'um upload em andamento');
select ok(public.admin_storage_breakdown() -> 'uploads' ? 'failed24h', 'uploads com falha em 24 h');
select ok(public.admin_health_history(8) ? 'jobs', 'histórico dos jobs (últimas 8)');
reset role;
select tests.login('00000000-0000-4000-8000-000000003504');
select throws_ok($$select public.admin_storage_breakdown()$$, 'MM004', null, 'sem papel não lê o storage');
select throws_ok($$select public.admin_health_history(8)$$, 'MM004', null, 'sem papel não lê a saúde');
reset role;

select * from finish();
rollback;
