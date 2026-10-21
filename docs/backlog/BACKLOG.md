# Backlog do MemoriesMT

> Fonte de verdade: `backlog.json` (editar lá). Este arquivo é gerado por `tools/backlog.py`. Fluxo: BACKLOG → READY → IN_PROGRESS → IN_REVIEW → TESTING → DONE (+ BLOCKED, DEFERRED, CANCELLED). **DONE exige implementação, testes, evidência e documentação atualizada.**

Total: **73** itens (sem contar 10 épicos). Prioridade: P0 17, P1 36, P2 13, P3 7. Status: BACKLOG 14, BLOCKED 1, DEFERRED 10, DONE 44, READY 4.

## Como retomar numa nova sessão
1. Rode `python3 docs/backlog/tools/backlog.py` (valida e regenera). 2. `... --next` mostra o próximo item READY por prioridade. 3. Preserve os IDs; não recrie o que está DONE. 4. Ao concluir, preencha `tests`, `evidence`, `commit`, `environment` e mude o status. 5. Registre decisões em `docs/architecture/ARCHITECTURE.md`.

## EP-01 · Eventos e convites (DONE)

| ID | Tipo | Título | Prio | Status | Depende de | Origem | Commit | Ambiente |
|---|---|---|---|---|---|---|---|---|
| FT-001 | FEATURE | Criar evento (wizard de 6 passos) | P1 | DONE | - | REA F-13..F-21 | 0e818dd | local (build de produção, Chromium) |
| FT-002 | FEATURE | Convite por código, link e QR (e QR por mesa) | P1 | DONE | - | REA F-11,F-12,F-24,F-25 | ac290ea | local (build de produção, Chromium) |
| FT-003 | FEATURE | Entrar no evento (código/link) com identidade local | P1 | DONE | - | REA F-05,F-06 | ac290ea | local (build de produção, Chromium) |
| FT-004 | FEATURE | Painel do organizador (visão geral, conteúdo, convidados, momentos, QR, configurações, downloads) | P1 | DONE | - | REA F-34,F-36; DS AdminNav | 0e818dd | local (build de produção, Chromium) |
| FT-005 | FEATURE | Capacidade, fotos por pessoa e regra de preço (sem cobrança) | P2 | DONE | - | REA F-21,F-22 | ac290ea | local (build de produção, Chromium) |
| FT-006 | FEATURE | Onboarding de propósito do evento | P3 | BACKLOG | - | REA F-07 | - | - |
| FT-007 | FEATURE | Capa do convite por imagem (upload e recorte) | P3 | BACKLOG | - | REA F-20 | - | - |
| FT-008 | FEATURE | Encerrar agora, estender término e excluir evento | P1 | DONE | - | REA F-36 | ac290ea | local (build de produção, Chromium) |

**FT-006** critérios: Escolha de propósito reaproveita as categorias; Pulável

**FT-007** critérios: Upload local com recorte; Validação de tipo e tamanho

## EP-02 · Captura, fotos e moderação (DONE)

| ID | Tipo | Título | Prio | Status | Depende de | Origem | Commit | Ambiente |
|---|---|---|---|---|---|---|---|---|
| FT-010 | FEATURE | Câmera web (virar, rolo, permissão, fallback por arquivo) | P1 | DONE | - | REA F-26 | ac290ea | local (build de produção, Chromium) |
| FT-011 | FEATURE | Rolo limitado por pessoa (cliente) com exclusão mútua | P1 | DONE | - | REA F-28 | 7e0f9ec | local (build de produção, Chromium) |
| FT-012 | FEATURE | Reações (1 por pessoa/foto) e Quem reagiu | P2 | DONE | - | REA F-32 | ac290ea | local (build de produção, Chromium) |
| FT-013 | FEATURE | Editor de fotos (desenho, texto, borracha, colagem, desfazer) | P2 | DONE | - | REA F-33 | ac290ea | local (build de produção, Chromium) |
| FT-014 | FEATURE | Exportar álbum (ZIP) e lista (CSV) e baixar foto | P2 | DONE | - | REA F-34 | ac290ea | local (build de produção, Chromium) |
| FT-015 | FEATURE | Compartilhar fotos pelo Web Share | P3 | BACKLOG | - | REA F-35 | - | - |
| FT-016 | FEATURE | Moderação (pedido de remoção, ocultar, destacar, remover) | P1 | DONE | - | decisão de produto; DS Tabs/CountBadge | ac290ea | local (build de produção, Chromium) |
| FT-017 | FEATURE | Fotos e estado locais em IndexedDB (cascata, migração versionada) | P1 | DONE | - | requisito do pedido | 0e818dd | local (build de produção, Chromium) |
| TK-010a | TASK | Zoom 1×/2× via constraints do track (onde suportado) | P3 | BACKLOG | FT-010 | REA F-26 | - | - |

