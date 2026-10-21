# Backlog do MemoriesMT

> Fonte de verdade: `backlog.json` (editar lá). Este arquivo é gerado por `tools/backlog.py`. Fluxo: BACKLOG → READY → IN_PROGRESS → IN_REVIEW → TESTING → DONE (+ BLOCKED, DEFERRED, CANCELLED). **DONE exige implementação, testes, evidência e documentação atualizada.**

Total: **125** itens (sem contar 10 épicos). Prioridade: P0 17, P1 45, P2 29, P3 34. Status: BACKLOG 52, BLOCKED 2, CANCELLED 2, DEFERRED 11, DONE 45, READY 13.

## Como retomar numa nova sessão
1. Rode `python3 docs/backlog/tools/backlog.py` (valida e regenera). 2. `... --next` mostra o próximo item READY por prioridade. 3. Preserve os IDs; não recrie o que está DONE. 4. Ao concluir, preencha `tests`, `evidence`, `commit`, `environment` e mude o status. 5. Registre decisões em `docs/architecture/ARCHITECTURE.md`.

## EP-01 · Eventos e convites (DONE)

| ID | Tipo | Título | Prio | Status | Depende de | Origem | Commit | Ambiente |
|---|---|---|---|---|---|---|---|---|
| BG-103 | BUG | 'Remover da festa' não impede a reentrada com o mesmo código | P2 | READY | - | auditoria AUD-001 · A1-003 · natureza: produto | - | - |
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

**BG-103** critérios: [A1-003] Corrigir: Estado 'removido' em participants, recusado em joinEvent; ou corrigir o texto.; [A1-003] Teste de regressão: e2e: removido não entra nem posta

## EP-02 · Captura, fotos e moderação (DONE)

| ID | Tipo | Título | Prio | Status | Depende de | Origem | Commit | Ambiente |
|---|---|---|---|---|---|---|---|---|
| BG-120 | BUG | react() e reportPhoto() aceitam foto ainda bloqueada | P3 | BACKLOG | - | auditoria AUD-001 · A1-007 · natureza: produto | - | - |
| BG-123 | BUG | Denúncia não é única por pessoa | P3 | BACKLOG | - | auditoria AUD-001 · A1-012 · natureza: produto | - | - |
| BG-131 | BUG | Imagens do feed sem lazy/decoding e /voce sem paginação | P3 | BACKLOG | - | auditoria AUD-001 · A2-013 · natureza: produto | - | - |
| BG-139 | BUG | CSV separado por vírgula; Excel pt-BR espera ponto e vírgula | P3 | BACKLOG | - | auditoria AUD-001 · A3-017 · natureza: produto | - | - |
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

**BG-120** critérios: [A1-007] Corrigir: Recusar react/report se não revelada e o ator não for host.; [A1-007] Teste de regressão: unit no serviço

**BG-123** critérios: [A1-012] Corrigir: Guardar (photoId, userId) e contar únicos.; [A1-012] Teste de regressão: unit

**BG-131** critérios: [A2-013] Corrigir: loading=lazy, decoding=async e paginar /voce.; [A2-013] Teste de regressão: Playwright: imagens fora da viewport sem decode inicial e /voce com no máximo 20 imagens iniciais.

**BG-139** critérios: [A3-017] Corrigir: Usar ';'.; [A3-017] Teste de regressão: —

## EP-03 · Revelação programada (IN_PROGRESS)

| ID | Tipo | Título | Prio | Status | Depende de | Origem | Commit | Ambiente |
|---|---|---|---|---|---|---|---|---|
| BG-101 | BUG | Revelação 'ao terminar' e 'N dias depois' não acompanha o fim do evento (estender/encerrar agora) | P1 | READY | - | auditoria AUD-001 · A1-001 · natureza: produto | - | - |
| BG-102 | BUG | Estado 'revelada' não é monotônico: relógio atrasado reesconde fotos e destrava a edição | P2 | BACKLOG | BG-101 | auditoria AUD-001 · A1-002 · natureza: produto | - | - |
| BG-104 | BUG | Diálogo de revelação: foco, Escape, landmark e não bloquear a postagem | P2 | READY | - | auditoria AUD-001 · A1-006, A1-014 · natureza: produto | - | - |
| BG-121 | BUG | Contagem zera enquanto a tela segue 'Aguardando' por até 15 s | P3 | BACKLOG | - | auditoria AUD-001 · A1-008 · natureza: produto | - | - |
| BG-122 | BUG | Sem limite superior para a data da revelação; troca de fuso com erro genérico e prévia da versão salva | P3 | BACKLOG | - | auditoria AUD-001 · A1-009, A1-010 · natureza: produto | - | - |
| BG-130 | BUG | Exemplo com revelação em 2 minutos não mostra a espera ao anfitrião | P3 | BACKLOG | - | auditoria AUD-001 · A2-012 · natureza: produto | - | - |
| BG-140 | BUG | Datas no fuso do aparelho, não do evento; formatação manual | P3 | BACKLOG | - | auditoria AUD-001 · A3-018 · natureza: produto | - | - |
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

