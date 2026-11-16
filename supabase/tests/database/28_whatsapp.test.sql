-- pgTAP · WhatsApp (Revela): opt-in de avisos pelo gateway.
-- Garante: telefone só do próprio convidado, ninguém grava pelo cliente, webhook idempotente e fora de ordem,
-- cascata (LGPD), revelação enfileirando só quem tem opt-in, e a fila respeitando o teto por hora.
begin;
select no_plan();

create schema tests;
create function tests.login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  set local role authenticated;
end $$;
grant usage on schema tests to authenticated;

-- 28a1 anfitrião | 28b1 convidada com opt-in | 28b2 convidado sem opt-in | 28b3 convidado bloqueado | 28b4 convidado de outro evento
insert into auth.users (id, aud, role, email, is_anonymous) values
  ('00000000-0000-4000-8000-0000000028a1', 'authenticated', 'authenticated', 'wa-host@test.local', false),
  ('00000000-0000-4000-8000-0000000028b1', 'authenticated', 'authenticated', null, true),
  ('00000000-0000-4000-8000-0000000028b2', 'authenticated', 'authenticated', null, true),
  ('00000000-0000-4000-8000-0000000028b3', 'authenticated', 'authenticated', null, true),
  ('00000000-0000-4000-8000-0000000028b4', 'authenticated', 'authenticated', null, true);
insert into public.profiles (id) select id from auth.users where id::text like '00000000-0000-4000-8000-0000000028%' on conflict do nothing;

insert into public.events (id, title, category, host_id, host_name, start_at, duration_hours, reveal_enabled, reveal_at, reveal_status) values
  ('00000000-0000-4000-8000-0000000028e1', 'Casamento WA', 'casamento', '00000000-0000-4000-8000-0000000028a1', 'H', now() - interval '3 hours', 1, true, now() - interval '1 minute', 'pendente'),
  ('00000000-0000-4000-8000-0000000028e2', 'Outro WA', 'casamento', '00000000-0000-4000-8000-0000000028a1', 'H', now() - interval '3 hours', 1, false, null, 'desativada');
insert into public.participants (event_id, user_id, name, blocked_at) values
  ('00000000-0000-4000-8000-0000000028e1', '00000000-0000-4000-8000-0000000028b1', 'Ana', null),
  ('00000000-0000-4000-8000-0000000028e1', '00000000-0000-4000-8000-0000000028b2', 'Beto', null),
  ('00000000-0000-4000-8000-0000000028e1', '00000000-0000-4000-8000-0000000028b3', 'Caio', now()),
  ('00000000-0000-4000-8000-0000000028e2', '00000000-0000-4000-8000-0000000028b4', 'Davi', null);

-- estrutura e permissões
select has_table('public', 'participant_whatsapp', 'tabela do opt-in existe');
select has_table('public', 'whatsapp_outbox', 'fila de envio existe');
select col_is_pk('public', 'participant_whatsapp', array['event_id', 'user_id'], 'um registro por convidado e evento');
select ok(not has_table_privilege('authenticated', 'public.participant_whatsapp', 'INSERT'), 'o cliente não insere opt-in');
select ok(not has_table_privilege('authenticated', 'public.participant_whatsapp', 'UPDATE'), 'o cliente não altera opt-in');
select ok(not has_table_privilege('authenticated', 'public.participant_whatsapp', 'DELETE'), 'o cliente não apaga opt-in');
select ok(not has_table_privilege('anon', 'public.participant_whatsapp', 'SELECT'), 'anônimo não lê');
select ok(not has_table_privilege('authenticated', 'public.whatsapp_outbox', 'SELECT'), 'a fila é só do serviço');
select ok(not has_function_privilege('authenticated', 'public.whatsapp_apply_event(text,uuid,uuid,text,timestamptz)', 'EXECUTE'), 'o cliente não aplica evento do gateway');
select ok(not has_function_privilege('authenticated', 'public.whatsapp_claim_batch(int,int)', 'EXECUTE'), 'o cliente não retira itens da fila');
select ok(has_function_privilege('service_role', 'public.whatsapp_apply_event(text,uuid,uuid,text,timestamptz)', 'EXECUTE'), 'o serviço aplica eventos');

-- flag desligada por padrão
select ok(not exists (select 1 from public.feature_flags where key = 'whatsapp_avisos' and enabled), 'o recurso nasce desligado (sem flag ligada)');

