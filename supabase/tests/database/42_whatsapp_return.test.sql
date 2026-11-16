-- pgTAP · link de volta do WhatsApp: token guardado só como hash, uso único, expira, preso ao participante, cliente sem acesso;
-- restauração de anônimo só para o e-mail técnico; participant_whatsapp no Realtime.
begin;
select no_plan();

insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-4000-8000-0000000042a1', 'host42@test.local', false),
  ('00000000-0000-4000-8000-0000000042a2', null, true),
  ('00000000-0000-4000-8000-0000000042a3', 'real42@test.local', false);
insert into public.profiles (id) select id from auth.users where id::text like '00000000-0000-4000-8000-0000000042a%' on conflict do nothing;
insert into public.events (id, title, category, host_id, host_name, duration_hours, capacity, shots_per_person, reveal_enabled) values
  ('00000000-0000-4000-8000-0000000042e1', 'Festa 42', 'festa', '00000000-0000-4000-8000-0000000042a1', 'Host 42', 6, 20, 10, false);
insert into public.participants (event_id, user_id, name) values
  ('00000000-0000-4000-8000-0000000042e1', '00000000-0000-4000-8000-0000000042a2', 'Gui'),
  ('00000000-0000-4000-8000-0000000042e1', '00000000-0000-4000-8000-0000000042a3', 'Rê');

create temporary table h42 (k text primary key, v text);
insert into h42 values ('ok', repeat('a', 64)), ('old', repeat('b', 64)), ('used', repeat('c', 64)), ('blk', repeat('d', 64));

select throws_ok($$select public.whatsapp_issue_return_token('00000000-0000-4000-8000-0000000042e1', '00000000-0000-4000-8000-0000000042a2', 'nao-hex')$$, 'MM005', null, 'só aceita SHA-256 em hex');
select throws_ok($$select public.whatsapp_issue_return_token('00000000-0000-4000-8000-0000000042e1', '00000000-0000-4000-8000-0000000042a1', repeat('e', 64))$$, 'MM004', null, 'só para participante (anfitrião não entra por aqui)');
select lives_ok($$select public.whatsapp_issue_return_token('00000000-0000-4000-8000-0000000042e1', '00000000-0000-4000-8000-0000000042a2', (select v from h42 where k = 'ok'))$$, 'emite token');
select public.whatsapp_issue_return_token('00000000-0000-4000-8000-0000000042e1', '00000000-0000-4000-8000-0000000042a2', (select v from h42 where k = 'old'), 5);
update public.whatsapp_return_tokens set expires_at = now() - interval '1 minute' where token_hash = (select v from h42 where k = 'old');
select public.whatsapp_issue_return_token('00000000-0000-4000-8000-0000000042e1', '00000000-0000-4000-8000-0000000042a3', (select v from h42 where k = 'blk'));

select is(public.whatsapp_consume_return_token((select v from h42 where k = 'ok')) ->> 'status', 'ok', 'token válido troca');
select is((select used_at is not null from public.whatsapp_return_tokens where token_hash = (select v from h42 where k = 'ok')), true, 'marcado como usado');
select is(public.whatsapp_consume_return_token((select v from h42 where k = 'ok')) ->> 'status', 'used', 'uso único');
select is(public.whatsapp_consume_return_token((select v from h42 where k = 'ok')) ->> 'code', (select code from public.events where id = '00000000-0000-4000-8000-0000000042e1'), 'usado devolve o código do evento para entrar de novo');
select is(public.whatsapp_consume_return_token((select v from h42 where k = 'old')) ->> 'status', 'expired', 'vencido');
select is(public.whatsapp_consume_return_token(repeat('f', 64)) ->> 'status', 'invalid', 'desconhecido');
select is(public.whatsapp_consume_return_token('x') ->> 'status', 'invalid', 'formato inválido');
update public.participants set blocked_at = now() where user_id = '00000000-0000-4000-8000-0000000042a3';
select is(public.whatsapp_consume_return_token((select v from h42 where k = 'blk')) ->> 'status', 'blocked', 'bloqueado não troca');

-- anônimo: só o e-mail técnico volta a ser anônimo; conta de verdade nunca é tocada
update auth.users set email = 'wa-00000000-0000-4000-8000-0000000042a2@retorno.invalid', is_anonymous = false where id = '00000000-0000-4000-8000-0000000042a2';
select is(public.whatsapp_restore_anonymous('00000000-0000-4000-8000-0000000042a2'), true, 'e-mail técnico: volta a ser anônimo');
select is((select is_anonymous from auth.users where id = '00000000-0000-4000-8000-0000000042a2'), true, 'continua convidado anônimo');
select is(public.whatsapp_restore_anonymous('00000000-0000-4000-8000-0000000042a3'), false, 'conta com e-mail real: não mexe');
select is((select is_anonymous from auth.users where id = '00000000-0000-4000-8000-0000000042a3'), false, 'conta real continua conta');

-- cliente não toca em nada disso
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-0000000042a2', 'role', 'authenticated')::text, true);
select throws_ok($$select count(*) from public.whatsapp_return_tokens$$, '42501', null, 'cliente não lê tokens');
select throws_ok($$select public.whatsapp_consume_return_token(repeat('a', 64))$$, '42501', null, 'cliente não troca token direto');
select throws_ok($$select public.whatsapp_restore_anonymous('00000000-0000-4000-8000-0000000042a2')$$, '42501', null, 'cliente não mexe em auth.users');
reset role;

select ok(exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'participant_whatsapp')
  or not exists (select 1 from pg_publication where pubname = 'supabase_realtime'), 'participant_whatsapp no Realtime');

select * from finish();
rollback;
