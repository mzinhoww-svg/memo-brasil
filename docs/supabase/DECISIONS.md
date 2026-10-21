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

## De produto (propostas; confirmar)
| # | Pergunta | Proposta | Efeito |
|---|---|---|---|
| P1 | Criar evento exige login Google? | **Sim** (organizador); convidado entra anônimo | define `host_id = auth.uid()` |
| P2 | O host vê as fotos antes da revelação? | **Sim** (moderação), como no código | policy de `photos` |
| P3 | Quem remove convidado pode bloquear reentrada? | **Sim** (`participants.blocked_at`) | BG-103 |
| P4 | Retenção/LGPD: excluir conta apaga fotos de terceiros? | Apaga as do titular; fotos de convidados em eventos dele são apagadas com o evento | `delete_account` |
| P5 | Código de convite: rotação/expiração? | Rotação a pedido e expiração opcional; limite de tentativas por IP | ITG-107 |
