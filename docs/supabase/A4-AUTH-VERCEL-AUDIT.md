# A.4 — Auditoria de Auth e Vercel (2026-10-21)

Somente leitura no Supabase (`supabase config diff`, `db query --linked`, endpoints públicos) e na Vercel (API). Nenhuma configuração foi alterada. Nenhum valor secreto foi lido ou registrado.

## Google OAuth, callbacks, redirect URLs (remoto `asyaegeodyttttaubvxh`)
- Google habilitado; `client_id` presente (público). Segredo do cliente não é comparável pela API (mascarado).
- `site_url` = `https://newmemocuiaba.vercel.app`.
- Redirect URLs: `https://newmemocuiaba.vercel.app/auth/callback` (exato) e `https://newmemocuiaba-*-mzinhoww-gmailcoms-projects.vercel.app/**` (previews da conta). Sem `localhost` no remoto (correto). O wildcard cobre qualquer deployment da conta, o que é aceitável para previews mas precisa sair/estreitar na promoção.
- Callback do app (`web/src/app/auth/callback/route.ts`): troca o código PKCE e só redireciona para caminho do próprio site (prefixo `origin` + `next` que começa com `/` e não com `//`): sem open redirect.
- **Achados:** (1) provedor **Email habilitado com cadastro aberto** (`disable_signup=false`; exige confirmação): qualquer pessoa cria conta não anônima e a RLS permite criar evento → SCV-010 (P1, ação do dono). (2) `anonymous_users` ligado (necessário para convidados). (3) Twilio/SMS aparece habilitado no remoto (`auth.sms.twilio.enabled`) e MFA TOTP ligado; `phone` não aparece como provedor externo ativo, mas conferir no painel e desligar SMS se não usado.
- Usuários no remoto: 25 anônimos, 4 com identidade e-mail (testes), 1 Google. Nenhum com claim `master`; `platform_roles` vazia.

## Variáveis de ambiente (nomes e alvos; valores não lidos)
| Ambiente | Variáveis |
|---|---|
| Preview | `NEXT_PUBLIC_MM_BACKEND`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (todas públicas por natureza) |
| Production | `NEXT_PUBLIC_MM_BACKEND`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (legada, só fallback), **`SUPABASE_SERVICEROLE_KEY` (sensível)** |
- **Achado P1:** `SUPABASE_SERVICEROLE_KEY` em Production. Nenhum código de `web/` nem do repositório a lê; contraria a regra "service_role nunca na Vercel" → INF-004 (decisão do dono: remover, depois de confirmar que o app legado Lume não depende dela).
- Production não tem o conteúdo verificável (valores criptografados); confirmar `NEXT_PUBLIC_MM_BACKEND=supabase` no painel.

## Qual deployment tem o código mais recente
- Commit mais recente enviado: `ca7a274`. **Preview correto: `dpl_2v3GF6rj7GHeE8vBGFCRyxyDdKwf`** (`newmemocuiaba-p3dzw49y4-mzinhoww-gmailcoms-projects.vercel.app`, protegido por SSO), com breadcrumbs e botão Google novo. Conferido: `/master` sem sessão mostra o portão de operador; `/entrar` renderiza a trilha de navegação.
- `dpl_AQwY…` e `dpl_BuD5…` (criados sem `rootDirectory`) são **vazios** (build da raiz do repo em 81 ms, `NOT_FOUND`) apesar de `READY` → INF-005. O push não dispara deploy neste projeto; o preview sai por API com `projectSettings {rootDirectory:"web", framework:"nextjs"}`.
- Produção `newmemocuiaba.vercel.app`: segue servindo o app legado (deploy `dpl_CX5G…`, commit `3a8bf89`). Não promovida.
- Configuração do projeto Vercel não mudou (`updatedAt` idêntico antes e depois).

## Provisionamento do primeiro master
- `supabase/ops/provision_master.sql` (psql) e nova variante `supabase/ops/provision_master_sqleditor.sql` (SQL Editor; mesma lógica, diff idêntico no bloco `do`; só edita o e-mail e o motivo).
- Pré-checagem remota da única conta Google (sem exibir e-mail): 1 identidade, Google com e-mail igual e verificado, e-mail confirmado, sem senha, não SSO, não banida → **passa em todas as travas**.
- Não executado (altera `auth.users` e `platform_roles`): é ação do operador na janela de mudança. Depois: sair e entrar de novo para receber a claim.

## Testes de autenticação/autorização executados (remoto, como `anon`, sem sessão)
- 13 tabelas (`events`, `photos`, `participants`, `profiles`, `audit_logs`, `platform_roles`, `event_themes`, `event_assets`, `platform_settings`, `feature_flags`, `storage_purge_queue`, `rate_limits`, `invitations`): `401 permission denied`.
- RPCs `admin_health`, `admin_audit_integrity`, `audit_integrity`, `audit_integrity_check`, `expire_pending_assets`, `purge_deleted_events`, `get_enabled_flags`: `permission denied`. As com argumentos (`mark_asset_validated`, `begin_asset_validation`, `finalize_asset`, `event_preview`, `admin_dashboard`) respondem `404` por assinatura sem argumentos; o revogamento é coberto pelo pgTAP.
- Edge Functions: `finalize-asset` sem JWT `401`, com chave pública `401`; `purge-storage` sem credencial e com chave pública `403`, `GET` `405`.
- Storage: buckets privados (`Bucket not found` no endpoint público), listagem anônima vazia.
- Não executados (exigem sessão real/segredos): login Google real, `/master` autenticado, fluxo de organizador/convidado com RLS, upload autenticado. Ficam para A.5 com contas de teste.
