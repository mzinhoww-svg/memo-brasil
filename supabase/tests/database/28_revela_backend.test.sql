-- pgTAP · Revela 2.0: embalagens/filme, plano em destaque + publicação de preços (TOTP), comentários, e-mail do convidado e aviso de revelação.
begin;
select no_plan();

create schema tests;
create function tests.login(p_user uuid, p_aal text default 'aal1', p_master boolean default false) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated', 'is_anonymous', false, 'aal', p_aal,
    'app_metadata', case when p_master then json_build_object('role', 'master') else '{}'::json end)::text, true);
  set local role authenticated;
end $$;
grant usage on schema tests to authenticated;

insert into auth.users (id, aud, role, email, is_anonymous) values
  ('00000000-0000-4000-8000-0000000028a1', 'authenticated', 'authenticated', 'host28@test.local', false),
  ('00000000-0000-4000-8000-0000000028b1', 'authenticated', 'authenticated', 'g1@test.local', false),
  ('00000000-0000-4000-8000-0000000028b2', 'authenticated', 'authenticated', 'g2@test.local', false),
  ('00000000-0000-4000-8000-0000000028b3', 'authenticated', 'authenticated', 'g3@test.local', false),
  ('00000000-0000-4000-8000-0000000028b4', 'authenticated', 'authenticated', 'g4@test.local', false),
  ('00000000-0000-4000-8000-0000000028c1', 'authenticated', 'authenticated', 'master28@test.local', false),
  ('00000000-0000-4000-8000-0000000028d1', 'authenticated', 'authenticated', 'stranger28@test.local', false);
insert into public.profiles (id) select id from auth.users where email like '%28@test.local' or email like 'g_@test.local' on conflict do nothing;
insert into public.platform_roles (user_id, role) values ('00000000-0000-4000-8000-0000000028c1', 'master');

-- evento já revelado (reveal desligado) e evento com revelação futura
insert into public.events (id, title, category, host_id, host_name, duration_hours, capacity, shots_per_person, camera_style, reveal_enabled, everyone_sees_all) values
  ('00000000-0000-4000-8000-0000000028e1', 'Revelado', 'festa', '00000000-0000-4000-8000-0000000028a1', 'Host', 6, 20, 10, 'casamento', false, true),
  ('00000000-0000-4000-8000-0000000028e2', 'Só as minhas', 'festa', '00000000-0000-4000-8000-0000000028a1', 'Host', 6, 20, 10, 'noite', false, false);
insert into public.events (id, title, category, host_id, host_name, duration_hours, capacity, shots_per_person, reveal_enabled, reveal_anchor) values
  ('00000000-0000-4000-8000-0000000028e3', 'Ainda no escuro', 'festa', '00000000-0000-4000-8000-0000000028a1', 'Host', 6, 20, 10, true, 'fim');
insert into public.participants (event_id, user_id, name) values
  ('00000000-0000-4000-8000-0000000028e1', '00000000-0000-4000-8000-0000000028b1', 'Ana'),
  ('00000000-0000-4000-8000-0000000028e1', '00000000-0000-4000-8000-0000000028b2', 'Bia'),
  ('00000000-0000-4000-8000-0000000028e1', '00000000-0000-4000-8000-0000000028b3', 'Caio'),
  ('00000000-0000-4000-8000-0000000028e1', '00000000-0000-4000-8000-0000000028b4', 'Davi'),
  ('00000000-0000-4000-8000-0000000028e2', '00000000-0000-4000-8000-0000000028b1', 'Ana'),
  ('00000000-0000-4000-8000-0000000028e2', '00000000-0000-4000-8000-0000000028b2', 'Bia'),
  ('00000000-0000-4000-8000-0000000028e3', '00000000-0000-4000-8000-0000000028b1', 'Ana');
