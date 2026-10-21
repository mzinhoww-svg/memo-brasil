# 09 · Registro de achados

Achados brutos dos 4 auditores independentes: **65** (P0 0, P1 12, P2 22, P3 31). Itens de infraestrutura registrados à parte (INF-*). Severidades são as dos auditores; o consolidador agrupou duplicidades em itens de backlog (coluna Backlog) e conferiu no código as marcadas com ✔ (`evidence/logs/consolidator-verification.txt`).

## Produto × integração × infraestrutura
- **Produto**: defeito ou lacuna do app como está (itens BG-*).
- **Integração**: lacuna que o app pré-backend tem para receber o Supabase (itens ITG-*); não é defeito do uso local.
- **Infraestrutura**: ambiente e acesso, fora do código (INF-001 conector Supabase do Claude; INF-002 produção com build antigo; INF-003 projeto Vercel sem Git).

| ID | Sev. | Fonte | Área | Título | Backlog | Verif. |
|---|---|---|---|---|---|---|
| A1-001 | P1 | A1 | revelação | Revelação 'quando o evento terminar' não acompanha mudança nem encerramento do fim | BG-101 | ✔ |
| A1-002 | P2 | A1 | revelação | Estado 'revelada' não é monotônico: relógio atrasado reesconde fotos, regrava revealStatus | BG-102 | ✔ |
| A1-003 | P2 | A1 | moderação | 'Remover da festa' não impede a reentrada | BG-103 | ✔ |
| A1-004 | P2 | A1 | papéis | Política can() cobre só event.configure no layout do painel | ITG-101 |  |
| A1-005 | P2 | A1 | contrato de dados | Repositórios não têm leitura por papel: o filtro de revelação existe só na UI | ITG-101 |  |
| A1-006 | P2 | A1 | acessibilidade | Diálogo de revelação: sem foco inicial, sem armadilha de foco, sem Escape e bloqueia a pos | BG-104 |  |
| A1-007 | P3 | A1 | revelação | react() e reportPhoto() aceitam foto ainda bloqueada | BG-120 |  |
| A1-008 | P3 | A1 | revelação | Contagem zera enquanto a tela segue 'Aguardando' por até 15 s | BG-121 |  |
| A1-009 | P3 | A1 | revelação | Sem limite superior para a data da revelação | BG-122 |  |
| A1-010 | P3 | A1 | revelação | Troca de fuso mantém hora de parede; erro genérico e prévia da versão salva | BG-122 |  |
| A1-011 | P3 | A1 | integridade | Atualizações do evento sem trava (lost update) | BG-113 |  |
| A1-012 | P3 | A1 | moderação | Denúncia não é única por pessoa | BG-123 |  |
| A1-013 | P3 | A1 | conteúdo | Textos inexatos | BG-124 |  |
| A1-014 | P3 | A1 | acessibilidade | axe: region (moderate) nas telas de espera e transição | BG-104 |  |
| A1-015 | P3 | A1 | papéis | Risco aceito pré-backend: meta.user com o hostId vira anfitrião | BG-150 |  |
| A2-001 | P2 | A2 | visual/tema | Tela de revelação inverte no tema Noite | BG-109 | ✔ |
| A2-002 | P2 | A2 | visual/overflow | Seletor de evento do admin estoura com nome de 60 caracteres | BG-110 |  |
| A2-003 | P2 | A2 | pwa/offline | Offline só funciona para URLs já visitadas online | BG-040 |  |
| A2-004 | P2 | A2 | pwa/versionamento | Pré-cache só de HTML; atualização apaga as páginas guardadas | BG-111 |  |
| A2-005 | P2 | A2 | resiliência/dados | Sem IndexedDB, o app confirma ações que não persistem | BG-108 |  |
| A2-006 | P3 | A2 | performance/fontes | Fontes decorativas pré-carregadas em todas as rotas; fonte da interface sem preload | BG-125 |  |
| A2-007 | P3 | A2 | performance/bundle | jszip carregado ao abrir Downloads; sem import dinâmico | BG-126 |  |
| A2-008 | P3 | A2 | pwa/manifest | Manifest sem variante escura e com orientação travada | BG-020 |  |
| A2-009 | P3 | A2 | visual/toque | Links abaixo de 44px: 'Guia de componentes' e skip link | BG-127 |  |
| A2-010 | P3 | A2 | visual/tokens | Borda de chip abaixo de 3:1 e tamanhos fixos fora dos tokens | BG-128 |  |
| A2-011 | P3 | A2 | visual/estados | Faixa de abas do painel no mobile corta itens sem indício; CLS e h1 duplicado | BG-129 |  |
| A2-012 | P3 | A2 | ux/demo | Exemplo com revelação em 2 minutos não mostra a espera ao anfitrião | BG-130 |  |
| A2-013 | P3 | A2 | performance/imagens | Imagens do feed sem lazy/decoding e /voce sem paginação | BG-131 |  |
| A2-014 | P3 | A2 | pwa/sw | Endurecimento do SW: chaves com códigos, evicção e troca silenciosa | BG-042 |  |
| A3-001 | P1 | A3 | seguranca/arquitetura | Visibilidade, revelação e moderação só existem como filtro de UI; o cliente carrega tudo | ITG-101 |  |
| A3-002 | P2 | A3 | seguranca/autorizacao | Modelo de papéis incompleto para RLS | ITG-109 |  |
| A3-003 | P2 | A3 | arquitetura | Contrato de repositório não é backend-ready em 7 pontos | ITG-102 |  |
| A3-004 | P2 | A3 | integridade | Read-modify-write sem versão: lost update e ressurreição de evento | BG-113 |  |
| A3-005 | P2 | A3 | seguranca | Código de convite de 8 caracteres (~39,6 bits) exige rate limit e RPC no backend | ITG-107 |  |
| A3-006 | P2 | A3 | qualidade/erros | Falha de escrita deixa botões presos em 'ocupado' (wizard, entrar, ZIP) | BG-106 | ✔ |
| A3-007 | P2 | A3 | qualidade/erros | Falha de leitura vira 'Carregando a festa…' eterno com mensagem de escrita | BG-107 | ✔ |
| A3-008 | P2 | A3 | acessibilidade | Foco do Sheet volta ao primeiro controle a cada tick do relógio; fundo não inerte | BG-105 | ✔ |
| A3-009 | P2 | A3 | validação | Limites só em maxLength do HTML; domínio e serviços não validam | BG-112 |  |
| A3-010 | P3 | A3 | seguranca/upload | Sem limite de dimensão/bytes de entrada; demais defesas OK | BG-132 |  |
| A3-011 | P3 | A3 | seguranca/headers | CSP com 'unsafe-inline', sem COOP/CORP; CSP precisará de ajuste para Supabase | BG-133 |  |
| A3-012 | P3 | A3 | dependencias | npm audit: 5 altas, todas dev e inalcançáveis em runtime | BG-134 |  |
| A3-013 | P3 | A3 | dependencias/codigo-morto | Dependências e exports não usados; contratos especulativos | BG-135 |  |
| A3-014 | P3 | A3 | tipagem | Escapes de tipo: 7 asserções, 0 any, 0 ts-expect-error | BG-136 |  |
| A3-015 | P3 | A3 | qualidade/erros | 8 catch vazios; câmera não distingue causa | BG-137 |  |
| A3-016 | P3 | A3 | qualidade/efeitos | URLs de objeto sem revogação em editor e feed | BG-138 |  |
| A3-017 | P3 | A3 | i18n/export | CSV separado por vírgula; Excel pt-BR espera ponto e vírgula | BG-139 |  |
| A3-018 | P3 | A3 | i18n/datas | Datas no fuso do aparelho, não do evento; formatação manual | BG-140 |  |
| A3-019 | P3 | A3 | arquitetura | Todas as páginas são Client Components; /design e /master públicos em produção | BG-141 |  |
| A3-020 | P3 | A3 | build | tsconfig inclui e2e/: erro de tipo em spec quebra next build | BG-142 |  |
| A3-021 | P3 | A3 | privacidade | Nome e fotos persistem localmente após 'sair' | BG-143 |  |
| A4-001 | P1 | A4 | contratos | PhotoRepository baseado em bytes, sem URL/miniatura | ITG-103 |  |
| A4-002 | P1 | A4 | contratos | Sem paginação nem contagem; truncamento silencioso | ITG-102 |  |
| A4-003 | P1 | A4 | contratos | Sem erros tipados, idempotência nem concorrência otimista | ITG-102 |  |
| A4-004 | P1 | A4 | revelação | reconcileReveal grava reveal_status em qualquer cliente | ITG-104 | ✔ |
| A4-005 | P1 | A4 | limites/RLS | Rolo contado no cliente quebra sob RLS; plano contraditório | ITG-104, ITG-106 |  |
| A4-006 | P1 | A4 | convites | Convite carrega evento, participantes e fotos de não-membro | ITG-101 |  |
| A4-007 | P1 | A4 | auth | Identidade local incompatível com Supabase Auth | ITG-105 |  |
| A4-008 | P1 | A4 | migração | Plano de migração conflita com o DDL | ITG-105, ITG-106 |  |
| A4-009 | P1 | A4 | upload/sync | Upload em duas fases e created_at do cliente | ITG-103 |  |
| A4-010 | P1 | A4 | limites | Regras que precisam virar constraint/trigger | ITG-104 |  |
| A4-011 | P2 | A4 | revelação | Relógio, ordem reveal×fim e realtime | ITG-104 |  |
| A4-012 | P2 | A4 | papéis | can() só guarda UI; /master sem proteção de servidor | ITG-109 |  |
| A4-013 | P2 | A4 | infra/testes | Sem env, CSP bloqueia Supabase, suíte de contrato não reutilizável | ITG-108 |  |
| A4-014 | P2 | A4 | convites | Convite sem id, rotação ou expiração; ?mesa= não confiável | ITG-107 |  |
| A4-015 | P3 | A4 | modelo | Tipos TS × Postgres | ITG-110 |  |