-- webhook: confirmação
select is(public.whatsapp_apply_event('optin.confirmed', '00000000-0000-4000-8000-0000000028e1', '00000000-0000-4000-8000-0000000028b1', '+55 (65) 99999-1111', '2026-11-16T10:00:00Z'), 'applied', 'confirmação aplicada');
select is((select whatsapp_phone from public.participant_whatsapp where user_id = '00000000-0000-4000-8000-0000000028b1'), '5565999991111', 'telefone guardado só com dígitos');
select is((select whatsapp_optin from public.participant_whatsapp where user_id = '00000000-0000-4000-8000-0000000028b1'), true, 'opt-in verdadeiro');
select isnt((select whatsapp_optin_at from public.participant_whatsapp where user_id = '00000000-0000-4000-8000-0000000028b1'), null, 'data do opt-in gravada');
select is(public.whatsapp_apply_event('optin.confirmed', '00000000-0000-4000-8000-0000000028e1', '00000000-0000-4000-8000-0000000028b1', '5565999991111', '2026-11-16T10:00:00Z'), 'applied', 'repetição da mesma confirmação é inofensiva');
select is((select count(*)::int from public.participant_whatsapp), 1, 'a repetição não duplica');
select is(public.whatsapp_apply_event('optin.confirmed', '00000000-0000-4000-8000-0000000028e1', '00000000-0000-4000-8000-0000000028b3', '5565999993333', '2026-11-16T10:00:00Z'), 'blocked', 'convidado bloqueado não ativa');
select is(public.whatsapp_apply_event('optin.confirmed', '00000000-0000-4000-8000-0000000028e1', '00000000-0000-4000-8000-0000000028ff', '5565999990000', '2026-11-16T10:00:00Z'), 'unknown_subject', 'participante inexistente é ignorado sem erro');
select throws_ok($$select public.whatsapp_apply_event('optin.confirmed', '00000000-0000-4000-8000-0000000028e1', '00000000-0000-4000-8000-0000000028b2', '123', now())$$, 'MM005', null, 'telefone inválido é recusado');
select throws_ok($$select public.whatsapp_apply_event('message.received', '00000000-0000-4000-8000-0000000028e1', '00000000-0000-4000-8000-0000000028b2', '5565999992222', now())$$, 'MM005', null, 'tipo desconhecido é recusado');

-- webhook: ordem (um "confirmado" atrasado não ressuscita quem saiu)
select is(public.whatsapp_apply_event('optin.revoked', '00000000-0000-4000-8000-0000000028e1', '00000000-0000-4000-8000-0000000028b1', '5565999991111', '2026-11-16T11:00:00Z'), 'applied', 'saída aplicada');
select is((select whatsapp_optin from public.participant_whatsapp where user_id = '00000000-0000-4000-8000-0000000028b1'), false, 'opt-in desligado');
select is((select whatsapp_phone from public.participant_whatsapp where user_id = '00000000-0000-4000-8000-0000000028b1'), null, 'telefone apagado ao sair');
select isnt((select revoked_at from public.participant_whatsapp where user_id = '00000000-0000-4000-8000-0000000028b1'), null, 'data da saída gravada');
select is(public.whatsapp_apply_event('optin.confirmed', '00000000-0000-4000-8000-0000000028e1', '00000000-0000-4000-8000-0000000028b1', '5565999991111', '2026-11-16T10:00:00Z'), 'stale', 'confirmação antiga depois da saída é ignorada');
select is((select whatsapp_optin from public.participant_whatsapp where user_id = '00000000-0000-4000-8000-0000000028b1'), false, 'continua sem opt-in');
select is(public.whatsapp_apply_event('optin.confirmed', '00000000-0000-4000-8000-0000000028e1', '00000000-0000-4000-8000-0000000028b1', '5565999991111', '2026-11-16T12:00:00Z'), 'applied', 'voltar a ativar depois funciona');
select is((select whatsapp_optin from public.participant_whatsapp where user_id = '00000000-0000-4000-8000-0000000028b1'), true, 'opt-in de novo');

-- a auditoria não carrega telefone
select is((select count(*)::int from public.audit_logs where action like 'whatsapp.%' and detail::text like '%5565%'), 0, 'auditoria sem telefone');