insert into public.photos (id, event_id, author_id, author_name, storage_path, upload_status) values
  ('00000000-0000-4000-8000-0000000028f1', '00000000-0000-4000-8000-0000000028e1', '00000000-0000-4000-8000-0000000028b1', 'Ana', '00000000-0000-4000-8000-0000000028e1/00000000-0000-4000-8000-0000000028f1', 'pronta'),
  ('00000000-0000-4000-8000-0000000028f2', '00000000-0000-4000-8000-0000000028e2', '00000000-0000-4000-8000-0000000028b1', 'Ana', '00000000-0000-4000-8000-0000000028e2/00000000-0000-4000-8000-0000000028f2', 'pronta'),
  ('00000000-0000-4000-8000-0000000028f3', '00000000-0000-4000-8000-0000000028e3', '00000000-0000-4000-8000-0000000028b1', 'Ana', '00000000-0000-4000-8000-0000000028e3/00000000-0000-4000-8000-0000000028f3', 'pronta');

-- ===================================================================== 1. embalagens e filme
select has_column('public', 'events', 'film_look', 'events.film_look existe');
select is((select camera_style from public.events where id = '00000000-0000-4000-8000-0000000028e1'), 'casamento', 'camera_style aceita a embalagem casamento');
select throws_ok($$update public.events set camera_style = 'rosa-choque' where id = '00000000-0000-4000-8000-0000000028e1'$$, '23514', null, 'valor fora das 4 embalagens e dos legados é recusado');
select throws_ok($$update public.events set film_look = 'sepia' where id = '00000000-0000-4000-8000-0000000028e1'$$, '23514', null, 'film_look só aceita natural ou filme35');
select is((select film_look from public.events where id = '00000000-0000-4000-8000-0000000028e1'), 'filme35', 'evento novo nasce com Filme 35mm');
select tests.login('00000000-0000-4000-8000-0000000028b1');
select is(public.event_preview('XXXX')::text, null, 'prévia de código inexistente continua nula');
reset role;

-- ===================================================================== 2. plano em destaque e publicação
select has_column('public', 'plans', 'highlighted', 'plans.highlighted existe');
update public.plans set highlighted = true where code = 'casamento';
select throws_ok($$update public.plans set highlighted = true where code = 'festa'$$, '23505', null, 'só um plano pode ficar em destaque');
update public.plans set highlighted = false;
select ok((select (p ->> 'highlighted') is not null from jsonb_array_elements(public.list_public_plans()) p limit 1), 'catálogo público traz highlighted');

-- entitlement e pedido aberto de referência (não podem mudar com a publicação)
insert into public.event_entitlements (event_id, plan_code, max_guests, max_shots, source, env, status)
  values ('00000000-0000-4000-8000-0000000028e1', 'festa', 30, 24, 'pago', 'sandbox', 'ativo');
insert into public.payment_orders (id, event_id, host_id, plan_code, amount_cents, status, provider, provider_env, idempotency_key)
  values ('00000000-0000-4000-8000-0000000028a9', '00000000-0000-4000-8000-0000000028e2', '00000000-0000-4000-8000-0000000028a1', 'festa', 2900, 'pendente', 'validapay', 'sandbox', gen_random_uuid());
create temporary table ent_before as select max_guests, max_shots from public.event_entitlements where event_id = '00000000-0000-4000-8000-0000000028e1';

select tests.login('00000000-0000-4000-8000-0000000028a1', 'aal2');
select throws_ok($$select public.admin_publish_plans('[{"code":"festa","priceCents":3900,"maxGuests":30,"maxShots":24,"sandboxActive":true,"productionActive":true}]', 'Reajuste de teste')$$, 'MM004', null, 'não-master não publica');
reset role;

select tests.login('00000000-0000-4000-8000-0000000028c1', 'aal1', true);
select throws_ok($$select public.admin_publish_plans('[{"code":"festa","priceCents":3900,"maxGuests":30,"maxShots":24,"sandboxActive":true,"productionActive":true}]', 'Reajuste de teste')$$, 'MM016', null, 'sem segundo fator (aal1) a publicação é recusada');
reset role;

