-- Fixtures descartáveis: mais de 50 registros e pendência fora do recorte geral.
begin;
select no_plan();
create schema tests;
grant usage on schema tests to authenticated;
create function tests.login(p_user uuid, p_role text default null) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated', 'is_anonymous', false,
    'app_metadata', case when p_role is null then '{}'::json else json_build_object('role', p_role) end)::text, true);
  set local role authenticated;
end $$;

insert into auth.users (id, aud, role, email, is_anonymous, raw_user_meta_data)
select ('50000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid, 'authenticated', 'authenticated',
  'uxlist' || n || '@test.local', false, jsonb_build_object('name', 'UXLista pessoa ' || n)
from generate_series(1,76) n;
insert into public.platform_roles (user_id, role) values ('50000000-0000-4000-8000-000000000001','master'),
  ('50000000-0000-4000-8000-000000000002','support');

insert into public.events (id,title,category,host_id,host_name,start_at,duration_hours,reveal_enabled,reveal_anchor,reveal_at)
select ('51000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid, 'UXLista evento ' || n, 'outro',
  ('50000000-0000-4000-8000-' || lpad((1+(n-1)%76)::text,12,'0'))::uuid, 'UXLista anfitrião ' || n,
  now(), 12, n <= 76, 'data', now() + (n - 2) * interval '1 hour'
from generate_series(1,201) n;
insert into public.participants (event_id,user_id,name)
select '51000000-0000-4000-8000-000000000001', ('50000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid, 'UXLista pessoa ' || n
from generate_series(1,76) n;
insert into public.invitations (event_id,label,token_hash)
select '51000000-0000-4000-8000-000000000001', 'UXLista convite ' || n, 'uxlista-token-hash-' || n
from generate_series(1,76) n;

select tests.login('50000000-0000-4000-8000-000000000001','master');
select is((public.admin_search_users(25,50,'uxlist')->>'total')::int,76,'busca de usuários conta antes do limite');
select is(jsonb_array_length(public.admin_search_users(25,50,'uxlist')->'items'),25,'terceira página de usuários acessível');
select is(jsonb_array_length(public.admin_search_users(25,75,'uxlist')->'items'),1,'último usuário acessível');
select is((public.admin_list_organizers(25,50,'UXLista')->>'total')::int,76,'organizadores contam toda a busca');
select is(jsonb_array_length(public.admin_list_organizers(25,75,'UXLista')->'items'),1,'organizador além dos primeiros 50 acessível');
select is((public.admin_search_participants(25,50,'UXLista')->>'total')::int,76,'participantes contam antes do limite');
select is(jsonb_array_length(public.admin_search_participants(25,75,'UXLista')->'items'),1,'último participante acessível');
select is((public.admin_search_invites(25,50,'UXLista')->>'total')::int,76,'convites contam antes do limite');
select is(jsonb_array_length(public.admin_search_invites(25,75,'UXLista')->'items'),1,'último convite acessível');
select is((public.admin_list_reveals(25,0,'UXLista')->>'total')::int,76,'pendências contam sem recorte dos 201 eventos');
select is(public.admin_list_reveals(25,0,'UXLista')#>>'{items,0,id}','51000000-0000-4000-8000-000000000001','mais atrasada vem primeiro mesmo fora da primeira página geral');
select is(public.admin_list_reveals(25,0,'UXLista')#>>'{items,0,revealState}','atrasada','estado atrasado explícito');
select is(jsonb_array_length(public.admin_list_reveals(25,75,'UXLista')->'items'),1,'última pendência acessível');
select is((public.admin_list_reveals(25,300,'UXLista')->>'total')::int,76,'página vazia mantém total real');
select is(public.admin_list_reveals(25,300,'UXLista')->'items','[]'::jsonb,'fora do intervalo retorna lista vazia');
select is((public.admin_search_invites(25,0,'UXLista convite 76')->>'total')::int,1,'busca é aplicada antes da paginação');
select is((public.admin_search_invites(25,0,'%')->>'total')::int,0,'wildcard é texto literal');
select ok(not (public.admin_search_invites(25,0,'UXLista')#>'{items,0}' ? 'token_hash'),'não expõe hash ou token');
reset role;

select tests.login('50000000-0000-4000-8000-000000000002','support');
select is(public.admin_search_users(25,0,'UXLista')#>>'{items,0,email}','u***@test.local','support recebe e-mail mascarado');
select is((public.admin_search_users(25,0,'uxlist76@test.local')->>'total')::int,0,'support não busca PII completa oculta');
reset role;
select tests.login('50000000-0000-4000-8000-000000000003');
select throws_ok($$select public.admin_list_reveals()$$,'MM004','forbidden','usuário comum não lista revelações');
select throws_ok($$select public.admin_search_users()$$,'MM004','forbidden','usuário comum não lista usuários');
select throws_ok($$select public.admin_search_participants()$$,'MM004','forbidden','usuário comum não lista participantes');
select throws_ok($$select public.admin_search_invites()$$,'MM004','forbidden','usuário comum não lista convites');
reset role;
select ok(not has_function_privilege('anon','public.admin_list_reveals(int,int,text)','execute'),'anon sem grant de pendências');
select ok(not has_function_privilege('anon','public.admin_search_users(int,int,text)','execute'),'anon sem grant de usuários');
select ok(not has_function_privilege('anon','public.admin_search_participants(int,int,text)','execute'),'anon sem grant de participantes');
select ok(not has_function_privilege('anon','public.admin_search_invites(int,int,text)','execute'),'anon sem grant de convites');
select * from finish();
rollback;
