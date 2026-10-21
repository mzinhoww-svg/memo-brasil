-- pgTAP · segurança (RLS/IDOR/escalada), revelação no servidor, rolo, convites, Storage e retenção.
begin;
select no_plan();

create schema tests;
create function tests.login(p_user uuid, p_anon boolean default false) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated', 'is_anonymous', p_anon)::text, true);
  set local role authenticated;
end $$;
create function tests.fake_object(p_path text, p_size int default 1000, p_mime text default 'image/jpeg') returns void language sql as $$
  insert into storage.objects (bucket_id, name, owner, metadata) values ('event-photos', p_path, null, jsonb_build_object('size', p_size, 'mimetype', p_mime))
$$;

-- pessoas: 2 organizadores (contas), 3 convidados anônimos
insert into auth.users (id, aud, role, email, is_anonymous) values
  ('00000000-0000-4000-8000-0000000000a1', 'authenticated', 'authenticated', 'emy@test.local', false),
  ('00000000-0000-4000-8000-0000000000a2', 'authenticated', 'authenticated', 'outro@test.local', false),
  ('00000000-0000-4000-8000-0000000000b1', 'authenticated', 'authenticated', null, true),
  ('00000000-0000-4000-8000-0000000000b2', 'authenticated', 'authenticated', null, true),
  ('00000000-0000-4000-8000-0000000000b3', 'authenticated', 'authenticated', null, true);

select is((select count(*)::int from public.profiles), 5, 'perfil criado automaticamente para cada usuário');

-- ===================================================== eventos
select tests.login('00000000-0000-4000-8000-0000000000b1', true);
select throws_ok($$insert into public.events (title, category, host_id, duration_hours) values ('X', 'casamento', '00000000-0000-4000-8000-0000000000b1', 6)$$,
  '42501', null, 'convidado anônimo não cria evento');
reset role;

select tests.login('00000000-0000-4000-8000-0000000000a1');
insert into public.events (id, title, category, host_id, host_name, duration_hours, reveal_enabled, reveal_anchor, reveal_offset_days, capacity, shots_per_person)
values ('10000000-0000-4000-8000-000000000001', 'Emy e Igor', 'casamento', '00000000-0000-4000-8000-0000000000a1', 'Emy', 6, true, 'fim', 0, 2, 2);
select is((select code ~ '^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$' from public.events where id = '10000000-0000-4000-8000-000000000001'), true, 'código gerado no servidor com o alfabeto sem 0 O 1 I L');
select is((select reveal_at - start_at from public.events where id = '10000000-0000-4000-8000-000000000001'), interval '6 hours', 'revelação "ao terminar": o servidor calcula reveal_at = fim');
select is((select reveal_status::text from public.events where id = '10000000-0000-4000-8000-000000000001'), 'pendente', 'espelho pendente');

-- estender o fim move a revelação junto (BG-101) enquanto pendente
update public.events set duration_hours = 30 where id = '10000000-0000-4000-8000-000000000001';
select is((select reveal_at - start_at from public.events where id = '10000000-0000-4000-8000-000000000001'), interval '30 hours', 'estender o fim move a revelação (âncora fim)');
update public.events set ended_at = now() + interval '1 hour', reveal_offset_days = 2 where id = '10000000-0000-4000-8000-000000000001';
select is((select abs(extract(epoch from (reveal_at - (now() + interval '1 hour' + interval '2 days'))))::int < 5 from public.events where id = '10000000-0000-4000-8000-000000000001'), true, '"N dias depois" soma N dias ao novo fim');
update public.events set ended_at = null, duration_hours = 6, reveal_offset_days = 0 where id = '10000000-0000-4000-8000-000000000001';

select throws_ok($$update public.events set reveal_anchor = 'data', reveal_at = now() - interval '1 hour' where id = '10000000-0000-4000-8000-000000000001'$$, 'MM005', 'invalid', 'data de revelação no passado é recusada');
update public.events set title = 'Emy & Igor', host_id = '00000000-0000-4000-8000-0000000000a2', code = 'AAAAAAAA' where id = '10000000-0000-4000-8000-000000000001';
select is((select host_id::text from public.events where id = '10000000-0000-4000-8000-000000000001'), '00000000-0000-4000-8000-0000000000a1', 'host_id é imutável (sem escalada de dono)');
select isnt((select code from public.events where id = '10000000-0000-4000-8000-000000000001'), 'AAAAAAAA', 'código só muda por rotação');
select is((select version from public.events where id = '10000000-0000-4000-8000-000000000001'), 5, 'version incrementa a cada gravação');
reset role;

