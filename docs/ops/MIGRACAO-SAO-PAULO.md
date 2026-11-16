# Migração do Supabase de produção para São Paulo (sa-east-1)

Origem: `asyaegeodyttttaubvxh` ("newmemocuiaba", us-west-2, org `zpnbwkmukywzlkxdfeja`, plano free, Postgres 17).
Destino: projeto novo em `sa-east-1` na mesma organização.
Ensaio completo feito em 2026-11-12 no projeto `mjwdokxwhfuldpoaavmu` ("newmemocuiaba-sp-ensaio"), **sem nenhuma escrita na origem**.
Scripts: `scripts/migrate-sp/` (Python, só biblioteca padrão; tudo por HTTPS: Management API + `<ref>.supabase.co`).

> Regra dos scripts: a origem é somente leitura. `sb.py` bloqueia na origem qualquer método que não seja GET e qualquer SQL que não seja uma leitura única; além disso, as consultas na origem vão com `read_only: true`, e a API passa a usar o papel `supabase_read_only_user`. Tudo que escreve no projeto antigo (congelar, pausar cron, desligar cadastro anônimo) está descrito abaixo para **você** executar no painel/SQL Editor.

---

## 0. Resumo do ensaio

| Etapa | Script | Tempo medido | Resultado |
|---|---|---|---|
| 1. Criar projeto sa-east-1 | `create_project.py` | API: ~20 s até `ACTIVE_HEALTHY` | ok. O laço de saúde levou 16 min porque o proxy desta sessão bloqueava o host novo (ver §2.4); reserve 2–5 min |
| 2. 54 migrations + histórico | `apply_schema.py` | 136 s (≈2,3 s cada) | ok, sem erro; `schema_migrations` com 54 linhas |
| 2b. Ref antigo → novo (Vault, cron, tokens internos) | `rewrite_refs.py` | 45 s | ok; 2 jobs tinham a URL antiga embutida; 0 restantes |
| Paridade de esquema | `schema_diff.py` | ~1 min | colunas, funções, políticas RLS, triggers, grants (tabela/coluna/função), views, buckets e extensões iguais |
| 3. Dados (auth + public) | `copy_data.py` | 348 s (cópia 72 s, verificação 110 s) | 58 tabelas, contagem e md5 iguais; `audit_integrity` = ok |
| 4. Storage | `copy_storage.py` | 30 s | 2 buckets, 32/32 objetos (4,8 MB), md5 do conteúdo igual |
| 5a. Edge Functions | `deploy_functions.py` | 22 s | 13 funções, `verify_jwt` igual ao de produção |
| 5b. Config de Auth + secrets | `copy_config.py --aplicar` | 3 s | 8 campos copiados; segredo do Google e 13 secrets são manuais |
| 6. Sessões copiadas | `test_session_copy.py` | ~10 s | refresh token copiado funciona; access token antigo é recusado |
| 7a. Ativar cron | `rewrite_refs.py --ativar-cron` | 38 s | 9 jobs ativos como na origem (`mm-purge-anon-orphans` segue inativo) |
| 7b. Funções + cadeia cron→Vault | `test_functions.py` | ~35 s | `purge-storage` 200; `payments-reconcile` passa no token (503 = sem credencial MP, esperado) |
| 7c. pgTAP | `run_pgtap.py` | 30 s | 14 arquivos sem falha; 10 pulados (usam `\gset`/`\ir` do psql); 8 com falhas causadas pelos dados reais (§8) |
| 7d. App apontando para o destino | `smoke_app.py` | build local 5–10 s + smoke ~10 s | `/`, `/e/<código real>` (prévia via `event_preview`) e `/entrar` com 200 |
| 7e. Latência | `latency.py` | 1 min | daqui (EUA, atrás de proxy) o destino ficou 30–140 ms mais lento; do Brasil se inverte (§9) |
| Congelar/descongelar escrita | `test_freeze.py` + `congelar.sql`/`descongelar.sql` | 15 s | escrita pela API bloqueada (403/42501), Auth segue; ACLs restauradas idênticas |

### O que funcionou / o que falhou / ajuste