select tests.login('00000000-0000-4000-8000-0000000028c1', 'aal2', true);
select throws_ok($$select public.admin_publish_plans('[{"code":"festa","priceCents":3900,"maxGuests":30,"maxShots":24,"sandboxActive":true,"productionActive":true}]', 'curto')$$, 'MM011', null, 'justificativa curta é recusada');
select throws_ok($$select public.admin_publish_plans('[{"code":"festa","priceCents":50,"maxGuests":30,"maxShots":24,"sandboxActive":true,"productionActive":true}]', 'Preço abaixo do mínimo')$$, 'MM005', null, 'preço abaixo de R$ 1 é recusado');
select throws_ok($$select public.admin_publish_plans('[{"code":"festa","priceCents":2900,"maxGuests":30,"maxShots":24,"sandboxActive":true,"productionActive":true,"highlighted":true},{"code":"casamento","priceCents":18900,"maxGuests":250,"maxShots":36,"sandboxActive":true,"productionActive":true,"highlighted":true}]', 'Dois destaques juntos')$$, 'MM005', null, 'dois destaques na mesma publicação são recusados');
select is((public.admin_publish_plans('[{"code":"festa","priceCents":3900,"maxGuests":40,"maxShots":24,"sandboxActive":true,"productionActive":true,"highlighted":true},{"code":"casamento","priceCents":18900,"maxGuests":250,"maxShots":36,"sandboxActive":true,"productionActive":true}]', 'Reajuste da festa para R$ 39') ->> 'changed')::int, 1, 'publica só o que mudou');
reset role;
select is((select price_cents || '/' || max_guests || '/' || highlighted from public.plans where code = 'festa'), '3900/40/true', 'plans gravou preço, convidados e destaque');
select is((select count(*)::int from public.plans where highlighted), 1, 'exatamente um plano em destaque');
select is((select count(*)::int from public.audit_logs where action = 'plan.price_changed' and target_id = 'festa'
           and detail -> 'old' ->> 'priceCents' = '2900' and detail -> 'new' ->> 'priceCents' = '3900'), 1, 'audit_logs registra plan.price_changed de → para');
select is((select count(*)::int from public.audit_logs where action = 'plan.price_changed' and target_id = 'casamento'), 0, 'plano sem alteração não gera registro');
select results_eq($$select max_guests, max_shots from public.event_entitlements where event_id = '00000000-0000-4000-8000-0000000028e1'$$, $$select max_guests, max_shots from ent_before$$, 'direitos já concedidos não mudam');
select is((select amount_cents from public.payment_orders where id = '00000000-0000-4000-8000-0000000028a9'), 2900, 'Pix aberto mantém o valor cotado');
select tests.login('00000000-0000-4000-8000-0000000028c1', 'aal2', true);
select lives_ok($$select public.admin_publish_plans('[{"code":"novo2","name":"Novo 2","priceCents":4900,"maxGuests":60,"maxShots":24,"sandboxActive":true,"productionActive":false,"isNew":true}]', 'Plano novo de teste')$$, 'cria plano novo');
reset role;
select is((select price_cents from public.plans where code = 'novo2'), 4900, 'plano novo gravado');
select tests.login('00000000-0000-4000-8000-0000000028c1', 'aal2', true);
select throws_ok($$select public.admin_publish_plans('[{"code":"gratis","priceCents":500,"maxGuests":10,"maxShots":10,"sandboxActive":true,"productionActive":true}]', 'Tentando mudar o grátis')$$, 'MM005', null, 'o grátis não muda de preço');
reset role;

-- ===================================================================== 3. comentários
select tests.login('00000000-0000-4000-8000-0000000028b1');
select throws_ok($$select public.post_comment('00000000-0000-4000-8000-0000000028f3', 'oi')$$, 'MM017', null, 'antes da revelação não se comenta');
select throws_ok($$select public.post_comment('00000000-0000-4000-8000-0000000028f1', '')$$, 'MM005', null, 'comentário vazio é recusado');
select throws_ok($$select public.post_comment('00000000-0000-4000-8000-0000000028f1', repeat('a', 281))$$, 'MM005', null, 'mais de 280 caracteres é recusado');
select lives_ok($$select public.post_comment('00000000-0000-4000-8000-0000000028f1', repeat('a', 280))$$, '280 caracteres passa');
select lives_ok($$select public.post_comment('00000000-0000-4000-8000-0000000028f1', 'Que noite!')$$, 'membro comenta depois da revelação');
reset role;
select is((select author_name from public.photo_comments where body = 'Que noite!'), 'Ana', 'autor vem do cadastro do participante');
select tests.login('00000000-0000-4000-8000-0000000028d1');
select throws_ok($$select public.post_comment('00000000-0000-4000-8000-0000000028f1', 'intruso')$$, 'MM004', null, 'quem não é do evento não comenta');
select is((select count(*)::int from public.photo_comments), 0, 'RLS: estranho não lê comentários');
reset role;
-- everyone_sees_all = false: Bia não vê a foto da Ana, então não comenta nem lê
select tests.login('00000000-0000-4000-8000-0000000028b2');
select throws_ok($$select public.post_comment('00000000-0000-4000-8000-0000000028f2', 'posso?')$$, 'MM004', null, 'everyone_sees_all=false: não comenta foto alheia');
select lives_ok($$select public.post_comment('00000000-0000-4000-8000-0000000028f1', 'Linda!')$$, 'comenta foto que vê');
select is(jsonb_array_length(public.list_photo_comments('00000000-0000-4000-8000-0000000028f1')), 3, 'lista os 3 comentários visíveis');
reset role;
select tests.login('00000000-0000-4000-8000-0000000028b1');
select lives_ok($$select public.post_comment('00000000-0000-4000-8000-0000000028f2', 'minha foto, meu comentário')$$, 'autor da foto comenta nela mesmo com everyone_sees_all=false');
reset role;

