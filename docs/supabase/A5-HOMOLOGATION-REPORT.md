# A.5 — Homologação E2E (2026-10-21): relatório GO/NO-GO

Escopo: preview `dpl_2v3GF6rj7GHeE8vBGFCRyxyDdKwf` (commit `ca7a274`) e Supabase remoto `asyaegeodyttttaubvxh`. Nenhum dado real foi alterado, nenhuma operação destrutiva, nenhum segredo lido ou registrado, nada promovido a produção.

## Decisão: **NO-GO para release/produção**
Motivos: INF-004 (service_role na Vercel Production) segue aberto, e os testes que exigem sessão real (Google, Master autenticado, organizador/convidado com RLS, upload autenticado, iOS/Android) **não foram executados** nesta rodada. A extensão do Chrome estava desconectada e não se digitam credenciais.

## Executado, com evidência
| Item | Resultado | Evidência |
|---|---|---|
| pgTAP (após `db reset --local`) | 430/430 | `supabase test db --local`: Files=3, Tests=430, PASS |
| Vitest unitário/componentes | 262/262 | `vitest run` |
| Integração local (adapter + purga + Edge Functions) | 14/14 | `npm run test:integration`, exit 0 |
| tsc / eslint | 0 erros (11 avisos) | `tsc --noEmit`, `eslint .` |
| **SCV-010** Auth sem e-mail/SMS | **resolvido** | `/auth/v1/settings`: externos ativos = `anonymous_users`, `google`. `POST /auth/v1/signup` com e-mail → 400 `email_provider_disabled`; OTP por telefone → 400 `phone_provider_disabled` |
| Isolamento anônimo no remoto | OK | 13 tabelas → 401; RPCs privilegiadas (`admin_health`, `audit_integrity`, `admin_audit_integrity`, `expire_pending_assets`, `purge_deleted_events`) → 401; `finalize-asset` sem JWT → 401; `purge-storage` sem token → 403, GET → 405; listagem anônima do bucket `event-photos` → `[]` |
| Purga do Storage e jobs `mm-*` | provados em A.3.5 | ver `OPERATOR-COMMANDS.md` |

Falha reproduzida e explicada: após `supabase db reset --local`, o `functions serve` já em execução passou a responder 503 e 2 testes de integração falharam (logo/capa e CORS). Reiniciar o servidor de funções (processo do próprio worktree) corrigiu: 14/14. Não é defeito do produto; vale lembrar no roteiro de testes locais.

## Não resolvido
- **INF-004 (P1):** `SUPABASE_SERVICEROLE_KEY` ainda está em Production (tipo sensitive, criada 2026-10-21, sem alteração). Nenhum código a lê. Remover é decisão do dono (ver instruções).
- SCV-009, INF-005, QAV-004: sem mudança.

## Pendente: precisa de sessão real ou aparelho (NÃO executado)
1. Login Google real e papel Master no backend: claim `app_metadata.role='master'` + linha ativa em `platform_roles`, atualização e expiração do JWT.
2. Matriz Master × organizador × convidado × anônimo com sessões reais (RLS, RPCs administrativas, auditoria).
3. Event Studio no preview (criação e personalização), convite, código, QR, câmera, upload autenticado, quotas, galeria e revelação programada, no remoto.
4. iOS Safari e Android Chrome em aparelhos físicos (câmera, PWA, upload).
5. `web/e2e/remote-flow.spec.ts` (E2E remoto completo) e E2E local pós-mudança de breadcrumbs/GoogleButton.

## Instruções para o operador
1. **INF-004:** Vercel → projeto `newmemocuiaba` → Settings → Environment Variables → apagar `SUPABASE_SERVICEROLE_KEY` (Production), depois de confirmar que o app legado Lume não depende dela. Considere rotacionar a service_role no Supabase (Settings → API) se ela chegou a ser exposta fora do cofre.
2. **Teste manual Master (5 min):** no preview, entrar com Google em `/entrar`, abrir `/master`, conferir dashboard e uma ação auditada com justificativa; sair, entrar de novo e conferir que a sessão persiste; em janela anônima, `/master` deve mostrar só o portão de operador.
3. **Aparelhos:** abrir o preview no iPhone (Safari) e no Android (Chrome); criar evento de demonstração, entrar como convidado por QR, tirar foto, enviar e ver na galeria.
4. Retornar com os resultados para eu registrar no backlog e liberar a A.5 completa.