## Infraestrutura (fora do código)
| ID | Sev. | Título | Status |
|---|---|---|---|
| INF-001 | P1 | Conector Supabase do Claude não enxerga o projeto asyaegeodyttttaubvxh (organização/conta divergente; o projeto existe, segundo o usuário) | READY |
| INF-002 | P2 | Produção serve o build antigo 3a8bf89 | BLOCKED (REL-001) |
| INF-003 | P3 | Projeto Vercel sem repositório vinculado | BACKLOG |

## P0 (0)

Nenhum achado.

## P1 (12)

### A1-001 · Revelação 'quando o evento terminar' não acompanha mudança nem encerramento do fim
- **Severidade:** P1 · **Área:** revelação · **Esforço:** M · **Backlog:** BG-101 · **Verificado pelo consolidador**
- **Descrição:** resolveReveal grava revealAt absoluto na criação. setEndIn e endEventNow não recalculam; RevealSettings.fromEvent sempre reabre como 'data'. Estender o fim para 1 dia deixou a revelação 18 h antes do fim; 'Encerrar agora' deixou 6 h de espera após encerrar. Revelada, não volta a esconder (D18), então a exposição precoce é irreversível. É o caminho padrão do wizard. AC-09 não atendido.
- **Evidência:** docs/audit/evidence/test-results/a1-reveal.json (R9, R9b); screenshots/a1-r9-encerrado-antes.png
- **Arquivos:** web/src/features/events/service.ts, web/src/features/events/reveal-input.ts, web/src/features/events/RevealSettings.tsx, web/src/app/painel/[id]/configuracoes/page.tsx
- **Reprodução:** ["Criar evento com revelação 'Quando o evento terminar'", 'Configurações > mudar o fim para 1 dia', 'Ler IDB: revealAt inalterado, antes do novo fim']
- **Impacto:** Convidados veem todas as fotos no meio do evento sem aviso; ou esperam horas após o fim. Perda do efeito surpresa, sem desfazer.
- **Causa provável:** O modo de revelação não é persistido, só o instante resultante.
- **Correção recomendada:** Persistir revealMode (fim|data|depois) e offset; recalcular revealAt em setEndIn/endEventNow enquanto pendente; senão exigir confirmação mostrando o novo horário.
- **Teste de regressão:** e2e: alterar fim e encerrar agora com modo 'fim' mantém revealAt === endAt; teste de domínio de recalculo
- **Dependências:** -

