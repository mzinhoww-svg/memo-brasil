-- pgTAP · MCP somente leitura (bot): token por hash, identidade do bot só dentro da transação, lista fechada de funções de leitura
-- e transação marcada como somente leitura (qualquer escrita é recusada pelo Postgres).
begin;
select no_plan();

-- ===================================================== estrutura e privilégios
select has_table('public', 'mcp_tokens', 'mcp_tokens existe');
select has_function('public', 'mcp_read', array['text', 'text', 'jsonb'], 'mcp_read existe');
select ok(has_function_privilege('anon', 'public.mcp_read(text, text, jsonb)', 'execute'), 'anon chama mcp_read (o token decide)');
select ok(not has_function_privilege('anon', 'public.mcp_issue_token(text)', 'execute'), 'anon não emite token');
select ok(not has_function_privilege('authenticated', 'public.mcp_issue_token(text)', 'execute'), 'authenticated não emite token');
select ok(not has_function_privilege('authenticated', 'public.mcp_revoke_token(text)', 'execute'), 'authenticated não revoga token');
select ok(not has_table_privilege('anon', 'public.mcp_tokens', 'select'), 'anon não lê mcp_tokens');
select ok(not has_table_privilege('authenticated', 'public.mcp_tokens', 'select'), 'authenticated não lê mcp_tokens');
select is((select provolatile::text from pg_proc where oid = 'public.mcp_read(text, text, jsonb)'::regprocedure), 's', 'mcp_read é STABLE');

-- toda função da lista fechada é STABLE (não escreve)
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname = any (public.mcp_read_functions()) and p.provolatile <> 's'), 0,
          'todas as funções da lista são STABLE');
select is((select count(distinct p.proname)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname = any (public.mcp_read_functions())),
          cardinality(public.mcp_read_functions()), 'todas as funções da lista existem');

-- identidade do bot: papel master ativo, sem senha
select ok(exists (select 1 from public.platform_roles where user_id = '00000000-0000-4000-8000-00000000b07a' and role = 'master' and revoked_at is null),
          'bot tem papel master ativo');
select ok((select encrypted_password is null or encrypted_password = '' from auth.users where id = '00000000-0000-4000-8000-00000000b07a'),
          'bot não tem senha');

-- ===================================================== emissão e revogação (escritas: antes das leituras)
select public.mcp_issue_token('teste45') as tok \gset
select public.mcp_issue_token('revogado45') as tok_rev \gset
select ok(:'tok' ~ '^mcp_[0-9a-f]{64}$', 'token no formato mcp_ + 64 hex');
select ok(not exists (select 1 from public.mcp_tokens where token_hash = :'tok'), 'token em claro não é guardado');
select ok(public.mcp_revoke_token('revogado45'), 'revoga pelo nome');

-- ===================================================== leitura pelo bot (como anon, só com o token)
set local role anon;
select throws_ok(format('select public.mcp_read(%L, %L, %L)', 'mcp_' || repeat('0', 64), 'saude', '{}'), 'MM004', null, 'token inválido: MM004');
select throws_ok(format('select public.mcp_read(%L, %L, %L)', :'tok_rev', 'saude', '{}'), 'MM004', null, 'token revogado: MM004');
select throws_ok(format('select public.mcp_read(%L, %L, %L)', :'tok', 'admin_set_plan', '{}'), 'MM005', null, 'ferramenta fora da lista: MM005');

select ok(public.mcp_read(:'tok', 'visao_geral', '{}') is not null, 'visao_geral');
select ok(public.mcp_read(:'tok', 'acessos', '{"dias": 7}') is not null, 'acessos com dias');
select ok(public.mcp_read(:'tok', 'metricas', '{}') is not null, 'metricas');
select ok(public.mcp_read(:'tok', 'eventos', '{"limite": 5}') is not null, 'eventos');
select ok(public.mcp_read(:'tok', 'pagamentos', '{}') is not null, 'pagamentos (SETOF vira lista)');
select is(jsonb_typeof(public.mcp_read(:'tok', 'planos', '{}')), 'array', 'planos devolve lista');
select ok(public.mcp_read(:'tok', 'saude', '{}') is not null, 'saude');
select ok(public.mcp_read(:'tok', 'auditoria', '{}') is not null, 'auditoria');
select ok(public.mcp_read(:'tok', 'buscar', '{"texto": "ana"}') is not null, 'buscar');

-- depois de uma chamada, a transação é somente leitura: nenhuma escrita passa
select is(current_setting('transaction_read_only'), 'on', 'transação fica somente leitura');
reset role;
select throws_ok($$insert into public.mcp_tokens (name, token_hash, actor_id) values ('x', 'y', '00000000-0000-4000-8000-00000000b07a')$$,
                 '25006', null, 'escrita recusada pelo Postgres na transação do bot');

select * from finish();
rollback;
