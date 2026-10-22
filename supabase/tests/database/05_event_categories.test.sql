-- pgTAP · BG categorias: todas as categorias oferecidas pelo wizard (casamento, festa, empresa, viagem, outro) são aceitas;
-- as do esquema original continuam aceitas e valores fora da lista seguem recusados.
begin;
select no_plan();

insert into auth.users (id, aud, role, email, is_anonymous) values
  ('00000000-0000-4000-8000-0000000000e1', 'authenticated', 'authenticated', 'org-e1@test.local', false);
insert into public.profiles (id) values ('00000000-0000-4000-8000-0000000000e1') on conflict do nothing;

select lives_ok($$insert into public.events (title, category, host_id, host_name, duration_hours) values ('c', 'casamento', '00000000-0000-4000-8000-0000000000e1', 'H', 6)$$, 'casamento');
select lives_ok($$insert into public.events (title, category, host_id, host_name, duration_hours) values ('c', 'festa', '00000000-0000-4000-8000-0000000000e1', 'H', 6)$$, 'festa (wizard)');
select lives_ok($$insert into public.events (title, category, host_id, host_name, duration_hours) values ('c', 'empresa', '00000000-0000-4000-8000-0000000000e1', 'H', 6)$$, 'empresa (wizard)');
select lives_ok($$insert into public.events (title, category, host_id, host_name, duration_hours) values ('c', 'viagem', '00000000-0000-4000-8000-0000000000e1', 'H', 6)$$, 'viagem (wizard)');
select lives_ok($$insert into public.events (title, category, host_id, host_name, duration_hours) values ('c', 'outro', '00000000-0000-4000-8000-0000000000e1', 'H', 6)$$, 'outro');
select lives_ok($$insert into public.events (title, category, host_id, host_name, duration_hours) values ('c', 'aniversario', '00000000-0000-4000-8000-0000000000e1', 'H', 6)$$, 'aniversario (legado do esquema)');
select lives_ok($$insert into public.events (title, category, host_id, host_name, duration_hours) values ('c', 'formatura', '00000000-0000-4000-8000-0000000000e1', 'H', 6)$$, 'formatura (legado do esquema)');
select lives_ok($$insert into public.events (title, category, host_id, host_name, duration_hours) values ('c', 'corporativo', '00000000-0000-4000-8000-0000000000e1', 'H', 6)$$, 'corporativo (legado do esquema)');
select throws_ok($$insert into public.events (title, category, host_id, host_name, duration_hours) values ('c', 'qualquer', '00000000-0000-4000-8000-0000000000e1', 'H', 6)$$, '23514', null, 'categoria desconhecida segue recusada');

select * from finish();
rollback;
