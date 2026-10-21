# 08 · Prontidão para o Supabase

Auditor A4 (somente leitura; nenhum SQL, migration, MCP do Supabase ou deploy). Rascunho: `drafts/A4.md`. Evidência: `evidence/logs/a4-*.txt`.

## Bloqueio de infraestrutura (separado dos achados de produto)
**INF-001 (P1).** O usuário informou que o projeto `newmemocuiaba` (ref `asyaegeodyttttaubvxh`, organização `zpnbwkmukywzlkxdfeja`, us-west-2, PostgreSQL 17, ACTIVE_HEALTHY) **existe e está ativo**, confirmado pelo plugin Supabase do ChatGPT. O conector Supabase do Claude lista apenas 6 projetos de outra organização (`vercel_icfg_…`, sa-east-1) e **não enxerga** esse projeto. É **bloqueio de acesso do conector** (conta, organização ou permissões), não ausência de infraestrutura, e a auditoria não tem como confirmar nem negar o estado do projeto. Tarefa `INF-001`: reconectar o conector à organização correta, validar `list_projects`/`get_project` em leitura, sem escrever. `newmemocuiaba` também é o nome do projeto **Vercel**.

## Veredito do auditor A4
# A4 — Prontidão para a integração Supabase (commit 3266e26)

## Resposta objetiva
**Não, ainda não sem retrabalho estrutural moderado.** O domínio é sólido (regras puras, UUID no cliente, reveal em UTC+IANA, 131 testes verdes), mas os contratos de repositório foram desenhados para armazenamento local, confiável e síncrono. Não suportam URL em vez de bytes, paginação, erros tipados, concorrência otimista, prévia de convite nem identidade real. O plano cobre bem RLS e revelação, mas tem lacunas de modelagem e migração. Sem P0 hoje. 10 P1 a fechar antes de qualquer migration.

## Prontidão por tema
| Tema | Estado | Evidência |
|---|---|---|
| Entidades e enums | Parcial | `domain/event.ts:8-35`, `photo.ts:7-26`; faltam `updatedAt`/`version`, estado de upload, `capturedAt` |
| IDs (UUID no cliente) | Pronto | `events/service.ts:37`, `photos/service.ts:24` |
| Código de convite | Parcial | `share-code.ts:5`; unicidade por check-then-insert (`service.ts:35`), sem rotação/expiração |
| Integridade referencial | Parcial | cascata só em `deleteEventCascade` (`repositories/index.ts:16`); `reactions.event_id` sem FK composta |
| Contratos de repositório | Inadequado | `types.ts:29-64`: sem paginação, erro tipado, versão, URL; `save()` upsert de linha inteira |
| Fotos (bytes) | Inadequado | `types.ts:24,48`; `hooks.ts:88` baixa tudo |
| Auth/identidade | Ausente | `AuthService` e `SyncService` sem uso (`a4-static-checks.txt`); `users.known/switchTo` (`types.ts:65-73`) |
| Convites/QR/`?mesa=` | Parcial | `links.ts:10` rótulo livre; `invitations` só no seed (`seed.ts:56`) |
| Upload linha→objeto | Ausente | `photos.add` atômico no IDB (`indexeddb:108`); sem estado intermediário |
| Revelação (domínio) | Pronto | `reveal.ts:76-100`, migração v2 testada |
| Revelação (servidor/relógio) | Parcial | só desenho (`INTEGRATION-PLAN §4.1`); `reconcileReveal` roda em todo cliente |
| Papéis `can()` × RLS | Parcial | `roles.ts:19`; `can()` só usado em `painel/layout.tsx:49`; sem proxy/middleware para `/master` |
| Limites no servidor | Ausente | tudo client-side (`domain/photo.ts:30`, `event.ts:18`) |
| Outbox/offline | Ausente | `localSync` é só rótulo (`services/index.ts:43`) |
| Migração IDB→nuvem | Parcial | v2 ok (`indexeddb:34`); export/import não existe |
| Env/tipos/CSP | Ausente | sem `supabase/`, sem env no `web/`; CSP `connect-src 'self'` (`next.config.ts:15`) |
| Suíte de contrato | Parcial | `repositories.test.ts:15-18` parametrizada, mas fixtures inválidas p/ Postgres |