**BG-101** critérios: [A1-001] Corrigir: Persistir revealMode (fim|data|depois) e offset; recalcular revealAt em setEndIn/endEventNow enquanto pendente; senão exigir confirmação mostrando o novo horário.; [A1-001] Teste de regressão: e2e: alterar fim e encerrar agora com modo 'fim' mantém revealAt === endAt; teste de domínio de recalculo

**BG-102** critérios: [A1-002] Corrigir: Local: gravar revealedAt e nunca regredir. Backend: hora do servidor (clock.ts como ponto de troca), transição só pendente→revelada.; [A1-002] Teste de regressão: unit: reconcileReveal nunca grava revelada→pendente; e2e com relógio recuado

**BG-104** critérios: [A1-006] Corrigir: Focar o diálogo ao abrir, prender foco, aceitar Escape; permitir fechar antes; não cobrir /postar com foto pendente.; [A1-014] Corrigir: Envolver em main/região rotulada.; [A1-006] Teste de regressão: e2e + axe: foco dentro do diálogo; Escape fecha; [A1-014] Teste de regressão: axe sem violações

**BG-121** critérios: [A1-008] Corrigir: Sincronizar no visibilitychange/focus e usar uma única fonte.; [A1-008] Teste de regressão: e2e: visibilitychange após revealAt revela

**BG-122** critérios: [A1-009] Corrigir: Limitar (ex. 1 ano ou fim + 30 dias).; [A1-010] Corrigir: Dizer 'o horário ficou no passado neste fuso'; explicar que a hora de parede é mantida.; [A1-009] Teste de regressão: unit; [A1-010] Teste de regressão: e2e do texto

**BG-130** critérios: [A2-012] Corrigir: Entrar já como convidado de exemplo com atalho para o painel.; [A2-012] Teste de regressão: Playwright: do botão até [data-testid=aguardando-revelacao] sem cliques extras.

**BG-140** critérios: [A3-018] Corrigir: Intl com event.timezone.; [A3-018] Teste de regressão: —

## EP-04 · Design system e experiência (DONE)

| ID | Tipo | Título | Prio | Status | Depende de | Origem | Commit | Ambiente |
|---|---|---|---|---|---|---|---|---|
| BG-020 | BUG | theme_color do manifest fixo (não acompanha Noite) | P3 | BACKLOG | - | auditoria · auditoria: A2-008 | - | - |
| BG-021 | BUG | Nome de evento longo a 375 px não medido | P2 | CANCELLED | - | auditoria | - | - |
| BG-022 | BUG | Sem validação em Safari/iOS e Firefox | P2 | READY | - | auditoria | - | - |
| BG-105 | BUG | Foco do Sheet volta ao primeiro controle a cada tick do relógio; fundo não inerte | P2 | READY | - | auditoria AUD-001 · A3-008 · natureza: produto | - | - |
| BG-109 | BUG | Tela de revelação inverte no tema Noite | P2 | READY | - | auditoria AUD-001 · A2-001 · natureza: produto | - | - |
| BG-110 | BUG | Seletor de evento do painel estoura com nome de 60 caracteres | P2 | READY | - | auditoria AUD-001 · A2-002 · natureza: produto | - | - |
| BG-124 | BUG | Textos inexatos na interface | P3 | BACKLOG | - | auditoria AUD-001 · A1-013 · natureza: produto | - | - |
| BG-125 | BUG | Fontes decorativas pré-carregadas em todas as rotas; fonte da interface sem preload | P3 | BACKLOG | - | auditoria AUD-001 · A2-006 · natureza: produto | - | - |
| BG-127 | BUG | Links abaixo de 44 px: 'Guia de componentes' e skip link | P3 | BACKLOG | - | auditoria AUD-001 · A2-009 · natureza: produto | - | - |
| BG-128 | BUG | Borda de chip abaixo de 3:1 (vem do CSS do kit) e tamanhos fixos fora dos tokens | P3 | BACKLOG | - | auditoria AUD-001 · A2-010 · natureza: produto | - | - |
| BG-129 | BUG | Faixa de abas do painel no mobile corta itens sem indício; CLS e h1 duplicado | P3 | BACKLOG | - | auditoria AUD-001 · A2-011 · natureza: produto | - | - |
| FT-020 | FEATURE | Tokens, temas Dia/Noite, fontes locais e logos oficiais | P1 | DONE | - | DS-01..DS-04 | ac290ea | local (build de produção, Chromium) |
| FT-021 | FEATURE | Biblioteca de componentes MemoriesMT (22 + Select, Sheet, KnownPeople) | P1 | DONE | - | DS-05 | 0e818dd | local (build de produção, Chromium) |
| FT-022 | FEATURE | Regras visuais e voz do kit (sem sombra/gradiente/emoji, pt-BR) | P1 | DONE | - | DS-06,DS-07 | 0e818dd | local (build de produção, Chromium) |

