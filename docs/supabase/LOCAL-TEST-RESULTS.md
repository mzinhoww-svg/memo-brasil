# Resultados dos testes (Supabase LOCAL, 2026-10-21)

Ambiente: Supabase CLI 2.117.0 + Docker, PostgreSQL 17, stack própria nas portas 55421–55424. Dados fictícios; nada disto toca o projeto remoto.

| Camada | Ferramenta | Resultado | Onde |
|---|---|---|---|
| Banco, RLS, revelação, rolo, convites, Storage (funções), IDOR, escalada, superfície direta | pgTAP (`supabase test db`) | **75/75** | `supabase/tests/database/01_security_and_reveal.test.sql` |
| API real: Auth (anônimo e conta), convite, lotação, upload em duas fases, MIME/tamanho/sobrescrita, URL assinada antes/depois da revelação, moderação, Realtime com RLS, LGPD | `node --test` + supabase-js | **12/12** | `web/integration/supabase.integration.test.mjs` |
| Adaptador Supabase atrás do contrato de repositório + serviços reais | Vitest (integração) | **9/9** | `web/integration/adapter.itest.ts` |
| Navegador real em modo Supabase (contexto independente): convidado entra, posta, espera, revelação do servidor, foto visível; portão do organizador | Playwright | **2/2** | `web/e2e/supabase.spec.ts` |
| Unitários (domínio, serviços, adaptadores locais, contratos) | Vitest | **207/207** | `web/src/**` |
| E2E no modo local (regressão) | Playwright | **48 passaram**, 7 ignorados (5 remotos + 2 de Supabase, por design) | `web/e2e/**` |
| Segurança estática | `supabase db advisors --local` (security + performance), `db lint` | **sem alertas** | — |
| Tipos e lint | `tsc --noEmit`, `eslint` | 0 erros, 0 avisos | `web/` |
| Build de produção | `next build` (modo local e modo Supabase) | ok | `web/` |

## Achados corrigidos durante os testes (todos reais)
1. `audit()`/`enqueue_purge()` eram `SECURITY DEFINER` e a guarda por `current_user` nunca disparava (em função definer ele é o dono). Agora são `SECURITY INVOKER` e o INSERT passa pela RLS, que só aceita escrita dentro de trigger.
2. Funções criadas depois de `ALTER DEFAULT PRIVILEGES` continuavam com `EXECUTE` para `PUBLIC` (o `PUBLIC` padrão do Postgres não sai por privilégio padrão): revogado explicitamente para `public` e `anon`.
3. A CSP do app (`connect-src 'self'`) bloqueava o Supabase: agora libera somente o host configurado (HTTP e WebSocket) em modo Supabase.
4. Visitante sem sessão não via nem a prévia do convite (a RPC exige `auth.uid()` para limitar tentativas): sessão anônima criada ao abrir o convite.

## Não coberto (ver SECURITY-VALIDATION.md, "Lacunas")
Google OAuth real, validação de conteúdo da imagem (magic bytes), Edge Function de limpeza do Storage, Realtime na interface, `pg_cron` no projeto remoto, acessibilidade/performance em modo Supabase.
