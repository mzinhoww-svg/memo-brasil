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

## Itens P0/P1 em aberto (26)
| ID | Título | Prio | Status |
|---|---|---|---|
| BG-071 | Outbox de sincronização offline ainda é só desenho | P1 | BACKLOG |
| REL-001 | Confirmar destino Vercel (newmemocuiaba) e promover o preview a produção | P1 | BLOCKED |
| INF-001 | Validar e corrigir a conexão do Supabase MCP do Claude com o projeto asyaegeodyttttaubvxh (conta, organização, permissões) | P1 | READY |
| SB-004 | Configurar Google OAuth, login anônimo e URLs de redirect no Supabase remoto | P0 | BLOCKED |
| SB-005 | Edge Functions: drenar storage_purge_queue e validar upload (magic bytes, resolução) | P1 | BACKLOG |
| SB-006 | Realtime na interface: assinar mudanças do evento e recuperar eventos perdidos na reconexão | P1 | BACKLOG |
| SB-008 | Variáveis na Vercel e deploy de preview/produção apontando para o Supabase remoto | P0 | BLOCKED |
| UXA-001 | Auditoria UX/UI: screenshots em 320/375/390/430/768/1024/1440/1920 de todas as rotas e estados | P0 | BACKLOG |
| UXA-002 | Corrigir tela 'Evento criado': coluna larga em desktop, título sem quebra ruim, URL com campo e copiar | P1 | BACKLOG |
| DSV-001 | Tokens v2 por camada (Platform/Event/Admin) e breakpoints | P0 | BACKLOG |
| DSV-002 | Componentes v2 e layouts (formulário, dashboard, convite, galeria) com documentação em /design | P1 | BACKLOG |
| DSV-003 | Acessibilidade WCAG 2.2 AA: teclado, alvos de toque, reduced motion, contraste | P0 | BACKLOG |
| EST-001 | Migrations v2: event_themes, event_assets, bucket event-branding privado | P0 | BACKLOG |
| EST-002 | Renderer de tema isolado por evento (tokens, sem CSS arbitrário) + assinatura Powered by MemoriesMT | P0 | BACKLOG |
| EST-003 | Criação de evento completa (nome, tipo, data/hora, local, timezone, limites, revelação, prévia do convite) | P1 | BACKLOG |
| EST-004 | Personalização: presets, paleta com contraste validado, fonte, logo, capa, mensagem, estilo de QR, restaurar padrão | P0 | BACKLOG |
| EST-005 | Gestão do evento: indicadores, compartilhar/baixar QR, participantes, revogar convites, uploads, limites, contagem regressiva, status, exportação autorizada | P1 | BACKLOG |
| MAD-001 | Papéis de plataforma no servidor: platform_roles, is_master com linha ativa, provisionamento seguro do primeiro master | P0 | BACKLOG |
| MAD-002 | Auditoria v2: reason obrigatório, imutabilidade, actor_role, confirmação de ações destrutivas | P0 | BACKLOG |
| MAD-003 | Console master: dashboard, eventos, usuários, organizadores, convites, storage, revelações, segurança, configurações, analytics, LGPD, saúde | P1 | BACKLOG |
| MAD-004 | Acesso excepcional a foto privada por admin com justificativa e auditoria | P1 | BACKLOG |
| ANL-001 | RPCs/views agregadas reais para o dashboard (eventos, participantes, fotos, falhas, revelações, Storage, tendências) | P1 | BACKLOG |
| SCV-002 | Revisão de segurança: escalada de privilégio, XSS em tema/mensagem, upload malicioso, IDOR | P0 | BACKLOG |
| QAV-001 | Testes: unit, integração, E2E, autorização, RLS, upload, responsivo, a11y; screenshots antes/depois; três identidades | P0 | BACKLOG |
| QAV-002 | Revisão independente A1–A5 e correção de P0/P1 | P0 | BACKLOG |
| RLV-001 | Preview Vercel v2 validado (UI, login, criação, personalização, upload, revelação, dashboard, master, permissões, logs) | P0 | BACKLOG |

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