**BG-020** critérios: Meta theme-color por esquema já existe; manifest dinâmico por tema não é possível: documentar ou aceitar

**BG-021** critérios: Evento com 60 caracteres sem rolagem horizontal em 375 px nos dois temas · testes: a criar: e2e/visual com título de 60 caracteres

**BG-022** critérios: Projetos WebKit e Firefox no Playwright rodam o smoke e o fluxo de convidado; Registrar o que falhar

**BG-105** critérios: [A3-008] Corrigir: onClose em ref; inert no fundo.; [A3-008] Teste de regressão: Foco estável após 16 s.

**BG-109** critérios: [A2-001] Corrigir: Fixar superfície escura nos dois temas (tokens Noite escopados no componente) e texto claro; remover o style inline do botão.; [A2-001] Teste de regressão: Playwright: em Noite, getComputedStyle de [data-testid=transicao-revelacao] tem luminância <0,1.

**BG-110** critérios: [A2-002] Corrigir: min-height em vez de height e line-clamp de 2 linhas com title completo; corrigir também o kit.; [A2-002] Teste de regressão: Playwright com título de 60 caracteres: filhos do .mm-event-switch dentro do retângulo.

**BG-124** critérios: [A1-013] Corrigir: Plural; esconder contador quando encerrado.; [A1-013] Teste de regressão: e2e dos textos

**BG-125** critérios: [A2-006] Corrigir: Carregar fontes do evento só nas rotas de evento e usar a fonte do evento escolhida; preload do Bricolage; Cache-Control immutable para /fonts.; [A2-006] Teste de regressão: Playwright: / não requisita woff2 de Birthstone, Pinyon ou Great Vibes.

**BG-127** critérios: [A2-009] Corrigir: Usar alvo de 44px ou remover o link em produção; skip link com min-height 44.; [A2-009] Teste de regressão: Playwright: nenhum a[href] visível <44px na home.

**BG-128** critérios: [A2-010] Corrigir: Decidir no DS (borda tinta ou 3:1) e usar as classes de texto do kit.; [A2-010] Teste de regressão: Teste de contraste de bordas de controle no crawl.

**BG-129** critérios: [A2-011] Corrigir: Fade na borda ou quebra em linhas; reservar altura do estado de erro; um só h1.; [A2-011] Teste de regressão: Lighthouse e axe no estado de erro; 1 h1 por rota.

## EP-05 · PWA e offline (IN_PROGRESS)

| ID | Tipo | Título | Prio | Status | Depende de | Origem | Commit | Ambiente |
|---|---|---|---|---|---|---|---|---|
| BG-040 | BUG | Rota dinâmica nunca visitada não abre offline | P2 | BACKLOG | - | auditoria · auditoria: A2-003 | - | - |
| BG-041 | BUG | Atualização do SW num segundo deploy não verificada | P2 | BACKLOG | - | auditoria | - | - |
| BG-042 | BUG | Lógica do SW sem teste unitário | P3 | BACKLOG | - | auditoria · auditoria: A2-014 | - | - |
| BG-108 | BUG | Sem IndexedDB o app confirma ações que não persistem e o aviso global não aparece | P2 | READY | - | auditoria AUD-001 · A2-005 · natureza: produto | - | - |
| BG-111 | BUG | Atualização do service worker apaga as páginas guardadas; pré-cache só de HTML | P2 | BACKLOG | BG-040 | auditoria AUD-001 · A2-004 · natureza: produto | - | - |
| FT-040 | FEATURE | PWA instalável (manifest, ícones, maskable) | P1 | DONE | - | requisito do pedido | 7e0f9ec | local (build de produção, Chromium) |
| FT-041 | FEATURE | Service worker versionado por deploy, shell offline e dados em IndexedDB | P1 | DONE | - | requisito do pedido | 7e0f9ec | local (build de produção, Chromium) |