| Item | Resultado no ensaio | Ajuste feito (já nos scripts) |
|---|---|---|
| Host `<novo>.supabase.co` | **Falhou**: proxy da sessão respondeu 403 | Liberado o host no ambiente "memo-brasil" (só esse host). No dia, liberar o host do projeto definitivo também |
| Migrations pelo `database/query` | Funcionou (arquivo inteiro por chamada) | Extensões `pg_cron`/`pg_net` habilitadas antes; Vault já vem habilitado |
| Escrita em `auth.*` pelo `database/query` | Funcionou (`postgres` tem INSERT/TRUNCATE em `auth.*`) | Não foi preciso usar a Admin API: ids, senhas, identidades Google e anônimos copiados como estão |
| `session_replication_role = replica` | Permitido | Usado em toda transação de carga |
| Triggers da trilha de auditoria | **Falhou** na 1ª carga: `audit_logs`/`platform_roles` têm triggers `ENABLE ALWAYS` (valem mesmo em replica) e event triggers que impedem desligá-los | `copy_data.py` suspende e restaura na MESMA transação (event triggers + triggers), só nas cargas dessas tabelas; `audit_integrity()` = ok no fim |
| Sequences | **Falhou**: `auth.refresh_tokens_id_seq` ficou no início (o GoTrue quebraria ao emitir refresh token: `duplicate key refresh_tokens_pkey`) | `copy_data.py` ajusta sequences de `public` **e** `auth` com o maior entre `last_value` da origem e `max()` da coluna |
| Vault | Origem não deixa decifrar em modo leitura (`permission denied for function _crypto_aead_det_decrypt`) | Não precisa: os 4 segredos são internos e `rewrite_refs.py` os regera (e grava os mesmos tokens nos secrets das funções) |
| `mm_purge_service_role` | **Falhou** (403): o roteiro antigo dizia "JWT legado", mas a plataforma injeta hoje `sb_secret_…` em `SUPABASE_SERVICE_ROLE_KEY` (origem e destino; conferido por digest) | `rewrite_refs.py` grava no Vault a chave cujo digest bate com o da função → 200 |
| Cron da origem escreve sozinho | `mm-payments-reconcile` atualiza `payment_orders.last_checked_at` a cada 5 min | Pausar os jobs da origem **antes** da cópia (§4, passo 3) |
| Congelar com `default_transaction_read_only` no `authenticator` | **Falhou**: o PostgREST abre a transação de escrita como READ WRITE | Descartado |
| Congelar com `revoke usage on schema public` | **Falhou**: `anon`/`authenticated` herdam USAGE via `PUBLIC` | Descartado |
| Congelar revogando privilégios | Funcionou, mas a 1ª versão perdeu o `UPDATE (display_name)` por coluna de `profiles` | `congelar.sql` guarda também ACLs por coluna; restauração conferida (ACLs idênticas) |
| Limpeza de usuários de teste em replica | Deixou sessões órfãs (o CASCADE não dispara em replica) | `sb.purge_test_users()` apaga os dependentes explicitamente |
| Fator MFA (TOTP) do Master | Segredo em base32 puro, sem cifra por projeto | Copiado; os mesmos códigos do autenticador valem no projeto novo |
| pgTAP pela API | Arquivos com `\gset`/`\ir` não rodam pela API; 8 arquivos assumem tabelas vazias | Suíte completa continua sendo `supabase test db` em banco limpo (CI) |

---

## 1. Decisões e acessos que dependem de você

1. **Data/hora da janela**: sem evento acontecendo (nenhum evento com `starts_at`/revelação nas próximas horas) e **sem Pix pendente**. Conferir na véspera e na hora:
   ```sql
   -- SQL Editor do projeto ANTIGO (só leitura)
   select id, status, provider, created_at from public.payment_orders where status in ('criado', 'pendente', 'em_disputa') or needs_refund order by created_at desc;
   select id, title, start_at, reveal_at from public.events where deleted_at is null and (start_at between now() - interval '12 hours' and now() + interval '24 hours' or reveal_at between now() and now() + interval '24 hours');
   ```
   (em 2026-11-12: 13 pedidos `expirado` e 2 `pago`, nenhum aberto; 1 pedido `expirado` de sandbox do Mercado Pago, de 2026-10-24, com `needs_refund` — não bloqueia, só registrar.)
