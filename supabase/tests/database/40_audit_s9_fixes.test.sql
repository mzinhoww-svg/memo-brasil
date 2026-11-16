-- pgTAP · pistas S9 da auditoria: 13 (finalize de upload expirado), 14 (impressão "todas" do convidado), 15 (purge do branding), 18 (start_at).
begin;
select no_plan();

create schema tests;
create function tests.login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated', 'is_anonymous', false, 'aal', 'aal1', 'app_metadata', '{}'::json)::text, true);
  set local role authenticated;
end $$;
grant usage on schema tests to authenticated;

insert into auth.users (id, aud, role, email, is_anonymous) values
  ('00000000-0000-4000-8000-0000000040a1', 'authenticated', 'authenticated', 'host40@test.local', false),
  ('00000000-0000-4000-8000-0000000040b1', 'authenticated', 'authenticated', 'guest40@test.local', false);
insert into public.profiles (id) select id from auth.users where email like '%40@test.local' on conflict do nothing;
insert into public.events (id, title, category, host_id, host_name, duration_hours, capacity, shots_per_person, reveal_enabled, everyone_sees_all) values
  ('00000000-0000-4000-8000-0000000040e1', 'Evento 40', 'casamento', '00000000-0000-4000-8000-0000000040a1', 'Host 40', 6, 20, 10, false, false);
insert into public.participants (event_id, user_id, name) values ('00000000-0000-4000-8000-0000000040e1', '00000000-0000-4000-8000-0000000040b1', 'Ana 40');
insert into public.photos (id, event_id, author_id, author_name, storage_path, upload_status) values
  ('00000000-0000-4000-8000-0000000040f1', '00000000-0000-4000-8000-0000000040e1', '00000000-0000-4000-8000-0000000040b1', 'Ana 40', '00000000-0000-4000-8000-0000000040e1/00000000-0000-4000-8000-0000000040f1', 'pronta'),
  ('00000000-0000-4000-8000-0000000040f2', '00000000-0000-4000-8000-0000000040e1', '00000000-0000-4000-8000-0000000040a1', 'Host 40', '00000000-0000-4000-8000-0000000040e1/00000000-0000-4000-8000-0000000040f2', 'pronta'),
  ('00000000-0000-4000-8000-0000000040f3', '00000000-0000-4000-8000-0000000040e1', '00000000-0000-4000-8000-0000000040b1', 'Ana 40', '00000000-0000-4000-8000-0000000040e1/00000000-0000-4000-8000-0000000040f3', 'falhou');
insert into public.feature_flags (key, enabled) values ('printed_album', true) on conflict (key) do update set enabled = true;

-- ===================================================== 13: upload expirado não finaliza
select tests.login('00000000-0000-4000-8000-0000000040b1');
select throws_ok($$select public.finalize_photo('00000000-0000-4000-8000-0000000040f3')$$, 'MM005', null, '13: upload "falhou" (expirado) não vira "pronta"');
select is(public.finalize_photo('00000000-0000-4000-8000-0000000040f1') ->> 'uploadStatus', 'pronta', '13: o que já está pronto segue respondendo pronto');
reset role;

-- ===================================================== 14: "todas as fotos" do convidado = as que ele vê
select tests.login('00000000-0000-4000-8000-0000000040b1');
select lives_ok($$select public.create_print_order('00000000-0000-4000-8000-000000040a01', '00000000-0000-4000-8000-0000000040e1', 'album', 1, '{}', true, 'Maria Souza', '65999991234', null,
  '{"cep":"78000-000","street":"Rua das Flores","number":"10","neighborhood":"Centro","city":"Cuiabá","state":"mt"}', null)$$, '14: convidado pede todas as fotos');
reset role;
select is((select all_photos from public.print_orders where id = '00000000-0000-4000-8000-000000040a01'), false, '14: vira lista explícita (all_photos = false)');
select is((select photo_ids from public.print_orders where id = '00000000-0000-4000-8000-000000040a01'), array['00000000-0000-4000-8000-0000000040f1']::uuid[], '14: só a foto que ele vê (nem a do anfitrião, nem a expirada)');
select tests.login('00000000-0000-4000-8000-0000000040a1');
select lives_ok($$select public.create_print_order('00000000-0000-4000-8000-000000040a02', '00000000-0000-4000-8000-0000000040e1', 'album', 1, '{}', true, 'Maria Souza', '65999991234', null,
  '{"cep":"78000-000","street":"Rua das Flores","number":"10","neighborhood":"Centro","city":"Cuiabá","state":"mt"}', null)$$, '14: anfitrião continua pedindo todas');
reset role;
select is((select all_photos from public.print_orders where id = '00000000-0000-4000-8000-000000040a02'), true, '14: pedido do anfitrião segue como "todas"');

-- ===================================================== 15: purge enfileira logo e capa
insert into public.events (id, title, category, host_id, host_name, duration_hours, deleted_at) values
  ('00000000-0000-4000-8000-0000000040e2', 'Apagado 40', 'casamento', '00000000-0000-4000-8000-0000000040a1', 'Host 40', 6, now() - interval '40 days');
insert into public.event_assets (id, event_id, kind, storage_path, mime, bytes, width, height, upload_status, created_by) values
  ('00000000-0000-4000-8000-0000000040d1', '00000000-0000-4000-8000-0000000040e2', 'logo', '00000000-0000-4000-8000-0000000040e2/00000000-0000-4000-8000-0000000040d1', 'image/png', 1000, 100, 100, 'pronta', '00000000-0000-4000-8000-0000000040a1');
select ok(public.purge_deleted_events() >= 1, '15: o purge apagou o evento vencido');
select is((select count(*)::int from public.storage_purge_queue where bucket = 'event-branding' and path = '00000000-0000-4000-8000-0000000040e2/00000000-0000-4000-8000-0000000040d1'), 1, '15: o logo foi para a fila de remoção do Storage');

-- ===================================================== 18: start_at limitado
select tests.login('00000000-0000-4000-8000-0000000040a1');
select throws_ok($$insert into public.events (title, category, host_id, host_name, duration_hours, start_at) values ('Longe', 'casamento', '00000000-0000-4000-8000-0000000040a1', 'Host 40', 6, now() + interval '500 days')$$, 'MM005', null, '18: criar com start_at a mais de 400 dias é recusado');
select throws_ok($$update public.events set start_at = now() + interval '500 days' where id = '00000000-0000-4000-8000-0000000040e1'$$, 'MM005', null, '18: empurrar start_at para além de 400 dias é recusado');
select lives_ok($$update public.events set start_at = now() + interval '30 days' where id = '00000000-0000-4000-8000-0000000040e1'$$, '18: remarcar dentro do horizonte continua livre');
reset role;

select * from finish();
rollback;
