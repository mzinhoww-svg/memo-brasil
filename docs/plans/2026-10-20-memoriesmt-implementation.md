# MemoriesMT (pré-Supabase) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (execução nativa, decidida pelo usuário: autonomia total) ou superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Entregar o MemoriesMT, câmera colaborativa para eventos, como PWA Next.js com design system MemoriesMT v1, persistência local (IndexedDB) e preview Vercel, sem backend.

**Architecture:** App Router em `web/`. Camadas: `domain/` (TS puro, testado) → `repositories/` (interfaces + adaptadores IndexedDB/memória) → `features/` (hooks/estado por área) → `components/memoriesmt/` (componentes do DS) → `app/` (rotas). Visual = tokens e classes `mm-*` oficiais do DS (copiadas, não reinventadas); Tailwind v4 só para layout, com tokens mapeados via `@theme`.

**Tech Stack:** Next.js (App Router), React, TypeScript strict, Tailwind v4, IndexedDB (`idb`), Vitest + fake-indexeddb + Testing Library, Playwright, Vercel.

**Spec:** pedido "SUPERPOWERS — MEMORIESMT" (sessão de 2026-10-20), `docs/reverse-engineering/` (REA), `design-system/MemoriesMT-design-system/`, `docs/architecture/EXISTING-SYSTEM-AUDIT.md`.

## Global Constraints
- Marca: **MemoriesMT** (nunca "Memo"). Logos só os SVGs do kit; selo ≥16px, wordmark ≥96px, proteção 25% do diâmetro do selo.
- Fontes locais: Bricolage Grotesque (UI) e Instrument Serif (emoção, máx. 1 por tela). Fonte do evento só no nome do evento. Sem Inter/Roboto.
- Temas `data-theme="dia"|"noite"`, tokens semânticos de `tokens.css`; sem inversão de cores, sem sombras, sem gradientes, sem emoji na UI, vermelho `rec` ≤10% da tela e nunca em texto (texto usa `rec-texto`).
- Mobile-first 375/390; alvo de toque ≥44px; foco visível 2px/offset 2px; CTA "Postar daqui" fixo no rodapé mobile.
- Voz: pt-BR, frases curtas, sem exclamação/travessão na UI, botões com verbo. Seções: **Agora, Explorar, Você** (+ "Visão", "Ao vivo"). Números 1.284, horário 21h40, data 12 · 12 · 2026. Dados fictícios marcados "dados de exemplo".
- Regras do REA (EST): fim = início + `durationHours`; mínimo 30 min no futuro; revelação DURING/AFTER/+N dias; capacidade {5,10,20,50,100,150,200,ilimitado}; fotos/pessoa {5,10,16,24,36,ilimitado}; ≤10 convidados grátis; código de 8 chars do alfabeto `23456789ABCDEFGHJKMNPQRSTUVWXYZ`; reação única por usuário por foto; álbum encerrado com fotos não reabre.
- Sem Supabase, sem credenciais, sem cobrança real, sem sincronização multiusuário simulada como real. Fluxos locais/simulados/dependentes de backend rotulados.
- Não tocar o Express nem outros projetos Vercel.

## Review Focus
1. Relógio: evento sem fotos/encerrado exatamente em `endAt`; revelação em `endAt + N dias` (teste de fronteira em T3).
2. Código de convite em minúsculas/espaços/ambíguos (0,O,1,I,L) deve ser normalizado ou rejeitado com "Código não confere." (T2, T9).
3. IndexedDB indisponível/cheio/modo privado: o app mostra aviso e não perde a foto em memória (T4, T11).
4. Foto > rolo restante / reação duplicada / entrar com evento lotado ou encerrado (T3, T10).
5. Troca de tema e evento com paleta que reprova contraste: validação de contraste ≥4,5:1 por paleta (T6).

---

### Task 1: Scaffold Next.js, tokens, fontes, temas
**Files:** Create `web/` (create-next-app), `web/src/styles/tokens.css`, `web/src/styles/mm.css` (de `componentes.css`), `web/src/app/globals.css`, `web/public/fonts/*`, `web/public/brand/*`, `web/public/icons/*`.
**Produces:** `<html data-theme>` controlado por `ThemeProvider` (`useTheme(): {theme:'dia'|'noite', setTheme}`), classes `mm-*` e utilitários Tailwind mapeados (`bg-fundo`, `text-tinta`, `rounded-control`, `h-campo`…).
- [ ] Scaffold com `--ts --tailwind --eslint --app --src-dir --use-npm`; TS `strict`.
- [ ] Copiar tokens/fonts (paths `../fonts/` → `/fonts/`), logos e ícones; mapear tokens no `@theme inline` do Tailwind v4 (preservando nomes).
- [ ] Script inline no `<head>` que aplica o tema salvo (ou `prefers-color-scheme`) antes da pintura.
- [ ] Verificar: `npm run build` passa; página `/design` mostra paleta nos dois temas.
- [ ] Commit.