**TK-010a** critérios: Chips só aparecem quando track.getCapabilities().zoom existe · testes: a criar: E2E com câmera sintética + teste unitário do helper

**FT-015** critérios: navigator.share com arquivos quando suportado; fallback para baixar

## EP-03 · Revelação programada (IN_PROGRESS)

| ID | Tipo | Título | Prio | Status | Depende de | Origem | Commit | Ambiente |
|---|---|---|---|---|---|---|---|---|
| FT-030 | FEATURE | Contrato de revelação programada | P0 | DONE | - | requisito novo (correção de escopo) | 0e818dd | local (build de produção, Chromium) |
| FT-031 | FEATURE | Configuração pelo organizador | P0 | DONE | FT-030 | requisito novo; DS Field/OptionGroup | 0e818dd | local (build de produção, Chromium) |
| FT-032 | FEATURE | Experiência do convidado: espera, contagem, revelação e galeria | P0 | DONE | FT-030 | requisito novo | 0e818dd | local (build de produção, Chromium) |
| FT-033 | FEATURE | Casos especiais de revelação | P0 | DONE | TK-030a3 | requisito novo | 0e818dd | local (build de produção, Chromium) |
| FT-034 | FEATURE | Papéis: organizador × administrador master (contrato) | P0 | DONE | - | requisito novo | 0e818dd | local (build de produção, Chromium) |
| FT-035 | FEATURE | Documentar a revelação no servidor (permissões, storage privado, URLs assinadas, idempotência, sincronização) | P1 | DONE | - | requisito novo | 0e818dd | - |
| FT-036 | FEATURE | Validação visual e de acessibilidade da revelação (dia/noite, mobile/desktop) | P1 | DONE | FT-032 | REA | 0e818dd | local (build de produção, Chromium) |
| FT-037 | FEATURE | Validar a revelação no preview Vercel | P1 | DONE | FT-036 | requisito novo | 5d8df4a | preview Vercel newmemocuiaba (dpl_Cq1otDUS9DsuZVFqthubBfGLEEAz, protegido; acesso por link temporário oficial) |
| TK-030a1 | TASK | Domínio de revelação (status, validação, travas, contagem, fuso) | P0 | DONE | - | REA | 0e818dd | local (build de produção, Chromium) |
| TK-030a2 | TASK | Migração v2 do IndexedDB (revealTiming → novo contrato) e tipos do evento | P0 | DONE | TK-030a1 | REA | 0e818dd | local (build de produção, Chromium) |
| TK-030a3 | TASK | Serviços: criar com revelação, updateReveal com travas, reconcileReveal idempotente | P0 | DONE | TK-030a1 | REA | 0e818dd | local (build de produção, Chromium) |
| TK-031a1 | TASK | RevealForm (wizard passo 3) e Select do kit | P0 | DONE | - | REA | 0e818dd | local (build de produção, Chromium) |
| TK-031a2 | TASK | RevealSettings no painel (salvar, travas, prévia) | P0 | DONE | TK-031a1 | REA | 0e818dd | local (build de produção, Chromium) |
| TK-032a | TASK | WaitingReveal, RevealTransition e integração no layout do convidado | P0 | DONE | - | REA | 0e818dd | local (build de produção, Chromium) |
| US-030a | USER_STORY | Como organizador, quero que o evento tenha revelação opcional com data, hora e fuso | P0 | DONE | FT-030 | requisito novo | 0e818dd | local (build de produção, Chromium) |
| US-031a | USER_STORY | Como organizador, quero ligar, desligar, escolher data/hora/fuso, ver o resumo e pré-visualizar | P0 | DONE | TK-030a3 | REA | 0e818dd | local (build de produção, Chromium) |
| US-032a | USER_STORY | Como convidado, quero fotografar sem ver fotos bloqueadas e ver a espera com contagem | P0 | DONE | TK-030a1 | REA | 0e818dd | local (build de produção, Chromium) |
| US-032b | USER_STORY | Como convidado, quero que a galeria abra sozinha na hora, mesmo offline, sem recarregar | P0 | DONE | US-032a | REA | 0e818dd | local (build de produção, Chromium) |
| US-032c | USER_STORY | Modo sem revelação: fotos aparecem na hora | P0 | DONE | - | REA | 0e818dd | local (build de produção, Chromium) |

## EP-04 · Design system e experiência (DONE)

