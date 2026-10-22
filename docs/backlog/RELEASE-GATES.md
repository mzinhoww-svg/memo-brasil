# Release gates

| Gate | Critério | Estado | Evidência |
|---|---|---|---|
| G1 | Jornadas locais e E2E | PARCIAL: 266 unitários; E2E alternativo 1 falhou/15 não executados | docs/supabase/A5-HOMOLOGATION-REPORT.md |
| G2 | Design system v1 e acessibilidade | HISTÓRICO; sem novo aceite físico nesta A5 | docs/audit/02-VISUAL-COMPLIANCE.md; docs/supabase/A5-HOMOLOGATION-REPORT.md |
| G3 | Segurança cliente/backend | PARCIAL: 30 probes e RLS; INF-004 aberto | docs/supabase/A5-HOMOLOGATION-REPORT.md |
| G4 | Revelação programada no servidor | Agenda ativa/zero atraso; nova jornada E2E pendente | docs/supabase/A5-HOMOLOGATION-REPORT.md |
| G5 | Auditoria/revisão independente | Revisão do diff A5 concluída; parecer NO-GO | docs/supabase/A5-REVIEW.md |
| G6 | Google OAuth e sessão | PARCIAL: Master confirmado; refresh/expiração pendentes | docs/supabase/A5-HOMOLOGATION-REPORT.md |
| G7 | Convidado: upload, Storage, quotas, galeria e revelação | PARCIAL; E2E autenticado/físicos pendentes | docs/supabase/A5-HOMOLOGATION-REPORT.md |
| G8 | Production pronta para promoção | BLOQUEADO: INF-004; promoção não autorizada | docs/supabase/A5-HOMOLOGATION-REPORT.md |
| G9 | Backend V2 local: pgTAP/integração | NÃO REEXECUTADO: stack local indisponível; histórico nos anexos | docs/supabase/A5-HOMOLOGATION-REPORT.md |
| G10 | Aceite completo V2 | BLOQUEADO; A não concluída | docs/supabase/A5-HOMOLOGATION-REPORT.md |
| G12 | Migrations V2 e Edge Functions remotas | PASSA no inventário: 16 migrations e duas Functions ativas | docs/supabase/evidence/a5-20261021/backend-readonly.json; docs/supabase/A5-HOMOLOGATION-REPORT.md |
| G11 | Conector Supabase acessa o projeto correto | PASSA: consultas remotas de leitura | docs/supabase/evidence/a5-20261021/backend-readonly.json |