### Task 2: Domínio — código, tempo, regras (TDD)
**Files:** `web/src/domain/{share-code,event,reveal,capacity,shots,pricing,contrast}.ts`, testes `*.test.ts`.
**Produces:** `generateShareCode(rng?): string`, `normalizeShareCode(input): string|null`, `endAt(e): number`, `eventStatus(e, now): 'ativo'|'encerrado'`, `isRevealed(e, now): boolean`, `revealAt(e): number`, `shotsLeft(e, used): number|null`, `canJoin(e, participants, now): {ok:true}|{ok:false, reason:'lotado'|'encerrado'}`, `priceRule(capacity, plusActive): {kind:'gratis'|'pago'|'incluido'}`, `contrastRatio(a,b): number`.
- [ ] Testes: alfabeto sem 0/O/1/I/L e 8 chars; normalização (`" nfv-arbqx "` → `NFVARBQX`; inválido → null); `endAt = start + h·3600000`; fronteira `now===endAt` encerrado; revelação AFTER = endAt, +N dias = endAt+N·86400000, DURING = start; `shotsLeft` ilimitado=null; ≤10 grátis; contraste #FFFFFF vs #1C1917 ≥ 4.5.
- [ ] Ver falhar, implementar, ver passar, commit.

### Task 3: Domínio — fotos, reações, moderação
**Files:** `web/src/domain/{photo,reaction,moderation}.ts` + testes.
**Produces:** `canPost(event, participant, usedShots, now): {ok}|{ok:false,reason:'rolo'|'encerrado'}`, `setReaction(reactions, photoId, authorId, kind): Reaction[]` (uma por autor/foto; mesma kind remove), `visiblePhotos(event, photos, viewerId, now)` (não reveladas só do próprio autor; ocultas/removidas nunca), `report(photo)`, `hide`, `remove`, `canEditEnd(event, photos, now)`.
- [ ] Testes: rolo esgotado bloqueia; reação trocada mantém uma; foto de outro oculta antes da revelação (modo AFTER) e visível depois; `canEditEnd` falso se encerrado com fotos; moderação oculta some do feed.
- [ ] Implementar, commit.

### Task 4: Repositórios e persistência local
**Files:** `web/src/repositories/{types,indexeddb/*,memory/*,index}.ts`, testes com `fake-indexeddb`.
**Produces:** interfaces `EventRepository {list,get,getByCode,save,remove}`, `ParticipantRepository`, `PhotoRepository {listByEvent,add(blob),getBlob,update,remove}`, `ReactionRepository`, `InvitationRepository`, `UserRepository {current,save,clear}`; `createLocalRepositories(): Repositories`; `StorageUnavailableError`.
- [ ] Testes de contrato rodados contra memória e IndexedDB (CRUD, getByCode, blobs, remoção em cascata de evento).
- [ ] `navigator.storage.persist()` best-effort; erro de cota → `StorageUnavailableError`.
- [ ] Commit.

### Task 5: Contratos de backend (stubs) para Supabase
**Files:** `web/src/repositories/contracts.ts`, `web/src/lib/services/{auth,billing,notifications,sync}.ts` (interfaces + implementações `Local*`/`Demo*`).
**Produces:** `AuthService`, `BillingService` (`LocalBillingStub`: nunca cobra; `purchase()` rejeita com `DemoOnlyError`), `NotificationScheduler`, `SyncService` (sem multiusuário).
- [ ] Testes: stub de billing não resolve compra; scheduler calcula horários (T−1d, T−1h, T−10min, fim, revelação).
- [ ] Commit.

### Task 6: Biblioteca de componentes MemoriesMT
**Files:** `web/src/components/memoriesmt/*.tsx` (Button, Field, Chip, OptionGroup, Stepper, Tabs, TabBar, EventHeader, Cover, LiveIndicator, PostCard, VisionTile, CountBadge, Progress, Notice, Signature, StatTile, TableCard, DataRow, AdminNav, Logo, Icon), `web/src/lib/event-theme.ts`, testes de componente.
**Produces:** componentes controlados que emitem as classes `mm-*` do DS; `eventThemeStyle(palette): CSSProperties`; paletas `salvia|terracota|oceano|ameixa` com validação de contraste.
- [ ] Testes (Testing Library): Button disabled usa `disabled`; Chip `aria-pressed`; Tabs `role=tablist/tab` e `aria-selected`; Field liga label/for e `aria-invalid`+`aria-describedby`; TabBar `aria-current="page"`; Icon exige `label`.
- [ ] Teste de contraste de cada paleta nos dois temas (pares do README do DS).
- [ ] Página `/design` com todos os componentes nos dois temas. Commit.

### Task 7: Shell, PWA e temas
**Files:** `web/src/app/{layout,manifest.ts}`, `web/public/sw.js`, ícones PNG 192/512/maskable, `web/src/components/memoriesmt/ThemeToggle.tsx`, `OfflineNotice`.
- [ ] Manifest (`display: standalone`, `theme_color` do tema), SW (cache do shell e fontes, fallback offline), registro só em produção.
- [ ] Estado sem sinal: "Sem sinal agora. Suas N fotos estão guardadas." Commit.

