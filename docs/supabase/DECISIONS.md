# Decisões para a fase Supabase (ITG-106)

Status: **técnicas = adotadas (reversíveis)**; **de produto = propostas, aguardam confirmação do dono**. Origem: AUD-001 (A4) e o plano `INTEGRATION-PLAN.md` v2.

## Técnicas (adotadas)
| # | Decisão | Motivo |
|---|---|---|
| T1 | Revelação decidida pelo servidor (`reveal_due_events`); o cliente só lê `reveal_status`/`revealed_at` | cliente não é confiável; relógio do aparelho |
| T2 | Visibilidade e rolo aplicados por RLS/trigger; o cliente nunca recebe foto bloqueada | filtro de UI não é segurança |
| T3 | `participants` (host fora da tabela); `is_member = host OR participante` | modelo real do código |
| T4 | Configurações embutidas em `events`; sem `reveal_schedules` | 1:1 com o evento, lido junto, RLS única |
| T5 | UUID gerado no cliente (idempotência de reenvio); `created_at` pelo servidor | outbox offline |
| T6 | Concorrência otimista (`version`) em `events` e `photos` | lost update (BG-113) |
| T7 | Fotos por URL assinada e miniatura; bytes só no upload | Storage privado |
| T8 | Identidade: Supabase Auth (anônima + Google via `linkIdentity`); `switchTo` existe só no demo local | `User.id` local ≠ `auth.uid()` |
| T9 | Migração local→nuvem por RPC `import_event`, só eventos do host, IDs preservados, idempotente | A4-008 |

## De produto (FIXADAS pelo dono em 2026-10-21; implementadas nas migrations 1–6)
| # | Pergunta | Decisão | Onde está implementada |
|---|---|---|---|
| P1 | Criar evento exige login Google? | **Sim** para o organizador; **convidado entra por convite, sem conta** (sessão anônima) | policy `events_insert` (não anônimo); `join_event`; portão no wizard |
| P2 | O host vê as fotos antes da revelação? | **Sim**, com acesso restrito e auditável | `can_see_photo` (host), `audit_logs` (`photo.moderated`, `reveal.*`) |
| P3 | Remoção de participante | Perde acesso ao evento e aos arquivos | `participants.blocked_at` + `is_member` (RLS, Storage e Realtime reagem na hora) |
| P4 | LGPD / exclusão de conta | Pedido registrado e processado com anonimização; não apaga fotos de outros participantes; retenção de 30 dias para evento apagado | `request_account_deletion`, `process_account_deletion`, `purge_deleted_events` |
| P5 | Convites | Token imprevisível (24 bytes, só o hash), expiração, limite de usos, revogação, rotação do código, limite de tentativas | `create_invitation`, `revoke_invitation`, `rotate_event_code`, `check_rate_limit` |
| P6 | Administrador master | Só por claim `app_metadata.role='master'` emitida pelo servidor; nunca público nem credencial fixa. Leitura de eventos/participantes/auditoria, **sem** acesso aos arquivos | `is_master()` + policies de leitura |