2. **Quem mexe onde** (anote os nomes):
   - Google Cloud Console (OAuth Client `252656977141-8bi8…apps.googleusercontent.com`): acrescentar o redirect `https://<novo>.supabase.co/auth/v1/callback`.
   - Painel da ValidaPay: trocar a URL do webhook para `https://<novo>.supabase.co/functions/v1/payments-validapay-webhook` (e, se o painel gerar segredo novo, atualizar `VALIDAPAY_PRODUCTION_WEBHOOK_SECRET`).
   - Painel do Mercado Pago (se ainda em uso): webhook `https://<novo>.supabase.co/functions/v1/payments-webhook`.
   - Vercel (projeto `newmemocuiaba`): variáveis e promoção.
3. **Valores dos secrets das Edge Functions** (não é possível ler os valores da origem; precisam ser digitados de novo no projeto novo, em *Edge Functions → Secrets*):

   | Secret | Classe | De onde vem |
   |---|---|---|
   | `ALLOWED_ORIGINS` | manual (não secreto) | lista de origens, hoje inclui `https://fotosdocasamento.online` e `www` |
   | `CLIENTID_VALIDAPAY`, `CLIENTSECRET_VALIDAPAY` | manual | painel ValidaPay |
   | `VALIDAPAY_ENVIRONMENT` (`production`), `VALIDAPAY_PRODUCTION_ENABLED` (`true`) | manual (não secreto) | conferir valores atuais com quem configurou |
   | `VALIDAPAY_PRODUCTION_PUBLIC_ID`, `VALIDAPAY_PRODUCTION_WEBHOOK_SECRET` | manual | painel ValidaPay |
   | `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_ACCESS_TOKEN_SANDBOX`, `MERCADOPAGO_WEBHOOK_SECRET` | manual | painel Mercado Pago (só se o MP continuar em uso) |
   | `PAYMENTS_CRON_TOKEN`, `VALIDAPAY_PRODUCTION_RECONCILE_TOKEN` | **regenerados** por `rewrite_refs.py` | não digitar |
   | `SUPABASE_*` | plataforma | o projeto novo já tem os seus |
   | `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY`, `access_token`, `public_key` | não usados pelo código atual | não recriar |

   Auth: **segredo do Google** (`external_google_secret`) volta mascarado da API → digitar em *Authentication → Providers → Google*.
4. **Plano free = 2 projetos ativos.** Hoje estão ativos a produção e o ensaio. Antes de criar o definitivo: **apague o ensaio** (ou reaproveite-o como definitivo, §3 opção B).
5. **Rede da sessão do Claude**: o host do projeto definitivo precisa estar liberado no ambiente (como foi feito para o ensaio).

---

## 2. Mudanças no app ANTES da janela (implementar, publicar e deixar rodando)

### 2.1 Manter o nome do cookie de sessão (obrigatório para não perder os convidados)
O `@supabase/ssr` dá ao cookie o nome `sb-<ref>-auth-token`, derivado do host de `NEXT_PUBLIC_SUPABASE_URL` (`supabase-js`: ``sb-${hostname.split(".")[0]}-auth-token``). Trocar a URL sem fixar o nome faz todo navegador "esquecer" a sessão: o convidado anônimo vira outro usuário (perde a ligação com o próprio nome/fotos do lado "Você"), e o organizador precisa entrar de novo.

Mudança (`web/src/lib/supabase/env.ts`, `client.ts`, `server.ts`):
```ts
// env.ts
export const AUTH_COOKIE = process.env.NEXT_PUBLIC_SUPABASE_AUTH_COOKIE ?? "sb-asyaegeodyttttaubvxh-auth-token";
// client.ts
createBrowserClient(cfg.url, cfg.key, { cookieOptions: { name: AUTH_COOKIE }, global: { fetch: timedFetch() } });
// server.ts
createServerClient(cfg.url, cfg.key, { cookieOptions: { name: AUTH_COOKIE }, cookies: { getAll, setAll } });
```
Enquanto o app aponta para o projeto antigo, esse nome é igual ao padrão: a mudança não altera nada hoje e pode ir para produção já.