| ID | Tipo | Título | Prio | Status | Depende de | Origem | Commit | Ambiente |
|---|---|---|---|---|---|---|---|---|
| BG-020 | BUG | theme_color do manifest fixo (não acompanha Noite) | P3 | BACKLOG | - | auditoria | - | - |
| BG-021 | BUG | Nome de evento longo a 375 px não medido | P2 | READY | - | auditoria | - | - |
| BG-022 | BUG | Sem validação em Safari/iOS e Firefox | P2 | READY | - | auditoria | - | - |
| FT-020 | FEATURE | Tokens, temas Dia/Noite, fontes locais e logos oficiais | P1 | DONE | - | DS-01..DS-04 | ac290ea | local (build de produção, Chromium) |
| FT-021 | FEATURE | Biblioteca de componentes MemoriesMT (22 + Select, Sheet, KnownPeople) | P1 | DONE | - | DS-05 | 0e818dd | local (build de produção, Chromium) |
| FT-022 | FEATURE | Regras visuais e voz do kit (sem sombra/gradiente/emoji, pt-BR) | P1 | DONE | - | DS-06,DS-07 | 0e818dd | local (build de produção, Chromium) |

**BG-020** critérios: Meta theme-color por esquema já existe; manifest dinâmico por tema não é possível: documentar ou aceitar

**BG-021** critérios: Evento com 60 caracteres sem rolagem horizontal em 375 px nos dois temas · testes: a criar: e2e/visual com título de 60 caracteres

**BG-022** critérios: Projetos WebKit e Firefox no Playwright rodam o smoke e o fluxo de convidado; Registrar o que falhar

## EP-05 · PWA e offline (IN_PROGRESS)

| ID | Tipo | Título | Prio | Status | Depende de | Origem | Commit | Ambiente |
|---|---|---|---|---|---|---|---|---|
| BG-040 | BUG | Rota dinâmica nunca visitada não abre offline | P2 | BACKLOG | - | auditoria | - | - |
| BG-041 | BUG | Atualização do SW num segundo deploy não verificada | P2 | BACKLOG | - | auditoria | - | - |
| BG-042 | BUG | Lógica do SW sem teste unitário | P3 | BACKLOG | - | auditoria | - | - |
| FT-040 | FEATURE | PWA instalável (manifest, ícones, maskable) | P1 | DONE | - | requisito do pedido | 7e0f9ec | local (build de produção, Chromium) |
| FT-041 | FEATURE | Service worker versionado por deploy, shell offline e dados em IndexedDB | P1 | DONE | - | requisito do pedido | 7e0f9ec | local (build de produção, Chromium) |

