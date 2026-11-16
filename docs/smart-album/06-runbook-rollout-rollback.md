# 06 · Runbook — rollout, monitoramento e rollback

**Nada desta entrega foi aplicado em produção.** Migrations, função e chaves só foram exercitadas num Supabase local descartável.

## 1. Chaves
| Chave | Onde | Efeito | Padrão |
|---|---|---|---|
| `smart_album_ui` | `feature_flags` (`rollout.events` opcional = allowlist) | aba Minhas Fotos + favoritas | sem linha = **desligada** |
| `smart_album_face_matching` | `feature_flags` (`rollout.events` **obrigatório**) | habilita a busca facial no evento (junto com os demais gates) | sem linha = **desligada** |
| `smart_album.legal_gate` | `platform_settings` | `{approved, opinion_ref, approved_by}` | sem linha = **fechado** |
| versão aprovada | `face_consent_documents.approved` | texto do consentimento vigente | só rascunho, **não aprovado** |
| `SMART_ALBUM_ENGINE` | env da Edge Function | escolhe o adaptador | ausente → **503** |

O console Master (`/master/configuracoes`) só tem interruptores fixos (checkout, cartão, álbum impresso) e grava `rollout = {}`; **não** há tela para estas chaves nem para allowlist. Caminhos reais:
- Conta master logada (JWT com `aal2`): `select public.admin_set_feature_flag('smart_album_ui', true, '{"events":["<uuid>"]}', 'motivo com 10+ caracteres');`
- SQL Editor do Supabase (papel `postgres`, onde `is_master()` é falso): gravar direto; o trigger `settings_audit` registra em `audit_logs` com o motivo:
  ```sql
  begin;
  select set_config('mm.audit_reason', 'Laboratório do álbum pessoal no evento X', true);
  insert into public.feature_flags (key, enabled, rollout) values ('smart_album_ui', true, '{"events":["<uuid-do-evento>"]}')
  on conflict (key) do update set enabled = excluded.enabled, rollout = excluded.rollout;
  commit;
  ```
Desligar: mesmo comando com `enabled = false`. Uma tela no Master para estas chaves é pendência.

## 2. Ordem de publicação — Fase A (álbum pessoal, sem biometria)
1. Confirmar o SHA vivo na Vercel e mesclar esta branch sobre ele (ver `00-repository-audit.md` §1).
2. `supabase db push --linked --dry-run` deve listar **só** `20261116000100_smart_album.sql`. Aplicar (aditiva; cria bucket privado vazio).
3. Rodar `node scripts/test-db.mjs` no stack local e confirmar 0 falhas.
4. Publicar o app (procedimento de `docs/supabase/PUBLISH-AND-ROLLBACK.md` §7/§15: candidato sem tráfego → validação → promover). Com a chave desligada nada muda para ninguém.
5. Ligar `smart_album_ui` com `{"events":["<evento de laboratório>"]}`; validar com contas de teste (dono + convidado): aba aparece só nesse evento, favoritas, antes/depois da revelação, outro convidado não vê os itens.
6. Ampliar a allowlist aos poucos; por fim `{}` (todos).
7. **Não** publicar nem agendar `smart-album-worker`; **não** agendar `smart_album_expire` (nada a expirar sem a busca).

## 3. Fase B (busca facial) — só depois de `07-release-gates.md` integralmente aprovado
1. Implementar o adaptador do motor escolhido em `engineFromEnv()` + testes.
2. Publicar `face_consent_documents` com a versão aprovada (migration própria) e registrar o gate (`admin_set_setting('smart_album.legal_gate', {...})`).
3. Deploy de `smart-album-worker` e `purge-storage` (agora conhece `face-references`); agendar o worker (pg_cron + Vault, como `payments-reconcile`) e `smart_album_expire()` diário.
4. `smart_album_face_matching` com allowlist de **um** evento de laboratório adulto, imagens consentidas; medir.

## 4. Monitoramento (sem PII)
- `audit_logs` ações `smart_album.*` (consentimento, revogação, job iniciado, ocultação, apagamento).
- `select status, count(*) from face_search_jobs group by 1;` (fila, falhas, cancelados por `gate_closed`).
- `select count(*) from storage_purge_queue where bucket='face-references';` deve voltar a 0 após cada rodada do purge.
- Log do worker: `smart-album job=<id> status=… processadas=… resultados=…`.

## 5. Rollback
| Situação | Ação | Tempo |
|---|---|---|
| Problema na UI | desligar `smart_album_ui` (Master) | imediato |
| Problema na busca | desligar `smart_album_face_matching` (kill switch: leitura de resultados passa a MM019; worker cancela jobs com `gate_closed`) | imediato |
| Revogar o gate jurídico | `admin_set_setting('smart_album.legal_gate', '{"approved":false}', motivo)` | imediato |
| Reverter o app | promover o deployment anterior na Vercel | minutos |
| Reverter o banco | desligar chaves → esperar a purga esvaziar `face-references` → `supabase/ops/rollback_smart_album.sql` (testado no local: remove funções/tabelas/política; o bucket vazio fica e é removido pelo painel, pois o Storage proíbe DELETE por SQL) | minutos |

## 6. Incidente de privacidade
1. Kill switch (`smart_album_face_matching` off) e gate fechado.
2. Preservar `audit_logs`; levantar titulares afetados por `face_consents`/`face_photo_matches` (sem exportar imagens).
3. Acionar o responsável jurídico (comunicação à ANPD/titulares conforme avaliação).
4. Purga dirigida: `select public.smart_album_erase(event_id, user_id, 'incidente')` (service_role) para os afetados.