### A3-001 · Visibilidade, revelação e moderação só existem como filtro de UI; o cliente carrega tudo
- **Severidade:** P1 · **Área:** seguranca/arquitetura · **Esforço:** L · **Backlog:** ITG-101
- **Descrição:** useEventData carrega todas as fotos do evento para qualquer participante e visiblePhotos() filtra depois (revelação, oculta). getData(id) devolve bytes de qualquer id. moderate/removeGuest/reportPhoto/react/updateSettings não recebem Actor; can() só é chamado em painel/[id]/layout.tsx.
- **Evidência:** hooks.ts useEventData; photo.ts visiblePhotos; grep can( = 1 uso.
- **Arquivos:** web/src/features/app/hooks.ts, web/src/domain/photo.ts, web/src/features/admin/service.ts, web/src/features/photos/service.ts
- **Reprodução:** Ler código; um adaptador ingênuo entrega fotos pendentes ao convidado.
- **Impacto:** Com backend, revelação e moderação seriam contornáveis. Hoje não explorável (dados locais).
- **Causa provável:** Regras no cliente.
- **Correção recomendada:** Filtrar no servidor (RLS), URL assinada só se visível, serviços com Actor.
- **Teste de regressão:** Teste RLS: convidado não lê foto pendente nem modera.
- **Dependências:** A3-002, A3-003

### A4-001 · PhotoRepository baseado em bytes, sem URL/miniatura
- **Severidade:** P1 · **Área:** contratos · **Esforço:** M · **Backlog:** ITG-103
- **Descrição:** add/getData movem ArrayBuffer; usePhotoUrls baixa todas as fotos em sequência.
- **Evidência:** types.ts:24,46,48; hooks.ts:83-92
- **Arquivos:** web/src/repositories/types.ts, web/src/features/app/hooks.ts
- **Reprodução:** análise estática
- **Impacto:** Com Storage, feed baixa originais de todas as fotos; URLs assinadas de 60 s expiram no cache por id.
- **Causa provável:** Contrato nasceu para IDB.
- **Correção recomendada:** getPhotoUrl(id,variant) com expiração, miniaturas, carga sob demanda; separar fila local de upload do cache.
- **Teste de regressão:** Contrato: getPhotoUrl devolve URL válida; hook renova após expirar;
- **Dependências:** -

### A4-002 · Sem paginação nem contagem; truncamento silencioso
- **Severidade:** P1 · **Área:** contratos · **Esforço:** M · **Backlog:** ITG-102
- **Descrição:** listByEvent devolve tudo; stats, ranking e rolo usam length.
- **Evidência:** types.ts:44,53; hooks.ts:65; admin/service.ts:15-21; photos/service.ts:11
- **Arquivos:** web/src/repositories/types.ts, web/src/features/admin/service.ts, web/src/features/photos/service.ts
- **Reprodução:** análise estática
- **Impacto:** Acima de ~1000 linhas (200 convidados x 36 fotos) números e rolo ficam errados sem erro.
- **Causa provável:** Armazenamento local ilimitado.
- **Correção recomendada:** Page<T> com cursor, count()/RPCs agregadas, filtros por autor/status.
- **Teste de regressão:** Contrato com 1200 fotos: contagem exata e paginação completa.
- **Dependências:** -

### A4-003 · Sem erros tipados, idempotência nem concorrência otimista
- **Severidade:** P1 · **Área:** contratos · **Esforço:** M · **Backlog:** ITG-102
- **Descrição:** Só StorageUnavailableError existe; save() é upsert da linha inteira; modelos sem updatedAt/version; reports é contador lido-incrementado-gravado.
- **Evidência:** types.ts:29-35,84-91; events/service.ts:93-94; photos/service.ts:51-58; a4-static-checks.txt
- **Arquivos:** web/src/repositories/types.ts, web/src/domain/event.ts, web/src/features/photos/service.ts
- **Reprodução:** análise estática
- **Impacto:** Outbox não distingue offline de limite; dois aparelhos sobrescrevem configurações e denúncias; denúncia dupla da mesma pessoa.
- **Causa provável:** Lock é local (Web Locks).
- **Correção recomendada:** RepositoryError {network,conflict,forbidden,limit,notfound}; create/update(patch,expectedVersion); report(photoId,reporterId); remover Photo.reports gravável.
- **Teste de regressão:** Contrato: update com versão velha falha com conflict; mesma pessoa
- **Dependências:** -

### A4-004 · reconcileReveal grava reveal_status em qualquer cliente
- **Severidade:** P1 · **Área:** revelação · **Esforço:** S · **Backlog:** ITG-104 · **Verificado pelo consolidador**
- **Descrição:** Efeito do layout do convidado chama events.save com status recalculado.
- **Evidência:** (app)/layout.tsx:65-68; events/service.ts:124-131
- **Arquivos:** web/src/app/e/[code]/(app)/layout.tsx, web/src/features/events/service.ts
- **Reprodução:** análise estática
- **Impacto:** Sob RLS convidado recebe 403 a cada revelação; se permitido, convidado altera o evento.
- **Causa provável:** Espelho persistido tratado como tarefa de cliente.
- **Correção recomendada:** Remover reveal_status gravável; derivar de reveal_at; manter job só para push/idempotência.
- **Teste de regressão:** Convidado nunca chama events.save; teste RLS: update de reveal_* por
- **Dependências:** A4-003

### A4-005 · Rolo contado no cliente quebra sob RLS; plano contraditório
- **Severidade:** P1 · **Área:** limites/RLS · **Esforço:** S · **Backlog:** ITG-104, ITG-106
- **Descrição:** used vem das fotos visíveis; antes da revelação o convidado não lê as próprias (§4.1) mas §5 diz 'autor: as suas'.
- **Evidência:** postar/page.tsx:29; photos/service.ts:10-12; domain/photo.ts:55; INTEGRATION-PLAN §4.1 x §5
- **Arquivos:** web/src/app/e/[code]/(app)/postar/page.tsx, docs/supabase/INTEGRATION-PLAN.md
- **Reprodução:** análise estática
- **Impacto:** Rolo ilimitado na UI ou, seguindo §5, autor vê fotos antes da revelação.
- **Causa provável:** Contagem derivada de leitura filtrada.
- **Correção recomendada:** RPC my_shot_count(event); policy do autor também exige is_revealed; corrigir §5.
- **Teste de regressão:** pgTAP: autor não lê foto própria pré-revelação; my_shot_count
- **Dependências:** A4-002

### A4-006 · Convite carrega evento, participantes e fotos de não-membro
- **Severidade:** P1 · **Área:** convites · **Esforço:** M · **Backlog:** ITG-101
- **Descrição:** useEventData({code}) lê getByCode + listas; layout do evento faz o mesmo.
- **Evidência:** hooks.ts:60-65; e/[code]/page.tsx:26
- **Arquivos:** web/src/features/app/hooks.ts, web/src/app/e/[code]/page.tsx
- **Reprodução:** análise estática
- **Impacto:** Com RLS a tela de convite falha; sem RLS, expõe evento inteiro.
- **Causa provável:** Sem tipo de prévia pública.
- **Correção recomendada:** EventRepository.preview(code): EventPreview via RPC; separar hook de prévia do hook de membro.
- **Teste de regressão:** Não-membro só recebe campos de EventPreview; rate limit de preview.
- **Dependências:** A4-003

### A4-007 · Identidade local incompatível com Supabase Auth
- **Severidade:** P1 · **Área:** auth · **Esforço:** M · **Backlog:** ITG-105
- **Descrição:** User.id é UUID local; known/switchTo/clear; AuthService nunca usado; signOut anônimo perde a conta.
- **Evidência:** provider.tsx:65-86; types.ts:65-73; services/index.ts:9; KnownPeople
- **Arquivos:** web/src/features/app/provider.tsx, web/src/repositories/types.ts, web/src/lib/services/index.ts
- **Reprodução:** análise estática
- **Impacto:** Anônimo que sai perde fotos; ids locais ≠ auth.uid().
- **Causa provável:** Auth modelada como repositório local.
- **Correção recomendada:** Usar AuthService no provider; anônimo + linkIdentity; remover switchTo do produto (demo à parte); função de fusão para Google já existente.
- **Teste de regressão:** Anônimo vincula Google mantendo uid e fotos.
- **Dependências:** A4-003

### A4-008 · Plano de migração conflita com o DDL
- **Severidade:** P1 · **Área:** migração · **Esforço:** M · **Backlog:** ITG-105, ITG-106
- **Descrição:** photos.author_id not null FK profiles, mas autores convidados locais não têm perfil; triggers de evento encerrado/rolo barram importação; hostId local precisa de remapeamento; várias identidades por aparelho.
- **Evidência:** INTEGRATION-PLAN §3 (photos), §4, §10; types.ts:65-73
- **Arquivos:** docs/supabase/INTEGRATION-PLAN.md
- **Reprodução:** análise estática
- **Impacto:** Importação de evento encerrado falha.
- **Causa provável:** Importação tratada como inserts comuns.
- **Correção recomendada:** author_id nullable + author_name; RPC import_event security definer que ignora triggers; escolher identidade; manifesto com contagens e versão de formato.
- **Teste de regressão:** Importar evento encerrado com fotos de 3 autores: contagens iguais,
- **Dependências:** A4-007

### A4-009 · Upload em duas fases e created_at do cliente
- **Severidade:** P1 · **Área:** upload/sync · **Esforço:** L · **Backlog:** ITG-103
- **Descrição:** Sem estado de upload; linha antes do objeto conta no rolo; createdAt vem do cliente e o trigger usa now().
- **Evidência:** indexeddb:108-112; photos/service.ts:24-32; INTEGRATION-PLAN §4,§7
- **Arquivos:** web/src/features/photos/service.ts, docs/supabase/INTEGRATION-PLAN.md
- **Reprodução:** análise estática
- **Impacto:** Falha parcial gasta um tiro; foto offline sincronizada após o fim é rejeitada.
- **Causa provável:** add() atômico no IDB.
- **Correção recomendada:** upload_status + finalize_photo; captured_at do cliente com tolerância; created_at do servidor; outbox com bytes e backoff.
- **Teste de regressão:** Falha no meio do upload não consome rolo; foto tirada antes do fim,
- **Dependências:** A4-001, A4-003

### A4-010 · Regras que precisam virar constraint/trigger
- **Severidade:** P1 · **Área:** limites · **Esforço:** M · **Backlog:** ITG-104
- **Descrição:** Só no cliente: rolo, capacidade (e não encolher abaixo de convidados), evento encerrado, não reabrir, revelação (1 min, imutável após revelada), título 60, legenda 140, momento 30, aviso 90, mesas 0-60, mime/8 MB, reação só em foto visível, denúncia única, event_id da reação = o da foto.
- **Evidência:** photo.ts:30,38; event.ts:18,26; events/service.ts:92; configuracoes/page.tsx:48,73; qr/page.tsx:36; photos/service.ts:16,40-42
- **Arquivos:** web/src/domain/event.ts, web/src/domain/photo.ts
- **Reprodução:** análise estática
- **Impacto:** Cliente adulterado burla limites; plano omite capacidade encolhida, mesas, comprimentos, FK composta.
- **Causa provável:** Validação só em UI.
- **Correção recomendada:** Checks e triggers para cada item; FK composta (photo_id,event_id).
- **Teste de regressão:** pgTAP por regra, com ator malicioso.
- **Dependências:** -

## P2 (22)

### A1-002 · Estado 'revelada' não é monotônico: relógio atrasado reesconde fotos, regrava revealStatus e destrava edição
- **Severidade:** P2 · **Área:** revelação · **Esforço:** S · **Backlog:** BG-102 · **Verificado pelo consolidador**
- **Descrição:** Com o relógio recuado após a revelação, o convidado volta a 'Aguardando', reconcileReveal grava 'pendente' e o organizador volta a editar a revelação.
- **Evidência:** a1-reveal.json (R5: stored revelada→pendente; R5b editavel true); screenshots/a1-r5-regride.png
- **Arquivos:** web/src/domain/reveal.ts, web/src/features/events/service.ts, web/src/app/e/[code]/(app)/layout.tsx, web/src/lib/clock.ts
- **Reprodução:** ['setFixedTime(revealAt+5s), abrir como convidado', 'setFixedTime(base), recarregar']
- **Impacto:** Aparelho com hora errada mostra estado errado; contrato do backend exige estado que nunca regride.
- **Causa provável:** computeRevealStatus(now) é a única fonte e reconcile grava qualquer divergência.
- **Correção recomendada:** Local: gravar revealedAt e nunca regredir. Backend: hora do servidor (clock.ts como ponto de troca), transição só pendente→revelada.
- **Teste de regressão:** unit: reconcileReveal nunca grava revelada→pendente; e2e com relógio recuado
- **Dependências:** supabase INTEGRATION-PLAN

### A1-003 · 'Remover da festa' não impede a reentrada
- **Severidade:** P2 · **Área:** moderação · **Esforço:** S · **Backlog:** BG-103 · **Verificado pelo consolidador**
- **Descrição:** Convidado removido volta a entrar com o mesmo código e posta de novo. A tela diz 'não posta mais'.
- **Evidência:** a1-journeys.json (J7 reentrada_apos_remocao true)
- **Arquivos:** web/src/features/admin/service.ts, web/src/app/painel/[id]/convidados/page.tsx, web/src/features/participants/service.ts
- **Reprodução:** ['Ana entra', 'Anfitrião remove Ana', 'Ana abre o convite e entra']
- **Impacto:** Moderação ineficaz; texto enganoso.
- **Causa provável:** Remoção apaga a linha de participante, sem marca de banimento checada em joinEvent/canPost.
- **Correção recomendada:** Estado 'removido' em participants, recusado em joinEvent; ou corrigir o texto.
- **Teste de regressão:** e2e: removido não entra nem posta
- **Dependências:** -

### A1-004 · Política can() cobre só event.configure no layout do painel
- **Severidade:** P2 · **Área:** papéis · **Esforço:** M · **Backlog:** ITG-101
- **Descrição:** reveal.configure, photo.moderate, event.delete e event.view não são usadas; os serviços (updateReveal, moderate, deleteEvent, updateSettings, setEndIn, endEventNow, removeGuest) não recebem ator; o layout do convidado calcula isHost por conta própria; /master não usa can() nem MasterRepository. LOCAL_ACTOR é sempre 'organizador'.
- **Evidência:** docs/audit/evidence/logs/a1-grep-roles.txt; web/src/app/painel/[id]/layout.tsx:51
- **Arquivos:** web/src/domain/roles.ts, web/src/features/events/service.ts, web/src/features/admin/service.ts, web/src/app/e/[code]/(app)/layout.tsx, web/src/app/master/page.tsx
- **Reprodução:** ["grep -rn 'can(' web/src"]
- **Impacto:** Contrato de papéis não é exercitado nas ações; risco de divergir no RLS.
- **Causa provável:** Gate único na rota.
- **Correção recomendada:** Passar Actor às funções de serviço e checar a ação correspondente; unificar isHost com can('event.view').
- **Teste de regressão:** unit: cada serviço recusa ator sem permissão
- **Dependências:** supabase INTEGRATION-PLAN

### A1-005 · Repositórios não têm leitura por papel: o filtro de revelação existe só na UI
- **Severidade:** P2 · **Área:** contrato de dados · **Esforço:** M · **Backlog:** ITG-101
- **Descrição:** listByEvent devolve todas as fotos; GuestCtx.photos carrega todas, e visiblePhotos filtra na tela. Sem método do tipo listVisible(eventId, viewer), a troca para Supabase pode herdar um filtro só de cliente.
- **Evidência:** a1-exposure-roles.json (E3 repositorio_lista_tudo_sem_filtro_de_papel); web/src/repositories/types.ts
- **Arquivos:** web/src/repositories/types.ts, web/src/features/app/hooks.ts, web/src/features/photos/service.ts
- **Reprodução:** ['Ler PhotoRepository']
- **Impacto:** Integração pode expor fotos bloqueadas se RLS e bucket privado não forem implementados.
- **Causa provável:** Contrato local sem ator.
- **Correção recomendada:** Definir listVisible/getData(viewer) no contrato e seguir o plano (policy is_revealed, bucket privado).
- **Teste de regressão:** teste de contrato do repositório: não-host não recebe fotos pendentes
- **Dependências:** A1-004, supabase INTEGRATION-PLAN

### A1-006 · Diálogo de revelação: sem foco inicial, sem armadilha de foco, sem Escape e bloqueia a postagem por ~2,3 s
- **Severidade:** P2 · **Área:** acessibilidade · **Esforço:** S · **Backlog:** BG-104
- **Descrição:** role=dialog aria-modal, mas durante a animação o foco fica no BODY e a tabulação alcança a página atrás. Cobre /postar no meio de uma foto. O botão só aparece após 2,2 s (nenhum atalho).
- **Evidência:** a1-reveal.json (R8 clique_em_Postar_bloqueado true, ms_ate_poder_postar 2313; R12 foco BODY); screenshots/a1-r7-transicao.png
- **Arquivos:** web/src/features/reveal/RevealTransition.tsx
- **Reprodução:** ['Convidado em /postar com foto capturada', 'Avançar o relógio além de revealAt']
- **Impacto:** Usuário de teclado e leitor de tela perde contexto; interrompe a postagem.
- **Causa provável:** Diálogo sem gestão de foco; atraso fixo.
- **Correção recomendada:** Focar o diálogo ao abrir, prender foco, aceitar Escape; permitir fechar antes; não cobrir /postar com foto pendente.
- **Teste de regressão:** e2e + axe: foco dentro do diálogo; Escape fecha
- **Dependências:** -

### A2-001 · Tela de revelação inverte no tema Noite
- **Severidade:** P2 · **Área:** visual/tema · **Esforço:** S · **Backlog:** BG-109 · **Verificado pelo consolidador**
- **Descrição:** `.app-reveal` usa `background: var(--tinta); color: var(--fundo)`. No Dia fica escura; na Noite vira tela clara cheia (#F4F2EF), em plena festa à noite. O DS exige temas Dia e Noite sem inversão. O CTA 'Ver as fotos' também usa troca inline fundo/tinta.
- **Evidência:** docs/audit/evidence/screenshots/a2-revelacao-transicao-390-noite.png contra a2-revelacao-transicao-390-dia.png
- **Arquivos:** web/src/styles/app.css, web/src/features/reveal/RevealTransition.tsx
- **Reprodução:** Tema Noite, evento com revelação, convidado, avançar o relógio até o horário: aparece a tela clara.
- **Impacto:** Quebra de identidade no momento mais emocional do produto e ofuscamento em ambiente escuro.
- **Causa provável:** Uso de tokens semânticos trocados em vez de uma superfície escura por tema.
- **Correção recomendada:** Fixar superfície escura nos dois temas (tokens Noite escopados no componente) e texto claro; remover o style inline do botão.
- **Teste de regressão:** Playwright: em Noite, getComputedStyle de [data-testid=transicao-revelacao] tem luminância <0,1.
- **Dependências:** -

### A2-002 · Seletor de evento do admin estoura com nome de 60 caracteres
- **Severidade:** P2 · **Área:** visual/overflow · **Esforço:** S · **Backlog:** BG-110
- **Descrição:** Em ≥900px a caixa `.mm-event-switch` tem 56px de altura fixa; título de 3 linhas ocupa 130px e a linha de data cai sobre a borda (6px de estouro). Mesmo CSS existe no kit (mm.css idêntico a componentes.css).
- **Evidência:** docs/audit/evidence/test-results/a2-overflow.json (painel-1440-*: boxH 56, childBottomMax 130, overflows true); screenshots/a2-longos-painel-1440-dia.png
- **Arquivos:** web/src/styles/mm.css, web/src/components/memoriesmt/AdminNav.tsx, design-system/MemoriesMT-design-system/componentes/componentes.css
- **Reprodução:** Criar evento com 60 caracteres, abrir /painel/<id> em 1440px.
- **Impacto:** Texto sobreposto no cabeçalho de todas as telas do painel para nomes longos.
- **Causa provável:** Altura fixa sem limite de linhas.
- **Correção recomendada:** min-height em vez de height e line-clamp de 2 linhas com title completo; corrigir também o kit.
- **Teste de regressão:** Playwright com título de 60 caracteres: filhos do .mm-event-switch dentro do retângulo.
- **Dependências:** -

### A2-003 · Offline só funciona para URLs já visitadas online
- **Severidade:** P2 · **Área:** pwa/offline · **Esforço:** M · **Backlog:** BG-040
- **Descrição:** O SW guarda HTML por URL exata. Rotas do mesmo evento nunca abertas (retrospectiva, painel/qr) e outros códigos caem em /offline, embora a casca seja a mesma e os dados estejam no IndexedDB. A página diz 'Tente de novo quando o sinal voltar', o que não ajuda quem tem o evento no aparelho.
- **Evidência:** a2-pwa.json: offlineNeverVisited (4 de 4 em /offline); screenshots/a2-pwa-offline-nunca-visitada-390-dia.png
- **Arquivos:** web/public/sw.js
- **Reprodução:** Visitar /e/CODE/agora online, ficar offline, abrir /e/CODE/retrospectiva.
- **Impacto:** O convidado perde partes do app sem sinal, justo no cenário de festa com rede ruim. A promessa 'abre offline' é parcial.
- **Causa provável:** Chave de cache por URL e fallback único para /offline; sem pré-cache de rotas.
- **Correção recomendada:** Para /e/* e /painel/*, servir qualquer HTML-casca em cache quando offline (a rota resolve no cliente) e pré-cachear os chunks das rotas do convidado.
- **Teste de regressão:** Playwright offline: abrir cada rota do convidado nunca visitada e esperar o h1 da rota, não /offline.
- **Dependências:** A2-004

### A2-004 · Pré-cache só de HTML; atualização apaga as páginas guardadas
- **Severidade:** P2 · **Área:** pwa/versionamento · **Esforço:** M · **Backlog:** BG-111
- **Descrição:** A instalação cacheia 5 URLs de HTML, sem JS, CSS ou fontes (entram depois, quando o SW já controla). Primeira visita seguida de offline funcionou aqui, mas por causa do cache HTTP. Ao trocar de versão o cache antigo é apagado e o novo tem só a casca: páginas de evento visitadas deixam de abrir offline. skipWaiting e claim trocam o SW sem aviso.
- **Evidência:** a2-pwa.json: cacheAfterFirstVisit (sem /_next/static); swUpdate.cachesAfterB (só 5 URLs)
- **Arquivos:** web/public/sw.js, web/src/lib/register-sw.tsx
- **Reprodução:** Registrar /sw.js?v=AAA, visitar rotas, registrar ?v=BBB, listar caches.
- **Impacto:** Depois de cada deploy, o uso offline some até o convidado reabrir online cada tela.
- **Causa provável:** Cache único por versão e sem migração de entradas.
- **Correção recomendada:** Pré-cachear chunks do build (manifesto) e copiar entradas de navegação válidas para o cache novo antes de apagar o antigo.
- **Teste de regressão:** Playwright: dois valores de ?v=; rota visitada continua abrindo offline após a troca.
- **Dependências:** -

### A2-005 · Sem IndexedDB, o app confirma ações que não persistem
- **Severidade:** P2 · **Área:** resiliência/dados · **Esforço:** S · **Backlog:** BG-108
- **Descrição:** Com `indexedDB` indefinido, o app usa repositório em memória e só a home avisa. Em /criar/pronto aparece 'Evento criado' com 'Compartilhar convite', e em postar 'Sua visão entrou na história'. Ao recarregar: 'Código não confere'. O banner global só aparece quando a abertura lança erro, não quando falta a API.
- **Evidência:** a2-pwa.json: idb_undefined (afterReloadText, wizardEnd); idb_throws; screenshots/a2-idb-undefined-criar-390-dia.png
- **Arquivos:** web/src/features/app/provider.tsx, web/src/components/memoriesmt/StorageBanner.tsx
- **Reprodução:** addInitScript que remove window.indexedDB; criar evento; recarregar.
- **Impacto:** Perda silenciosa de fotos e eventos. Não classifiquei P1 porque o navegador precisa bloquear IndexedDB (modo restrito) e a home avisa nesse caso.
- **Causa provável:** StorageBanner depende de storageError, não de persistent=false.
- **Correção recomendada:** Mostrar o banner global quando persistent for false e avisar na confirmação de postagem e de criação.
- **Teste de regressão:** Playwright com IndexedDB removido: banner visível em /e/CODE/postar e /criar/pronto.
- **Dependências:** -

### A3-002 · Modelo de papéis incompleto para RLS
- **Severidade:** P2 · **Área:** seguranca/autorizacao · **Esforço:** M · **Backlog:** ITG-109
- **Descrição:** event.view é true para qualquer convidado sem checar participação; sem ações postar/reagir/denunciar/baixar; LOCAL_ACTOR dá organizador a qualquer um; master true para tudo sem motivo/auditoria; sem papel participante nem co-organizador. IDOR futuro por event id (/painel/[id] só protegido pela UI).
- **Evidência:** roles.ts:19-37; painel/[id]/layout.tsx:47.
- **Arquivos:** web/src/domain/roles.ts, docs/architecture/ROLES.md
- **Reprodução:** Expressar 'só participante posta' em can().
- **Impacto:** RLS derivada daqui teria lacunas.
- **Causa provável:** Contrato escrito para a UI.
- **Correção recomendada:** RLS por tabela: events (dono; leitura por RPC de código), participants (próprio/dono), photos (autor/dono/revelada), reactions (membro), invitations (dono), storage por evento; master por claim + audit_logs.
- **Teste de regressão:** Matriz papel x ação x tabela.
- **Dependências:** A3-001

### A3-003 · Contrato de repositório não é backend-ready em 7 pontos
- **Severidade:** P2 · **Área:** arquitetura · **Esforço:** L · **Backlog:** ITG-102
- **Descrição:** (1) getData devolve bytes completos e a UI cria blob URL (feed, editor, ZIP) sem URL assinada nem miniatura; (2) list sem paginação (o 'limit' do feed fatia no cliente); (3) events.list() em app/page.tsx assume todos visíveis; (4) getByCode assume leitura pública; (5) save(event) grava o objeto inteiro; (6) now() do cliente decide canPost/canJoin/revelação; (7) identidade é UUID local sem sessão e o único erro tipado é StorageUnavailableError. Pontos bons: interfaces async, domain puro.
- **Evidência:** types.ts; hooks.ts:74-100; app/page.tsx:24; editor.tsx:61.
- **Arquivos:** web/src/repositories/types.ts, web/src/features/app/hooks.ts, web/src/app/page.tsx, web/src/features/photos/editor.tsx
- **Reprodução:** Ler código.
- **Impacto:** Adaptador exigirá mudar telas.
- **Causa provável:** Interface moldada ao IndexedDB.
- **Correção recomendada:** PhotoRef com URL/miniatura, cursor, patch, erros tipados, hora do servidor, RPC por código, AuthService.
- **Teste de regressão:** Mesma suíte de contrato em memory e supabase.
- **Dependências:** A3-001

### A3-004 · Read-modify-write sem versão: lost update e ressurreição de evento
- **Severidade:** P2 · **Área:** integridade · **Esforço:** M · **Backlog:** BG-113
- **Descrição:** events.save grava o objeto inteiro: reconcileReveal (efeito do layout do convidado), updateSettings, updateReveal e setEndIn podem sobrescrever gravações concorrentes e ressuscitar evento excluído. moderate() sem withLock (reportPhoto usa): update perdido. deleteEventCascade em 5 transações. blocking() fecha o handle mas dbp cacheado fica apontando para conexão fechada.
- **Evidência:** events/service.ts; admin/service.ts moderate; repositories/index.ts; indexeddb/index.ts:50-56 (leitura de código).
- **Arquivos:** web/src/features/events/service.ts, web/src/features/admin/service.ts, web/src/repositories/index.ts, web/src/repositories/indexeddb/index.ts
- **Reprodução:** Duas abas: reconcilia enquanto outra salva.
- **Impacto:** Perda silenciosa; órfãos.
- **Causa provável:** Escrita da entidade inteira.
- **Correção recomendada:** Patch com version; ON DELETE CASCADE; reabrir db.
- **Teste de regressão:** Teste concorrente updateSettings x reconcileReveal.
- **Dependências:** A3-003

### A3-005 · Código de convite de 8 caracteres (~39,6 bits) exige rate limit e RPC no backend
- **Severidade:** P2 · **Área:** seguranca · **Esforço:** M · **Backlog:** ITG-107
- **Descrição:** 31^8 = 8,5e11 (39,6 bits), gerado com getRandomValues sem viés. Com leitura por código, é enumerável sem rate limit e /e/[code] revela título, anfitrião e local.
- **Evidência:** share-code.ts; log2(31^8)=39,63.
- **Arquivos:** web/src/domain/share-code.ts
- **Reprodução:** Cálculo.
- **Impacto:** Descoberta de eventos alheios.
- **Causa provável:** Código curto por design.
- **Correção recomendada:** RPC por código com rate limit, backoff e captcha; não expor eventos por id; avaliar 10+ caracteres.
- **Teste de regressão:** 100 códigos inválidos geram 429.
- **Dependências:** A3-002

### A3-006 · Falha de escrita deixa botões presos em 'ocupado' (wizard, entrar, ZIP)
- **Severidade:** P2 · **Área:** qualidade/erros · **Esforço:** S · **Backlog:** BG-106 · **Verificado pelo consolidador**
- **Descrição:** wizard create, Convite enter e Downloads album não têm try/finally: se o repositório lança, o estado ocupado nunca volta.
- **Evidência:** a3-resilience.json: wizardButtonDisabled=true.
- **Arquivos:** web/src/features/events/wizard.tsx, web/src/app/e/[code]/page.tsx, web/src/app/painel/[id]/downloads/page.tsx, web/e2e/audit-a3-resilience.spec.ts
- **Reprodução:** put lança QuotaExceededError; clicar Criar evento.
- **Impacto:** Recarregar a página.
- **Causa provável:** Sem try/finally.
- **Correção recomendada:** try/catch/finally.
- **Teste de regressão:** Botão reabilitado.
- **Dependências:** -

### A3-007 · Falha de leitura vira 'Carregando a festa…' eterno com mensagem de escrita
- **Severidade:** P2 · **Área:** qualidade/erros · **Esforço:** S · **Backlog:** BG-107 · **Verificado pelo consolidador**
- **Descrição:** useEventData.refresh não captura: com leitura falhando, loading fica true e o banner fala de 'guardar'.
- **Evidência:** a3-resilience.json readFailureBodyText.
- **Arquivos:** web/src/features/app/hooks.ts, web/src/app/e/[code]/(app)/layout.tsx, web/src/features/app/provider.tsx
- **Reprodução:** Falhar leituras e recarregar /e/CODE/agora.
- **Impacto:** Tela sem saída.
- **Causa provável:** Sem catch.
- **Correção recomendada:** Estado de erro com retry.
- **Teste de regressão:** Espera tela de erro.
- **Dependências:** -

### A3-008 · Foco do Sheet volta ao primeiro controle a cada tick do relógio; fundo não inerte
- **Severidade:** P2 · **Área:** acessibilidade · **Esforço:** S · **Backlog:** BG-105 · **Verificado pelo consolidador**
- **Descrição:** O efeito depende de onClose (lambda inline) e o painel re-renderiza a cada 15 s: o foco volta ao primeiro botão. Sem inert no fundo.
- **Evidência:** a3-resilience.json: foco 'Voltar' antes, 'Excluir evento' após 16 s.
- **Arquivos:** web/src/components/memoriesmt/Sheet.tsx
- **Reprodução:** Abrir o Sheet, Tab, esperar 16 s.
- **Impacto:** Foco perdido.
- **Causa provável:** Dependência instável.
- **Correção recomendada:** onClose em ref; inert no fundo.
- **Teste de regressão:** Foco estável após 16 s.
- **Dependências:** -

### A3-009 · Limites só em maxLength do HTML; domínio e serviços não validam
- **Severidade:** P2 · **Área:** validação · **Esforço:** S · **Backlog:** BG-112
- **Descrição:** Limites (título 60, nome 40, legenda 140, aviso 90, momento 30) só em maxLength. Serviços não limitam; updateSettings aceita título vazio e momentos ilimitados.
- **Evidência:** grep maxLength só em .tsx.
- **Arquivos:** web/src/features/events/service.ts, web/src/features/photos/service.ts, web/src/domain/event.ts
- **Reprodução:** updateSettings com title vazio.
- **Impacto:** Dados inválidos persistem.
- **Causa provável:** Validação só no formulário.
- **Correção recomendada:** Schemas no domain e CHECK no banco.
- **Teste de regressão:** Testes de limites.
- **Dependências:** -

### A4-011 · Relógio, ordem reveal×fim e realtime
- **Severidade:** P2 · **Área:** revelação · **Esforço:** M · **Backlog:** ITG-104
- **Descrição:** setEndIn/endEventNow não movem revealAt; o preset 'ao terminar' vira data fixa; o tempo passando não gera evento postgres_changes; relógio do cliente decide a UI.
- **Evidência:** events/service.ts:68-85; reveal-input.ts:24-35; clock.ts; layout.tsx:55-60
- **Arquivos:** web/src/features/events/service.ts, web/src/features/reveal/RevealTransition.tsx
- **Reprodução:** análise estática
- **Impacto:** Álbum revelado com evento ainda aberto; contador diverge do servidor; atraso de até 60 s do cron.
- **Causa provável:** Sem invariante reveal_at x ends_at.
- **Correção recomendada:** Definir invariante; offset servidor-cliente via RPC; refetch em reveal_at+skew, realtime só acelera.
- **Teste de regressão:** Cliente 5 min adiantado não revela; encerrar antes não deixa
- **Dependências:** A4-004

### A4-012 · can() só guarda UI; /master sem proteção de servidor
- **Severidade:** P2 · **Área:** papéis · **Esforço:** M · **Backlog:** ITG-109
- **Descrição:** Serviços não checam ator; não há proxy/middleware; claim master tem TTL do JWT.
- **Evidência:** roles.ts:19; painel/layout.tsx:49; ls src/proxy.ts ausente; ROLES.md regra 4
- **Arquivos:** web/src/domain/roles.ts, web/src/app/master/page.tsx
- **Reprodução:** ls web/src/proxy.ts web/src/middleware.ts
- **Impacto:** Matriz can()×RLS não é testável; rota master depende só de UI.
- **Causa provável:** Contrato sem implementação.
- **Correção recomendada:** Matriz can×RLS como teste; proxy validando claim; ações master via RPC com audit_logs.
- **Teste de regressão:** Dois usuários x 6 ações x tabelas; master revogado perde acesso no
- **Dependências:** A4-007

### A4-013 · Sem env, CSP bloqueia Supabase, suíte de contrato não reutilizável
- **Severidade:** P2 · **Área:** infra/testes · **Esforço:** M · **Backlog:** ITG-108
- **Descrição:** connect-src e img-src 'self'; sem supabase/ ou tipos gerados; fixtures usam ids 'e1','p1' e inserem reação sem foto.
- **Evidência:** next.config.ts:12,15; a4-contract-fixtures.txt; repositories.test.ts:15-18,52-54,61-63
- **Arquivos:** web/next.config.ts, web/src/repositories/repositories.test.ts
- **Reprodução:** cat docs/audit/evidence/logs/a4-contract-fixtures.txt
- **Impacto:** Primeira chamada falha; suíte reprova adaptador correto.
- **Causa provável:** Fixtures sem FK/auth.
- **Correção recomendada:** CSP com host Supabase (https e wss) e env NEXT_PUBLIC_*; service role só servidor; fábrica de fixtures UUID com dois atores; supabase start no CI.
- **Teste de regressão:** Mesma suíte roda em memória, IDB e Supabase local.
- **Dependências:** A4-003

### A4-014 · Convite sem id, rotação ou expiração; ?mesa= não confiável
- **Severidade:** P2 · **Área:** convites · **Esforço:** M · **Backlog:** ITG-107
- **Descrição:** Código é segredo permanente; link carrega rótulo livre, não invitation id; invitations só no seed.
- **Evidência:** links.ts:3-12; seed.ts:56; e/[code]/page.tsx:54
- **Arquivos:** web/src/features/invitations/links.ts
- **Reprodução:** análise estática
- **Impacto:** Sem métrica por mesa; vazamento do código não tem remédio; table_label forjável.
- **Causa provável:** Modelo mínimo.
- **Correção recomendada:** Decidir: id no link + invitation_id, ou cortar. RPC rotate_code, rate limit em preview/join, table_label só informativo.
- **Teste de regressão:** Código rotacionado invalida o antigo; 100 previews/min são limitados.
- **Dependências:** A4-006

## P3 (31)

### A1-007 · react() e reportPhoto() aceitam foto ainda bloqueada
- **Severidade:** P3 · **Área:** revelação · **Esforço:** S · **Backlog:** BG-120
- **Descrição:** Em serviço, um convidado grava reação em foto pendente. A UI não oferece o caminho.
- **Evidência:** a1-exposure-roles.json (E3 reacao_gravada_em_foto_bloqueada true)
- **Arquivos:** web/src/features/photos/service.ts
- **Reprodução:** ["react(repos,evento_pendente,photoId,'guest','amei')"]
- **Impacto:** Baixo na UI; risco quando o contrato virar API.
- **Causa provável:** Falta guarda de isRevealed.
- **Correção recomendada:** Recusar react/report se não revelada e o ator não for host.
- **Teste de regressão:** unit no serviço
- **Dependências:** A1-005

### A1-008 · Contagem zera enquanto a tela segue 'Aguardando' por até 15 s
- **Severidade:** P3 · **Área:** revelação · **Esforço:** S · **Backlog:** BG-121
- **Descrição:** WaitingReveal usa relógio de 1 s e o layout de 15 s; sem visibilitychange/focus para sincronizar. Aba suspensa mostra 00h 00min 00s e nada muda.
- **Evidência:** a1-reveal.json (R13)
- **Arquivos:** web/src/features/reveal/WaitingReveal.tsx, web/src/features/app/hooks.ts, web/src/app/e/[code]/(app)/layout.tsx
- **Reprodução:** ['Fixar tempo em revealAt+2s sem disparar timers']
- **Impacto:** Atraso visível na transição.
- **Causa provável:** Dois relógios independentes.
- **Correção recomendada:** Sincronizar no visibilitychange/focus e usar uma única fonte.
- **Teste de regressão:** e2e: visibilitychange após revealAt revela
- **Dependências:** -

### A1-009 · Sem limite superior para a data da revelação
- **Severidade:** P3 · **Área:** revelação · **Esforço:** S · **Backlog:** BG-122
- **Descrição:** Ano 9999 é aceito; o timer ignora mais de 2^31 ms.
- **Evidência:** a1-reveal.json (R3_dominio 'ano 9999')
- **Arquivos:** web/src/domain/reveal.ts
- **Reprodução:** ['validateRevealInput 9999-12-31']
- **Impacto:** Fotos presas por engano.
- **Causa provável:** Validação só de piso.
- **Correção recomendada:** Limitar (ex. 1 ano ou fim + 30 dias).
- **Teste de regressão:** unit
- **Dependências:** -

### A1-010 · Troca de fuso mantém hora de parede; erro genérico e prévia da versão salva
- **Severidade:** P3 · **Área:** revelação · **Esforço:** S · **Backlog:** BG-122
- **Descrição:** Cuiabá→Lisboa manteve 12h00 e caiu no passado: o aviso é 'Confira a data, a hora e o fuso' e o resumo diz 'Escolha a data e a hora' com campos preenchidos. A prévia usa o evento salvo, não o formulário. Coerente com INTEGRATION-PLAN linha 103, mas não explicado.
- **Evidência:** a1-reveal.json (R4); screenshots/a1-r4-troca-fuso.png
- **Arquivos:** web/src/features/events/RevealForm.tsx, web/src/features/events/RevealSettings.tsx
- **Reprodução:** ['Configurações: fuso Lisboa mantendo 12:00']
- **Impacto:** Organizador não entende o motivo.
- **Causa provável:** Mensagem única e texto de resumo.
- **Correção recomendada:** Dizer 'o horário ficou no passado neste fuso'; explicar que a hora de parede é mantida.
- **Teste de regressão:** e2e do texto
- **Dependências:** -

### A1-011 · Atualizações do evento sem trava (lost update)
- **Severidade:** P3 · **Área:** integridade · **Esforço:** S · **Backlog:** BG-113
- **Descrição:** get→save do objeto inteiro em updateSettings, setEndIn, endEventNow, updateReveal e reconcileReveal, sem withLock. Não reproduzi; é leitura de código.
- **Evidência:** web/src/features/events/service.ts:68-132
- **Arquivos:** web/src/features/events/service.ts
- **Reprodução:** ['Duas abas alterando o mesmo evento']
- **Impacto:** Alteração perdida em corrida rara.
- **Causa provável:** Sem exclusão mútua nem merge por campo.
- **Correção recomendada:** withLock por evento ou patch por campo.
- **Teste de regressão:** unit com dois saves concorrentes
- **Dependências:** -

### A1-012 · Denúncia não é única por pessoa
- **Severidade:** P3 · **Área:** moderação · **Esforço:** S · **Backlog:** BG-123
- **Descrição:** report() soma 1 a cada chamada; o estado 'enviado' vale por abertura da folha. Por leitura de código.
- **Evidência:** web/src/domain/photo.ts:report; web/src/features/photos/service.ts:reportPhoto
- **Arquivos:** web/src/domain/photo.ts, web/src/features/photos/service.ts
- **Reprodução:** ['Denunciar a mesma foto várias vezes']
- **Impacto:** Contador inflado por um convidado.
- **Causa provável:** Sem registro do denunciante.
- **Correção recomendada:** Guardar (photoId, userId) e contar únicos.
- **Teste de regressão:** unit
- **Dependências:** -

### A1-013 · Textos inexatos
- **Severidade:** P3 · **Área:** conteúdo · **Esforço:** S · **Backlog:** BG-124
- **Descrição:** 'Suas 1 fotos estão guardadas' (offline) e '23 fotos restantes' em evento encerrado.
- **Evidência:** a1-journeys.json (J4, J2)
- **Arquivos:** web/src/app/e/[code]/(app)/layout.tsx, web/src/app/e/[code]/(app)/postar/page.tsx
- **Reprodução:** ['Offline com 1 foto; abrir /postar após encerrar']
- **Impacto:** Qualidade de texto.
- **Causa provável:** Sem plural e sem checar encerramento.
- **Correção recomendada:** Plural; esconder contador quando encerrado.
- **Teste de regressão:** e2e dos textos
- **Dependências:** -

### A1-014 · axe: region (moderate) nas telas de espera e transição
- **Severidade:** P3 · **Área:** acessibilidade · **Esforço:** S · **Backlog:** BG-104
- **Descrição:** Um nó fora de landmark em cada tela.
- **Evidência:** a1-reveal.json (R12)
- **Arquivos:** web/src/features/reveal/WaitingReveal.tsx, web/src/features/reveal/RevealTransition.tsx
- **Reprodução:** ['axe na espera']
- **Impacto:** Menor.
- **Causa provável:** Conteúdo sem landmark.
- **Correção recomendada:** Envolver em main/região rotulada.
- **Teste de regressão:** axe sem violações
- **Dependências:** -

### A1-015 · Risco aceito pré-backend: meta.user com o hostId vira anfitrião
- **Severidade:** P3 · **Área:** papéis · **Esforço:** L · **Backlog:** BG-150
- **Descrição:** Gravar meta.user com o hostId (legível no evento) abre painel e fotos antes da revelação. Registrado em ROLES.md como não segurança. Não existe senha fixa, URL secreta ou caminho master no código ou bundle.
- **Evidência:** a1-exposure-roles.json (P2); a1-grep-roles.txt
- **Arquivos:** web/src/repositories/indexeddb/index.ts, web/src/domain/roles.ts
- **Reprodução:** ["IndexedDB meta 'user' = hostId"]
- **Impacto:** Nenhum além do aparelho do usuário.
- **Causa provável:** Identidade local.
- **Correção recomendada:** Auth do Supabase com RLS; master só por claim.
- **Teste de regressão:** teste de RLS no backend
- **Dependências:** supabase INTEGRATION-PLAN

### A2-006 · Fontes decorativas pré-carregadas em todas as rotas; fonte da interface sem preload
- **Severidade:** P3 · **Área:** performance/fontes · **Esforço:** S · **Backlog:** BG-125
- **Descrição:** Birthstone, Pinyon e Great Vibes (latin, cerca de 90 KB) têm preload em todas as páginas, inclusive / e /entrar, e só servem ao nome do evento. Bricolage (77 KB) vem de /fonts por @font-face e não tem preload. /fonts, /brand e /pwa respondem `max-age=0`. Fontes somam 163 KB por rota. O LCP mobile simulado (h1, 2,9 a 3,3 s) provavelmente sofre com isso (hipótese, não isolada).
- **Evidência:** a2-perf-routes-mobile.json (fonts); HTML de /entrar; Lighthouse a2-lighthouse-home-mobile.json
- **Arquivos:** web/src/app/layout.tsx, web/src/styles/tokens.css, web/next.config.ts
- **Reprodução:** curl /entrar | grep preload; curl -I /fonts/BricolageGrotesque-Variable.woff2.
- **Impacto:** Cerca de 90 KB desnecessários por visita e revalidação de 77 KB a cada carga.
- **Causa provável:** next/font no layout raiz e sem headers de cache para public/.
- **Correção recomendada:** Carregar fontes do evento só nas rotas de evento e usar a fonte do evento escolhida; preload do Bricolage; Cache-Control immutable para /fonts.
- **Teste de regressão:** Playwright: / não requisita woff2 de Birthstone, Pinyon ou Great Vibes.
- **Dependências:** -

### A2-007 · jszip carregado ao abrir Downloads; sem import dinâmico
- **Severidade:** P3 · **Área:** performance/bundle · **Esforço:** S · **Backlog:** BG-126
- **Descrição:** jszip tem 190 KB brutos (cerca de 55 KB gzip) e entra no carregamento de /painel/ID/downloads, embora só seja usado ao clicar. O código de demo (seed) vai no chunk da home (25 KB). Nenhum import() no projeto.
- **Evidência:** a2-perf-routes-desktop.json (jsFiles: 0_t7ot-9xac4y.js 190 KB); build em /tmp/a2-build
- **Arquivos:** web/src/features/admin/export.ts, web/src/app/painel/[id]/downloads/page.tsx, web/src/app/page.tsx
- **Reprodução:** Abrir /painel/ID/downloads e listar scripts.
- **Impacto:** Rota de downloads 40% mais pesada que as demais.
- **Causa provável:** Import estático.
- **Correção recomendada:** import('jszip') dentro do handler do ZIP; idem para seed na home.
- **Teste de regressão:** Playwright: ao abrir /downloads, nenhum script contém 'JSZip' antes do clique.
- **Dependências:** -

### A2-008 · Manifest sem variante escura e com orientação travada
- **Severidade:** P3 · **Área:** pwa/manifest · **Esforço:** S · **Backlog:** BG-020
- **Descrição:** theme_color e background_color fixos em #FFFFFF (a meta viewport já tem variante escura); `orientation: portrait` também vale para o painel do organizador em tablet ou desktop. Sem screenshots no manifest.
- **Evidência:** a2-pwa.json: manifest, head.themeColors
- **Arquivos:** web/src/app/manifest.ts
- **Reprodução:** GET /manifest.webmanifest.
- **Impacto:** Splash branca para quem usa Noite; PWA do painel preso em retrato.
- **Causa provável:** Manifest estático.
- **Correção recomendada:** Remover orientation (ou limitar ao convidado) e alinhar cores de splash ao tema padrão do app.
- **Teste de regressão:** Teste de unidade do manifest: sem orientation global.
- **Dependências:** -

### A2-009 · Links abaixo de 44px: 'Guia de componentes' e skip link
- **Severidade:** P3 · **Área:** visual/toque · **Esforço:** S · **Backlog:** BG-127
- **Descrição:** O link 'Guia de componentes' no rodapé da home mede 173×21, vive dentro de um parágrafo sem estilo de link e expõe a página /design em produção. O skip link mede 169×43.
- **Evidência:** a2-crawl-375-dia.json (home, targets.small); screenshots/a2-home-1440-dia.png
- **Arquivos:** web/src/app/page.tsx, web/src/styles/mm.css
- **Reprodução:** Abrir / em 375px e medir os alvos.
- **Impacto:** Alvo pequeno e rota interna de desenvolvimento acessível ao público.
- **Causa provável:** Link inline sem classe .mm-link e sem condicional de ambiente.
- **Correção recomendada:** Usar alvo de 44px ou remover o link em produção; skip link com min-height 44.
- **Teste de regressão:** Playwright: nenhum a[href] visível <44px na home.
- **Dependências:** -

### A2-010 · Borda de chip abaixo de 3:1 e tamanhos fixos fora dos tokens
- **Severidade:** P3 · **Área:** visual/tokens · **Esforço:** S · **Backlog:** BG-128
- **Descrição:** A borda 1px de `mm-chip` mede 1,46:1 (Dia) e 1,54:1 (Noite), contra a regra de 3:1 para bordas de controle; vem do CSS do kit. A home usa h1 de 36px inline (token `display` tem 40px) e o nome do evento usa 30px inline (`nome-evento` tem 54px).
- **Evidência:** a2-crawl-390-dia.json (design, postar-preview: nonTextContrast); src/app/page.tsx:68
- **Arquivos:** web/src/styles/mm.css, web/src/app/page.tsx, web/src/app/criar/pronto/[id]/page.tsx, web/src/app/e/[code]/(app)/agora/page.tsx
- **Reprodução:** Medir a borda de .mm-chip contra o fundo.
- **Impacto:** Chips pouco perceptíveis no não selecionado; desvios pequenos de escala tipográfica.
- **Causa provável:** Regra do DS inconsistente consigo mesma e estilos inline.
- **Correção recomendada:** Decidir no DS (borda tinta ou 3:1) e usar as classes de texto do kit.
- **Teste de regressão:** Teste de contraste de bordas de controle no crawl.
- **Dependências:** -

### A2-011 · Faixa de abas do painel no mobile corta itens sem indício; CLS e h1 duplicado
- **Severidade:** P3 · **Área:** visual/estados · **Esforço:** S · **Backlog:** BG-129
- **Descrição:** No 390px as abas do painel rolam na horizontal com itens cortados e sem indicação. O painel com id desconhecido em desktop tem CLS 0,322 (Lighthouse). O convite tem dois h1 (nome do evento e 'Entrar na festa').
- **Evidência:** screenshots/a2-painel-configuracoes-390-dia.png; a2-lighthouse-painel-desktop.json; a2-crawl-390-dia.json (convite.h1)
- **Arquivos:** web/src/app/painel/[id]/layout.tsx, web/src/app/e/[code]/page.tsx
- **Reprodução:** Abrir /painel/<id> em 390px; abrir /painel/<uuid inexistente> em 1440px.
- **Impacto:** Navegação do admin menos descobrível; salto visual no erro; hierarquia de títulos ambígua.
- **Causa provável:** Overflow-x sem fade ou seta; estado de erro com layout diferente do carregando; dois h1.
- **Correção recomendada:** Fade na borda ou quebra em linhas; reservar altura do estado de erro; um só h1.
- **Teste de regressão:** Lighthouse e axe no estado de erro; 1 h1 por rota.
- **Dependências:** -

### A2-012 · Exemplo com revelação em 2 minutos não mostra a espera ao anfitrião
- **Severidade:** P3 · **Área:** ux/demo · **Esforço:** S · **Backlog:** BG-130
- **Descrição:** O botão da home cria o exemplo como anfitrião, que vê tudo e só recebe um aviso. Para ver a tela de espera é preciso Você, 'Entrar como outra pessoa' e digitar um nome.
- **Evidência:** a2-revelacao-host-agora-390-dia.png; a2-revelacao-espera-390-dia.png
- **Arquivos:** web/src/app/page.tsx, web/src/features/demo/seed.ts
- **Reprodução:** Home, 'Ver exemplo com revelação em 2 minutos'.
- **Impacto:** A demonstração do recurso novo exige 4 passos extras.
- **Causa provável:** Seed entra como anfitrião.
- **Correção recomendada:** Entrar já como convidado de exemplo com atalho para o painel.
- **Teste de regressão:** Playwright: do botão até [data-testid=aguardando-revelacao] sem cliques extras.
- **Dependências:** -

### A2-013 · Imagens do feed sem lazy/decoding e /voce sem paginação
- **Severidade:** P3 · **Área:** performance/imagens · **Esforço:** S · **Backlog:** BG-131
- **Descrição:** Nenhum <img> usa loading=lazy ou decoding=async; /voce renderiza todas as fotos próprias de uma vez (150 em 307 ms, sem throttling). O feed é paginado (20 por vez), o que limita o custo. Redimensionamento 1600px e JPEG 0,85 confirmados no código (capture.ts).
- **Evidência:** a2-perf-200fotos-b.json; src/features/photos/capture.ts
- **Arquivos:** web/src/components/memoriesmt/PostCard.tsx, web/src/app/e/[code]/(app)/voce/page.tsx
- **Reprodução:** Semear 150 fotos do anfitrião e abrir /voce.
- **Impacto:** Pressão de memória de bitmaps em celulares fracos com rolos grandes (não medida).
- **Causa provável:** Sem atributos de carregamento e sem limite em /voce.
- **Correção recomendada:** loading=lazy, decoding=async e paginar /voce.
- **Teste de regressão:** Playwright: imagens fora da viewport sem decode inicial e /voce com no máximo 20 imagens iniciais.
- **Dependências:** -

### A2-014 · Endurecimento do SW: chaves com códigos, evicção e troca silenciosa
- **Severidade:** P3 · **Área:** pwa/sw · **Esforço:** M · **Backlog:** BG-042
- **Descrição:** O cache não guarda dados de evento nem fotos, mas as chaves contêm código do convite e UUID. Com backend o código será credencial. A evicção parece FIFO por inserção (não verificado como LRU). Não há navigation preload nem aviso de nova versão.
- **Evidência:** a2-pwa.json: cacheAfterVisits (URLs com /e/CODE e /painel/UUID); swUpdate.pagesCachedAfter50Fetches
- **Arquivos:** web/public/sw.js
- **Reprodução:** Listar caches após visitar um evento.
- **Impacto:** Rastro de códigos em aparelho compartilhado; páginas muito usadas podem sair do cache.
- **Causa provável:** remember() usa a URL completa e o limite remove as mais antigas.
- **Correção recomendada:** Limpar o cache ao sair do evento, registrar uso recente na evicção e avisar a nova versão.
- **Teste de regressão:** Playwright: sair do evento esvazia entradas /e/CODE do cache.
- **Dependências:** A2-003

### A3-010 · Sem limite de dimensão/bytes de entrada; demais defesas OK
- **Severidade:** P3 · **Área:** seguranca/upload · **Esforço:** S · **Backlog:** BG-132
- **Descrição:** SVG com script é rasterizado (sem execução); não-imagem rejeitada; EXIF/GPS removido; 40 MB aleatório rejeitado em 2,6 s; PNG 20000x20000 (48 KB) aceito em 1 s no Chromium. Sem limite de file.size nem de pixels antes de decodificar; MAX_PHOTO_BYTES só vale na saída.
- **Evidência:** a3-upload-results.json
- **Arquivos:** web/src/features/photos/capture.ts, web/src/features/photos/service.ts, web/e2e/audit-a3-upload.spec.ts
- **Reprodução:** Rodar o spec de upload.
- **Impacto:** Memória em celulares fracos.
- **Causa provável:** —
- **Correção recomendada:** Limitar bytes e pixels antes de decodificar; backend valida magic bytes e dimensão.
- **Teste de regressão:** —
- **Dependências:** -

### A3-011 · CSP com 'unsafe-inline', sem COOP/CORP; CSP precisará de ajuste para Supabase
- **Severidade:** P3 · **Área:** seguranca/headers · **Esforço:** S · **Backlog:** BG-133
- **Descrição:** Headers idênticos no build de teste e de produção. CSP tem frame-ancestors 'none', object-src 'none', base-uri 'self'; script-src/style-src com 'unsafe-inline' sem nonce; sem COOP/CORP; X-Powered-By ativo. connect-src/img-src 'self' bloquearão o Supabase.
- **Evidência:** logs/a3-headers-*.txt
- **Arquivos:** web/next.config.ts
- **Reprodução:** curl -I.
- **Impacto:** CSP quebra no go-live.
- **Causa provável:** —
- **Correção recomendada:** Nonce ou hash; origem Supabase; COOP; poweredByHeader:false.
- **Teste de regressão:** —
- **Dependências:** A3-003

### A3-012 · npm audit: 5 altas, todas dev e inalcançáveis em runtime
- **Severidade:** P3 · **Área:** dependencias · **Esforço:** S · **Backlog:** BG-134
- **Descrição:** Cadeia braces, micromatch, fast-glob, eslint-config-next (DoS por padrão aninhado, GHSA-vfj7-8cjw-p6xm). audit --omit=dev: 0. O 'fix --force' sugere downgrade para eslint-config-next@14: não aplicar.
- **Evidência:** logs/a3-npm-audit*.txt
- **Arquivos:** web/package.json
- **Reprodução:** npm audit --omit=dev.
- **Impacto:** Nenhum em produção.
- **Causa provável:** —
- **Correção recomendada:** Registrar exceção; audit --omit=dev no CI.
- **Teste de regressão:** —
- **Dependências:** -

### A3-013 · Dependências e exports não usados; contratos especulativos
- **Severidade:** P3 · **Área:** dependencias/codigo-morto · **Esforço:** S · **Backlog:** BG-135
- **Descrição:** depcheck marca tailwindcss e @tailwindcss/turbopack (usados via @import: falso positivo). knip: 19 exports e 20 tipos sem uso; AuthService, BillingService, SyncService, MasterRepository sem consumidor. 131 testes passam; eslint limpo.
- **Evidência:** logs/a3-depcheck.txt, a3-knip.txt
- **Arquivos:** web/src/lib/services/index.ts, web/src/domain/roles.ts
- **Reprodução:** npx knip.
- **Impacto:** Ruído.
- **Causa provável:** —
- **Correção recomendada:** Remover ou ligar contratos.
- **Teste de regressão:** —
- **Dependências:** -

### A3-014 · Escapes de tipo: 7 asserções, 0 any, 0 ts-expect-error
- **Severidade:** P3 · **Área:** tipagem · **Esforço:** S · **Backlog:** BG-136
- **Descrição:** reveal.ts:124 (as unknown as, forma legada); indexeddb: as never x2 e db as unknown as (wipe dinâmico). '!' em editor (getContext, stage.current) e Sheet. Sem bug observado.
- **Evidência:** grep as never|as unknown as.
- **Arquivos:** web/src/domain/reveal.ts, web/src/repositories/indexeddb/index.ts, web/src/features/photos/editor.tsx
- **Reprodução:** grep.
- **Impacto:** Baixo.
- **Causa provável:** —
- **Correção recomendada:** Tipo LegacyEvent; wipe tipado.
- **Teste de regressão:** —
- **Dependências:** -

### A3-015 · 8 catch vazios; câmera não distingue causa
- **Severidade:** P3 · **Área:** qualidade/erros · **Esforço:** S · **Backlog:** BG-137
- **Descrição:** sessionStorage, tema e SW são aceitáveis. Em postar, getUserMedia trata NotAllowed, NotFound e NotReadable do mesmo jeito e a mensagem só cita permissão.
- **Evidência:** postar/page.tsx:54,75,89.
- **Arquivos:** web/src/app/e/[code]/(app)/postar/page.tsx
- **Reprodução:** Ler.
- **Impacto:** Suporte difícil.
- **Causa provável:** —
- **Correção recomendada:** Mapear error.name.
- **Teste de regressão:** —
- **Dependências:** -

### A3-016 · URLs de objeto sem revogação em editor e feed
- **Severidade:** P3 · **Área:** qualidade/efeitos · **Esforço:** S · **Backlog:** BG-138
- **Descrição:** editor.tsx load() nunca revoga blob URLs; usePhotoUrls só revoga ao desmontar. Tracks da câmera e listeners são liberados corretamente.
- **Evidência:** editor.tsx:28-34; hooks.ts:78-100.
- **Arquivos:** web/src/features/photos/editor.tsx, web/src/features/app/hooks.ts
- **Reprodução:** Ler.
- **Impacto:** Memória.
- **Causa provável:** —
- **Correção recomendada:** Revogar após decodificar.
- **Teste de regressão:** —
- **Dependências:** -

### A3-017 · CSV separado por vírgula; Excel pt-BR espera ponto e vírgula
- **Severidade:** P3 · **Área:** i18n/export · **Esforço:** S · **Backlog:** BG-139
- **Descrição:** guestsCsv usa ',' e o Excel pt-BR espera ';'. Proteção contra fórmula e slug no ZIP corretos (sem path traversal).
- **Evidência:** admin/export.ts.
- **Arquivos:** web/src/features/admin/export.ts
- **Reprodução:** Abrir no Excel pt-BR.
- **Impacto:** Usabilidade.
- **Causa provável:** —
- **Correção recomendada:** Usar ';'.
- **Teste de regressão:** —
- **Dependências:** -

### A3-018 · Datas no fuso do aparelho, não do evento; formatação manual
- **Severidade:** P3 · **Área:** i18n/datas · **Esforço:** S · **Backlog:** BG-140
- **Descrição:** formatDate/formatTime usam o fuso do aparelho, não event.timezone; scheduler de notificações usa Date.now() em vez do relógio da app.
- **Evidência:** hooks.ts:110-125.
- **Arquivos:** web/src/features/app/hooks.ts, web/src/lib/services/notifications.ts
- **Reprodução:** Ler.
- **Impacto:** Horários divergentes.
- **Causa provável:** —
- **Correção recomendada:** Intl com event.timezone.
- **Teste de regressão:** —
- **Dependências:** -

### A3-019 · Todas as páginas são Client Components; /design e /master públicos em produção
- **Severidade:** P3 · **Área:** arquitetura · **Esforço:** M · **Backlog:** BG-141
- **Descrição:** Todas as páginas de dados são 'use client' (useApp/IndexedDB); AppProvider envolve tudo. Rotas [id]/[code] são dinâmicas. /design (catálogo) é servido em produção.
- **Evidência:** grep use client; a3-xss-network.json.
- **Arquivos:** web/src/app/layout.tsx, web/src/app/design/page.tsx
- **Reprodução:** Abrir /design.
- **Impacto:** Auth SSR exigirá separar server/client.
- **Causa provável:** —
- **Correção recomendada:** Barrar /design.
- **Teste de regressão:** —
- **Dependências:** -

### A3-020 · tsconfig inclui e2e/: erro de tipo em spec quebra next build
- **Severidade:** P3 · **Área:** build · **Esforço:** S · **Backlog:** BG-142
- **Descrição:** Na cópia de produção, specs A1 com erro de tipo fizeram 'next build' falhar; passou ao removê-los. Com a flag do relógio em 1 em produção, o gate de hostname localhost ainda limita.
- **Evidência:** logs/a3-prod-build.txt (build final).
- **Arquivos:** web/tsconfig.json
- **Reprodução:** npm run build com specs com
- **Impacto:** Deploy frágil.
- **Causa provável:** —
- **Correção recomendada:** Excluir e2e do build.
- **Teste de regressão:** —
- **Dependências:** -

### A3-021 · Nome e fotos persistem localmente após 'sair'
- **Severidade:** P3 · **Área:** privacidade · **Esforço:** S · **Backlog:** BG-143
- **Descrição:** users.clear() mantém 'known' por desenho; authorName/name denormalizados; sem apagar-meus-dados. Sem tokens nem console.*; localStorage só guarda o tema.
- **Evidência:** indexeddb users.*; a3-xss-network.json.
- **Arquivos:** web/src/repositories/indexeddb/index.ts
- **Reprodução:** Sair e inspecionar IndexedDB.
- **Impacto:** Dados pessoais no aparelho.
- **Causa provável:** —
- **Correção recomendada:** Ação 'esquecer'; erasure no backend.
- **Teste de regressão:** —
- **Dependências:** A3-003

### A4-015 · Tipos TS × Postgres
- **Severidade:** P3 · **Área:** modelo · **Esforço:** S · **Backlog:** ITG-110
- **Descrição:** notice com expiresAt em epoch ms; durationHours+endedAt em vez de ends_at; palette/eventFont sem enum; moment texto livre; moments:[] com fallback 'Agora'.
- **Evidência:** event.ts:17,28-33,39-42; postar/page.tsx:22
- **Arquivos:** web/src/domain/event.ts
- **Reprodução:** análise estática
- **Impacto:** Conversões frágeis.
- **Causa provável:** Modelo local.
- **Correção recomendada:** notice_text+notice_expires_at; ends_at; checks nos enums; mapper único camel/snake e epoch↔timestamptz.
- **Teste de regressão:** Roundtrip mapper para todos os campos.
- **Dependências:** A4-003