-- leitura: só a própria linha, só quem é membro
select tests.login('00000000-0000-4000-8000-0000000028b1');
select is((select count(*)::int from public.participant_whatsapp), 1, 'a convidada lê a própria linha');
select is((select whatsapp_phone from public.participant_whatsapp limit 1), '5565999991111', 'e o próprio telefone');
reset role;
select tests.login('00000000-0000-4000-8000-0000000028b2');
select is((select count(*)::int from public.participant_whatsapp), 0, 'outro convidado não vê nada');
reset role;
select tests.login('00000000-0000-4000-8000-0000000028a1');
select is((select count(*)::int from public.participant_whatsapp), 0, 'nem o anfitrião lê o telefone dos convidados');
reset role;
select tests.login('00000000-0000-4000-8000-0000000028b1');
select throws_ok($$insert into public.participant_whatsapp (event_id, user_id, whatsapp_phone, whatsapp_optin) values ('00000000-0000-4000-8000-0000000028e1', '00000000-0000-4000-8000-0000000028b1', '5565000000000', true)$$, '42501', null, 'INSERT direto é negado');
select throws_ok($$update public.participant_whatsapp set whatsapp_optin = true$$, '42501', null, 'UPDATE direto é negado');
reset role;

-- status para a tela
select tests.login('00000000-0000-4000-8000-0000000028b1');
select is((public.whatsapp_status('00000000-0000-4000-8000-0000000028e1') ->> 'enabled')::boolean, false, 'status: recurso desligado');
select is((public.whatsapp_status('00000000-0000-4000-8000-0000000028e1') ->> 'optin')::boolean, true, 'status: opt-in ativo');
select is((public.whatsapp_status('00000000-0000-4000-8000-0000000028e1') ->> 'eligible')::boolean, true, 'status: elegível');
reset role;
select tests.login('00000000-0000-4000-8000-0000000028b4');
select throws_ok($$select public.whatsapp_status('00000000-0000-4000-8000-0000000028e1')$$, 'MM004', null, 'status de evento alheio é recusado');
reset role;
select tests.login('00000000-0000-4000-8000-0000000028a1');
select is((public.whatsapp_status('00000000-0000-4000-8000-0000000028e1') ->> 'eligible')::boolean, false, 'anfitrião sem participação não é elegível');
select is((public.whatsapp_status('00000000-0000-4000-8000-0000000028e1') ->> 'optin')::boolean, false, 'status sem linha: opt-in falso');
reset role;
insert into public.feature_flags (key, enabled) values ('whatsapp_avisos', true) on conflict (key) do update set enabled = true;
select tests.login('00000000-0000-4000-8000-0000000028b1');
select is((public.whatsapp_status('00000000-0000-4000-8000-0000000028e1') ->> 'enabled')::boolean, true, 'status: recurso ligado');
reset role;

-- a revelação enfileira só quem tem opt-in e não está bloqueado, na mesma transação, uma vez
select public.whatsapp_apply_event('optin.confirmed', '00000000-0000-4000-8000-0000000028e1', '00000000-0000-4000-8000-0000000028b2', '5565999992222', '2026-11-16T12:00:00Z');
select is(public.reveal_due_events(), 1, 'a revelação vencida roda');
select is((select count(*)::int from public.whatsapp_outbox where event_id = '00000000-0000-4000-8000-0000000028e1' and kind = 'revealed'), 2, 'dois convidados com opt-in entram na fila');
select is((select count(*)::int from public.whatsapp_outbox where user_id = '00000000-0000-4000-8000-0000000028b3'), 0, 'bloqueado não entra');
select is((select count(*)::int from public.whatsapp_outbox where event_id = '00000000-0000-4000-8000-0000000028e2'), 0, 'outro evento não entra');
select is(public.reveal_due_events(), 0, 'rodar de novo não revela nem enfileira outra vez');
select is((select count(*)::int from public.whatsapp_outbox), 2, 'fila intacta');
select throws_ok($$insert into public.whatsapp_outbox (event_id, user_id, kind) values ('00000000-0000-4000-8000-0000000028e1', '00000000-0000-4000-8000-0000000028b1', 'revealed')$$, '23505', null, 'chave única (evento, convidado, tipo)');