-- curtir (liga e desliga) e denunciar (3 pessoas escondem)
select tests.login('00000000-0000-4000-8000-0000000028b2');
select is((public.toggle_comment_like((select id from public.photo_comments where body = 'Que noite!')) ->> 'likes')::int, 1, 'curtida soma');
select is((public.toggle_comment_like((select id from public.photo_comments where body = 'Que noite!')) ->> 'likes')::int, 0, 'segunda chamada desfaz a curtida');
select is((public.report_comment((select id from public.photo_comments where body = 'Que noite!')) ->> 'reports')::int, 1, '1ª denúncia');
select is((public.report_comment((select id from public.photo_comments where body = 'Que noite!')) ->> 'reports')::int, 1, 'denúncia repetida da mesma pessoa não soma');
reset role;
select tests.login('00000000-0000-4000-8000-0000000028b3');
select is((public.report_comment((select id from public.photo_comments where body = 'Que noite!')) ->> 'hidden')::boolean, false, '2 denúncias ainda não escondem');
reset role;
select tests.login('00000000-0000-4000-8000-0000000028b4');
select is((public.report_comment((select id from public.photo_comments where body = 'Que noite!')) ->> 'hidden')::boolean, true, 'a 3ª denúncia esconde o comentário');
select is((select count(*)::int from jsonb_array_elements(public.list_photo_comments('00000000-0000-4000-8000-0000000028f1')) c where c ->> 'body' = 'Que noite!'), 0, 'convidado não vê o comentário escondido');
reset role;
select tests.login('00000000-0000-4000-8000-0000000028a1');
select is((select count(*)::int from jsonb_array_elements(public.list_photo_comments('00000000-0000-4000-8000-0000000028f1')) c where c ->> 'body' = 'Que noite!'), 1, 'anfitrião vê o escondido, com denúncias');
select lives_ok($$select public.moderate_comment((select id from public.photo_comments where body = 'Que noite!'), 'mostrar')$$, 'anfitrião devolve o comentário ao feed');
select lives_ok($$select public.moderate_comment((select id from public.photo_comments where body = 'Linda!'), 'remover')$$, 'anfitrião remove comentário');
reset role;
select is((select count(*)::int from public.audit_logs where action in ('comment.mostrar', 'comment.remover') and event_id = '00000000-0000-4000-8000-0000000028e1'), 2, 'moderação do anfitrião é auditada');
select tests.login('00000000-0000-4000-8000-0000000028b1');
select throws_ok($$select public.moderate_comment((select id from public.photo_comments where body = 'Que noite!'), 'esconder')$$, 'MM004', null, 'convidado não modera');
reset role;
select tests.login('00000000-0000-4000-8000-0000000028c1', 'aal2', true);
select throws_ok($$select public.moderate_comment((select id from public.photo_comments where body = 'Que noite!'), 'esconder')$$, 'MM011', null, 'Master precisa de justificativa');
select lives_ok($$select public.moderate_comment((select id from public.photo_comments where body = 'Que noite!'), 'esconder', 'Conteúdo ofensivo denunciado')$$, 'Master esconde com justificativa');
reset role;
select is((select hidden_by from public.photo_comments where body = 'Que noite!'), 'master', 'registra quem escondeu');

