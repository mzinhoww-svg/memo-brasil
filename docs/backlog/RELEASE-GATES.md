# Release gates

| Gate | Critério | Estado | Evidência |
|---|---|---|---|
| G1 | Jornadas locais (eventos, convidados, fotos, revelação) | PASSA | 131 unit + 46 E2E + 29 testes de auditoria (A1); docs/audit/01-FUNCTIONAL-COVERAGE.md |
| G2 | Design system aderente (paridade de estilos, axe, 4 viewports, 284 estados) | PASSA | docs/audit/02-VISUAL-COMPLIANCE.md |
| G3 | Segurança do cliente pré-backend (sem segredos, XSS, headers, locks) | PASSA com ressalvas | docs/audit/04-SECURITY-REVIEW.md |
| G4 | Revelação programada validada em browser e no preview | PASSA (preview 5d8df4a) | e2e/reveal*.spec.ts; e2e/remote.spec.ts |
| G5 | Auditoria independente AUD-001 executada | CONCLUÍDA: resultado NO-GO para integrar agora | docs/audit/11-RELEASE-GATE.md |
| G6 | Reauditoria dos P1 (AUD-002) após as correções | ABERTO | docs/audit/10-REMEDIATION-BACKLOG.md |
| G7 | Acesso do conector Supabase ao projeto (INF-001) | ABERTO (bloqueio de infraestrutura) | docs/audit/evidence/logs/vercel-supabase-inspection.md |
| G8 | Produção promovida e verificada (REL-001) | BLOQUEADO (destino não confirmado) | — |

## Itens P0/P1 em aberto (4)
| ID | Título | Prio | Status |
|---|---|---|---|
| BG-071 | Outbox de sincronização offline ainda é só desenho | P1 | BACKLOG |
| REL-001 | Confirmar destino Vercel (newmemocuiaba) e promover o preview a produção | P1 | BLOCKED |
| INF-001 | Validar e corrigir a conexão do Supabase MCP do Claude com o projeto asyaegeodyttttaubvxh (conta, organização, permissões) | P1 | READY |
| AUD-002 | Reauditoria dos P1 após as correções (gate para iniciar a fase Supabase) | P1 | BACKLOG |

## Decisão atual (AUD-001)
**NO-GO para iniciar a integração com o Supabase agora.** Não há P0; há 1 P1 de produto (`BG-101`) e 6 P1 de integração (`ITG-101..ITG-106`). O caminho até **CONDITIONAL GO** é curto e não exige reescrever o produto: ondas 1 a 3 em `docs/audit/10-REMEDIATION-BACKLOG.md`, depois `AUD-002`. **GO para continuar a fase pré-backend** (correções). Nenhum item de EP-09 deve começar antes de `AUD-002`. `INF-001` (acesso do conector) corre em paralelo.

## Próximos itens READY
| Prio | ID | Título |
|---|---|---|
| P1 | INF-001 | Validar e corrigir a conexão do Supabase MCP do Claude com o projeto asyaegeodyttttaubvxh (conta, organização, permissões) |
| P2 | BG-022 | Sem validação em Safari/iOS e Firefox |
| P2 | BG-103 | 'Remover da festa' não impede a reentrada com o mesmo código |
| P2 | BG-104 | Diálogo de revelação: foco, Escape, landmark e não bloquear a postagem |
| P2 | BG-105 | Foco do Sheet volta ao primeiro controle a cada tick do relógio; fundo não inerte |
| P2 | BG-106 | Falha de escrita deixa botões presos em 'ocupado' (wizard, entrar, ZIP) |
| P2 | BG-107 | Falha de leitura vira 'Carregando a festa…' eterno |
| P2 | BG-108 | Sem IndexedDB o app confirma ações que não persistem e o aviso global não aparece |
| P2 | BG-109 | Tela de revelação inverte no tema Noite |
| P2 | BG-110 | Seletor de evento do painel estoura com nome de 60 caracteres |
| P2 | BG-112 | Limites de campos só em maxLength; domínio e serviços não validam |
