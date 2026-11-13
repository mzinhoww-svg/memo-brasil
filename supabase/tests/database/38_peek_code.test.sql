-- pgTAP · peek_code: leitura do presente pelo link /c/<código>, sem consumir nada.
begin;
select no_plan();

create temp table fx on commit drop as
select
  (select code from public.plans where not is_free and pack_of is null order by price_cents limit 1) as plan;
grant select on fx to public;

insert into public.courtesy_codes (code_hash, code_hint, plan_code, max_uses, uses, expires_at, note, created_by) values
  (public.courtesy_code_hash('MMT-AAAA-AAAA'), 'MMT-AAAA', (select plan from fx), 1, 0, now() + interval '3 days', 'presente ativo', gen_random_uuid()),
  (public.courtesy_code_hash('MMT-BBBB-BBBB'), 'MMT-BBBB', (select plan from fx), 1, 1, now() + interval '3 days', 'presente usado', gen_random_uuid()),
  (public.courtesy_code_hash('MMT-CCCC-CCCC'), 'MMT-CCCC', (select plan from fx), 1, 0, now() - interval '1 day', 'presente expirado', gen_random_uuid());
insert into public.courtesy_codes (code_hash, code_hint, plan_code, max_uses, uses, expires_at, note, created_by, revoked_at) values
  (public.courtesy_code_hash('MMT-DDDD-DDDD'), 'MMT-DDDD', (select plan from fx), 1, 0, now() + interval '3 days', 'presente revogado', gen_random_uuid(), now());

set local role anon;
select is(public.peek_code('MMT-AAAA-AAAA')->>'status', 'ativo', 'código válido: ativo (anon pode ler)');
select is(public.peek_code('mmt aaaa aaaa')->>'status', 'ativo', 'normaliza maiúsculas e separadores');
select is(public.peek_code('AAAAAAAA')->>'status', 'ativo', 'aceita o corpo de 8 caracteres sem prefixo');
select is(public.peek_code('MMT-BBBB-BBBB')->>'status', 'usado', 'uso único já gasto: usado');
select is(public.peek_code('MMT-CCCC-CCCC')->>'status', 'expirado', 'vencido: expirado');
select is(public.peek_code('MMT-DDDD-DDDD')->>'status', 'revogado', 'revogado');
select is(public.peek_code('MMT-ZZZZ-ZZZZ'), '{"status":"invalido"}'::jsonb, 'desconhecido: só o status, sem plano');
select ok(public.peek_code('MMT-AAAA-AAAA') ? 'planName' and not (public.peek_code('MMT-AAAA-AAAA') ? 'note') and not (public.peek_code('MMT-AAAA-AAAA') ? 'uses'), 'traz o plano e nunca a nota nem a contagem de usos');
reset role;
select is((select uses from public.courtesy_codes where code_hint = 'MMT-AAAA'), 0, 'espiar não consome uso');

select * from finish();
rollback;
