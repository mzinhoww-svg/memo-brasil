-- pgTAP · Revela 2.0 · 24j: página pública de saída dos avisos por e-mail (email_opt_out_preview e email_resubscribe).
begin;
select no_plan();

create schema tests;
create function tests.login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated', 'is_anonymous', false, 'aal', 'aal1')::text, true);
  set local role authenticated;
end $$;
grant usage on schema tests to authenticated;

insert into auth.users (id, aud, role, email, is_anonymous) values
  ('00000000-0000-4000-8000-0000000029a1', 'authenticated', 'authenticated', 'host29@test.local', false),
  ('00000000-0000-4000-8000-0000000029b1', 'authenticated', 'authenticated', 'g29@test.local', false);
insert into public.profiles (id) select id from auth.users where email like '%29@test.local' on conflict do nothing;
insert into public.events (id, title, category, host_id, host_name, duration_hours, capacity, shots_per_person, reveal_enabled, reveal_anchor) values
  ('00000000-0000-4000-8000-0000000029e1', 'Ana & Leo', 'casamento', '00000000-0000-4000-8000-0000000029a1', 'Host', 6, 20, 10, true, 'fim');
insert into public.participants (event_id, user_id, name) values
  ('00000000-0000-4000-8000-0000000029e1', '00000000-0000-4000-8000-0000000029b1', 'Bia');

select tests.login('00000000-0000-4000-8000-0000000029b1');
select lives_ok($$select public.set_my_email('00000000-0000-4000-8000-0000000029e1', 'bia@exemplo.com', true)$$, 'convidada deixa o e-mail');
reset role;

create temporary table tok as select optout_token from public.participant_emails where event_id = '00000000-0000-4000-8000-0000000029e1';
grant select on tok to anon;

set local role anon;
select is(public.email_opt_out_preview('00000000-0000-4000-8000-000000000000'), null, 'token inexistente devolve nulo, sem erro');
select is(public.email_opt_out_preview((select optout_token from tok)) ->> 'title', 'Ana & Leo', 'prévia traz o título do evento sem login');
select is(public.email_opt_out_preview((select optout_token from tok)) ->> 'email', 'bia@exemplo.com', 'prévia traz o e-mail antes da saída');
select is((public.email_opt_out_preview((select optout_token from tok)) ->> 'optedOut')::boolean, false, 'ainda não saiu');
select is(public.email_opt_out((select optout_token from tok)), true, 'sai da lista pelo token');
select is((public.email_opt_out_preview((select optout_token from tok)) ->> 'optedOut')::boolean, true, 'prévia mostra que saiu');
select is(public.email_opt_out_preview((select optout_token from tok)) -> 'email', 'null'::jsonb, 'e o e-mail já foi apagado');
select throws_ok($$select public.email_resubscribe((select optout_token from tok), 'isso-nao-e-email')$$, 'MM005', null, 'reativar com e-mail inválido é recusado');
select is(public.email_resubscribe('00000000-0000-4000-8000-000000000000', 'bia@exemplo.com'), false, 'token inexistente não reativa nada');
select is(public.email_resubscribe((select optout_token from tok), 'Bia@Exemplo.com'), true, 'volta a receber pelo token');
select is(public.email_resubscribe((select optout_token from tok), 'outro@exemplo.com'), false, 'quem não saiu não troca o e-mail por este caminho');
reset role;
select is((select email from public.participant_emails where optout_token = (select optout_token from tok)), 'bia@exemplo.com', 'e-mail volta normalizado em minúsculas');
select is((select opt_out_at is null and consent_at is not null from public.participant_emails where optout_token = (select optout_token from tok)), true, 'com consentimento novo e sem a marca de saída');

select * from finish();
rollback;
