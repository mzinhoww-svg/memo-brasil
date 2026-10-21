# Release gates

| Gate | Critério | Estado | Evidência |
|---|---|---|---|
| G1 | Jornadas locais (eventos, convidados, fotos, revelação) | PASSA | 131 unit + 50 E2E (46 locais passando; 4 remotos) |
| G2 | Design system aderente (paridade de estilos, axe, 4 viewports) | PASSA | docs/qa/VISUAL-VALIDATION.md |
| G3 | Segurança básica do cliente (CSP, headers, locks, sem segredos) | PASSA com ressalvas | docs/qa/FINAL-AUDIT.md |
| G4 | Revelação programada validada em browser e no preview | ABERTO até o smoke remoto (FT-037) | e2e/reveal*.spec.ts |
| G5 | Auditoria independente concluída sem P0/P1 bloqueante (AUD-001) | ABERTO | docs/audit/ (a produzir) |
| G6 | Produção promovida e verificada (REL-001) | BLOQUEADO (destino não confirmado) | — |

## Itens P0/P1 em aberto (3)
| ID | Título | Prio | Status |
|---|---|---|---|
| BG-071 | Outbox de sincronização offline ainda é só desenho | P1 | BACKLOG |
| AUD-001 | Auditoria independente pré-Supabase (docs/audit/00..11) | P0 | READY |
| REL-001 | Confirmar destino Vercel (newmemocuiaba) e promover o preview a produção | P1 | BLOCKED |

## Decisão atual
**NO-GO para iniciar o Supabase** enquanto `AUD-001` (P0) estiver aberta. **GO para executar a auditoria independente** (`AUD-001`): as dependências estão concluídas, exceto a validação remota `FT-037`. Não declarar o produto pronto com P0/P1 bloqueantes em aberto.

## Próximos itens READY
| Prio | ID | Título |
|---|---|---|
| P0 | AUD-001 | Auditoria independente pré-Supabase (docs/audit/00..11) |
| P2 | BG-021 | Nome de evento longo a 375 px não medido |
| P2 | BG-022 | Sem validação em Safari/iOS e Firefox |
| P2 | BG-051 | Dependências sem auditoria de vulnerabilidades |
