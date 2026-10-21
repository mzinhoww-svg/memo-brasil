# Homologação remota — projeto `asyaegeodyttttaubvxh` (2026-10-21)

Commit homologado: `4ab85f8`. Classificação: **INTEGRATION READY — produção NÃO promovida**.

## Verificações diretas no Supabase (comportamento observado, sem credenciais nos logs)
| Item | Resultado |
|---|---|
| Anonymous sign-ins | **Ativo** (`/auth/v1/settings` → `anonymous_users: true`; `signup` anônimo devolve usuário) |
| Provedor Google | **DESATIVADO** (`external.google: false`; `/auth/v1/authorize?provider=google` → 400 `provider is not enabled`) |
| Manual linking / Redirect URLs | Não legíveis sem token de gestão; sem Google ativo não há como validar o callback |
| Migrations | 6 aplicadas; 11 tabelas, 0 sem RLS; bucket `event-photos` privado; 3 jobs `pg_cron` |

## Testes contra o remoto (usuários e eventos isolados, limpos no `after`)
- Integração (`integration/supabase.integration.test.mjs`): **12/12** — papéis, lotação, convites (token uma vez, revogação), upload em duas fases, Storage privado antes da revelação, limite do rolo, revelação no servidor idempotente, moderação, Realtime respeitando RLS, LGPD.
- Adaptador (`adapter.itest.ts`): **9/9**.
- Unitários: **209/209**; `tsc --noEmit` limpo.
- Correção: o teste de Realtime falhava por pressa (800 ms) no remoto; a latência medida é ~600 ms depois de a assinatura estabilizar (agora 3 s, `RT_SETTLE_MS`).

## Correção de produto
A home, o convite e a entrada exibiam o texto fixo "Versão local" mesmo com Supabase. Agora `BackendNotice` só mostra o aviso em modo local; `NEXT_PUBLIC_MM_BACKEND=supabase` sem URL/chave exibe erro visível (`backendStatus() === "misconfigured"`), sem fallback silencioso.

## Vercel
- Preview: `NEXT_PUBLIC_MM_BACKEND=supabase`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (plain).
- Production: existem `NEXT_PUBLIC_SUPABASE_URL`, `…_PUBLISHABLE_KEY`, `…_ANON_KEY` (criptografadas, não decifradas) e `SUPABASE_SERVICEROLE_KEY` (sensível, preexistente, nunca lida). **Falta `NEXT_PUBLIC_MM_BACKEND=supabase`** e **não é possível confirmar** que a URL de produção aponta para o ref `asyaegeodyttttaubvxh`.

## Gates de produção
| Gate | Estado |
|---|---|
| Google OAuth funcional | **FALHA** (provedor desativado) |
| Migrations / RLS / Storage privado | OK |
| Revelação no servidor | OK (remoto) |
| Testes críticos de banco | OK |
| E2E no preview + login Google do organizador | **PENDENTE** (depende do Google) |
| Variáveis de Production corretas | **PENDENTE** |

## Ação mínima para destravar
1. Supabase → Authentication → Providers → **Google**: ativar e informar Client ID/Secret do cliente OAuth criado no Google Cloud (tipo Web), com redirect `https://asyaegeodyttttaubvxh.supabase.co/auth/v1/callback`.
2. Supabase → Authentication → URL Configuration: Site URL de produção e Redirect URLs `<domínio>/auth/callback` (preview e produção).
3. Supabase → Authentication → Sign In / Providers: ativar **Allow manual linking**.
4. Vercel (Production): definir `NEXT_PUBLIC_MM_BACKEND=supabase` e confirmar que `NEXT_PUBLIC_SUPABASE_URL` é `https://asyaegeodyttttaubvxh.supabase.co`.