### 2.2 Renovar na hora um access token de outro projeto
O access token guardado no cookie foi assinado pela chave ES256 do projeto antigo (`/config/auth/signing-keys`: origem e destino têm chaves ES256 próprias; a privada não é exportável e a API não aceita importar só a pública). **Comprovado no ensaio**: um access token de outro projeto recebe `403 bad_jwt` no Auth e `401` no PostgREST. O `getSession()` do app usa o token guardado sem ir à rede enquanto ele não vence (até 1 h, `jwt_exp = 3600`), então nesse intervalo as consultas falhariam.

Mudança (no provider/arranque do cliente, antes da primeira consulta):
```ts
const { data } = await sb.auth.getSession();
const at = data.session?.access_token;
if (at) {
  const iss = JSON.parse(atob(at.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).iss as string;
  if (!iss.startsWith(cfg.url)) await sb.auth.refreshSession(); // refresh token copiado → token novo do projeto novo
}
```
Se o refresh falhar (token emitido pelo antigo depois da cópia), o SDK descarta a sessão e o fluxo normal cria um convidado novo — é o risco residual (§10).

### 2.3 Modo manutenção (especificação; não implementado)
- Variável de **build** `NEXT_PUBLIC_MAINTENANCE=1`. Com ela, o layout raiz renderiza só uma tela estática ("Estamos melhorando o Revela. Volte em alguns minutos.") para todas as rotas, **sem instanciar o cliente Supabase** (nada de `browserSupabase()`/`serverSupabase()`, para não renovar tokens contra o projeto antigo durante a cópia) e responde 503 com `Retry-After: 1800` nas rotas de API.
- Como `NEXT_PUBLIC_*` é fixado no build, gere **antes da janela** um deployment candidato de produção com `NEXT_PUBLIC_MAINTENANCE=1` (mesmo SHA, `target=production`, `autoAssignCustomDomains=false`, procedimento de `docs/supabase/PUBLISH-AND-ROLLBACK.md` §7) e promova-o no início da janela (promoção é instantânea).
- Alternativa sem rebuild (`platform_settings.maintenance` lido no cliente) foi descartada: exige o cliente Supabase ativo, que é o que queremos evitar.
- O congelamento no banco (§4 passo 2) é a defesa em profundidade para abas antigas abertas.

### 2.4 Rede da sessão do Claude
Se a migração for executada por uma sessão do Claude, o host `https://<novo>.supabase.co` precisa estar liberado no ambiente (Storage, Auth e smoke usam esse host; a Management API não basta). No ensaio isso foi pedido e aprovado na hora.

---

## 3. Preparação (dias antes; sem impacto em produção)

Defina o destino (o ref sai do passo 1):
```bash
cd /home/user/memo-brasil
```

**Opção A — projeto novo (recomendado):** apague o ensaio no painel (Settings → General → Delete project) e:
```bash
python3 -I scripts/migrate-sp/create_project.py newmemocuiaba-sp     # imprime o ref; senha do banco aleatória só em memória
export MIGRATE_DST_REF=<ref novo>
```
**Opção B — reaproveitar o ensaio:** `export MIGRATE_DST_REF=mjwdokxwhfuldpoaavmu` (renomeie no painel). Os passos de dados truncam e recopiam tudo; o ensaio só tem a extensão `pgtap` a mais.

