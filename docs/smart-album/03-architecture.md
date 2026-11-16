# 03 · Arquitetura

## 1. Visão
```
Convidado (PWA, Next 16)                     Supabase (Postgres + Storage)                       Worker (Edge Function, service_role)
──────────────────────                       ─────────────────────────────                       ────────────────────────────────────
GuestTabs ─ chave smart_album_ui ───────────► smart_album_ui_enabled(event)
MinhasFotos ─ estado ───────────────────────► smart_album_state(event)  (sem caminho, sem score)
  favoritas ────────────────────────────────► smart_album_set_item / smart_album_my_items  ── can_see_photo
Onboarding:
  referência (galeria/câmera/Google)
  → prepareReference (no aparelho: sniff, recomprime, sem EXIF)
  → consentimento ─────────────────────────► smart_album_grant_face_consent  ── 5 gates
  → upload ────────────────────────────────► smart_album_begin_reference → Storage face-references (INSERT só no próprio caminho)
  → busca ─────────────────────────────────► smart_album_request_search (revelado, idempotente) → face_search_jobs(queued)
                                                                                        ◄──────── smart_album_worker_claim (fotos elegíveis "como o titular")
                                                                                                  baixa referência + fotos, FaceEngine (desligado)
                                                                                        ◄──────── smart_album_worker_complete (só fotos ainda elegíveis)
Resultados ─────────────────────────────────► smart_album_list_matches ── revalida can_see_photo + is_revealed a cada leitura
Ocultar / Revogar ──────────────────────────► smart_album_hide_match / smart_album_revoke_face → storage_purge_queue → purge-storage
```

## 2. Por que RPC e não rotas `/api`
O app não tem rotas de API para regras de negócio: tudo é RPC `security definer` (search_path vazio) + RLS, com o `auth.uid()` do JWT. Rotas Next exigiriam a service key no servidor Vercel (removida de propósito em rodadas anteriores) e duplicariam a autorização. Mapeamento do contrato do plano (§8):

| Plano | Implementação |
|---|---|
| GET `/smart-album` | `smart_album_state(p_event)` |
| POST `/consent` | `smart_album_grant_face_consent(p_event, p_version, p_source, p_self_attested)` |
| POST `/reference` | `smart_album_begin_reference(p_event, p_source)` + upload no Storage (política) |
| POST `/search` | `smart_album_request_search(p_event, p_idempotency)` |
| GET `/jobs/:id` | `smart_album_state(...).face.job` |
| GET `/matches` | `smart_album_list_matches(p_event, p_limit, p_before)` (cursor por `created_at`) |
| POST `/matches/:photo/hide` | `smart_album_hide_match(p_event, p_photo)` |
| GET/POST/DELETE `/favorites` | `smart_album_my_items(p_event)` / `smart_album_set_item(p_photo, p_kind, p_on)` |
| DELETE `/face-profile` | `smart_album_revoke_face(p_event)` |

Códigos: MM004 (sem acesso; foto inexistente responde igual), MM005 (inválido), MM006 (frequência), MM017 (antes da revelação), **MM019** (busca/álbum indisponível), **MM020** (sem consentimento biométrico).

## 3. Dados (migration `20261116000200_smart_album.sql`)
- `personal_photo_items(event_id, user_id, photo_id, kind)` — PK composta; RLS de leitura: dono **e** `can_see_photo`; escrita só por RPC.
- `face_consent_documents(version, approved)` — só `2026-11-16-rascunho` (não aprovada).
- `face_consents` — append-only por trigger (só `revoked_at` muda, uma vez); um ativo por (evento, titular).
- `face_profiles` — caminho `event/user/profile` checado por constraint; um ativo por (evento, titular); `expires_at`.
- `face_search_jobs` — idempotência `(user_id, idempotency_key)`, um ativo por (evento, titular), tentativas ≤ 3, `locked_until`, `error_code` só `[a-z_]`.
- `face_photo_matches` — PK (evento, titular, foto); `hidden_by_user` preservado em novas buscas.
- Tabelas `face_*`: RLS ligada, **nenhum GRANT** para anon/authenticated (nem o anfitrião/master leem pelo painel).
- Bucket `face-references`: privado, 5 MB, jpeg/png/webp; uma política: INSERT pelo titular no caminho do perfil pendente, com gates e sem objeto existente. Sem SELECT/UPDATE/DELETE.

