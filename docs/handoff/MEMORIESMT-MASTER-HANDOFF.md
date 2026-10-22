# MemoriesMT — handoff do checkpoint A.5

Data: 21/10/2026, America/Cuiaba. Este arquivo foi criado porque o handoff original não estava no remoto. Não recupera conteúdo não enviado do Mac.

1. **Resumo:** A não concluída; NO-GO. Resultados atuais em `../supabase/A5-HOMOLOGATION-REPORT.md`.
2. **Produto:** álbum colaborativo de eventos; preservar escopo V2 e decisões existentes.
3. **Arquitetura:** aplicação Next.js em `web/`, adaptador Supabase e backend SQL/Storage/Functions; legado na raiz.
4. **Infraestrutura:** Supabase `asyaegeodyttttaubvxh`, Vercel `newmemocuiaba`.
5. **Repositório/worktrees:** `mzinhoww-svg/memo-brasil`; snapshot isolado nesta sessão; worktrees anteriores indisponíveis.
6. **Branches/commits:** origem V2 `feat/memoriesmt-studio` em `57a30eb`; preview `ca7a274`; `6d84c31` não localizado remotamente. Alterações desta rodada devem usar pai remoto, não o histórico sintético local.
7. **Produção:** anexos/A4 informam Lume legado; nenhum deploy ou promoção feitos nesta sessão. Conteúdo atual de Production não homologado.
8. **Preview:** `newmemocuiaba-p3dzw49y4-mzinhoww-gmailcoms-projects.vercel.app`, READY, autenticação Vercel bloqueia navegador desta sessão.
9. **Banco:** 16 migrations remotas confirmadas; nenhuma nova migration aplicada.
10. **Auth:** Master do operador confirmado no banco, concessão ativa; acesso UI confirmado pelo operador. SCV-010 passou no teste negativo. Refresh/expiração Google pendentes.
11. **Functions/jobs:** finalize-asset e purge-storage ativos; seis jobs ativos. Retorno 500 da purga corrigido só em código local, sem deploy remoto.
12. **Design System:** V2 disponível no código; não alegar novo aceite visual/físico.
13. **Event Studio:** testes unitários passaram; criação/personalização autenticadas ainda pendentes nesta rodada.
14. **Master Admin:** is_master e admin_health aprovados em contexto SQL simulado; organizador/convidado negados com MM004.
15. **Segurança:** RLS ativa em 16 tabelas; buckets privados; service key ainda em Production (INF-004). Nenhum segredo exportado.
16. **Testes:** 266/266 unitários e 4/4 do probe; typecheck/lint/build saída 0; 30/30 probes HTTP. E2E alternativo: 1 falhou, 15 não executados; integração, pgTAP e físicos com limites no relatório.
17. **Bloqueios:** sessão/browser, escopo Vercel, INF-004, INF-005, físicos; SCV-009 e QAV-004 abertos conforme relatório.
18. **Backlog:** fonte `../backlog/backlog.json`, 213 itens sem épicos; proposta de 256 não recuperada. Duas inconsistências de dependências encontradas, sem apagar evidências.
19. **Outras frentes:** B, Growth Factory e C apenas inventariadas, sem execução. Branches citadas nos anexos não aparecem no remoto consultado.
20. **Decisões:** manter A → B → Codex → C. Não refazer discovery. Não recriar Master nem rodar provisionamento personalizado.
21. **Riscos:** estado local não enviado pode divergir; faltam credenciais/stack descartável e testes reais; não usar backend compartilhado para suites destrutivas.
22. **Comandos:** `../supabase/A5-MANUAL-RUNBOOK.md`; não imprimir chaves da stack local.
23. **GO/NO-GO:** NO-GO atual. Resolver bloqueios, executar aceite autenticado/físico e rever evidências antes de novo parecer. GO não autoriza promoção.
24. **Próximas ações:** recuperar estado local; comparar branches; autorizar escopo Vercel; disponibilizar sessão preview; tratar INF-004; homologar INF-005; executar stack local; E2E autenticado; físicos; purga/higiene e novo parecer.
25. **Retomada autônoma:** ler este arquivo e `NEXT-SESSION.md`, conferir se o estado mudou e retomar somente os testes pendentes de A.5; preservar limitações e aprovações específicas.