Depois (opção A; na B já está feito, mas repetir não faz mal, exceto `apply_schema.py`, que pula o que já aplicou):
```bash
python3 -I scripts/migrate-sp/apply_schema.py          # 54 migrations, ~2,5 min; deixa os jobs do cron INATIVOS
python3 -I scripts/migrate-sp/rewrite_refs.py          # Vault + tokens internos + cron recriado com o ref novo (inativo), ~45 s
python3 -I scripts/migrate-sp/schema_diff.py           # esperar só: event_triggers (search_path cosmético), cron (inativo) e pgtap se opção B
python3 -I scripts/migrate-sp/deploy_functions.py      # 13 funções com o verify_jwt da origem, ~25 s
python3 -I scripts/migrate-sp/copy_config.py --aplicar # Auth: site_url, uri_allow_list, Google, anônimos...; lista os secrets manuais
python3 -I scripts/migrate-sp/copy_data.py             # 1ª cópia completa (ensaio geral), ~6 min
python3 -I scripts/migrate-sp/copy_storage.py          # 1ª cópia dos objetos, ~30 s
python3 -I scripts/migrate-sp/test_session_copy.py     # refresh token copiado aceito; token alheio recusado
python3 -I scripts/migrate-sp/test_functions.py        # purge-storage 200 pela cadeia cron→Vault
```
Manual, ainda antes da janela:
1. Digitar os secrets manuais (§1.3) e o segredo do Google no projeto novo.
2. Google Cloud Console: **acrescentar** `https://<novo>.supabase.co/auth/v1/callback` (manter o antigo até o fim da limpeza; os dois convivem).
3. Publicar as mudanças do app §2.1 e §2.2 (apontando ainda para o projeto antigo).
4. Construir (sem promover) dois candidatos de produção na Vercel com `autoAssignCustomDomains=false`:
   - **manutenção**: env atual + `NEXT_PUBLIC_MAINTENANCE=1`;
   - **São Paulo**: `NEXT_PUBLIC_SUPABASE_URL=https://<novo>.supabase.co`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<sb_publishable do novo>` (se `NEXT_PUBLIC_SUPABASE_ANON_KEY` existir na Vercel, troque também ou remova; o código prefere a publicável), e `web/vercel.json` com `"regions": ["gru1"]` (commit próprio, só nesse candidato).
   Demais variáveis lidas pelo app (sem mudança): `NEXT_PUBLIC_MM_BACKEND=supabase`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_VALIDAPAY_CHECKOUT`, `NEXT_PUBLIC_VALIDAPAY_SANDBOX_PREVIEW`, `NEXT_PUBLIC_EMAIL_LOGIN`. Não há chave de servidor do Supabase no app (`web/src/lib/master/*` e as rotas usam a sessão do usuário; o CSP do `next.config.ts` libera só o host de `NEXT_PUBLIC_SUPABASE_URL`, por isso o rebuild é obrigatório).
   Importante: as variáveis `NEXT_PUBLIC_*` são do build; mudar na Vercel não muda deployments já construídos.
5. Smoke local contra o novo (opcional): `python3 -I scripts/migrate-sp/smoke_app.py` (sobe na 3270, para no fim e apaga o convidado anônimo criado pelo próprio smoke).

---

## 4. Janela de manutenção (passo a passo, tempos do ensaio)

T = início. Anote a hora de cada passo.

| Passo | Ação | Quem | Tempo |
|---|---|---|---|
| 1 | Promover o candidato **manutenção** na Vercel | você | < 1 min |
| 2 | Congelar escrita no ANTIGO: colar `scripts/migrate-sp/congelar.sql` no SQL Editor do projeto antigo | você | < 1 min |
| 3 | Pausar o cron do ANTIGO (ele escreve sozinho: conciliação a cada 5 min). Guardar a lista antes: `select jobid, jobname, active from cron.job order by jobid;` e depois `select cron.alter_job(jobid, active := false) from cron.job where active;` | você | < 1 min |
| 4 | Desligar cadastro anônimo no ANTIGO (*Authentication → Sign In / Providers → Allow anonymous sign-ins* = off) | você | < 1 min |
| 5 | Webhook da ValidaPay (e MP) apontando para o projeto novo | você | 2–5 min |
| 6 | `python3 -I scripts/migrate-sp/copy_data.py` (trunca e recopia auth + public, sequences, verifica) | script | ~6 min (72 s de cópia + 110 s de verificação) |
| 7 | `python3 -I scripts/migrate-sp/copy_storage.py` (upsert de todos os objetos e verificação) | script | ~30 s com 4,8 MB; cresce com o bucket |
| 8 | `python3 -I scripts/migrate-sp/rewrite_refs.py --ativar-cron` (cron do novo com o estado da origem) | script | ~40 s |
| 9 | `python3 -I scripts/migrate-sp/test_functions.py` (esperado: purge-storage 200; `payments-reconcile` 200 ou 503 conforme credenciais; validapay-reconcile 200 com os secrets digitados) | script | ~35 s |
| 10 | Promover o candidato **São Paulo** na Vercel | você | < 1 min |
| 11 | Smoke no domínio: `/`, `/e/<código de um evento "TESTE – excluir">`, `/entrar`, `/master` (entrar com Google + TOTP), criar e excluir um evento de teste; conferir no navegador que o cookie continua `sb-asyaegeodyttttaubvxh-auth-token` e que as chamadas vão para `<novo>.supabase.co` | você | 5–10 min |