**BG-040** critérios: Shell genérico para /e/* e /painel/* servido offline; Teste E2E com rota não visitada

**BG-041** critérios: Dois builds consecutivos: cache antigo some e o novo assume

**BG-042** critérios: Estratégias testadas em ambiente de worker simulado

## EP-06 · Segurança e papéis (IN_PROGRESS)

| ID | Tipo | Título | Prio | Status | Depende de | Origem | Commit | Ambiente |
|---|---|---|---|---|---|---|---|---|
| BG-050 | BUG | CSP com unsafe-inline | P3 | BACKLOG | - | auditoria | - | - |
| BG-051 | BUG | Dependências sem auditoria de vulnerabilidades | P2 | READY | - | requisito de auditoria | - | - |
| FT-050 | FEATURE | Headers de segurança e CSP em produção | P1 | DONE | - | auditoria | 7e0f9ec | preview Vercel + local |
| FT-051 | FEATURE | Identidades locais e 'Continuar como' | P1 | DONE | - | auditoria | 7e0f9ec | local (build de produção, Chromium) |

**BG-050** critérios: Nonce por requisição em script e estilo inline

**BG-051** critérios: npm audit sem alta/crítica em produção, ou exceção documentada

## EP-07 · Qualidade e testes (IN_PROGRESS)

| ID | Tipo | Título | Prio | Status | Depende de | Origem | Commit | Ambiente |
|---|---|---|---|---|---|---|---|---|
| BG-060 | BUG | Sem testes de useEventData e usePhotoUrls | P2 | BACKLOG | - | auditoria | - | - |
| BG-061 | BUG | axe só em 390 px | P2 | BACKLOG | - | auditoria | - | - |
| BG-062 | BUG | Evento grande (milhares de fotos) não medido | P2 | BACKLOG | - | auditoria | - | - |
| FT-060 | FEATURE | Suíte unitária (domínio, repositórios, serviços, componentes) | P1 | DONE | - | requisito do pedido | 0e818dd | local (build de produção, Chromium) |
| FT-061 | FEATURE | Suíte E2E (fluxos, PWA, visual, paridade, axe, revelação) | P1 | DONE | - | requisito do pedido | 0e818dd | local (build de produção, Chromium) |

**BG-060** critérios: Hooks testados com repositório em memória

**BG-061** critérios: axe também em 375, 768 e 1440

**BG-062** critérios: Agora com 7.200 fotos mantém interação fluida; medir e registrar

## EP-08 · Prontidão para o Supabase (IN_PROGRESS)

| ID | Tipo | Título | Prio | Status | Depende de | Origem | Commit | Ambiente |
|---|---|---|---|---|---|---|---|---|
| BG-070 | BUG | Exclusão em cascata não é atômica | P2 | BACKLOG | - | auditoria | - | - |
| BG-071 | BUG | Outbox de sincronização offline ainda é só desenho | P1 | BACKLOG | AUD-001 | auditoria | - | - |
| FT-070 | FEATURE | Plano de integração Supabase (ERD, RLS, Auth, Storage, realtime, migração, conflitos) | P1 | DONE | - | requisito do pedido | 0e818dd | - |
| FT-071 | FEATURE | Contratos de repositório e serviços atrás de interfaces | P1 | DONE | - | requisito do pedido | 0e818dd | local (build de produção, Chromium) |

**BG-070** critérios: Cascata numa transação IndexedDB

**BG-071** critérios: Interface Outbox com testes e implementação local

## EP-09 · Fase Supabase (exclusivo do backend) (DEFERRED)

| ID | Tipo | Título | Prio | Status | Depende de | Origem | Commit | Ambiente |
|---|---|---|---|---|---|---|---|---|
| FT-080 | FEATURE | Auth: Google (organizador) e anônima (convidado) | P1 | DEFERRED | AUD-001 | fase Supabase | - | - |
| FT-081 | FEATURE | Web Push real e permissão de notificações | P1 | DEFERRED | AUD-001 | fase Supabase | - | - |
| FT-082 | FEATURE | Esquema, RLS e testes de RLS | P1 | DEFERRED | AUD-001 | fase Supabase | - | - |
| FT-083 | FEATURE | Revelação no servidor: reveal_due_events (pg_cron), idempotente, e avisos agendados | P1 | DEFERRED | AUD-001, FT-082 | fase Supabase | - | - |
| FT-084 | FEATURE | Realtime e sincronização offline-first entre aparelhos | P1 | DEFERRED | AUD-001, BG-071, FT-082 | fase Supabase | - | - |
| FT-085 | FEATURE | Storage privado e URLs assinadas | P1 | DEFERRED | AUD-001, FT-082 | fase Supabase | - | - |
| FT-086 | FEATURE | Pagamento, entitlements e Memo+ (gateway) | P1 | DEFERRED | AUD-001 | fase Supabase | - | - |
| FT-087 | FEATURE | Excluir conta e LGPD | P1 | DEFERRED | AUD-001, FT-082 | fase Supabase | - | - |
| FT-088 | FEATURE | Administrador master real (claim, middleware, audit_logs) | P1 | DEFERRED | AUD-001, FT-080, FT-082 | fase Supabase | - | - |
| FT-089 | FEATURE | Migração local → nuvem | P1 | DEFERRED | AUD-001, FT-080, FT-082, FT-085 | fase Supabase | - | - |

**FT-080** critérios: Depende do backend; não iniciar antes do release gate

**FT-081** critérios: Depende do backend; não iniciar antes do release gate

**FT-082** critérios: Depende do backend; não iniciar antes do release gate

**FT-083** critérios: Depende do backend; não iniciar antes do release gate

**FT-084** critérios: Depende do backend; não iniciar antes do release gate

**FT-085** critérios: Depende do backend; não iniciar antes do release gate

**FT-086** critérios: Depende do backend; não iniciar antes do release gate

**FT-087** critérios: Depende do backend; não iniciar antes do release gate

**FT-088** critérios: Depende do backend; não iniciar antes do release gate

**FT-089** critérios: Depende do backend; não iniciar antes do release gate

## EP-10 · Governança e release (IN_PROGRESS)

| ID | Tipo | Título | Prio | Status | Depende de | Origem | Commit | Ambiente |
|---|---|---|---|---|---|---|---|---|
| AUD-001 | TASK | Auditoria independente pré-Supabase (docs/audit/00..11) | P0 | READY | FT-037 | auditoria | - | - |
| REL-001 | TASK | Confirmar destino Vercel (newmemocuiaba) e promover o preview a produção | P1 | BLOCKED | - | auditoria | - | - |
| REL-002 | TASK | Manter preview como ambiente de validação e registrar commit/URL | P1 | DONE | FT-037 | REA | 5d8df4a | preview Vercel newmemocuiaba (dpl_Cq1otDUS9DsuZVFqthubBfGLEEAz, protegido; acesso por link temporário oficial) |

**AUD-001** critérios: 12 relatórios + evidências; Registro de achados classificado P0–P3; Release gate GO/CONDITIONAL/NO-GO; Achados consolidados neste backlog sem duplicar

**REL-001** critérios: Confirmação explícita de Aurimar; Commit e URL de produção verificados
