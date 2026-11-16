# 00 · Auditoria do repositório (Smart Album · Minhas Fotos)

Data: 16/11/2026. Fonte: checkout local de `mzinhoww-svg/memo-brasil`. Nenhum segredo copiado.

## 1. Produção e commit de trabalho

| Item | Evidência | Grau de certeza |
|---|---|---|
| Domínio | `https://fotosdocasamento.online` (e `newmemocuiaba.vercel.app`), projeto Vercel `newmemocuiaba`, Root Directory `web`, branch de produção `main` | documentado em `docs/supabase/PUBLISH-AND-ROLLBACK.md` §7–§15 |
| Último deploy **documentado** | `dpl_GNdnV1zyXHL4i8GmoGW8Tv5C9Q8a`, SHA `cf8d4f8` (§15) | documentado |
| `main` agora | `758e7ee` (contém `cf8d4f8`, mais 9 commits de UX: link de presente `/c/<código>`, assistente, master responsivo) | verificado (`git rev-parse origin/main`) |
| Deploy **vivo** | não confirmado nesta sessão: a rede da sessão recebe 403 do proxy para o domínio e para a API da Vercel; a API de deployments do GitHub devolveu lista vazia | **não verificado** |
| Base desta entrega | `758e7ee` (= `origin/main`). Como `main` faz deploy automático em produção, é a melhor aproximação do que está no ar; os 9 commits após `cf8d4f8` só tocam UI/e2e e uma RPC aditiva (`peek_code`) | inferido |

Ação recomendada antes de homologar: conferir na Vercel (Deployments → Production) qual SHA está promovido e, se for diferente de `758e7ee`, refazer o merge desta branch sobre ele.

**Branch.** O plano pede `feat/revela-smart-album`; esta sessão só tem permissão de push em `claude/admiring-lamport-tkl7ru`, então o trabalho está nela (isolada da `main`, PR em rascunho). Renomear é trivial na hora do merge.

## 2. Arquitetura real

- **App de produção:** `web/` — Next.js 16.4.2 (App Router), React 19.3, TypeScript, Tailwind 4, `@supabase/ssr`. Ver `web/AGENTS.md`: esta versão do Next tem mudanças incompatíveis; nada foi assumido de memória.
- **Servidor Express na raiz (`server.js`, `src/`, `Dockerfile`, `Caddyfile`):** app **legado** "Lume" (SQLite). Não é o deploy atual; não foi tocado.
- **Sem rotas de API Next para regras de negócio.** Único `route.ts`: `src/app/auth/callback`. O navegador fala direto com o Supabase: **RPCs `security definer`** (search_path vazio) + **RLS**. Por isso o "contrato de API" do plano (§8) foi implementado como RPCs (ver `03-architecture.md`), seguindo o padrão de comentários/impressões.
- **Dois backends no cliente** (`NEXT_PUBLIC_MM_BACKEND`): `supabase` (produção) e `local` (IndexedDB/localStorage, demonstração e E2E). Toda feature nova precisa de adaptador para os dois (padrão `features/comments/service.ts`).
- **Área do convidado:** `web/src/app/e/[code]/(app)/` — `agora` (feed), `minhas` (Minhas **poses**, rolo pendente), `voce`, `postar`, `rolo`, `retrospectiva`, etc. Layout `(app)/layout.tsx` faz a guarda de acesso, tema, fila de upload e o relógio de revelação.
- **Barra de abas do convidado:** `web/src/revela/GuestTabs.tsx` (Feed / Minhas / Você, + Painel para o anfitrião). Não há segunda barra; a câmera é CTA nas telas (Laboratório "Abrir câmera"), não uma aba.
- **Autenticação:** Supabase Auth; Google OAuth para organizador; convidado pode ser **sessão anônima** (`is_anonymous`). `user_metadata` só é usado para exibição (nome). Nenhuma coluna de avatar em `profiles`.
- **Fotos:** `photos(event_id, author_id, status visivel|oculta|removida, upload_status, storage_path = event_id/id, deleted_at)`; bucket privado `event-photos`, políticas de Storage via `can_read_object → can_see_photo`.
- **Ponto único de decisão de visibilidade:** `public.can_see_photo(id)` (versão vigente em `20261022001300_legal_v1_retention.sql`): foto pronta, não removida, evento ativo e dentro da retenção; anfitrião vê tudo; membro (não bloqueado) só `visivel`, **revelado** e (`everyone_sees_all` ou autor). Remoção é terminal (`photos_guard` grava `deleted_at` e enfileira purga).
- **Revelação:** `is_revealed(event)` = `not reveal_enabled or revealed_at is not null or now() >= reveal_at` (servidor). O cliente espelha com `computeRevealStatus` (`web/src/domain/reveal.ts`), mas quem autoriza é o banco.
- **Consentimentos:** `legal_documents` + `user_consents` + `record_consent()` (termos/privacidade). Não servem para biometria.
- **Flags:** `feature_flags(key, enabled, rollout jsonb)`; escrita só por `admin_set_feature_flag` (master, motivo ≥ 10 caracteres, auditado por trigger). Padrão "sem linha = desligado" (`printed_album`, `validapay_card`). `platform_settings` para configurações (`admin_set_setting`).
- **Filas/jobs:** pg_cron (`mm-*`), `storage_purge_queue(path, bucket)` esvaziada pela Edge Function `purge-storage` (service_role). Não há fila de mensagens externa; não foi adotada nenhuma.
- **Edge Functions:** `supabase/functions/*` (Deno); lógica pura em `_shared/*.ts` testada por `web/vitest.functions.config.ts`.
- **Design tokens:** `web/src/styles/tokens.css` é o único arquivo com hex (`no-hex.test.ts`); classes `rv-*`; tema Noite.
- **Observabilidade:** não há Sentry nem pipeline analítico no cliente; logs das Edge Functions via `console.log`.
- **Testes/CI:** `.github/workflows/ci.yml` — typecheck, lint, vitest, vitest de funções, build, Playwright (ValidaPay local, UX), `payment-database` (Supabase local + `scripts/test-db.mjs` → `supabase test db` com pgTAP).
- **Migrations:** `supabase/migrations/AAAAMMDDHHMMSS_nome.sql`, aditivas, com rollback manual em `supabase/ops/rollback_*.sql` e teste pgTAP numerado em `supabase/tests/database/`.
- **Supabase:** o plano cita o projeto `asyaegeodyttttaubvxh`; existe também projeto regional de ensaio (`docs/ops/MIGRACAO-SAO-PAULO.md`). Esta sessão **não** acessou nenhum projeto remoto; tudo rodou num Supabase local descartável (Docker).

## 3. Achados durante a auditoria

1. `supabase/tests/database/02_v2_studio_admin.test.sql` esperava 6 jobs `mm-*`, mas a migration `20261024000100_console_redesign.sql` criou o 7º (`mm-purge-anon-orphans`). A suíte pgTAP falhava na `main` antes desta entrega (2/2085). Corrigida só a expectativa do teste (commit separado).
2. Já existe uma aba "Minhas" = **Minhas poses** (rolo pendente). A nova "Minhas Fotos" fica ao lado; os dois rótulos são parecidos. Não renomeei a aba homologada; proposta de UX registrada em `01-product-prd.md` §6.
3. Não há canal para baixar a foto do Google no servidor; o fluxo baixa no navegador só após escolha da pessoa, com allowlist de host (ver `03-architecture.md` §5).