Tempo de indisponibilidade estimado: **~15–20 min** de passos + folga. Reserve **45 min**.
Os passos 6–9 rodam com `MIGRATE_DST_REF=<ref novo>` exportado.

Se o passo 6 acusar diferença numa tabela (alguém escreveu no antigo por um caminho não congelado, ex.: webhook com `service_role`): rode `python3 -I scripts/migrate-sp/diff_rows.py public.<tabela>` e repita o passo 6 (ele é idempotente: trunca e recopia).

---

## 5. Depois da virada

- Ainda no antigo, deixe o congelamento e o cron pausado (servem para rollback limpo).
- 30–60 min depois: `python3 -I scripts/migrate-sp/diff_rows.py` mostra o que chegou no antigo depois da cópia (deve ser nada). Webhooks atrasados que caírem no antigo aparecem em `public.validapay_webhook_inbox`/`payment_events`: replicar à mão no novo (ou acionar "Conciliar agora" no Master do novo).
- Google Cloud Console: remover o redirect antigo só na limpeza (§7).
- Monitorar no Master do novo: Saúde (cron e integridade da auditoria), pedidos de pagamento, uploads.

---

## 6. Critérios e procedimento de rollback

Voltar se, até 1 h depois da virada: login Google ou TOTP do Master falhar; convidados não conseguirem postar; checkout/Pix falhar; cron/integridade da auditoria em erro; erro 5xx persistente.

1. Vercel: promover o deployment de produção anterior (aponta para o projeto antigo; anote o `dpl_` antes da janela).
2. Antigo: colar `scripts/migrate-sp/descongelar.sql`; reativar os jobs que estavam ativos (lista do passo 3) com `select cron.alter_job(<jobid>, active := true);`; religar cadastro anônimo.
3. Webhooks ValidaPay/MP: voltar para `https://asyaegeodyttttaubvxh.supabase.co/functions/v1/...`.
4. Reconciliar o que foi escrito no novo durante o tempo em que ele esteve no ar: `python3 -I scripts/migrate-sp/diff_rows.py` lista, por tabela, as chaves que existem só no destino e as alteradas (sem valores pessoais). Prioridade: `payment_orders`, `payment_charges`, `payment_events`, `event_entitlements` (dinheiro), depois `events`, `participants`, `photos` (e os objetos correspondentes no Storage do novo). Replicar no antigo pelo SQL Editor/Master. Fotos enviadas ao novo precisam ser baixadas do bucket do novo e reenviadas ao antigo.
5. Desativar o cron do novo (`select cron.alter_job(jobid, active := false) from cron.job;`) para ele não processar nada em paralelo.

---

## 7. Limpeza

- Apagar o projeto de ensaio (se não foi reaproveitado).
- Manter o projeto antigo **ativo e congelado por 7 dias** (rollback e conferência), depois **pausar** (no free, um projeto pausado pode ser restaurado por até 90 dias). Apagar só depois de 30 dias sem incidentes e com backup baixado (`supabase/ops/backup_and_rotate.sh`).
- Remover do Google Cloud Console o redirect antigo e, na ValidaPay/MP, qualquer webhook antigo.
- Revogar o host do ensaio no ambiente da sessão do Claude.
- Atualizar `docs/supabase/PUBLISH-AND-ROLLBACK.md`, `ENVIRONMENT-MATRIX.md` e `supabase/ops/schedule_purge_storage.sql` (que ainda diz para usar o JWT legado no Vault) com o ref novo.

