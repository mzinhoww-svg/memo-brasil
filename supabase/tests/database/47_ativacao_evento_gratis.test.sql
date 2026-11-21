-- pgTAP · sequência de ativação do evento grátis (WhatsApp ao anfitrião): agenda ao criar, horários no fuso do evento,
-- reagenda/cancela quando a data muda, espera o opt-in do "logo depois de criar" por até 24 h e nunca sai para evento pago,
-- de teste. (O aviso de limite com desconto, que substituiu o "dia seguinte", está no teste 48.)
begin;
select no_plan();

insert into auth.users (id, aud, role, email, is_anonymous) values
  ('00000000-0000-4000-8000-0000000047a1', 'authenticated', 'authenticated', 'host47@test.local', false),
  ('00000000-0000-4000-8000-0000000047a2', 'authenticated', 'authenticated', 'semoptin47@test.local', false);
insert into public.profiles (id, display_name) values ('00000000-0000-4000-8000-0000000047a1', 'Bia Lima'), ('00000000-0000-4000-8000-0000000047a2', 'Caio')
  on conflict (id) do update set display_name = excluded.display_name;
insert into public.feature_flags (key, enabled) values ('whatsapp_avisos', true) on conflict (key) do update set enabled = true;
select public.host_whatsapp_apply_event('optin.confirmed', '00000000-0000-4000-8000-0000000047a1', '5565988887777', now());
-- avisos de outros testes não interferem na retirada
update public.host_outbox set status = 'cancelado' where status = 'pendente';

-- ===================================================== agenda ao criar (evento daqui a 10 dias, às 20 h em Cuiabá)
insert into public.events (id, title, category, host_id, host_name, duration_hours, capacity, shots_per_person, start_at, timezone) values
  ('00000000-0000-4000-8000-0000000047e1', 'Festa da Bia', 'aniversario', '00000000-0000-4000-8000-0000000047a1', 'Bia', 3, 10, 10,
   ((current_date + 10) + time '20:00') at time zone 'America/Cuiaba', 'America/Cuiaba');
select is((select array_agg(kind order by send_after) from public.host_outbox where event_id = '00000000-0000-4000-8000-0000000047e1'),
          array['ativ_criado', 'ativ_3d', 'ativ_vespera'], 'criar agenda os três lembretes do QR');
select is((select send_after from public.host_outbox where event_id = '00000000-0000-4000-8000-0000000047e1' and kind = 'ativ_3d'),
          ((current_date + 7) + time '10:00') at time zone 'America/Cuiaba', '3 dias antes, às 10 h no fuso do evento');
select is((select send_after from public.host_outbox where event_id = '00000000-0000-4000-8000-0000000047e1' and kind = 'ativ_vespera'),
          ((current_date + 9) + time '10:00') at time zone 'America/Cuiaba', 'véspera às 10 h');

-- logo depois de criar: sai na próxima retirada, com o nome e o evento
select results_eq($$select h.kind, h.phone, h.host_name, h.event_title from public.host_claim_batch(10, 55) h$$,
                  $$values ('ativ_criado'::text, '5565988887777'::text, 'Bia'::text, 'Festa da Bia'::text)$$, 'aviso de evento criado sai');

-- ===================================================== evento em 2 dias: sem "3 dias antes"
insert into public.events (id, title, category, host_id, host_name, duration_hours, start_at, timezone) values
  ('00000000-0000-4000-8000-0000000047e2', 'Em cima da hora', 'outro', '00000000-0000-4000-8000-0000000047a1', 'Bia', 4,
   ((current_date + 2) + time '20:00') at time zone 'America/Cuiaba', 'America/Cuiaba');
select ok(not exists (select 1 from public.host_outbox where event_id = '00000000-0000-4000-8000-0000000047e2' and kind = 'ativ_3d'), 'sem 3 dias se faltam 2');
select ok(exists (select 1 from public.host_outbox where event_id = '00000000-0000-4000-8000-0000000047e2' and kind = 'ativ_vespera'), 'véspera continua');
update public.host_outbox set status = 'cancelado' where event_id = '00000000-0000-4000-8000-0000000047e2' and kind = 'ativ_criado';

