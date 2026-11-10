-- pgTAP · Master M02/M09: admin_events_board e admin_moderation_queue (leituras aditivas, só staff; texto e nomes só para o master).
begin;
select no_plan();

create schema tests;
create function tests.login(p_user uuid, p_master boolean default false) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated', 'is_anonymous', false, 'aal', 'aal1',
    'app_metadata', case when p_master then json_build_object('role', 'master') else '{}'::json end)::text, true);
  set local role authenticated;
end $$;
grant usage on schema tests to authenticated;

insert into auth.users (id, aud, role, email, is_anonymous) values
  ('00000000-0000-4000-8000-0000000029a1', 'authenticated', 'authenticated', 'host29@test.local', false),
  ('00000000-0000-4000-8000-0000000029b1', 'authenticated', 'authenticated', 'guest29@test.local', false),
  ('00000000-0000-4000-8000-0000000029b2', 'authenticated', 'authenticated', 'guest29b@test.local', false),
  ('00000000-0000-4000-8000-0000000029c1', 'authenticated', 'authenticated', 'master29@test.local', false),
  ('00000000-0000-4000-8000-0000000029d1', 'authenticated', 'authenticated', 'stranger29@test.local', false);
insert into public.profiles (id) select id from auth.users where email like '%29@test.local' or email like 'guest29%@test.local' on conflict do nothing;
insert into public.platform_roles (user_id, role) values ('00000000-0000-4000-8000-0000000029c1', 'master');

insert into public.events (id, title, category, host_id, host_name, duration_hours, capacity, shots_per_person, reveal_enabled, reveal_anchor) values
  ('00000000-0000-4000-8000-0000000029e1', 'Board 29 ativo', 'casamento', '00000000-0000-4000-8000-0000000029a1', 'Host 29', 6, 20, 10, true, 'fim'),
  ('00000000-0000-4000-8000-0000000029e2', 'Board 29 excluido', 'outro', '00000000-0000-4000-8000-0000000029a1', 'Host 29', 6, 20, 10, true, 'fim');
update public.events set deleted_at = now() where id = '00000000-0000-4000-8000-0000000029e2';
insert into public.participants (event_id, user_id, name, blocked_at) values
  ('00000000-0000-4000-8000-0000000029e1', '00000000-0000-4000-8000-0000000029b1', 'Ana 29', null),
  ('00000000-0000-4000-8000-0000000029e1', '00000000-0000-4000-8000-0000000029b2', 'Bia 29', now());
insert into public.photos (id, event_id, author_id, author_name, storage_path, upload_status, reports) values
  ('00000000-0000-4000-8000-0000000029f1', '00000000-0000-4000-8000-0000000029e1', '00000000-0000-4000-8000-0000000029b1', 'Ana 29',
   '00000000-0000-4000-8000-0000000029e1/00000000-0000-4000-8000-0000000029f1', 'pronta', 3);
insert into public.photo_comments (id, photo_id, event_id, author_id, author_name, body, reports) values
  ('00000000-0000-4000-8000-0000000029f9', '00000000-0000-4000-8000-0000000029f1', '00000000-0000-4000-8000-0000000029e1', '00000000-0000-4000-8000-0000000029b1', 'Ana 29', 'comentário 29', 2);

-- ===================================================================== admin_events_board
select tests.login('00000000-0000-4000-8000-0000000029d1');
select throws_ok($$select public.admin_events_board()$$, 'MM004', null, 'quem não é da equipe não lê o quadro de eventos');
select throws_ok($$select public.admin_moderation_queue()$$, 'MM004', null, 'nem a fila de moderação');
select throws_ok($$select public.admin_reveals_board()$$, 'MM004', null, 'nem a fila de revelações');
reset role;