---

## 8. Validação do ensaio (detalhes)

- **Esquema** (`schema_diff.py`): iguais colunas, funções (md5 da definição), políticas RLS, triggers, grants de tabela/coluna/função, RLS ligada, views, buckets, extensões. Diferenças restantes: `event_triggers` (só o `search_path` com que o nome da função aparece), `cron` (inativo no destino por desenho) e `pgtap` (instalado só no ensaio). O event trigger `ensure_rls`/`rls_auto_enable()` (recurso da plataforma, existe na origem) é recriado por `rewrite_refs.py`.
- **Dados** (`copy_data.py --so-verificar`): 58 tabelas; contagem e `md5(string_agg(linha::text ordenado pela PK))` iguais em 57. A única diferença final é `public.payment_orders` (2 linhas, colunas `last_checked_at`, `updated_at`, `version`), causada pelo cron de conciliação de produção depois da cópia — exatamente o motivo do passo 3 da janela. `auth.*`: 49 usuários (40 anônimos; 4 com senha de e-mail, 5 identidades Google), 51 sessões, 79 refresh tokens, 1 fator TOTP; colunas de `auth.*` iguais nas duas versões do GoTrue.
- **Storage**: 32/32 objetos, mesmos nomes, tamanhos, content-type e `owner_id`; md5 do conteúdo baixado do destino igual ao da origem. `event-branding` não tem objetos.
- **Funções**: sem token → 403/401 como esperado; CORS de `payments-validapay` devolve `Access-Control-Allow-Origin: https://fotosdocasamento.online`; `mm-purge-storage` → 200; `mm-payments-reconcile` → 503 `pagamento_indisponivel` (passou no token; faltam credenciais MP no ensaio); `mm-validapay-production-reconcile` → 401 (sem `VALIDAPAY_ENVIRONMENT`/`_ENABLED` no ensaio o token esperado é vazio; com os secrets manuais digitados responde como em produção, onde hoje dá 200).
- **pgTAP** (no ensaio, cada arquivo numa transação desfeita): sem falha 05, 06, 19, 26, 27, 29 (×2), 30 (×3), 31_request_reconcile, 31_print_orders, 32 (×2). Pulados (meta-comandos do psql): 01, 02, 07–14. Falhas atribuídas aos dados reais copiados: 03 e 04/33 (supõem uma única linha/um único master), 28 (espera o preço do seed, produção mudou o preço), 31_export_csv (espera tabelas vazias), 34/35 (contagens de métricas), 36 (espera inbox de webhook vazio). O esquema já foi comprovado igual; a suíte completa deve rodar em banco limpo com `supabase test db` (CI).
- **App** (`smoke_app.py`, build local com URL e chave publicável do ensaio): `/` 200, `/e/<código real copiado>` 200 com `event_preview` 200 (prévia do convite), `/entrar` 200 (tela do código); o convite criou um convidado anônimo (`/auth/v1/signup` 200), apagado pelo script. O `401 /rest/v1/events` antes do cadastro anônimo também acontece em produção (anon não tem SELECT em `events`), não é regressão.

---

## 9. Latência

Daqui (contêiner nos EUA atrás de proxy), medianas de 20–30 chamadas com keep-alive: `auth/v1/health` 156–296 ms (us-west-2) × 187–435 ms (sa-east-1); `rpc/get_public_settings` 142–159 ms × 172–187 ms. O proxy adiciona ruído grande; a diferença ficou entre **30 e 140 ms a favor de us-west-2 — daqui**.

Do Brasil a relação se inverte. Estimativa por RTT típico: Cuiabá → São Paulo ≈ 25–35 ms; Cuiabá → Oregon ≈ 180–220 ms. O convite fez 7 chamadas ao Supabase no smoke (várias em sequência), então a economia esperada para o convidado é da ordem de **0,5–1 s por tela**, mais o ganho das funções da Vercel em `gru1` ao lado do banco.

---

## 10. Riscos

