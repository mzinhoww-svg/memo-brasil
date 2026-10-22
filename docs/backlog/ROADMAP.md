# Roadmap por releases (gerado de backlog.json)

> Não editar: altere `release` nos itens de `backlog.json` e rode `tools/backlog.py`.

## R1 · Estabilização e go-live da V1 (0–30 dias)

Homologação real concluída e V1 em produção (Google OAuth, callback, variáveis de Production, smoke público).

Itens abertos: **11** · P0 1, P1 6, P2 3, P3 1 · BACKLOG 4, BLOCKED 5, IN_REVIEW 1, READY 1

| ID | Prio | Status | Título | Depende de |
|---|---|---|---|---|
| SB-008 | P0 | BLOCKED | Variáveis na Vercel e deploy de preview/produção apontando para o Supabase remoto | SB-003, SB-004, REL-001 |
| BG-071 | P1 | BACKLOG | Outbox de sincronização offline ainda é só desenho | AUD-001, ITG-102 |
| INF-001 | P1 | READY | Validar e corrigir a conexão do Supabase MCP do Claude com o projeto asyaegeodyttttaubvxh  | - |
| INF-004 | P1 | BLOCKED | Variável SUPABASE_SERVICEROLE_KEY (sensível) no ambiente Production da Vercel | - |
| REL-001 | P1 | BLOCKED | Confirmar destino Vercel (newmemocuiaba) e promover o preview a produção | - |
| SB-005 | P1 | BACKLOG | Edge Functions: drenar storage_purge_queue e validar upload (magic bytes, resolução) | SB-003 |
| SB-006 | P1 | BACKLOG | Realtime na interface: assinar mudanças do evento e recuperar eventos perdidos na reconexã | SB-002 |
| INF-002 | P2 | BLOCKED | Produção serve o build antigo (3a8bf89): sem headers/CSP e sem correções da auditoria ante | REL-001 |
| INF-005 | P2 | IN_REVIEW | Preview por API exige rootDirectory=web e framework=nextjs | REL-001 |
| SB-007 | P2 | BACKLOG | Relógio do servidor no app e observabilidade (logs estruturados, monitor da revelação, run | SB-003 |
| QAV-004 | P3 | BLOCKED | Limpar usuários e dados de teste do remoto | SCV-010 |

## R2 · Studio & Admin V2 em produção (30–60 dias)

Design System v2, Event Studio, Master Admin e requisitos legais/operacionais mínimos (termos, backup, domínio).

Itens abertos: **78** · P0 14, P1 14, P2 34, P3 16 · BACKLOG 45, BLOCKED 1, IN_REVIEW 24, READY 8

| ID | Prio | Status | Título | Depende de |
|---|---|---|---|---|
| COM-004 | P0 | IN_REVIEW | Termos de uso, política de privacidade e registro de aceite (organizador e convidado) | SB-004 |
| DSV-001 | P0 | IN_REVIEW | Tokens v2 por camada (Platform/Event/Admin) e breakpoints | UXA-001 |
| DSV-003 | P0 | BACKLOG | Acessibilidade WCAG 2.2 AA: teclado, alvos de toque, reduced motion, contraste | DSV-002 |
| EST-001 | P0 | IN_REVIEW | Migrations v2: event_themes, event_assets, bucket event-branding privado | DSV-001 |
| EST-002 | P0 | IN_REVIEW | Renderer de tema isolado por evento (tokens, sem CSS arbitrário) + assinatura Powered by M | DSV-001 |
| EST-004 | P0 | IN_REVIEW | Personalização: presets, paleta com contraste validado, fonte, logo, capa, mensagem, estil | EST-001, EST-002 |
| MAD-001 | P0 | IN_REVIEW | Papéis de plataforma no servidor: platform_roles, is_master com linha ativa, provisionamen | EST-001 |
| MAD-002 | P0 | IN_REVIEW | Auditoria v2: reason obrigatório, imutabilidade, actor_role, confirmação de ações destruti | MAD-001 |
| QAV-001 | P0 | IN_REVIEW | Testes: unit, integração, E2E, autorização, RLS, upload, responsivo, a11y; screenshots ant | EST-005, MAD-003 |
| QAV-002 | P0 | IN_REVIEW | Revisão independente A1–A5 e correção de P0/P1 | QAV-001 |
| RLV-001 | P0 | BLOCKED | Preview Vercel v2 validado (UI, login, criação, personalização, upload, revelação, dashboa | QAV-002, SB-004, SB-008 |
| SCV-002 | P0 | BACKLOG | Revisão de segurança: escalada de privilégio, XSS em tema/mensagem, upload malicioso, IDOR | EST-004, MAD-003 |
| SCV-003 | P0 | IN_REVIEW | Provisionamento do master: desligar provider e-mail/senha (ou confirmação) no remoto e val | MAD-001 |
| SCV-008 | P0 | IN_REVIEW | Validar em banco (Supabase local) a migration 20261022000700 e as edições de endurecimento | SCV-003 |
| ANL-001 | P1 | IN_REVIEW | RPCs/views agregadas reais para o dashboard (eventos, participantes, fotos, falhas, revela | MAD-001 |
| COM-009 | P1 | BACKLOG | Backup, PITR e teste de restauração; política de retenção de fotos | SB-008 |
| DSV-002 | P1 | BACKLOG | Componentes v2 e layouts (formulário, dashboard, convite, galeria) com documentação em /de | DSV-001 |
| DSV-004 | P1 | BACKLOG | Tokens --mm-* v2 completos (espaço, raio, sombra, movimento) e documentação do DS v2 em /d | DSV-001 |
| EST-003 | P1 | BACKLOG | Criação de evento completa (nome, tipo, data/hora, local, timezone, limites, revelação, pr | EST-002 |
| EST-005 | P1 | BACKLOG | Gestão do evento: indicadores, compartilhar/baixar QR, participantes, revogar convites, up | EST-003 |
| EST-006 | P1 | BACKLOG | Logo e capa nas demais telas do convidado e na prévia do convite (assinatura de URL fora d | EST-004, SCV-006 |
| MAD-003 | P1 | IN_REVIEW | Console master: dashboard, eventos, usuários, organizadores, convites, storage, revelações | MAD-001, MAD-002, ANL-001 |
| MAD-004 | P1 | BACKLOG | Acesso excepcional a foto privada por admin com justificativa e auditoria | MAD-002 |
| MAD-005 | P1 | BACKLOG | Escrita de settings e feature flags no console com justificativa, confirmação e auditoria | MAD-003 |
| QAV-003 | P1 | IN_REVIEW | Isolamento do tema nas telas do convidado em modo Supabase, sessão expirada com tema e per | EST-004, SCV-008 |
| SCV-004 | P1 | IN_REVIEW | Worker de purga que respeita o bucket e agendamento de expire_pending_assets; limpar logo/ | SB-005 |
| SCV-006 | P1 | IN_REVIEW | Upload de identidade: magic bytes, dimensões reais e reencode no servidor antes de exibir  | SB-005, EST-004 |
| UXA-104 | P1 | BACKLOG | [Administrativa] /painel/[id]/conteudo · Pedidos de remoção/Ocultas/Todas: Moderação mostr | UXA-001 |
| BG-022 | P2 | READY | Sem validação em Safari/iOS e Firefox | - |
| BG-040 | P2 | BACKLOG | Rota dinâmica nunca visitada não abre offline | - |
| BG-041 | P2 | BACKLOG | Atualização do SW num segundo deploy não verificada | - |
| BG-060 | P2 | BACKLOG | Sem testes de useEventData e usePhotoUrls | - |
| BG-061 | P2 | BACKLOG | axe só em 390 px | - |
| BG-062 | P2 | BACKLOG | Evento grande (milhares de fotos) não medido | - |
| BG-105 | P2 | READY | Foco do Sheet volta ao primeiro controle a cada tick do relógio; fundo não inerte | - |
| BG-106 | P2 | READY | Falha de escrita deixa botões presos em 'ocupado' (wizard, entrar, ZIP) | - |
| BG-107 | P2 | READY | Falha de leitura vira 'Carregando a festa…' eterno | - |
| BG-108 | P2 | READY | Sem IndexedDB o app confirma ações que não persistem e o aviso global não aparece | - |
| BG-109 | P2 | READY | Tela de revelação inverte no tema Noite | - |
| BG-110 | P2 | READY | Seletor de evento do painel estoura com nome de 60 caracteres | - |
| BG-111 | P2 | BACKLOG | Atualização do service worker apaga as páginas guardadas; pré-cache só de HTML | BG-040 |
| BG-112 | P2 | READY | Limites de campos só em maxLength; domínio e serviços não validam | - |
| COM-011 | P2 | BACKLOG | Domínio próprio e e-mail de marca | REL-001 |
| DSV-005 | P2 | BACKLOG | Contraste do limite do controle (WCAG 1.4.11, ex.: Sálvia ~2,6:1) e token separado para o  | DSV-001 |
| DSV-006 | P2 | BACKLOG | Sheet com fundo inert e trava de scroll; OptionGroup como radiogroup; legenda e rótulos po | DSV-002 |
| EST-007 | P2 | BACKLOG | Tema com cores por modo (dia/noite) no Event Theme personalizado | EST-002 |
| MAD-006 | P2 | BACKLOG | UI do acesso excepcional a foto privada (justificativa → auditoria → URL de 60 s) e revoga | MAD-004, SCV-005 |
| PRF-001 | P2 | BACKLOG | Bundle: import dinâmico do SDK Supabase e do qrcode; AppProvider fora do /master; rotas cl | QAV-001 |
| SCV-001 | P2 | IN_REVIEW | Feature flags e platform_settings com escrita só do master | MAD-001 |
| SCV-005 | P2 | IN_REVIEW | Auditoria: event trigger para DISABLE/DROP TRIGGER, prefixo reservado em admin_log, trava  | MAD-002 |
| SCV-007 | P2 | BACKLOG | Middleware de refresh de sessão para Server Components (evitar deslogar o console após ~1  | MAD-003 |
| SCV-009 | P2 | IN_REVIEW | purge-storage: responder não-2xx quando falhas>0 e alertar fila parada | SCV-004 |
| UXA-105 | P2 | IN_REVIEW | [Administrativa] /painel/[id] e abas (visão, convidados, momentos, configurações, download | UXA-001 |
| UXA-107 | P2 | IN_REVIEW | [Administrativa] /painel/[id] · navegação < 900px: Abas do painel cortadas ('Convidad…', ' | UXA-001 |
| UXA-108 | P2 | BACKLOG | [Anfitrião] /criar · passos 1–6: Wizard em coluna de 480px: sem prévia do convite/tema nem | UXA-001 |
| UXA-109 | P2 | BACKLOG | [Convidado] /e/[code]/agora, /explorar, /retrospectiva em desktop: Feed em coluna única de | UXA-001 |
| UXA-110 | P2 | IN_REVIEW | [Anfitrião] /criar · validação: Mensagens de erro continuam visíveis depois de o campo ser | UXA-001 |
| UXA-111 | P2 | BACKLOG | [Todas] Carregando (pronto, convite, área do convidado): Loading é só texto cinza ('Prepar | UXA-001 |
| UXA-112 | P2 | BACKLOG | [Todas] Sessão expirada / sem identidade: Anfitrião sem sessão vê 'Só o anfitrião abre o p | UXA-001 |
| UXA-113 | P2 | IN_REVIEW | [Convidado] Chips de reação, momento e sugestão (/agora, /explorar, /editar, /postar): Con | UXA-001 |
| UXA-114 | P2 | IN_REVIEW | [Todas] Alvos de toque < 44px: Link 'Guia de componentes' 174×21px na home (3 estados); li | UXA-001 |
| UXA-127 | P2 | BACKLOG | Studio: presets com amostra de cor, estado 'Personalizado', fontes exibidas na própria fon | EST-004 |
| ARQ-001 | P3 | BACKLOG | Consolidar duplicações: limites de upload compartilhados, useBrandImages com refresh, same | EST-004 |
| PRF-002 | P3 | BACKLOG | Estudio: debounce do QR, validateTheme sem repetição, paletteCss em CSS estático, jszip so | PRF-001 |
| UXA-106 | P3 | BACKLOG | [Administrativa] /painel/[id]/convidados: Lista de convidados repetida: tabela 'Convidados | UXA-001 |
| UXA-115 | P3 | BACKLOG | [Todas] Botão de texto (Voltar, Cancelar, Voltar ao início): Botão texto recuado 8px do ei | UXA-001 |
| UXA-116 | P3 | BACKLOG | [Todas] Datas (cabeçalho, resumo, revelação): '21 · 10 · 2026' quebra entre os dígitos ('2 | UXA-001 |
| UXA-117 | P3 | BACKLOG | [Convidado] /agora e retrospectiva · contadores: Plural errado: '1 fotos' | UXA-001 |
| UXA-118 | P3 | BACKLOG | [Todas] /error (boundary): 'Algo deu errado' usa o ícone de sem sinal (antena cortada), qu | UXA-001 |
| UXA-119 | P3 | BACKLOG | [Convidado] /retrospectiva e sucesso do post: Telas sem <h1>: o título é um <p class=emoca | UXA-001 |
| UXA-120 | P3 | BACKLOG | [Convidado] /postar · limite de fotos (rolo acabou) e estados vazios: Tela do limite ocupa | UXA-001 |
| UXA-121 | P3 | BACKLOG | [Convidado] /e/[code] · evento encerrado: Botão desabilitado e a mensagem de erro vem abai | UXA-001 |
| UXA-122 | P3 | BACKLOG | [Convidado] /postar · câmera: 'Virar câmera' e 'Escolher foto' têm largura do texto, alinh | UXA-001 |
| UXA-123 | P3 | BACKLOG | [Todas] Home pública, /design, /master: Home mostra 'Guia de componentes' e 'Ver exemplo c | UXA-001 |
| UXA-124 | P3 | BACKLOG | [Administrativa] /painel/[id]/qr · QR Code Studio: Cards A6 com ~35% de vazio entre texto  | UXA-001 |
| UXA-125 | P3 | BACKLOG | [Administrativa] /painel/[id]/aparencia (WIP de outro agente): Em 375 a 'Prévia do convite | UXA-001 |
| UXA-126 | P3 | BACKLOG | [Anfitrião] /criar · passo 6 (resumo): CTA 'Criar evento de demonstração' quebra em 2 linh | UXA-001 |
| UXA-128 | P3 | BACKLOG | Erro de upload de logo/capa persistente por campo (aria-describedby) e prévia móvel como p | EST-004 |

## R3 · Monetização e escala (60–90 dias)

Planos, pagamento, e-mail, observabilidade e escala de mídia.

Itens abertos: **27** · P0 0, P1 15, P2 11, P3 1 · BACKLOG 14, DEFERRED 11, READY 2

| ID | Prio | Status | Título | Depende de |
|---|---|---|---|---|
| COM-001 | P1 | BACKLOG | Modelo de planos e entitlements no banco (plano por evento/organizador) | SB-004, SB-008 |
| COM-002 | P1 | BACKLOG | Gateway de pagamento (Pix e cartão) com webhooks idempotentes e conciliação | COM-001, COM-004 |
| COM-003 | P1 | BACKLOG | Enforcement server-side dos limites por plano (convidados, fotos, upload de identidade) | COM-001 |
| COM-005 | P1 | BACKLOG | E-mail transacional (recibo, aviso de revelação, convite) com remetente de marca | SB-008 |
| COM-006 | P1 | BACKLOG | Página de planos e checkout do organizador | COM-002 |
| FT-080 | P1 | DEFERRED | Auth: Google (organizador) e anônima (convidado) | INF-001, AUD-002, ITG-105 |
| FT-081 | P1 | DEFERRED | Web Push real e permissão de notificações | AUD-002 |
| FT-082 | P1 | DEFERRED | Esquema, RLS e testes de RLS | INF-001, AUD-002, ITG-104, ITG-109, ITG-106 |
| FT-083 | P1 | DEFERRED | Revelação no servidor: reveal_due_events (pg_cron), idempotente, e avisos agendados | FT-082, INF-001, AUD-002, ITG-104 |
| FT-084 | P1 | DEFERRED | Realtime e sincronização offline-first entre aparelhos | BG-071, FT-082, INF-001, AUD-002, ITG-102 |
| FT-085 | P1 | DEFERRED | Storage privado e URLs assinadas | FT-082, INF-001, AUD-002, ITG-103 |
| FT-086 | P1 | DEFERRED | Pagamento, entitlements e Memo+ (gateway) | AUD-002 |
| FT-087 | P1 | DEFERRED | Excluir conta e LGPD | FT-082, INF-001, AUD-002, ITG-101 |
| FT-088 | P1 | DEFERRED | Administrador master real (claim, middleware, audit_logs) | FT-080, FT-082, INF-001, AUD-002, ITG-109 |
| FT-089 | P1 | DEFERRED | Migração local → nuvem | FT-080, FT-082, FT-085, INF-001, AUD-002, ITG-105 |
| BG-070 | P2 | BACKLOG | Exclusão em cascata não é atômica | - |
| BG-103 | P2 | READY | 'Remover da festa' não impede a reentrada com o mesmo código | - |
| BG-104 | P2 | READY | Diálogo de revelação: foco, Escape, landmark e não bloquear a postagem | - |
| COM-007 | P2 | BACKLOG | Faturamento e financeiro no console master (recibos, reembolso, conciliação) | COM-002, MAD-003 |
| COM-008 | P2 | BACKLOG | Observabilidade: logs, alertas de revelação atrasada/uploads com falha, uptime | SB-007 |
| COM-010 | P2 | BACKLOG | Escala de mídia: miniaturas, transformação de imagem e custo de Storage por evento | SB-005 |
| COM-012 | P2 | BACKLOG | Suporte e operação: canal de contato, SLA e runbook de incidentes | COM-008 |
| COM-013 | P2 | BACKLOG | Abuso e antifraude: rate limit na borda e moderação automática de imagens | SB-005 |
| ITG-107 | P2 | BACKLOG | Convites: id, rotação, expiração, ?mesa= confiável e limite de tentativas (código ~39,6 bi | ITG-106 |
| ITG-108 | P2 | BACKLOG | Ambiente (env), CSP para o Supabase e suíte de contrato reutilizável | ITG-106 |
| ITG-109 | P2 | BACKLOG | Matriz de papéis × RLS e proteção de servidor para /master | ITG-106 |
| BG-150 | P3 | DEFERRED | Risco aceito pré-backend: alterar meta.user para o hostId vira anfitrião | - |

## R4 · Pós-90 dias (>90 dias)

Melhorias P3 e itens adiados sem dependência de receita.

Itens abertos: **33** · P0 0, P1 0, P2 0, P3 33 · BACKLOG 33

| ID | Prio | Status | Título | Depende de |
|---|---|---|---|---|
| BG-020 | P3 | BACKLOG | theme_color do manifest fixo (não acompanha Noite) | - |
| BG-042 | P3 | BACKLOG | Lógica do SW sem teste unitário | - |
| BG-050 | P3 | BACKLOG | CSP com unsafe-inline | - |
| BG-120 | P3 | BACKLOG | react() e reportPhoto() aceitam foto ainda bloqueada | - |
| BG-121 | P3 | BACKLOG | Contagem zera enquanto a tela segue 'Aguardando' por até 15 s | - |
| BG-122 | P3 | BACKLOG | Sem limite superior para a data da revelação; troca de fuso com erro genérico e prévia da  | - |
| BG-123 | P3 | BACKLOG | Denúncia não é única por pessoa | - |
| BG-124 | P3 | BACKLOG | Textos inexatos na interface | - |
| BG-125 | P3 | BACKLOG | Fontes decorativas pré-carregadas em todas as rotas; fonte da interface sem preload | - |
| BG-126 | P3 | BACKLOG | jszip carregado ao abrir Downloads; sem import dinâmico | - |
| BG-127 | P3 | BACKLOG | Links abaixo de 44 px: 'Guia de componentes' e skip link | - |
| BG-128 | P3 | BACKLOG | Borda de chip abaixo de 3:1 (vem do CSS do kit) e tamanhos fixos fora dos tokens | - |
| BG-129 | P3 | BACKLOG | Faixa de abas do painel no mobile corta itens sem indício; CLS e h1 duplicado | - |
| BG-130 | P3 | BACKLOG | Exemplo com revelação em 2 minutos não mostra a espera ao anfitrião | - |
| BG-131 | P3 | BACKLOG | Imagens do feed sem lazy/decoding e /voce sem paginação | - |
| BG-132 | P3 | BACKLOG | Sem limite de dimensão/bytes de entrada no upload (PNG 20000×20000 aceito) | - |
| BG-133 | P3 | BACKLOG | CSP com 'unsafe-inline', sem COOP/CORP | - |
| BG-134 | P3 | BACKLOG | npm audit: 5 altas em dependências de desenvolvimento (cadeia do eslint-config-next) | - |
| BG-135 | P3 | BACKLOG | Dependências e exports não usados; contratos especulativos | - |
| BG-136 | P3 | BACKLOG | Escapes de tipo (7 asserções): revisar | - |
| BG-137 | P3 | BACKLOG | 8 catch vazios; câmera não distingue a causa da falha | - |
| BG-138 | P3 | BACKLOG | URLs de objeto sem revogação no editor e no feed | - |
| BG-139 | P3 | BACKLOG | CSV separado por vírgula; Excel pt-BR espera ponto e vírgula | - |
| BG-140 | P3 | BACKLOG | Datas no fuso do aparelho, não do evento; formatação manual | - |
| BG-141 | P3 | BACKLOG | Todas as páginas são Client Components; /design e /master públicos em produção | - |
| BG-142 | P3 | BACKLOG | tsconfig inclui e2e/: erro de tipo em spec quebra next build (reproduzido nesta auditoria) | - |
| BG-143 | P3 | BACKLOG | Nome e fotos persistem localmente depois de 'sair' | - |
| FT-006 | P3 | BACKLOG | Onboarding de propósito do evento | - |
| FT-007 | P3 | BACKLOG | Capa do convite por imagem (upload e recorte) | - |
| FT-015 | P3 | BACKLOG | Compartilhar fotos pelo Web Share | - |
| INF-003 | P3 | BACKLOG | Projeto Vercel sem repositório vinculado: deploys foram criados por API com gitSource | - |
| ITG-110 | P3 | BACKLOG | Tipos TypeScript × Postgres (datas, enums, opcionais) | ITG-102 |
| TK-010a | P3 | BACKLOG | Zoom 1×/2× via constraints do track (onde suportado) | FT-010 |

## Caminho crítico

Monetização: REL-001 → SB-008 → COM-001 → COM-002 → COM-006

Escala: SB-007 → COM-008 → COM-012
