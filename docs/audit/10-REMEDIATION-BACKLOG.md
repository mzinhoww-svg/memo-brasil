# 10 · Backlog de correção (priorizado)

Fonte de verdade: `docs/backlog/backlog.json` (IDs preservados). Esta é a visão por ondas; dependências e critérios de aceitação estão no JSON e em `docs/backlog/BACKLOG.md`. Nenhuma correção foi feita durante a auditoria.

**Caminho crítico até o Supabase:** `BG-101` (revelação acompanha o fim) → `BG-102` (monotônica) ∥ `ITG-106` (plano sem contradições) → `ITG-101`/`ITG-104` (leitura escopada e autoridade do servidor) e `ITG-102` (contratos v2) → `ITG-103`/`ITG-105` → `AUD-002` (reauditoria) → EP-09 (`FT-080…FT-089`). `INF-001` (acesso do conector) corre em paralelo e bloqueia só a execução no banco.

## Onda 1 · P1 de produto e destravamento de acesso
| ID | Prio | Título | Status | Depende de | Esforço |
|---|---|---|---|---|---|
| BG-101 | P1 | Revelação 'ao terminar' e 'N dias depois' não acompanha o fim do evento (estender/encerrar agora) | READY | - | M |
| INF-001 | P1 | Validar e corrigir a conexão do Supabase MCP do Claude com o projeto asyaegeodyttttaubvxh (conta, or | READY | - | - |
| ITG-106 | P1 | Corrigir contradições do INTEGRATION-PLAN e fechar decisões de produto pendentes | READY | - | M |

## Onda 2 · robustez e experiência (P2 prontos, sem dependência)
| ID | Prio | Título | Status | Depende de | Esforço |
|---|---|---|---|---|---|
| BG-103 | P2 | 'Remover da festa' não impede a reentrada com o mesmo código | READY | - | S |
| BG-104 | P2 | Diálogo de revelação: foco, Escape, landmark e não bloquear a postagem | READY | - | S |
| BG-105 | P2 | Foco do Sheet volta ao primeiro controle a cada tick do relógio; fundo não inerte | READY | - | S |
| BG-106 | P2 | Falha de escrita deixa botões presos em 'ocupado' (wizard, entrar, ZIP) | READY | - | S |
| BG-107 | P2 | Falha de leitura vira 'Carregando a festa…' eterno | READY | - | S |
| BG-108 | P2 | Sem IndexedDB o app confirma ações que não persistem e o aviso global não aparece | READY | - | S |
| BG-109 | P2 | Tela de revelação inverte no tema Noite | READY | - | S |
| BG-110 | P2 | Seletor de evento do painel estoura com nome de 60 caracteres | READY | - | S |
| BG-112 | P2 | Limites de campos só em maxLength; domínio e serviços não validam | READY | - | S |

## Onda 3 · semântica da revelação e contratos (P1 de integração)
| ID | Prio | Título | Status | Depende de | Esforço |
|---|---|---|---|---|---|
| BG-102 | P2 | Estado 'revelada' não é monotônico: relógio atrasado reesconde fotos e destrava a edição | BACKLOG | BG-101 | S |
| BG-113 | P2 | Read-modify-write sem versão: lost update e ressurreição de evento | BACKLOG | - | M |
| ITG-101 | P1 | Leitura escopada por papel: serviços recebem Actor; fotos bloqueadas nunca chegam ao cliente; convit | BACKLOG | BG-101, BG-102, ITG-106 | L |
| ITG-102 | P1 | Contratos de repositório v2: paginação, contagem, erros tipados, versão e idempotência | BACKLOG | ITG-106, BG-113 | L |
| ITG-104 | P1 | Autoridade do servidor: revelação, rolo, limites e relógio | BACKLOG | BG-101, BG-102, ITG-106 | M |

## Onda 4 · fotos, identidade e convites
| ID | Prio | Título | Status | Depende de | Esforço |
|---|---|---|---|---|---|
| ITG-103 | P1 | Fotos por URL/miniatura e upload em duas fases com created_at do servidor | BACKLOG | ITG-102 | L |
| ITG-105 | P1 | Identidade (auth.uid) e migração local→nuvem compatíveis com o esquema | BACKLOG | ITG-102 | M |
| ITG-107 | P2 | Convites: id, rotação, expiração, ?mesa= confiável e limite de tentativas (código ~39,6 bits) | BACKLOG | ITG-106 | M |
| ITG-108 | P2 | Ambiente (env), CSP para o Supabase e suíte de contrato reutilizável | BACKLOG | ITG-106 | M |
| ITG-109 | P2 | Matriz de papéis × RLS e proteção de servidor para /master | BACKLOG | ITG-106 | M |
| BG-040 | P2 | Rota dinâmica nunca visitada não abre offline | BACKLOG | - | - |
| BG-111 | P2 | Atualização do service worker apaga as páginas guardadas; pré-cache só de HTML | BACKLOG | BG-040 | M |

## Onda 5 · reauditoria e gate
| ID | Prio | Título | Status | Depende de | Esforço |
|---|---|---|---|---|---|
| AUD-002 | P1 | Reauditoria dos P1 após as correções (gate para iniciar a fase Supabase) | BACKLOG | BG-101, ITG-101, ITG-102, ITG-103, ITG-104, ITG-105, ITG-106 | S |

## Onda 6 · P3 (fila de melhorias)
| ID | Prio | Título | Status | Depende de | Esforço |
|---|---|---|---|---|---|
| BG-120 | P3 | react() e reportPhoto() aceitam foto ainda bloqueada | BACKLOG | - | S |
| BG-121 | P3 | Contagem zera enquanto a tela segue 'Aguardando' por até 15 s | BACKLOG | - | S |
| BG-122 | P3 | Sem limite superior para a data da revelação; troca de fuso com erro genérico e prévia da versão sal | BACKLOG | - | S |
| BG-123 | P3 | Denúncia não é única por pessoa | BACKLOG | - | S |
| BG-124 | P3 | Textos inexatos na interface | BACKLOG | - | S |
| BG-125 | P3 | Fontes decorativas pré-carregadas em todas as rotas; fonte da interface sem preload | BACKLOG | - | S |
| BG-126 | P3 | jszip carregado ao abrir Downloads; sem import dinâmico | BACKLOG | - | S |
| BG-127 | P3 | Links abaixo de 44 px: 'Guia de componentes' e skip link | BACKLOG | - | S |
| BG-128 | P3 | Borda de chip abaixo de 3:1 (vem do CSS do kit) e tamanhos fixos fora dos tokens | BACKLOG | - | S |
| BG-129 | P3 | Faixa de abas do painel no mobile corta itens sem indício; CLS e h1 duplicado | BACKLOG | - | S |
| BG-130 | P3 | Exemplo com revelação em 2 minutos não mostra a espera ao anfitrião | BACKLOG | - | S |
| BG-131 | P3 | Imagens do feed sem lazy/decoding e /voce sem paginação | BACKLOG | - | S |
| BG-132 | P3 | Sem limite de dimensão/bytes de entrada no upload (PNG 20000×20000 aceito) | BACKLOG | - | S |
| BG-133 | P3 | CSP com 'unsafe-inline', sem COOP/CORP | BACKLOG | - | S |
| BG-134 | P3 | npm audit: 5 altas em dependências de desenvolvimento (cadeia do eslint-config-next) | BACKLOG | - | S |
| BG-135 | P3 | Dependências e exports não usados; contratos especulativos | BACKLOG | - | S |
| BG-136 | P3 | Escapes de tipo (7 asserções): revisar | BACKLOG | - | S |
| BG-137 | P3 | 8 catch vazios; câmera não distingue a causa da falha | BACKLOG | - | S |
| BG-138 | P3 | URLs de objeto sem revogação no editor e no feed | BACKLOG | - | S |
| BG-139 | P3 | CSV separado por vírgula; Excel pt-BR espera ponto e vírgula | BACKLOG | - | S |
| BG-140 | P3 | Datas no fuso do aparelho, não do evento; formatação manual | BACKLOG | - | S |
| BG-141 | P3 | Todas as páginas são Client Components; /design e /master públicos em produção | BACKLOG | - | M |
| BG-142 | P3 | tsconfig inclui e2e/: erro de tipo em spec quebra next build (reproduzido nesta auditoria) | BACKLOG | - | S |
| BG-143 | P3 | Nome e fotos persistem localmente depois de 'sair' | BACKLOG | - | S |
| BG-150 | P3 | Risco aceito pré-backend: alterar meta.user para o hostId vira anfitrião | DEFERRED | - | L |
| ITG-110 | P3 | Tipos TypeScript × Postgres (datas, enums, opcionais) | BACKLOG | ITG-102 | S |
| INF-003 | P3 | Projeto Vercel sem repositório vinculado: deploys foram criados por API com gitSource | BACKLOG | - | S |

## Bloqueado por decisão do dono
| ID | Prio | Título | Status | Depende de | Esforço |
|---|---|---|---|---|---|
| REL-001 | P1 | Confirmar destino Vercel (newmemocuiaba) e promover o preview a produção | BLOCKED | - | - |
| INF-002 | P2 | Produção serve o build antigo (3a8bf89): sem headers/CSP e sem correções da auditoria anterior | BLOCKED | REL-001 | S |