select tests.login('00000000-0000-4000-8000-0000000029c1', true);
select is((public.admin_events_board(null, 'Board 29') -> 'total')::int, 1, 'Todos não traz excluídos');
select is((public.admin_events_board(null, 'Board 29') -> 'items' -> 0 ->> 'category'), 'casamento', 'traz a categoria');
select is((public.admin_events_board(null, 'Board 29') -> 'items' -> 0 ->> 'reports')::int, 2, 'denúncias = foto com denúncia + comentário com denúncia');
select is((public.admin_events_board('denuncias', 'Board 29') -> 'total')::int, 1, 'filtro Com denúncias');
select is((public.admin_events_board('excluidos', 'Board 29') ->> 'total')::int, 1, 'filtro Excluídos traz só o excluído');
select is((public.admin_events_board('aguardando', 'Board 29') ->> 'total')::int, 1, 'filtro Aguardando revelação');
select is((public.admin_events_board('revelados', 'Board 29') ->> 'total')::int, 0, 'filtro Revelados vazio');
select is((public.admin_events_board(null, 'Board 29') -> 'counts' ->> 'excluidos')::int, 1, 'contagem dos chips');
select throws_ok($$select public.admin_events_board('qualquer')$$, 'MM005', null, 'filtro inválido é recusado');

-- ===================================================================== admin_reveals_board
select ok((select bool_or(i ->> 'title' = 'Board 29 ativo') from jsonb_array_elements(public.admin_reveals_board() -> 'items') i), 'fila de revelações traz o evento pendente');
select is((select (i ->> 'emailOptIns')::int from jsonb_array_elements(public.admin_reveals_board() -> 'items') i where i ->> 'title' = 'Board 29 ativo'), 0, 'sem e-mails com consentimento: zero');
select ok(not (public.admin_reveals_board() -> 'items' -> 0 ? 'email'), 'só números: nenhum endereço de e-mail');

-- ===================================================================== admin_moderation_queue
select is(jsonb_array_length(public.admin_moderation_queue() -> 'photos'), 1, 'fila traz a foto denunciada (sem a imagem)');
select is(public.admin_moderation_queue() -> 'photos' -> 0 ->> 'reports', '3', 'com o número de denúncias');
select ok(not (public.admin_moderation_queue() -> 'photos' -> 0 ? 'storagePath'), 'sem caminho de arquivo');
select is(public.admin_moderation_queue() -> 'comments' -> 0 ->> 'body', 'comentário 29', 'master vê o texto do comentário denunciado');
select is(public.admin_moderation_queue() -> 'blocked' -> 0 ->> 'name', 'Bia 29', 'master vê quem foi bloqueado');

-- ===================================================================== chave validapay_card e validade do Pix (Master > Configurações)
select is((select count(*)::int from public.feature_flags where key = 'validapay_card' and enabled), 0, 'cartão ValidaPay nasce desligado (sem linha = desligado)');
select lives_ok($$select public.admin_set_feature_flag('validapay_card', true, '{}'::jsonb, 'Ligar o cartão para homologação do 3DS')$$, 'master liga a chave do cartão com motivo');
select is((select enabled from public.feature_flags where key = 'validapay_card'), true, 'a chave ficou ligada');
select ok(exists(select 1 from public.audit_logs where action like 'feature_flags.%' and target_id = 'validapay_card'), 'a gravação da chave foi auditada');
select lives_ok($$select public.admin_set_setting('validapay_pix_expiry_minutes', '30'::jsonb, 'Pix com 30 minutos de validade')$$, 'master grava a validade do Pix');
select is((select value::text from public.platform_settings where key = 'validapay_pix_expiry_minutes'), '30', 'valor gravado');
select throws_ok($$select public.admin_set_feature_flag('validapay_card', false, '{}'::jsonb, 'curto')$$, 'MM011', null, 'sem motivo suficiente a chave não muda');
reset role;
select tests.login('00000000-0000-4000-8000-0000000029d1');
select throws_ok($$select public.admin_set_feature_flag('validapay_card', true, '{}'::jsonb, 'tentando ligar sem ser master')$$, 'MM004', null, 'quem não é master não liga o cartão');
reset role;

select * from finish();
rollback;