-- ===================================================== IDOR: outro organizador não vê nem altera
select tests.login('00000000-0000-4000-8000-0000000000a2');
select is((select count(*)::int from public.events), 0, 'outro organizador não enxerga o evento');
update public.events set title = 'Invadido' where id = '10000000-0000-4000-8000-000000000001';
reset role;
select is((select title from public.events where id = '10000000-0000-4000-8000-000000000001'), 'Emy & Igor', 'outro organizador não consegue alterar o evento');

-- ===================================================== entrar na festa
select tests.login('00000000-0000-4000-8000-0000000000b1', true);
select is((select public.event_preview((select code from public.events where id = '10000000-0000-4000-8000-000000000001' limit 1)) is null), true, 'prévia do convite não vaza para quem não entrou (RLS oculta o evento na subconsulta)');
reset role;
select code as ev_code from public.events where id = '10000000-0000-4000-8000-000000000001' \gset
select tests.login('00000000-0000-4000-8000-0000000000b1', true);
select is((public.event_preview(:'ev_code') ->> 'title'), 'Emy & Igor', 'prévia devolve título');
select is((select array_agg(k order by k) from jsonb_object_keys(public.event_preview(:'ev_code')) k),
  array['capacity','category','code','eventFont','full','hostName','palette','place','startAt','status','theme','title'], 'prévia só tem os 11 campos seguros da v1 + theme (v2)');
select throws_ok($$select public.join_event('ZZZZZZZZ', 'Ana')$$, 'MM005', 'invalid', 'código inexistente');
select throws_ok(format($$select public.join_event(%L, '  ')$$, :'ev_code'), 'MM005', 'invalid', 'nome vazio');
select is((public.join_event(:'ev_code', 'Ana') ->> 'role'), 'membro', 'convidado anônimo entra com o código');
select is((public.join_event(:'ev_code', 'Ana Maria') ->> 'role'), 'membro', 'reentrada é idempotente e atualiza o nome');
reset role;
select is((select count(*)::int from public.participants), 1, 'um participante só');
select tests.login('00000000-0000-4000-8000-0000000000b2', true);
select public.join_event(:'ev_code', 'Bia');
reset role;
select tests.login('00000000-0000-4000-8000-0000000000b3', true);
select throws_ok(format($$select public.join_event(%L, 'Caio')$$, :'ev_code'), 'MM003', 'capacityfull', 'lotação decidida no servidor');
reset role;
select tests.login('00000000-0000-4000-8000-0000000000a1');
select is((public.join_event(:'ev_code', 'Emy') ->> 'role'), 'organizador', 'organizador não vira participante');
reset role;

-- ===================================================== fotos: rolo, envio em duas fases, visibilidade
select tests.login('00000000-0000-4000-8000-0000000000b1', true);
select throws_ok($$insert into public.photos (id, event_id, author_id, author_name, storage_path) values ('20000000-0000-4000-8000-000000000099', '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000b1', 'Ana', '10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000099')$$,
  '42501', null, 'INSERT direto em photos é negado (só begin_photo)');
