# MCP somente leitura para o bot (OpenBot)

## Por quê
O bot do dono precisa consultar os dados do console Master, sobretudo a visão geral e os acessos, mas também eventos, pessoas,
pagamentos, moderação, saúde, auditoria e o resto, **sem nunca escrever**.

## Decidido pelo dono
- Abordagem A: rota MCP dentro do app (`https://fotosdocasamento.online/api/mcp`), publicada pela Vercel.
- Somente leitura.

## Abordagens consideradas
- **A. Rota no app (escolhida):** mesmo repositório, testes e deploy; o bot só conhece uma URL e um token.
- B. Edge Function no Supabase: mesmo resultado, código separado em Deno e deploy manual.
- C. Programa local: exige a chave administrativa do banco na máquina do bot.

## Design
- **Transporte:** MCP Streamable HTTP sem sessão (POST com JSON-RPC, resposta `application/json`), métodos `initialize`,
  `notifications/initialized`, `ping`, `tools/list` e `tools/call`. Autenticação: `Authorization: Bearer <token>`.
- **Banco decide o acesso**, não o app:
  - Tabela `mcp_tokens` (só o hash SHA-256 do token; revogável; sem grants para clientes).
  - Identidade do bot: usuário `mcp-bot` sem senha (não consegue entrar no app), com papel de plataforma `master` concedido por
    operador com justificativa. *(Chamada do Claude: `admin_overview`, pagamentos, moderação e detalhe de evento exigem master; o
    papel `auditor` não cobriria a visão geral.)*
  - RPC única `mcp_read(p_token, p_tool, p_args)` (STABLE, security definer, liberada para `anon`): confere o token, **liga
    `transaction_read_only`** (qualquer escrita, em qualquer função chamada, é recusada pelo Postgres), assume a identidade do bot
    só dentro da transação e despacha para uma **lista fechada** de funções `admin_*` de leitura (todas STABLE).
  - `mcp_issue_token(nome)` / `mcp_revoke_token(nome)`: só operador (SQL editor do Supabase); o token em claro aparece uma vez.
- **App:** `web/src/app/api/mcp/route.ts` fino; lógica pura (catálogo de ferramentas e protocolo) em `web/src/features/mcp/`.
  O app usa a chave pública do Supabase; não precisa de segredo novo na Vercel.
- **Ferramentas (pt-BR):** visao_geral, metricas, acessos, eventos, evento_detalhe, eventos_lista, pessoas_contagens,
  organizadores, usuarios, buscar_usuarios, participantes, buscar_participantes, convites, equipe, pagamentos,
  pagamentos_resumo, pagamentos_divergencias, moderacao_fila, revelacoes, revelacoes_lista, saude, saude_historico,
  armazenamento, auditoria, auditoria_eventos, lgpd, impressoes, impressao_detalhe, planos, configuracoes, buscar.
- **Fora:** códigos de cortesia (são credenciais resgatáveis), exportações CSV, eventos de teste e tudo que escreve.
  *(Chamada do Claude.)*

## Anti-metas
- Qualquer caminho de escrita a partir do bot.
- Token em claro guardado em algum lugar além do bot.