-- ===================================================== mudança de data reagenda; data que não comporta cancela
update public.events set start_at = ((current_date + 20) + time '20:00') at time zone 'America/Cuiaba' where id = '00000000-0000-4000-8000-0000000047e1';
select is((select send_after from public.host_outbox where event_id = '00000000-0000-4000-8000-0000000047e1' and kind = 'ativ_3d'),
          ((current_date + 17) + time '10:00') at time zone 'America/Cuiaba', 'nova data: 3 dias reagendado');
update public.events set start_at = now() + interval '3 hours' where id = '00000000-0000-4000-8000-0000000047e1';
select is((select string_agg(kind || ':' || status || ':' || coalesce(last_error, '-'), ',' order by kind) from public.host_outbox
            where event_id = '00000000-0000-4000-8000-0000000047e1' and kind in ('ativ_3d', 'ativ_vespera')),
          'ativ_3d:cancelado:data_mudou,ativ_vespera:cancelado:data_mudou', 'data em cima da hora: 3 dias e véspera cancelados');

-- ===================================================== sem opt-in: o "criado" espera até 24 h, depois sai da fila
insert into public.events (id, title, category, host_id, host_name, duration_hours, start_at) values
  ('00000000-0000-4000-8000-0000000047e3', 'Do Caio', 'festa', '00000000-0000-4000-8000-0000000047a2', 'Caio', 4, now() + interval '30 days');
select is((select count(*)::int from public.host_claim_batch(10, 55)), 0, 'sem opt-in: nada sai');
select is((select status from public.host_outbox where event_id = '00000000-0000-4000-8000-0000000047e3' and kind = 'ativ_criado'), 'pendente',
          'sem opt-in: o aviso de criado continua esperando');
select public.host_whatsapp_apply_event('optin.confirmed', '00000000-0000-4000-8000-0000000047a2', '5565977776666', now());
update public.host_outbox set next_attempt_at = now() - interval '1 minute' where event_id = '00000000-0000-4000-8000-0000000047e3' and kind = 'ativ_criado';
select is((select kind from public.host_claim_batch(10, 55)), 'ativ_criado', 'ativou os avisos: o aviso de criado sai');

insert into public.events (id, title, category, host_id, host_name, duration_hours, start_at) values
  ('00000000-0000-4000-8000-0000000047e4', 'Antigo', 'festa', '00000000-0000-4000-8000-0000000047a2', 'Caio', 4, now() + interval '30 days');
-- o banco grava created_at do servidor: envelhece o aviso direto na fila (criado há 25 h)
update public.host_outbox set send_after = now() - interval '25 hours' where event_id = '00000000-0000-4000-8000-0000000047e4' and kind = 'ativ_criado';
select is((select count(*)::int from public.host_claim_batch(10, 55)), 0, 'criado há mais de 24 h não sai');
select is((select last_error from public.host_outbox where event_id = '00000000-0000-4000-8000-0000000047e4' and kind = 'ativ_criado'), 'atrasado', 'motivo: atrasado');

-- ===================================================== evento pago também recebe os lembretes do QR
select set_config('mm.audit_reason', 'teste 47', true);
insert into public.event_entitlements (event_id, plan_code, max_guests, max_shots, source, env, reason)
values ('00000000-0000-4000-8000-0000000047e3', 'ate150', 150, 36, 'cortesia', 'nenhum', 'teste 47');
update public.host_outbox set send_after = now() - interval '1 minute' where event_id = '00000000-0000-4000-8000-0000000047e3' and kind = 'ativ_vespera';
select results_eq($$select h.kind from public.host_claim_batch(10, 55) h$$, $$values ('ativ_vespera'::text)$$, 'evento pago: véspera sai');

-- ===================================================== evento de teste não entra na fila
insert into public.events (id, title, category, host_id, host_name, duration_hours, start_at, is_test) values
  ('00000000-0000-4000-8000-0000000047e7', 'Teste', 'festa', '00000000-0000-4000-8000-0000000047a1', 'Bia', 4, now() + interval '10 days', true);
select is((select count(*)::int from public.host_outbox where event_id = '00000000-0000-4000-8000-0000000047e7'), 0, 'evento de teste não agenda');

select * from finish();
rollback;
