# Release gates

| Gate | Critério | Estado | Evidência |
|---|---|---|---|
| G1 | Jornadas locais (eventos, convidados, fotos, revelação) | PASSA | 242 unit + 50 E2E locais; docs/audit/01-FUNCTIONAL-COVERAGE.md |
| G2 | Design system v1 aderente (paridade, axe, viewports) | PASSA | docs/audit/02-VISUAL-COMPLIANCE.md |
| G3 | Segurança do cliente pré-backend | PASSA com ressalvas | docs/audit/04-SECURITY-REVIEW.md |
| G4 | Revelação programada no servidor (remoto) | PASSA | integração remota 12/12 e adaptador 9/9 (docs/supabase/REMOTE-HOMOLOGATION.md) |
| G5 | Auditoria independente AUD-001 / reauditoria AUD-002 | CONCLUÍDAS (CONDITIONAL GO) | docs/audit/11-RELEASE-GATE.md |
| G6 | Google OAuth + callback no preview (login real) | PASSA | docs/supabase/REMOTE-HOMOLOGATION.md (rodada 3) |
| G7 | Fluxo de convidado com RLS e fotos pelo navegador no preview remoto | PENDENTE | SB-004/SB-008 |
| G8 | Variáveis de Production confirmadas e domínio servindo o MemoriesMT | BLOQUEADO (domínio serve o Lume legado; valores criptografados) | REL-001, INF-002 |
| G9 | V2 backend: pgTAP e E2E de autorização em Supabase local | PASSA (local; não aplicado no remoto) | pgTAP 366/366; e2e/master-studio.spec.ts 5/5; docs/supabase/MIGRATIONS-V2.md |
| G10 | V2: revisão independente A1–A5 e correção de P0/P1 | EM ANDAMENTO | docs/audit/ux/INVENTARIO.md; revisões da sessão |
| G11 | Acesso do conector Supabase ao projeto (INF-001) | ABERTO | INF-001 |