## 4. Gates (todos no servidor)
`smart_album_face_enabled(event)` = chave `smart_album_face_matching` ligada **e** evento em `rollout.events` **e** `smart_album_legal_gate()` (`approved=true`, `opinion_ref`, `approved_by`) **e** versão aprovada do consentimento **e** evento não excluído. Mais: conta não anônima (consentimento), membro/anfitrião, revelado (busca/leitura). A chave `smart_album_ui` (com `rollout.events` opcional) controla só o álbum pessoal.

## 5. Foto do Google
Só para prévia/escolha: `googlePictureUrl` aceita apenas HTTPS em `*.googleusercontent.com` (sem userinfo/porta) e pede 640 px. O download acontece no navegador, depois da escolha, com `credentials: omit`, `redirect: error`, teto de 15 MB e 8 s; depois passa pelo mesmo preparo da galeria. Nenhum fetch de URL arbitrária no servidor (sem superfície de SSRF).

## 6. Worker
`supabase/functions/smart-album-worker` (Deno) → `_shared/smart-album-worker.ts` (puro). Responde 503 sem `SMART_ALBUM_ENGINE` (e qualquer valor hoje cai no motor desligado). Lote sequencial (3 jobs), teto de 3.000 fotos/job, prazo de 120 s, retry ≤ 3 com retorno à fila, falha definitiva quando a referência é inválida, `dispose` do handle no `finally`, bytes zerados após uso, log só com id do job e contagens. Elegibilidade calculada pelo banco executando `can_see_photo` "como o titular" (`request.jwt.claims` local à transação, restaurado ao fim), para não duplicar a regra.

## 7. Purga e expiração
Revogar/trocar/expirar → `smart_album_erase`: cancela jobs, apaga matches, marca perfis `erased`, zera caminho e enfileira o objeto em `storage_purge_queue(bucket='face-references')`; `purge-storage` agora conhece esse bucket. `smart_album_expire()` (service_role) revoga e apaga perfis vencidos ou de titulares bloqueados e remove jobs antigos — **não agendado** (agendar só na ativação). Exclusão do evento/conta apaga tudo em cascata.

## 8. Cliente
`web/src/features/smart-album/`: `service.ts` (nuvem/local), `reference.ts`, `use-smart-album.ts`, `MinhasFotos.tsx`, `Onboarding.tsx`, `CameraCapture.tsx`, `copy.ts`, `flags.ts`, `analytics.ts`; rota `web/src/app/e/[code]/(app)/minhas-fotos`. Nada biométrico em localStorage/IndexedDB/analytics/URL.

## 9. Motor em produção (16/11/2026)
Motor próprio `services/face-engine` (YuNet + SFace) rodando na Vertra como worker sem endereço público (app `revela-face-engine`,
384 MB, Python 3.13). **Modo pull:** a cada 20 s chama a Edge Function `smart-album-engine` (Bearer `SMART_ALBUM_ENGINE_TOKEN`),
que reserva 1 job (`smart_album_worker_claim`), devolve URLs assinadas de 30 min (referência + fotos elegíveis) e grava o resultado
(`smart_album_worker_complete`/`_fail`, versão do motor fixada no servidor). O motor não tem chave do banco e só baixa do host do Storage.
Por isso não há pg_cron para o Smart Album. Vertra fica no cluster `usa1` (EUA): processamento fora do Brasil (ver RIPD).

**Estado em produção (16/11/2026, 04:40 UTC):** 21 funções `smart_album_*` presentes e migrations 20261116000200/000300 registradas;
nenhuma executável por `anon`; worker/audit/erase/expire só `service_role`. Flags `smart_album_ui` (on) e `smart_album_face_matching`
(on, `{"all":true}`); `platform_settings.smart_album.legal_gate` aprovado com referência "parecer declarado pelo proprietário em 16/11/2026
(sem nº informado)"; termo `2026-11-16-v1` aprovado. `/claim` responde 200 desde 04:36:37 (fila vazia). Desligar: `supabase/ops/rollback_smart_album.sql`
ou `update feature_flags set enabled=false where key='smart_album_face_matching'`.