-- rate limit: check_rate_limit conta a partir da 2ª chamada (limite 20 = 21 comentários passam); Ana já fez 3: 280 chars, "Que noite!" e "minha foto..."
select tests.login('00000000-0000-4000-8000-0000000028b1');
do $$ begin for i in 1..18 loop perform public.post_comment('00000000-0000-4000-8000-0000000028f1', 'c' || i); end loop; end $$;
select throws_ok($$select public.post_comment('00000000-0000-4000-8000-0000000028f1', 'passou do limite')$$, 'MM006', null, 'rate limit de comentários');
reset role;

-- ===================================================================== 4. e-mail do convidado e aviso de revelação
select has_table('public', 'participant_emails', 'tabela de e-mails dos convidados existe');
select tests.login('00000000-0000-4000-8000-0000000028b1');
select throws_ok($$select public.set_my_email('00000000-0000-4000-8000-0000000028e3', 'ana@exemplo.com', false)$$, 'MM018', null, 'e-mail sem consentimento é recusado');
select throws_ok($$select public.set_my_email('00000000-0000-4000-8000-0000000028e3', 'isso-nao-e-email', true)$$, 'MM005', null, 'e-mail inválido é recusado');
select lives_ok($$select public.set_my_email('00000000-0000-4000-8000-0000000028e3', 'Ana@Exemplo.com', true)$$, 'guarda com consentimento');
select is(public.get_my_email('00000000-0000-4000-8000-0000000028e3') ->> 'email', 'ana@exemplo.com', 'normaliza para minúsculas');
select throws_ok($$select email from public.participant_emails$$, '42501', null, 'e-mail não é legível pelo cliente (tabela sem GRANT)');
select throws_ok($$select optout_token from public.participant_emails$$, '42501', null, 'token de descadastro não é legível pelo cliente');
reset role;
select tests.login('00000000-0000-4000-8000-0000000028d1');
select throws_ok($$select public.set_my_email('00000000-0000-4000-8000-0000000028e3', 'x@exemplo.com', true)$$, 'MM004', null, 'estranho não grava e-mail no evento');
reset role;

-- o evento 3 chega na hora da revelação: o job enfileira uma vez, idempotente
update public.events set reveal_at = now() - interval '1 minute', start_at = now() - interval '7 hours' where id = '00000000-0000-4000-8000-0000000028e3';
select is(public.reveal_due_events(), 1, 'job revela o evento vencido (via release_reveal)');
select is((select count(*)::int from public.reveal_email_queue where event_id = '00000000-0000-4000-8000-0000000028e3'), 1, 'um e-mail na fila (só quem consentiu)');
select is(public.reveal_due_events(), 0, 'segunda execução não revela nem enfileira de novo');
select is((select count(*)::int from public.reveal_email_queue where event_id = '00000000-0000-4000-8000-0000000028e3'), 1, 'fila segue com uma linha por pessoa');
select is(public.release_reveal('00000000-0000-4000-8000-0000000028e3', now(), 'master'), false, 'revelar de novo (manual) não faz nada nem duplica o aviso');
select is((select count(*)::int from public.claim_reveal_emails(10)), 1, 'envio reivindica o lote');
select is((select count(*)::int from public.claim_reveal_emails(10)), 0, 'lote já reivindicado não sai de novo');
select is(public.mark_reveal_email_sent((select id from public.reveal_email_queue limit 1)), true, 'marca como enviado');
select is(public.mark_reveal_email_sent((select id from public.reveal_email_queue limit 1)), false, 'segundo envio da mesma linha é ignorado');
-- opt-out pelo link do e-mail (sem login)
create temporary table tok as select optout_token from public.reveal_email_queue limit 1;
grant select on tok to anon;
set local role anon;
select is(public.email_opt_out((select optout_token from tok)), true, 'descadastro pelo token funciona sem login');
reset role;
select is((select email from public.participant_emails where event_id = '00000000-0000-4000-8000-0000000028e3' and user_id = '00000000-0000-4000-8000-0000000028b1'), null, 'descadastro apaga o e-mail');
select is((select opt_out_at is not null from public.participant_emails where event_id = '00000000-0000-4000-8000-0000000028e3' and user_id = '00000000-0000-4000-8000-0000000028b1'), true, 'e registra a saída');

select * from finish();
rollback;