### Task 8: Home, entrada e identidade do convidado
**Files:** `web/src/app/{page,entrar/page,e/[code]/page}.tsx`, `web/src/features/invitations/*`.
- [ ] `/` (Entrar na festa / Criar evento), `/entrar` (Field código com `--codigo`), `/e/[code]` convite: EventHeader, nome ("Como te chamam na festa?"), consentimento, "Entrar na festa"; erros "Código não confere." / encerrado / lotado.
- [ ] Teste unitário do hook e E2E de entrada. Commit.

### Task 9: Experiência do convidado (Agora, Explorar, Você, Postar)
**Files:** `web/src/app/e/[code]/{agora,explorar,voce,postar}/page.tsx`, layout com TabBar, `web/src/features/photos/*`.
- [ ] `getUserMedia` com fallback `<input capture>`; captura em canvas; estados: permissão negada, publicando (Progress "Subindo 2 de 3"), publicado ("Sua visão entrou na história." em serif), sem sinal.
- [ ] Agora: feed com PostCard, Notice, LiveIndicator, reações (Chip); Explorar: filtros por momento (Chip filtro) e VisionTile; Você: minhas fotos, rolo restante, estados de revelação.
- [ ] Marcador "Neste navegador" (colaboração real só com backend). Commit.

### Task 10: Criação de evento (organizador)
**Files:** `web/src/app/criar/page.tsx`, `web/src/features/events/*`.
- [ ] Wizard em passos (Stepper de progresso do DS não é obrigatório; usar Progress): nome do evento, categoria, término (≥30 min), revelação, câmera/estilo, capa/paleta, convidados/fotos por pessoa, resumo com regra de preço ("Grátis" ≤10; acima "Pagamento indisponível nesta versão", sem cobrança), criado + convite (QR, link, Web Share).
- [ ] Testes de validação (30 min, capacidade) e E2E do fluxo. Commit.

### Task 11: Painel do organizador
**Files:** `web/src/app/painel/[id]/{page,moderacao,convidados,qr,config}/page.tsx`, `web/src/features/admin/*`.
- [ ] AdminNav + Tabs; Resumo (StatTile, dados reais locais), Convidados (DataRow), Moderação (fila "Pedidos de remoção · N", ocultar/apagar/destacar), QR (TableCard com QR por mesa, impressão A6), Configurações (OptionGroup: revelação, fotos por pessoa; Stepper de mesa; editar término com regra `canEditEnd`; **Encerrar agora**; excluir evento com confirmação).
- [ ] Download do álbum (ZIP no cliente). Commit.

### Task 12: Retrospectiva e revelação
- [ ] Estado de revelação no Agora/Você; tela de retrospectiva (capa em serif) após revelação; notificação local (Notification API) opcional. Testes de domínio já em T2/T3 + E2E com relógio simulado (`?agora=` apenas em dev/test). Commit.

### Task 13: Qualidade — Vitest, Playwright, acessibilidade, visual
**Files:** `web/playwright.config.ts`, `web/e2e/*.spec.ts`, `docs/qa/VISUAL-VALIDATION.md`.
- [ ] E2E: entrar por código, postar foto (fake camera), reagir, organizar evento, moderar, trocar tema, offline.
- [ ] Screenshots 375/390/768/1440 × dia/noite das telas principais; comparar com `/design` e com `index.html` do DS; `@axe-core/playwright` sem violações críticas.
- [ ] Lighthouse/performance (Playwright + `lighthouse` CLI se disponível). Corrigir regressões.

### Task 14: Documentação Supabase
**Files:** `docs/supabase/INTEGRATION-PLAN.md` (ERD, tabelas, RLS, Auth, Storage, convites, revelação, realtime, migração, conflitos).
- [ ] Escrever a partir de `08-DATA-MODEL.md` e dos repositórios. Commit.

### Task 15: Deploy
- [ ] `npm run lint && npm run typecheck && npm test && npm run build && npm run e2e`.
- [ ] Commit, `git push -u origin feat/memoriesmt`.
- [ ] Preview Vercel (Root Directory `web`), smoke tests na URL; registrar bloqueios.

### Task 16: Auditoria independente e relatório final
- [ ] Subagente independente audita 10 dimensões; relatório `docs/qa/FINAL-AUDIT.md` com matriz REA → DS → Implementação → Teste → Status.

## Self-review
Spec coverage: M0 (audit, plano), M1 (T1,T6), M2 (T2–T5), M3 (T8,T9,T12), M4 (T10,T11), M5 (T7), M6 (T13), M7 (T15), M8 (T14), auditoria (T16). Tipos: nomes de T2/T3 usados em T9–T11. Proporção: plano orienta; código é escrito na execução.