## Modelo real × tabelas propostas
- **profiles**: manter mínimo; o nome por evento vive em `Participant.name`.
- **events + event_settings**: manter **embutido** (1 linha, ~25 colunas, sempre lido junto, RLS única). Tabela separada só adicionaria join sem ganho.
- **reveal_schedules**: **não criar**; reveal é 1:1 com o evento. Manter `reveal_enabled/reveal_at/timezone` em `events` e **remover `reveal_status`** (derivável de `now()`; espelho vira drift). Se preciso, `revealed_notified_at` para idempotência do push.
- **participants** (não `event_members`): o domínio tem host fora da lista (`participants/service.ts:24`); `is_member` deve ser `host OR participants`. Capacidade conta só convidados.
- **invitations**: hoje inútil (link carrega o rótulo, não o id). Ou ganha `id` no link e `invitation_id` em `participants`, ou sai do MVP.
- **photos**: faltam `captured_at`, `upload_status`, `mime/bytes/width/height`, `deleted_at`; `author_id` deve ser nullable (migração). `storage_path` é derivável.
- **photo_reports**: correto; exige `reportPhoto(photoId, reporterId)`; `Photo.reports` vira contagem derivada.
- **RPCs ausentes do plano**: `event_preview`, `my_shot_count`, `import_event`, `finalize_photo`.

## Bloqueadores (P1) e lacunas pré-migration
Contratos sem URL/paginação/contagem, e PostgREST trunca em 1000 linhas (A4-001/002); sem erros tipados, idempotência e versão (A4-003); `reconcileReveal` grava de qualquer cliente (A4-004); rolo no cliente quebra sob RLS e o plano se contradiz sobre o autor ler a própria foto (A4-005); convite expõe evento+fotos (A4-006); identidade local ≠ `auth.uid()` (A4-007); migração com autores sem perfil e triggers de evento encerrado (A4-008); upload em duas fases e `created_at` do cliente (A4-009); regras só no cliente (A4-010).

Decisões abertas: criar evento exige Google? Host vê fotos pré-revelação (código: sim). Fusão anônimo→Google já existente.

## Sequência recomendada
1. **Decisões de produto** (criação logada, host pré-revelação, LGPD).
2. **Contratos v2** (A4-001/002/003/006): `getPhotoUrl`, `Page<T>`, `RepositoryError`, `version`, `EventPreview`, `report(photoId, reporterId)`; adaptar IDB/memória. Depende de 1.
3. **Domínio**: `reveal_status` derivado, `captured_at`, `ends_at`, reveal×fim (A4-011). Depende de 2.
4. **Suíte de contrato v2** com fixtures UUID/FK/dois atores (A4-013). Depende de 2.
5. **Projeto `supabase/` local**: migrations, RLS, pgTAP, `supabase gen types`. Depende de 3 e 4.
6. **Auth**: `SupabaseAuthService`, anônimo + `linkIdentity`, remover `switchTo` (A4-007). Depende de 5.
7. **Adaptadores Supabase** + CSP/env (A4-013). Depende de 5, 6.
8. **Outbox + realtime + relógio** (A4-009/011). Depende de 7.
9. **Migração local→nuvem** (`import_event`, A4-008). Depende de 7, 8.

## Não verificado
Nada de SQL, RLS ou Realtime foi executado. O limite de 1000 linhas do PostgREST e o `linkIdentity` com identidade existente vêm de conhecimento da plataforma, não de teste. Legado da raiz (`server.js`) não auditado.

## Pendências antes das migrations (consolidadas no backlog)
`ITG-101` leitura escopada por papel · `ITG-102` contratos v2 · `ITG-103` fotos por URL e upload em duas fases · `ITG-104` autoridade do servidor (revelação, rolo, limites, relógio) · `ITG-105` identidade e migração · `ITG-106` contradições do plano (autor lê a própria foto antes da revelação? `reveal_status` espelhado ou derivado? `participants` × `event_members`; `invitations`) · `ITG-107` convites · `ITG-108` env/CSP/suíte de contrato · `ITG-109` papéis × RLS · `ITG-110` tipos.