select is((public.begin_photo('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'O sim') ->> 'uploadStatus'), 'enviando', 'begin_photo cria linha enviando');
select is((public.begin_photo('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'O sim') ->> 'uploadStatus'), 'enviando', 'begin_photo é idempotente (não recobra o rolo)');
select is((public.event_counts('10000000-0000-4000-8000-000000000001') ->> 'mine')::int, 1, 'envio em andamento reserva o rolo');
select throws_ok($$select public.finalize_photo('20000000-0000-4000-8000-000000000001')$$, 'MM005', 'invalid', 'finalize sem objeto no Storage é recusado');
reset role;
select tests.fake_object('10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000001');
select tests.login('00000000-0000-4000-8000-0000000000b1', true);
select is((public.finalize_photo('20000000-0000-4000-8000-000000000001') ->> 'uploadStatus'), 'pronta', 'finalize publica depois do upload');
select public.begin_photo('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'Brinde');
select throws_ok($$select public.begin_photo('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001')$$, 'MM001', 'shotlimitreached', 'rolo cheio recusado no servidor');
reset role;
select tests.login('00000000-0000-4000-8000-0000000000b2', true);
select throws_ok($$select public.begin_photo('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001')$$, 'MM004', 'forbidden', 'não se assume a foto de outro id');
select public.begin_photo('20000000-0000-4000-8000-000000000010', '10000000-0000-4000-8000-000000000001', 'Pista');
reset role;
select tests.fake_object('10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000010');
select tests.fake_object('10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000002');
select tests.login('00000000-0000-4000-8000-0000000000b2', true);
select public.finalize_photo('20000000-0000-4000-8000-000000000010');
reset role;
select tests.login('00000000-0000-4000-8000-0000000000b1', true);
select public.finalize_photo('20000000-0000-4000-8000-000000000002');
reset role;

-- antes da revelação: convidado não lê foto nenhuma (nem a própria); host lê as publicadas
select tests.login('00000000-0000-4000-8000-0000000000b1', true);
select is((select count(*)::int from public.photos), 0, 'antes da revelação o convidado não lê nem as próprias fotos');
select is((public.event_counts('10000000-0000-4000-8000-000000000001') ->> 'total')::int, 3, 'contagem total (sem conteúdo) disponível ao convidado');
select is(public.can_read_object('10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000001'), false, 'Storage: nem o autor lê o arquivo antes da revelação');
select is(public.can_read_object('10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000010'), false, 'Storage: convidado não lê arquivo de outro antes da revelação');
reset role;
select tests.login('00000000-0000-4000-8000-0000000000a1');
select is((select count(*)::int from public.photos), 3, 'organizador vê as fotos publicadas antes da revelação (moderação)');
select is(public.can_read_object('10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000010'), true, 'Storage: organizador lê');
reset role;
select tests.login('00000000-0000-4000-8000-0000000000a2');
select is((select count(*)::int from public.photos), 0, 'IDOR: outro organizador não vê fotos');
select is(public.can_read_object('10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000010'), false, 'IDOR: outro organizador não lê arquivo');
reset role;

-- reações antes da revelação: sem acesso
select tests.login('00000000-0000-4000-8000-0000000000b2', true);
select throws_ok($$insert into public.reactions (photo_id, author_id, event_id, kind) values ('20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000b2', '10000000-0000-4000-8000-000000000001', 'amei')$$,
  '42501', null, 'reação em foto bloqueada é negada');
reset role;

-- ===================================================== revelação no servidor
select is(public.reveal_due_events(), 0, 'nada vencido ainda: tarefa não faz nada');
update public.events set reveal_at = now() - interval '1 minute', start_at = now() - interval '7 hours' where id = '10000000-0000-4000-8000-000000000001'; -- como dono do banco: simula o relógio andando
select is(public.reveal_due_events(), 1, 'tarefa libera a revelação vencida');
select is(public.reveal_due_events(), 0, 'reexecutar é idempotente');
select is((select reveal_status::text from public.events where id = '10000000-0000-4000-8000-000000000001'), 'revelada', 'espelho revelada');
select isnt((select revealed_at from public.events where id = '10000000-0000-4000-8000-000000000001'), null, 'revealed_at gravado');
select is((select count(*)::int from public.audit_logs where action = 'reveal.released'), 1, 'liberação auditada');

select tests.login('00000000-0000-4000-8000-0000000000b1', true);
select is((select count(*)::int from public.photos), 3, 'depois da revelação o convidado lê as fotos visíveis (todos veem tudo)');
select is(public.can_read_object('10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000010'), true, 'Storage: arquivo liberado depois da revelação');
select lives_ok($$insert into public.reactions (photo_id, author_id, event_id, kind) values ('20000000-0000-4000-8000-000000000010', '00000000-0000-4000-8000-0000000000b1', '10000000-0000-4000-8000-000000000099', 'amei')$$, 'reação em foto liberada');
select is((select event_id::text from public.reactions limit 1), '10000000-0000-4000-8000-000000000001', 'event_id da reação vem da foto, não do cliente');
select lives_ok($$select public.report_photo('20000000-0000-4000-8000-000000000010')$$, 'denúncia');
select lives_ok($$select public.report_photo('20000000-0000-4000-8000-000000000010')$$, 'denúncia repetida não duplica');
reset role;
select is((select reports from public.photos where id = '20000000-0000-4000-8000-000000000010'), 1, 'uma denúncia por pessoa');

-- revelada não reabre: nem o dono, nem o relógio
select tests.login('00000000-0000-4000-8000-0000000000a1');
select throws_ok($$update public.events set reveal_enabled = false where id = '10000000-0000-4000-8000-000000000001'$$, 'MM008', 'revealed', 'organizador não desliga a revelação já ocorrida');
select throws_ok($$update public.events set reveal_at = now() + interval '1 day', reveal_anchor = 'data' where id = '10000000-0000-4000-8000-000000000001'$$, 'MM008', 'revealed', 'nem adia a data (não esconde de novo)');
update public.events set revealed_at = null, reveal_status = 'pendente' where id = '10000000-0000-4000-8000-000000000001';
reset role;
select is((select revealed_at is not null and reveal_status = 'revelada' from public.events where id = '10000000-0000-4000-8000-000000000001'), true, 'cliente não consegue zerar revealed_at (monotônico)');

-- moderação: oculta some do convidado, host continua vendo
select tests.login('00000000-0000-4000-8000-0000000000a1');
update public.photos set status = 'oculta', caption = 'hack', author_name = 'X', reports = 99 where id = '20000000-0000-4000-8000-000000000010';
reset role;
select is((select caption is null and author_name = 'Bia' and reports = 1 from public.photos where id = '20000000-0000-4000-8000-000000000010'), true, 'moderação só muda status/destaque; demais colunas travadas');
select tests.login('00000000-0000-4000-8000-0000000000b1', true);
select is((select count(*)::int from public.photos where id = '20000000-0000-4000-8000-000000000010'), 0, 'foto oculta some do convidado');
select is(public.can_read_object('10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000010'), false, 'Storage: foto oculta não é legível');
update public.photos set status = 'visivel' where id = '20000000-0000-4000-8000-000000000010';
select is((select count(*)::int from public.reactions), 0, 'reação de foto oculta não vaza');
reset role;
select is((select status::text from public.photos where id = '20000000-0000-4000-8000-000000000010'), 'oculta', 'convidado não modera');
select is((select count(*)::int from public.audit_logs where action = 'photo.moderated'), 1, 'moderação auditada');

-- ===================================================== convites
select tests.login('00000000-0000-4000-8000-0000000000a1');
select is((public.create_invitation('10000000-0000-4000-8000-000000000001', 'Mesa 8', null, 1) ->> 'token') is not null, true, 'convite devolve token uma vez');
reset role;
select is((select count(*)::int from public.invitations where token_hash ~ '^[0-9a-f]{64}$'), 1, 'só o hash do token fica guardado');
select tests.login('00000000-0000-4000-8000-0000000000b1', true);
select throws_ok($$select public.create_invitation('10000000-0000-4000-8000-000000000001', 'X')$$, 'MM004', 'forbidden', 'convidado não cria convite');
select is((select count(*)::int from public.invitations), 0, 'convidado não lê convites');
reset role;

-- ===================================================== superfície de ataque direta
select tests.login('00000000-0000-4000-8000-0000000000b1', true);
select throws_ok($$select public.audit(null, 'forjado', '{}')$$, '42501', null, 'cliente não forja auditoria (RLS)');
select throws_ok($$select public.enqueue_purge('x')$$, '42501', null, 'cliente não enche a fila de limpeza (RLS)');
select throws_ok($$insert into public.audit_logs (action) values ('x')$$, '42501', null, 'INSERT direto em audit_logs negado');
select throws_ok($$select * from public.rate_limits$$, '42501', null, 'rate_limits fechada');
select throws_ok($$select public.reveal_due_events()$$, '42501', null, 'tarefa de revelação não é chamável por cliente');
select throws_ok($$select public.process_account_deletion('00000000-0000-4000-8000-0000000000b2')$$, '42501', null, 'exclusão de conta de terceiros não é chamável');
select throws_ok($$delete from public.events$$, '42501', null, 'sem DELETE em events (só delete_event)');
reset role;
select set_config('request.jwt.claims', '', true);
set local role anon;
select throws_ok($$select * from public.events$$, '42501', null, 'anon sem acesso a events');
select throws_ok($$select public.event_preview('AAAAAAAA')$$, '42501', null, 'anon sem acesso à prévia');
reset role;

select * from finish();
rollback;