- **Sessões/anônimos**: sem §2.1 todo convidado perde a sessão. Com §2.1 + §2.2, a sessão continua porque o refresh token é opaco (12 caracteres, formato legado sem HMAC: `sessions.refresh_token_hmac_key` nulo nas 51 sessões) e validado só pela tabela `auth.refresh_tokens`, que é copiada. **Comprovado no ensaio**: um refresh token que só existia como linha inserida por SQL foi aceito (`200`, mesma `session_id`, token rotacionado, novo access token ES256 com `iss` do projeto novo). Risco residual: abas abertas com o app antigo que renovarem o token contra o projeto antigo DEPOIS da cópia ficam com um refresh token que não existe no novo → sessão perdida (o modo manutenção sem cliente Supabase e a cópia de `auth.*` no fim minimizam isso). Organizadores entram de novo com Google sem perda de dados.
- **Pagamentos**: webhook atrasado pode cair no antigo durante/depois da janela (usa `service_role`, que o congelamento não bloqueia). Janela sem Pix pendente; conferir `diff_rows.py` depois; "Conciliar agora" no novo. `payments_env = 'production'` é copiado: o novo cobra de verdade assim que os secrets da ValidaPay forem digitados.
- **Cron**: jobs do antigo precisam ficar pausados (senão continuam conciliando/revelando no banco antigo). No novo, só ativar no passo 8. `mm-purge-anon-orphans` segue inativo como na origem.
- **E-mails**: provedor Email do Auth desligado e sem SMTP; `reveal-emails` não está publicada em produção (por isso não foi publicada no novo). Sem impacto hoje; se ligar e-mail, configurar SMTP no novo.
- **URLs assinadas antigas**: apontam para o host antigo e foram assinadas com a chave do antigo; continuam valendo enquanto o projeto antigo estiver no ar (por isso mantê-lo ativo 7 dias). O app gera URLs novas (cache de 1 h).
- **Chaves**: `anon`/`service_role`/`sb_publishable`/`sb_secret` mudam. Nada no app usa chave de servidor; nas funções, a plataforma injeta as novas.
- **Domínio de auth**: `site_url` e `uri_allow_list` são copiados (`https://fotosdocasamento.online` e callbacks). O callback do Google passa a ser `https://<novo>.supabase.co/auth/v1/callback` (acrescentar antes).
- **Plano free**: só 2 projetos ativos; projeto sem atividade por 7 dias é pausado (não se aplica à produção ativa).

---

## 11. Referência dos scripts

| Script | Escreve em | Lê de |
|---|---|---|
| `sb.py` | — (biblioteca; trava de somente leitura na origem) | — |
| `create_project.py <nome>` | cria projeto | — |
| `apply_schema.py` | destino | repositório |
| `rewrite_refs.py [--ativar-cron]` | destino (Vault, secrets internos, cron, `ensure_rls`) | origem (cron, `rls_auto_enable`) |
| `schema_diff.py` | — | origem e destino |
| `copy_data.py [--so-verificar]` | destino (`auth.*`, `public.*`, sequences) | origem |
| `copy_storage.py [--so-verificar]` | destino (buckets, objetos) | origem (download com service_role) |
| `deploy_functions.py [slug…]` | destino | repositório, origem (`verify_jwt`) |
| `copy_config.py [--aplicar]` | destino (config de Auth) | origem (config de Auth, nomes dos secrets) |
| `test_session_copy.py` | destino (usuário sintético, apagado) | origem (GET `/auth/v1/user` com token do destino, para ver a recusa) |
| `test_functions.py` | destino (chamadas `net.http_post`) | — |
| `test_freeze.py` | destino (congela/descongela, convidado de teste apagado) | — |
| `run_pgtap.py` | destino (transações desfeitas) | repositório |
| `smoke_app.py` + `smoke.mjs` | destino (convidado do smoke, apagado) | — |
| `latency.py` | — | origem e destino |
| `diff_rows.py [tabela…]` | — | origem e destino |
| `congelar.sql` / `descongelar.sql` | **você** cola no SQL Editor do projeto antigo | — |

Todos usam `MIGRATE_DST_REF` (destino) e recusam rodar se ele for igual à origem. Chaves ficam só em memória; nada é impresso.