## Itens P0/P1 em aberto (53)
| ID | Título | Prio | Status |
|---|---|---|---|
| BG-071 | Outbox de sincronização offline ainda é só desenho | P1 | BACKLOG |
| REL-001 | Confirmar destino Vercel (newmemocuiaba) e promover o preview a produção | P1 | BLOCKED |
| INF-001 | Validar e corrigir a conexão do Supabase MCP do Claude com o projeto asyaegeodyttttaubvxh (conta, organização, permissões) | P1 | READY |
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
| COM-004 | Termos de uso, política de privacidade e registro de aceite (organizador e convidado) | P0 | IN_REVIEW |
| COM-001 | Modelo de planos e entitlements no banco (plano por evento/organizador) | P1 | BACKLOG |
| COM-003 | Enforcement server-side dos limites por plano (convidados, fotos, upload de identidade) | P1 | BACKLOG |
| COM-002 | Gateway de pagamento (Pix e cartão) com webhooks idempotentes e conciliação | P1 | IN_REVIEW |
| COM-006 | Página de planos e checkout do organizador | P1 | BACKLOG |
| COM-005 | E-mail transacional (recibo, aviso de revelação, convite) com remetente de marca | P1 | BACKLOG |
| COM-009 | Backup, PITR e teste de restauração; política de retenção de fotos | P1 | BACKLOG |
| COM-017 | Códigos de cortesia: Master gera, organizador resgata (Plano, Ajustes ou link /c/) | P1 | READY |
| SCV-003 | Provisionamento do master: desligar provider e-mail/senha (ou confirmação) no remoto e validar identidade Google sem senha | P0 | IN_REVIEW |
| SCV-004 | Worker de purga que respeita o bucket e agendamento de expire_pending_assets; limpar logo/capa na exclusão LGPD | P1 | IN_REVIEW |
| SCV-006 | Upload de identidade: magic bytes, dimensões reais e reencode no servidor antes de exibir a convidados | P1 | IN_REVIEW |
| SCV-008 | Validar em banco (Supabase local) a migration 20261022000700 e as edições de endurecimento; reconciliar contagem pgTAP | P0 | IN_REVIEW |
| EST-006 | Logo e capa nas demais telas do convidado e na prévia do convite (assinatura de URL fora da RLS para quem ainda não entrou) | P1 | BACKLOG |
| DSV-004 | Tokens --mm-* v2 completos (espaço, raio, sombra, movimento) e documentação do DS v2 em /design (Studio, Admin DS, tema) | P1 | BACKLOG |
| MAD-005 | Escrita de settings e feature flags no console com justificativa, confirmação e auditoria | P1 | BACKLOG |
| QAV-003 | Isolamento do tema nas telas do convidado em modo Supabase, sessão expirada com tema e permissões do organizador no adaptador | P1 | IN_REVIEW |
| OPS-A5-003 | Rotação de cópias de segurança manuais a cada ≤ 30 dias | P1 | READY |
| PAY-OPS-001 | [humano] Conta e chave sandbox AbacatePay, segredos das Functions e registro do webhook | P0 | BLOCKED |
| PAY-OPS-002 | [humano] Vault: mm_payments_cron_token e mm_payments_reconcile_url; agendar conciliação | P1 | BLOCKED |
| PAY-OPS-003 | Homologação sandbox ponta a ponta (Pix, webhook, liberação de limites, reembolso) | P0 | BLOCKED |
| PAY-OPS-005 | [humano] Decisões comerciais/legais D3, D5, D6 e revisão jurídica dos textos | P1 | BLOCKED |
| PAY-OPS-004 | [humano] Produção AbacatePay: CNPJ, chave de produção e ativação por plano | P1 | BLOCKED |
| PAY-001 | Pedido pago com needs_refund antigo por divergencia_cobranca pode reembolsar a cobrança legítima | P1 | BACKLOG |
| PAY-002 | needs_refund de divergencia_cobranca não é limpo após reembolso feito no painel | P1 | BACKLOG |
| PAY-003 | Restringir o waiver de valor da migration 001600 (~linha 350) a status não pagos | P1 | BACKLOG |
| REL-003 | Smoke autenticado em produção após a promoção (Google, wizard Grátis 10/10, convidado, Master, código de cortesia) | P0 | BACKLOG |
| REL-004 | [humano] Testes físicos em iPhone e Android (câmera, upload, PWA) | P1 | BLOCKED |
| REL-005 | [humano] Painel Supabase: rever limite de login anônimo (30/h por IP) e estreitar Redirect URLs após o go-live | P1 | BLOCKED |
| REL-006 | [humano] Confirmar payments_env='desligado' no remoto | P0 | BLOCKED |

## Decisão atual
**NO-GO para produção; A não concluída.** Checkpoint A5 em docs/supabase/A5-HOMOLOGATION-REPORT.md. Testes unitários/probes não substituem E2E autenticado, sessões e aparelhos físicos. Nenhuma promoção autorizada. Ordem A → B → Codex → C preservada; proposta paralela de backlog não integrada.

## Próximos itens READY
| Prio | ID | Título |
|---|---|---|
| P1 | COM-017 | Códigos de cortesia: Master gera, organizador resgata (Plano, Ajustes ou link /c/) |
| P1 | INF-001 | Validar e corrigir a conexão do Supabase MCP do Claude com o projeto asyaegeodyttttaubvxh (conta, organização, permissões) |
| P1 | OPS-A5-003 | Rotação de cópias de segurança manuais a cada ≤ 30 dias |
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
