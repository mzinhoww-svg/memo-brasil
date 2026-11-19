# MCP somente leitura (bot)

Servidor MCP para o bot consultar os dados do console Master **sem escrever nada**.

- **URL:** `https://fotosdocasamento.online/api/mcp` (Streamable HTTP, só `POST`, sem sessão)
- **Autenticação:** cabeçalho `Authorization: Bearer mcp_…`
- **Ferramentas:** `visao_geral`, `acessos`, `metricas`, `eventos`, `evento_detalhe`, pessoas, pagamentos, moderação, revelações,
  saúde, armazenamento, auditoria, LGPD, impressões, planos, configurações e `buscar` (31 no total; `tools/list` mostra todas).

## Como a leitura é garantida
O app só repassa o token. No banco, `mcp_read` confere o hash do token, **marca a transação como somente leitura** (o Postgres
recusa qualquer escrita, em qualquer função chamada) e despacha só para uma lista fechada de funções `admin_*` de leitura.
Fora da lista: códigos de cortesia, exportações e tudo que altera dados. O bot usa uma identidade própria sem senha
(`mcp-bot@fotosdocasamento.online`), que não consegue entrar no app.

## Emitir o token (uma vez)
No Supabase, **SQL Editor** do projeto de produção:

```sql
select public.mcp_issue_token('openbot');
```

O resultado (`mcp_` + 64 caracteres) aparece **só agora**; copie direto para a configuração do bot. O banco guarda apenas o hash.

## Revogar / trocar
```sql
select public.mcp_revoke_token('openbot');
select public.mcp_issue_token('openbot-2');
```

## Configurar no bot
Servidor MCP remoto (HTTP / Streamable HTTP) com a URL acima e o cabeçalho `Authorization: Bearer <token>`.
Se o bot só aceitar servidores locais (stdio), use a ponte:

```json
{ "command": "npx", "args": ["-y", "mcp-remote", "https://fotosdocasamento.online/api/mcp", "--header", "Authorization:Bearer ${MCP_TOKEN}"] }
```