-- fila: lote, teto por hora, saída antes do envio, falhas
select is((select count(*)::int from public.whatsapp_claim_batch(1, 60)), 1, 'o lote respeita o tamanho pedido');
select is((select count(*)::int from public.whatsapp_claim_batch(5, 60)), 1, 'o item já retirado não volta antes do prazo');
select public.whatsapp_apply_event('optin.revoked', '00000000-0000-4000-8000-0000000028e1', '00000000-0000-4000-8000-0000000028b2', null, '2026-11-16T13:00:00Z');
update public.whatsapp_outbox set next_attempt_at = now() - interval '1 second';
select is((select count(*)::int from public.whatsapp_claim_batch(5, 60)), 1, 'quem saiu antes do envio não é entregue ao worker');
select is((select status from public.whatsapp_outbox where user_id = '00000000-0000-4000-8000-0000000028b2' and kind = 'revealed'), 'revogado', 'e fica marcado como revogado');
select public.whatsapp_mark('00000000-0000-4000-8000-0000000028e1', '00000000-0000-4000-8000-0000000028b1', 'revealed', 'enviado', 'gw-1', null);
select is((select status from public.whatsapp_outbox where user_id = '00000000-0000-4000-8000-0000000028b1'), 'enviado', 'envio marcado');
select isnt((select sent_at from public.whatsapp_outbox where user_id = '00000000-0000-4000-8000-0000000028b1'), null, 'hora do envio gravada');
insert into public.whatsapp_outbox (event_id, user_id, kind, status, sent_at) values ('00000000-0000-4000-8000-0000000028e1', '00000000-0000-4000-8000-0000000028b1', 'teste_enviado', 'enviado', now());
insert into public.whatsapp_outbox (event_id, user_id, kind) values ('00000000-0000-4000-8000-0000000028e1', '00000000-0000-4000-8000-0000000028b1', 'teste_pendente');
select is((select count(*)::int from public.whatsapp_claim_batch(5, 2)), 0, 'o teto por hora fecha a fila (2 já enviados na última hora)');
select is((select count(*)::int from public.whatsapp_claim_batch(5, 10)), 1, 'com folga no teto, o pendente sai');
select public.whatsapp_mark('00000000-0000-4000-8000-0000000028e1', '00000000-0000-4000-8000-0000000028b1', 'revealed', 'falhou', null, 'erro');
select is((select status from public.whatsapp_outbox where user_id = '00000000-0000-4000-8000-0000000028b1' and kind = 'revealed'), 'falhou', 'falha definitiva marcada');

-- LGPD: sair do evento, apagar o convidado, apagar a conta e apagar o evento levam o telefone junto
select public.whatsapp_apply_event('optin.confirmed', '00000000-0000-4000-8000-0000000028e2', '00000000-0000-4000-8000-0000000028b4', '5565999994444', '2026-11-16T12:00:00Z');
select is((select count(*)::int from public.participant_whatsapp where user_id = '00000000-0000-4000-8000-0000000028b4'), 1, 'opt-in do outro evento gravado');
select public.process_account_deletion('00000000-0000-4000-8000-0000000028b4');
select is((select count(*)::int from public.participant_whatsapp where user_id = '00000000-0000-4000-8000-0000000028b4'), 0, 'exclusão de conta apaga o telefone');
delete from public.participants where user_id = '00000000-0000-4000-8000-0000000028b1';
select is((select count(*)::int from public.participant_whatsapp where user_id = '00000000-0000-4000-8000-0000000028b1'), 0, 'sair do evento apaga o telefone');
delete from public.events where id = '00000000-0000-4000-8000-0000000028e1';
select is((select count(*)::int from public.participant_whatsapp where event_id = '00000000-0000-4000-8000-0000000028e1'), 0, 'apagar o evento apaga os telefones');
select is((select count(*)::int from public.whatsapp_outbox where event_id = '00000000-0000-4000-8000-0000000028e1'), 0, 'e a fila do evento');

-- texto legal
select is((select count(*)::int from public.legal_documents where kind = 'privacy' and version = '2026-11-16-v2'), 1, 'Política v2 publicada');
select ok((select legal_review ilike '%nenhuma%' from public.legal_documents where kind = 'privacy' and version = '2026-11-16-v2'), 'sem revisão jurídica registrada que não houve');
select is((select count(*)::int from public.legal_documents where version = '2026-10-22-v1'), 2, 'a v1 continua publicada');

select * from finish();
rollback;