## Itens P0/P1 em aberto (40)
| ID | Título | Prio | Status |
|---|---|---|---|
| BG-071 | Outbox de sincronização offline ainda é só desenho | P1 | BACKLOG |
| REL-001 | Confirmar destino Vercel (newmemocuiaba) e promover o preview a produção | P1 | BLOCKED |
| INF-001 | Validar e corrigir a conexão do Supabase MCP do Claude com o projeto asyaegeodyttttaubvxh (conta, organização, permissões) | P1 | READY |
| SB-004 | Configurar Google OAuth, login anônimo e URLs de redirect no Supabase remoto | P0 | BLOCKED |
| SB-005 | Edge Functions: drenar storage_purge_queue e validar upload (magic bytes, resolução) | P1 | BACKLOG |
| SB-006 | Realtime na interface: assinar mudanças do evento e recuperar eventos perdidos na reconexão | P1 | BACKLOG |
| SB-008 | Variáveis na Vercel e deploy de preview/produção apontando para o Supabase remoto | P0 | BLOCKED |
| DSV-001 | Tokens v2 por camada (Platform/Event/Admin) e breakpoints | P0 | IN_REVIEW |
| DSV-002 | Componentes v2 e layouts (formulário, dashboard, convite, galeria) com documentação em /design | P1 | BACKLOG |
| DSV-003 | Acessibilidade WCAG 2.2 AA: teclado, alvos de toque, reduced motion, contraste | P0 | BACKLOG |
| EST-001 | Migrations v2: event_themes, event_assets, bucket event-branding privado | P0 | IN_REVIEW |
| EST-002 | Renderer de tema isolado por evento (tokens, sem CSS arbitrário) + assinatura Powered by MemoriesMT | P0 | IN_REVIEW |
| EST-003 | Criação de evento completa (nome, tipo, data/hora, local, timezone, limites, revelação, prévia do convite) | P1 | BACKLOG |
| EST-004 | Personalização: presets, paleta com contraste validado, fonte, logo, capa, mensagem, estilo de QR, restaurar padrão | P0 | IN_REVIEW |
| EST-005 | Gestão do evento: indicadores, compartilhar/baixar QR, participantes, revogar convites, uploads, limites, contagem regressiva, status, exportação autorizada | P1 | BACKLOG |
| MAD-001 | Papéis de plataforma no servidor: platform_roles, is_master com linha ativa, provisionamento seguro do primeiro master | P0 | IN_REVIEW |
| MAD-002 | Auditoria v2: reason obrigatório, imutabilidade, actor_role, confirmação de ações destrutivas | P0 | IN_REVIEW |
| MAD-003 | Console master: dashboard, eventos, usuários, organizadores, convites, storage, revelações, segurança, configurações, analytics, LGPD, saúde | P1 | IN_REVIEW |
| MAD-004 | Acesso excepcional a foto privada por admin com justificativa e auditoria | P1 | BACKLOG |
| ANL-001 | RPCs/views agregadas reais para o dashboard (eventos, participantes, fotos, falhas, revelações, Storage, tendências) | P1 | IN_REVIEW |
| SCV-002 | Revisão de segurança: escalada de privilégio, XSS em tema/mensagem, upload malicioso, IDOR | P0 | BACKLOG |
| QAV-001 | Testes: unit, integração, E2E, autorização, RLS, upload, responsivo, a11y; screenshots antes/depois; três identidades | P0 | IN_REVIEW |
| QAV-002 | Revisão independente A1–A5 e correção de P0/P1 | P0 | IN_REVIEW |
| RLV-001 | Preview Vercel v2 validado (UI, login, criação, personalização, upload, revelação, dashboard, master, permissões, logs) | P0 | BLOCKED |
| UXA-104 | [Administrativa] /painel/[id]/conteudo · Pedidos de remoção/Ocultas/Todas: Moderação mostra 1 foto de 480px por vez numa área de ~1000px; sem grade, seleção em massa ou comparação; fila longa vira rol | P1 | BACKLOG |
| COM-004 | Termos de uso, política de privacidade e registro de aceite (organizador e convidado) | P0 | BACKLOG |
| COM-001 | Modelo de planos e entitlements no banco (plano por evento/organizador) | P1 | BACKLOG |
| COM-003 | Enforcement server-side dos limites por plano (convidados, fotos, upload de identidade) | P1 | BACKLOG |
| COM-002 | Gateway de pagamento (Pix e cartão) com webhooks idempotentes e conciliação | P1 | BACKLOG |
| COM-006 | Página de planos e checkout do organizador | P1 | BACKLOG |
| COM-005 | E-mail transacional (recibo, aviso de revelação, convite) com remetente de marca | P1 | BACKLOG |
| COM-009 | Backup, PITR e teste de restauração; política de retenção de fotos | P1 | BACKLOG |
| SCV-003 | Provisionamento do master: desligar provider e-mail/senha (ou confirmação) no remoto e validar identidade Google sem senha | P0 | BACKLOG |
| SCV-004 | Worker de purga que respeita o bucket e agendamento de expire_pending_assets; limpar logo/capa na exclusão LGPD | P1 | BACKLOG |
| SCV-006 | Upload de identidade: magic bytes, dimensões reais e reencode no servidor antes de exibir a convidados | P1 | BACKLOG |
| SCV-008 | Validar em banco (Supabase local) a migration 20261022000700 e as edições de endurecimento; reconciliar contagem pgTAP | P0 | BLOCKED |
| EST-006 | Logo e capa nas demais telas do convidado e na prévia do convite (assinatura de URL fora da RLS para quem ainda não entrou) | P1 | BACKLOG |
| DSV-004 | Tokens --mm-* v2 completos (espaço, raio, sombra, movimento) e documentação do DS v2 em /design (Studio, Admin DS, tema) | P1 | BACKLOG |
| MAD-005 | Escrita de settings e feature flags no console com justificativa, confirmação e auditoria | P1 | BACKLOG |
| QAV-003 | Isolamento do tema nas telas do convidado em modo Supabase, sessão expirada com tema e permissões do organizador no adaptador | P1 | BACKLOG |

## Decisão atual
**V1: NO-GO para produção** até REL-001/SB-008 (domínio serve o app legado e as variáveis de Production não foram verificadas) e G7 (fluxo de convidado no preview remoto). **V2: GO para preview** (nunca promover antes da V1 e da revisão independente). Itens da V2 em IN_REVIEW dependem da revisão A1–A5; nada aqui está DONE por ter sido codificado.

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
