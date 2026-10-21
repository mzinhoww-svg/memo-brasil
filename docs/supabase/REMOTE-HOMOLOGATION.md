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

## Rodada 2 (2026-10-21, após ajustes do dono)
- `/auth/v1/settings`: `google: true`, `anonymous_users: true`. `authorize?provider=google` → 302 para `accounts.google.com` com `redirect_uri` do Supabase correto. **Provedor habilitado.**
- Login Google real no preview `dpl_Hjrb…` (commit `4ab85f8`): botão "Entrar com Google" → seletor de contas → conta escolhida → Supabase devolveu o navegador para `https://newmemocuiaba.vercel.app/?code=…` (Site URL), **não** para `<preview>/auth/callback?next=/criar`. Conclusão: a URL do preview **não está na allow-list de Redirect URLs**; o `code` caiu no app legado Lume e não foi trocado por sessão. **Gate "callback/auth" NÃO validado.**
- Achado: existe o deployment de **produção** `dpl_CX5GuvrnNSgjySpjBPpEGpX6hbKD` (commit antigo `3a8bf89`, criado fora desta sessão logo após as variáveis de Production) e `newmemocuiaba.vercel.app` serve o app legado Lume; o alias do branch também passou a apontar para ele.
- Production na Vercel agora tem `NEXT_PUBLIC_MM_BACKEND` (valor criptografado, não decifrado: o classificador negou a leitura), URL e chaves também criptografadas: destino do Supabase ainda não confirmável antes de um deploy.
- Resultado: **produção NÃO promovida**.

### Ação mínima
Em Supabase → Authentication → URL Configuration → Redirect URLs, adicionar `https://newmemocuiaba-*-mzinhoww-gmailcoms-projects.vercel.app/**` (previews) e `https://newmemocuiaba.vercel.app/auth/callback` (produção). Depois eu repito o login Google no preview e, se passar, promovo o MemoriesMT.

## Rodada 3 (2026-10-21, Redirect URLs atualizadas)
- Login Google real no preview `dpl_Hjrb…` (commit `4ab85f8`): o `redirect_to` enviado pelo código foi `<preview>/auth/callback?next=/criar` (mesmo domínio do preview); o Supabase devolveu o navegador para esse callback; a sessão foi criada (cookie `sb-<ref>-auth-token` em dois pedaços; cookies antigos de `code-verifier` permanecem, cosmético).
- Criação de evento pelo wizard no preview: evento `82f9a213-…` (código `FKCY46BU`). Verificado no banco: `provider = google`, `is_anonymous = false`, `reveal_status = pendente`, duração de revelação 6 h, 0 participantes.
- **Gate G6 (Google OAuth + callback + sessão + criação) PASSA.**
- **Não executado:** fluxo de convidado com RLS/upload/revelação pelo navegador no preview. O script que o faria usava a `service_role` para alterar o relógio de um evento real; foi recusado pelo dono e **não rodou**. Esse gate (G7) segue pendente e deve ser feito como teste isolado (evento e usuários próprios), como a suíte de integração.
- Resíduo de teste no remoto: o evento `82f9a213-…` ("Teste homologacao RT1") e o usuário Google do dono como organizador; sem exclusão automática (a regra é não executar exclusões no remoto sem pedido).
- Produção: continua servindo o app legado Lume (`dpl_CX5Guvrn…`, commit antigo, criado fora desta sessão). Não promovido.

## Rodada 4 (2026-10-21) — homologação ponta a ponta no preview remoto
Preview `dpl_HXdWGqLNacSGMEoQCvpQC9L2zsvk` (commit `ed63bc4`, front V2 compatível com servidor V1) contra o Supabase remoto **ainda no schema V1** (as migrations V2 NÃO foram aplicadas: ver abaixo). Teste `web/e2e/remote-flow.spec.ts`, usuários e eventos de teste isolados, removidos no fim.
| Etapa | Resultado |
|---|---|
| Organizador (usuário de teste, sessão injetada) cria o evento **pela interface** do wizard | OK: evento com `host_id` do organizador, `reveal_status = pendente` |
| Convidado (contexto independente, anônimo) entra pelo convite, vê a espera, posta uma foto | OK: `photos` = 1, `upload_status = pronta` |
| Storage privado | OK: URL pública do objeto ≠ 200; foto bloqueada nem para o autor antes da revelação |
| Permissões | OK: convidado não abre o painel nem `/master` (pede login de operador); organizador comum recebe "Sem permissão." no `/master` |
| Isolamento entre organizadores | OK: outro organizador não lê o evento, as fotos nem assina a URL (antes e depois da revelação) |
| Revelação com o relógio real do servidor | OK: o evento de teste teve o horário antecipado e o **job `mm-reveal-due` do pg_cron** marcou `revelada` sozinho (sem chamar a RPC); a galeria do convidado abriu com a foto |
| Perfis | Desktop Chrome: passou. Android Chrome (Pixel 7 **emulado**): passou. **iOS Safari: não testado** (sem WebKit instalado e sem aparelho real) |
Limites desta evidência: login Google do organizador foi homologado na rodada 3 (real); aqui o organizador usa sessão de teste injetada para poder repetir o fluxo sem credenciais pessoais.

### Migrations V2 no remoto: BLOQUEADAS (ação sua)
- Estado: o remoto tem as 6 migrations V1. Pendentes (dry-run): `20261022000100` … `20261022000800` (8 arquivos, aditivos; varredura sem DROP/TRUNCATE de dados).
- Validação local concluída: pgTAP 385/385, integração 12/12, adaptador 13/13, E2E Supabase 5/5, provisionamento 7/7.
- Recuperação: backup de esquema e dados do remoto feito antes (fora do repositório, em `/private/tmp/claude-503/backup/`); as migrations são aditivas e o front V2 tolera servidor V1.
- O classificador de permissões **bloqueou** `supabase db push --linked` e o script `scripts/supabase-apply-remote.sh` ("Blind Apply"); não foi contornado. Procedimento em `docs/supabase/V2-REMOTE-APPLY-RUNBOOK.md`.