**BG-040** critérios: Shell genérico para /e/* e /painel/* servido offline; Teste E2E com rota não visitada

**BG-041** critérios: Dois builds consecutivos: cache antigo some e o novo assume

**BG-042** critérios: Estratégias testadas em ambiente de worker simulado

**BG-108** critérios: [A2-005] Corrigir: Mostrar o banner global quando persistent for false e avisar na confirmação de postagem e de criação.; [A2-005] Teste de regressão: Playwright com IndexedDB removido: banner visível em /e/CODE/postar e /criar/pronto.

**BG-111** critérios: [A2-004] Corrigir: Pré-cachear chunks do build (manifesto) e copiar entradas de navegação válidas para o cache novo antes de apagar o antigo.; [A2-004] Teste de regressão: Playwright: dois valores de ?v=; rota visitada continua abrindo offline após a troca.

## EP-06 · Segurança e papéis (IN_PROGRESS)

| ID | Tipo | Título | Prio | Status | Depende de | Origem | Commit | Ambiente |
|---|---|---|---|---|---|---|---|---|
| BG-050 | BUG | CSP com unsafe-inline | P3 | BACKLOG | - | auditoria | - | - |
| BG-051 | BUG | Dependências sem auditoria de vulnerabilidades | P2 | CANCELLED | - | requisito de auditoria | - | - |
| BG-112 | BUG | Limites de campos só em maxLength; domínio e serviços não validam | P2 | READY | - | auditoria AUD-001 · A3-009 · natureza: produto | - | - |
| BG-132 | BUG | Sem limite de dimensão/bytes de entrada no upload (PNG 20000×20000 aceito) | P3 | BACKLOG | - | auditoria AUD-001 · A3-010 · natureza: produto | - | - |
| BG-133 | BUG | CSP com 'unsafe-inline', sem COOP/CORP | P3 | BACKLOG | - | auditoria AUD-001 · A3-011 · natureza: produto | - | - |
| BG-134 | BUG | npm audit: 5 altas em dependências de desenvolvimento (cadeia do eslint-config-next) | P3 | BACKLOG | - | auditoria AUD-001 · A3-012 · natureza: produto | - | - |
| BG-141 | BUG | Todas as páginas são Client Components; /design e /master públicos em produção | P3 | BACKLOG | - | auditoria AUD-001 · A3-019 · natureza: produto | - | - |
| BG-143 | BUG | Nome e fotos persistem localmente depois de 'sair' | P3 | BACKLOG | - | auditoria AUD-001 · A3-021 · natureza: produto | - | - |
| BG-150 | TASK | Risco aceito pré-backend: alterar meta.user para o hostId vira anfitrião | P3 | DEFERRED | - | auditoria AUD-001 · A1-015 · natureza: produto | - | - |
| FT-050 | FEATURE | Headers de segurança e CSP em produção | P1 | DONE | - | auditoria | 7e0f9ec | preview Vercel + local |
| FT-051 | FEATURE | Identidades locais e 'Continuar como' | P1 | DONE | - | auditoria | 7e0f9ec | local (build de produção, Chromium) |

**BG-050** critérios: Nonce por requisição em script e estilo inline

**BG-051** critérios: Produção sem alta/crítica (confirmado: 0); Exceção das 5 altas de desenvolvimento documentada em BG-134

**BG-112** critérios: [A3-009] Corrigir: Schemas no domain e CHECK no banco.; [A3-009] Teste de regressão: Testes de limites.

**BG-132** critérios: [A3-010] Corrigir: Limitar bytes e pixels antes de decodificar; backend valida magic bytes e dimensão.; [A3-010] Teste de regressão: —

**BG-133** critérios: [A3-011] Corrigir: Nonce ou hash; origem Supabase; COOP; poweredByHeader:false.; [A3-011] Teste de regressão: —

**BG-134** critérios: [A3-012] Corrigir: Registrar exceção; audit --omit=dev no CI.; [A3-012] Teste de regressão: —

**BG-141** critérios: [A3-019] Corrigir: Barrar /design.; [A3-019] Teste de regressão: —

**BG-143** critérios: [A3-021] Corrigir: Ação 'esquecer'; erasure no backend.; [A3-021] Teste de regressão: —

**BG-150** critérios: [A1-015] Corrigir: Auth do Supabase com RLS; master só por claim.; [A1-015] Teste de regressão: teste de RLS no backend

## EP-07 · Qualidade e testes (IN_PROGRESS)

| ID | Tipo | Título | Prio | Status | Depende de | Origem | Commit | Ambiente |
|---|---|---|---|---|---|---|---|---|
| BG-060 | BUG | Sem testes de useEventData e usePhotoUrls | P2 | BACKLOG | - | auditoria | - | - |
| BG-061 | BUG | axe só em 390 px | P2 | BACKLOG | - | auditoria | - | - |
| BG-062 | BUG | Evento grande (milhares de fotos) não medido | P2 | BACKLOG | - | auditoria · auditoria: A2-013 | - | - |
| BG-106 | BUG | Falha de escrita deixa botões presos em 'ocupado' (wizard, entrar, ZIP) | P2 | READY | - | auditoria AUD-001 · A3-006 · natureza: produto | - | - |
| BG-107 | BUG | Falha de leitura vira 'Carregando a festa…' eterno | P2 | READY | - | auditoria AUD-001 · A3-007 · natureza: produto | - | - |
| BG-126 | BUG | jszip carregado ao abrir Downloads; sem import dinâmico | P3 | BACKLOG | - | auditoria AUD-001 · A2-007 · natureza: produto | - | - |
| BG-135 | BUG | Dependências e exports não usados; contratos especulativos | P3 | BACKLOG | - | auditoria AUD-001 · A3-013 · natureza: produto | - | - |
| BG-136 | BUG | Escapes de tipo (7 asserções): revisar | P3 | BACKLOG | - | auditoria AUD-001 · A3-014 · natureza: produto | - | - |
| BG-137 | BUG | 8 catch vazios; câmera não distingue a causa da falha | P3 | BACKLOG | - | auditoria AUD-001 · A3-015 · natureza: produto | - | - |
| BG-138 | BUG | URLs de objeto sem revogação no editor e no feed | P3 | BACKLOG | - | auditoria AUD-001 · A3-016 · natureza: produto | - | - |
| BG-142 | BUG | tsconfig inclui e2e/: erro de tipo em spec quebra next build (reproduzido nesta auditoria) | P3 | BACKLOG | - | auditoria AUD-001 · A3-020 · natureza: produto | - | - |
| FT-060 | FEATURE | Suíte unitária (domínio, repositórios, serviços, componentes) | P1 | DONE | - | requisito do pedido | 0e818dd | local (build de produção, Chromium) |
| FT-061 | FEATURE | Suíte E2E (fluxos, PWA, visual, paridade, axe, revelação) | P1 | DONE | - | requisito do pedido | 0e818dd | local (build de produção, Chromium) |

**BG-060** critérios: Hooks testados com repositório em memória

**BG-061** critérios: axe também em 375, 768 e 1440

**BG-062** critérios: Agora com 7.200 fotos mantém interação fluida; medir e registrar

**BG-106** critérios: [A3-006] Corrigir: try/catch/finally.; [A3-006] Teste de regressão: Botão reabilitado.

**BG-107** critérios: [A3-007] Corrigir: Estado de erro com retry.; [A3-007] Teste de regressão: Espera tela de erro.

**BG-126** critérios: [A2-007] Corrigir: import('jszip') dentro do handler do ZIP; idem para seed na home.; [A2-007] Teste de regressão: Playwright: ao abrir /downloads, nenhum script contém 'JSZip' antes do clique.

**BG-135** critérios: [A3-013] Corrigir: Remover ou ligar contratos.; [A3-013] Teste de regressão: —

**BG-136** critérios: [A3-014] Corrigir: Tipo LegacyEvent; wipe tipado.; [A3-014] Teste de regressão: —

**BG-137** critérios: [A3-015] Corrigir: Mapear error.name.; [A3-015] Teste de regressão: —

**BG-138** critérios: [A3-016] Corrigir: Revogar após decodificar.; [A3-016] Teste de regressão: —

**BG-142** critérios: [A3-020] Corrigir: Excluir e2e do build.; [A3-020] Teste de regressão: —

## EP-08 · Prontidão para o Supabase (IN_PROGRESS)

| ID | Tipo | Título | Prio | Status | Depende de | Origem | Commit | Ambiente |
|---|---|---|---|---|---|---|---|---|
| BG-070 | BUG | Exclusão em cascata não é atômica | P2 | BACKLOG | - | auditoria | - | - |
| BG-071 | BUG | Outbox de sincronização offline ainda é só desenho | P1 | BACKLOG | AUD-001, ITG-102 | auditoria | - | - |
| BG-113 | BUG | Read-modify-write sem versão: lost update e ressurreição de evento | P2 | BACKLOG | - | auditoria AUD-001 · A3-004, A1-011 · natureza: produto | - | - |
| FT-070 | FEATURE | Plano de integração Supabase (ERD, RLS, Auth, Storage, realtime, migração, conflitos) | P1 | DONE | - | requisito do pedido | 0e818dd | - |
| FT-071 | FEATURE | Contratos de repositório e serviços atrás de interfaces | P1 | DONE | - | requisito do pedido | 0e818dd | local (build de produção, Chromium) |
| INF-001 | TASK | Validar e corrigir a conexão do Supabase MCP do Claude com o projeto asyaegeodyttttaubvxh (conta, organização, permissões) | P1 | READY | - | auditoria AUD-001 (infraestrutura) | - | - |
| ITG-101 | FEATURE | Leitura escopada por papel: serviços recebem Actor; fotos bloqueadas nunca chegam ao cliente; convite sem expor evento | P1 | BACKLOG | BG-101, BG-102, ITG-106 | auditoria AUD-001 · A3-001, A1-005, A1-004, A4-006 · natureza: integração | - | - |
| ITG-102 | FEATURE | Contratos de repositório v2: paginação, contagem, erros tipados, versão e idempotência | P1 | BACKLOG | ITG-106, BG-113 | auditoria AUD-001 · A3-003, A4-002, A4-003 · natureza: integração | - | - |
| ITG-103 | FEATURE | Fotos por URL/miniatura e upload em duas fases com created_at do servidor | P1 | BACKLOG | ITG-102 | auditoria AUD-001 · A4-001, A4-009 · natureza: integração | - | - |
| ITG-104 | FEATURE | Autoridade do servidor: revelação, rolo, limites e relógio | P1 | BACKLOG | BG-101, BG-102, ITG-106 | auditoria AUD-001 · A4-004, A4-005, A4-010, A4-011 · natureza: integração | - | - |
| ITG-105 | FEATURE | Identidade (auth.uid) e migração local→nuvem compatíveis com o esquema | P1 | BACKLOG | ITG-102 | auditoria AUD-001 · A4-007, A4-008 · natureza: integração | - | - |
| ITG-106 | TASK | Corrigir contradições do INTEGRATION-PLAN e fechar decisões de produto pendentes | P1 | READY | - | auditoria AUD-001 · A4-005, A4-008 · natureza: integração | - | - |
| ITG-107 | FEATURE | Convites: id, rotação, expiração, ?mesa= confiável e limite de tentativas (código ~39,6 bits) | P2 | BACKLOG | ITG-106 | auditoria AUD-001 · A4-014, A3-005 · natureza: integração | - | - |
| ITG-108 | TASK | Ambiente (env), CSP para o Supabase e suíte de contrato reutilizável | P2 | BACKLOG | ITG-106 | auditoria AUD-001 · A4-013 · natureza: integração | - | - |
| ITG-109 | TASK | Matriz de papéis × RLS e proteção de servidor para /master | P2 | BACKLOG | ITG-106 | auditoria AUD-001 · A3-002, A4-012 · natureza: integração | - | - |
| ITG-110 | TASK | Tipos TypeScript × Postgres (datas, enums, opcionais) | P3 | BACKLOG | ITG-102 | auditoria AUD-001 · A4-015 · natureza: integração | - | - |

**BG-070** critérios: Cascata numa transação IndexedDB

**BG-071** critérios: Interface Outbox com testes e implementação local

**INF-001** critérios: list_projects do conector do Claude retorna o projeto asyaegeodyttttaubvxh; get_project confirma ACTIVE_HEALTHY, PostgreSQL 17 e região us-west-2 (somente leitura); Nenhuma escrita, migration, tabela, bucket ou credencial criada nesta verificação; Resultado registrado em docs/audit/evidence/logs

**BG-113** critérios: [A3-004] Corrigir: Patch com version; ON DELETE CASCADE; reabrir db.; [A1-011] Corrigir: withLock por evento ou patch por campo.; [A3-004] Teste de regressão: Teste concorrente updateSettings x reconcileReveal.; [A1-011] Teste de regressão: unit com dois saves concorrentes

**ITG-101** critérios: [A3-001] Corrigir: Filtrar no servidor (RLS), URL assinada só se visível, serviços com Actor.; [A1-005] Corrigir: Definir listVisible/getData(viewer) no contrato e seguir o plano (policy is_revealed, bucket privado).; [A1-004] Corrigir: Passar Actor às funções de serviço e checar a ação correspondente; unificar isHost com can('event.view').; [A4-006] Corrigir: EventRepository.preview(code): EventPreview via RPC; separar hook de prévia do hook de membro.; [A3-001] Teste de regressão: Teste RLS: convidado não lê foto pendente nem modera.; [A1-005] Teste de regressão: teste de contrato do repositório: não-host não recebe fotos pendentes; [A1-004] Teste de regressão: unit: cada serviço recusa ator sem permissão; [A4-006] Teste de regressão: Não-membro só recebe campos de EventPreview; rate limit de preview.

**ITG-102** critérios: [A3-003] Corrigir: PhotoRef com URL/miniatura, cursor, patch, erros tipados, hora do servidor, RPC por código, AuthService.; [A4-002] Corrigir: Page<T> com cursor, count()/RPCs agregadas, filtros por autor/status.; [A4-003] Corrigir: RepositoryError {network,conflict,forbidden,limit,notfound}; create/update(patch,expectedVersion); report(photoId,reporterId); remover Photo.reports gravável.; [A3-003] Teste de regressão: Mesma suíte de contrato em memory e supabase.; [A4-002] Teste de regressão: Contrato com 1200 fotos: contagem exata e paginação completa.; [A4-003] Teste de regressão: Contrato: update com versão velha falha com conflict; mesma pessoa

**ITG-103** critérios: [A4-001] Corrigir: getPhotoUrl(id,variant) com expiração, miniaturas, carga sob demanda; separar fila local de upload do cache.; [A4-009] Corrigir: upload_status + finalize_photo; captured_at do cliente com tolerância; created_at do servidor; outbox com bytes e backoff.; [A4-001] Teste de regressão: Contrato: getPhotoUrl devolve URL válida; hook renova após expirar;; [A4-009] Teste de regressão: Falha no meio do upload não consome rolo; foto tirada antes do fim,

**ITG-104** critérios: [A4-004] Corrigir: Remover reveal_status gravável; derivar de reveal_at; manter job só para push/idempotência.; [A4-005] Corrigir: RPC my_shot_count(event); policy do autor também exige is_revealed; corrigir §5.; [A4-010] Corrigir: Checks e triggers para cada item; FK composta (photo_id,event_id).; [A4-011] Corrigir: Definir invariante; offset servidor-cliente via RPC; refetch em reveal_at+skew, realtime só acelera.; [A4-004] Teste de regressão: Convidado nunca chama events.save; teste RLS: update de reveal_* por; [A4-005] Teste de regressão: pgTAP: autor não lê foto própria pré-revelação; my_shot_count; [A4-010] Teste de regressão: pgTAP por regra, com ator malicioso.; [A4-011] Teste de regressão: Cliente 5 min adiantado não revela; encerrar antes não deixa

**ITG-105** critérios: [A4-007] Corrigir: Usar AuthService no provider; anônimo + linkIdentity; remover switchTo do produto (demo à parte); função de fusão para Google já existente.; [A4-008] Corrigir: author_id nullable + author_name; RPC import_event security definer que ignora triggers; escolher identidade; manifesto com contagens e versão de formato.; [A4-007] Teste de regressão: Anônimo vincula Google mantendo uid e fotos.; [A4-008] Teste de regressão: Importar evento encerrado com fotos de 3 autores: contagens iguais,

**ITG-106** critérios: [A4-005] Corrigir: RPC my_shot_count(event); policy do autor também exige is_revealed; corrigir §5.; [A4-008] Corrigir: author_id nullable + author_name; RPC import_event security definer que ignora triggers; escolher identidade; manifesto com contagens e versão de formato.; [A4-005] Teste de regressão: pgTAP: autor não lê foto própria pré-revelação; my_shot_count; [A4-008] Teste de regressão: Importar evento encerrado com fotos de 3 autores: contagens iguais,

**ITG-107** critérios: [A4-014] Corrigir: Decidir: id no link + invitation_id, ou cortar. RPC rotate_code, rate limit em preview/join, table_label só informativo.; [A3-005] Corrigir: RPC por código com rate limit, backoff e captcha; não expor eventos por id; avaliar 10+ caracteres.; [A4-014] Teste de regressão: Código rotacionado invalida o antigo; 100 previews/min são limitados.; [A3-005] Teste de regressão: 100 códigos inválidos geram 429.

**ITG-108** critérios: [A4-013] Corrigir: CSP com host Supabase (https e wss) e env NEXT_PUBLIC_*; service role só servidor; fábrica de fixtures UUID com dois atores; supabase start no CI.; [A4-013] Teste de regressão: Mesma suíte roda em memória, IDB e Supabase local.

**ITG-109** critérios: [A3-002] Corrigir: RLS por tabela: events (dono; leitura por RPC de código), participants (próprio/dono), photos (autor/dono/revelada), reactions (membro), invitations (dono), storage por evento; master por claim + audit_logs.; [A4-012] Corrigir: Matriz can×RLS como teste; proxy validando claim; ações master via RPC com audit_logs.; [A3-002] Teste de regressão: Matriz papel x ação x tabela.; [A4-012] Teste de regressão: Dois usuários x 6 ações x tabelas; master revogado perde acesso no

**ITG-110** critérios: [A4-015] Corrigir: notice_text+notice_expires_at; ends_at; checks nos enums; mapper único camel/snake e epoch↔timestamptz.; [A4-015] Teste de regressão: Roundtrip mapper para todos os campos.

## EP-09 · Fase Supabase (exclusivo do backend) (DEFERRED)

| ID | Tipo | Título | Prio | Status | Depende de | Origem | Commit | Ambiente |
|---|---|---|---|---|---|---|---|---|
| FT-080 | FEATURE | Auth: Google (organizador) e anônima (convidado) | P1 | DEFERRED | INF-001, AUD-002, ITG-105 | fase Supabase | - | - |
| FT-081 | FEATURE | Web Push real e permissão de notificações | P1 | DEFERRED | AUD-002 | fase Supabase | - | - |
| FT-082 | FEATURE | Esquema, RLS e testes de RLS | P1 | DEFERRED | INF-001, AUD-002, ITG-104, ITG-109, ITG-106 | fase Supabase | - | - |
| FT-083 | FEATURE | Revelação no servidor: reveal_due_events (pg_cron), idempotente, e avisos agendados | P1 | DEFERRED | FT-082, INF-001, AUD-002, ITG-104 | fase Supabase | - | - |
| FT-084 | FEATURE | Realtime e sincronização offline-first entre aparelhos | P1 | DEFERRED | BG-071, FT-082, INF-001, AUD-002, ITG-102 | fase Supabase | - | - |
| FT-085 | FEATURE | Storage privado e URLs assinadas | P1 | DEFERRED | FT-082, INF-001, AUD-002, ITG-103 | fase Supabase | - | - |
| FT-086 | FEATURE | Pagamento, entitlements e Memo+ (gateway) | P1 | DEFERRED | AUD-002 | fase Supabase | - | - |
| FT-087 | FEATURE | Excluir conta e LGPD | P1 | DEFERRED | FT-082, INF-001, AUD-002, ITG-101 | fase Supabase | - | - |
| FT-088 | FEATURE | Administrador master real (claim, middleware, audit_logs) | P1 | DEFERRED | FT-080, FT-082, INF-001, AUD-002, ITG-109 | fase Supabase | - | - |
| FT-089 | FEATURE | Migração local → nuvem | P1 | DEFERRED | FT-080, FT-082, FT-085, INF-001, AUD-002, ITG-105 | fase Supabase | - | - |

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
| AUD-001 | TASK | Auditoria independente pré-Supabase (docs/audit/00..11) | P0 | DONE | FT-037 | auditoria | 32dff31 | local (build de produção/teste, Chromium) + inspeção Vercel/Supabase somente leitura |
| AUD-002 | TASK | Reauditoria dos P1 após as correções (gate para iniciar a fase Supabase) | P1 | BACKLOG | BG-101, ITG-101, ITG-102, ITG-103, ITG-104, ITG-105, ITG-106 | auditoria AUD-001 · infraestrutura | - | - |
| INF-002 | TASK | Produção serve o build antigo (3a8bf89): sem headers/CSP e sem correções da auditoria anterior | P2 | BLOCKED | REL-001 | auditoria AUD-001 · infraestrutura | - | - |
| INF-003 | TASK | Projeto Vercel sem repositório vinculado: deploys foram criados por API com gitSource | P3 | BACKLOG | - | auditoria AUD-001 · infraestrutura | - | - |
| REL-001 | TASK | Confirmar destino Vercel (newmemocuiaba) e promover o preview a produção | P1 | BLOCKED | - | auditoria | - | - |
| REL-002 | TASK | Manter preview como ambiente de validação e registrar commit/URL | P1 | DONE | FT-037 | REA | 5d8df4a | preview Vercel newmemocuiaba (dpl_Cq1otDUS9DsuZVFqthubBfGLEEAz, protegido; acesso por link temporário oficial) |

**REL-001** critérios: Confirmação explícita de Aurimar; Commit e URL de produção verificados

**INF-002** critérios: O alias de produção aponta para o primeiro deploy. Resolver promovendo o preview validado, só com autorização (REL-001).

**INF-003** critérios: Sem integração Git automática. Decidir se vincula o repositório (Root Directory web) ou mantém deploy manual documentado.

**AUD-002** critérios: Reexecutar as frentes A1 e A4 e os testes de exposição sobre as correções; só então liberar EP-09.
