# Migrations v2 (Event Studio + Master Admin)

Branch `feat/memoriesmt-studio`. Contrato: `docs/architecture/DESIGN-V2-STUDIO-ADMIN.md` (seções 3 e 4). **Aplicadas e testadas apenas no Supabase LOCAL. Nenhuma foi aplicada no projeto remoto.**

## Garantia de aditividade
- Nenhuma migration faz `DROP`, `TRUNCATE`, `DELETE` ou `UPDATE` de dados existentes; nenhuma coluna/tabela/função da v1 é removida ou renomeada.
- Alterações em objetos existentes (todas compatíveis): `create or replace` de `is_master()` (mais restritiva, ver impacto) e `event_preview()` (mantém os 11 campos, acrescenta `theme`); `audit_logs` ganha 4 colunas nullable e triggers de imutabilidade; a policy `audit_host_select` é recriada (acrescenta o papel auditor); `event_themes` entra no `supabase_realtime`.
- Códigos de erro novos: `MM010` imutável (auditoria/histórico) · `MM011` justificativa obrigatória/insuficiente. Os `MM001–MM009` seguem iguais.

## Ordem e conteúdo
| # | Arquivo | Tickets | Cria | Impacto sobre dados existentes |
|---|---|---|---|---|
| 1 | `20261022000100_platform_roles_audit.sql` | MAD-001, MAD-002 | `platform_roles`; `is_master()` (reescrita), `is_platform_role(text)`, `is_platform_staff()`, `admin_log(...)`, `admin_grant_platform_role`, `admin_revoke_platform_role`; colunas `actor_role/reason/target_type/target_id` em `audit_logs`; triggers `audit_logs_no_update/delete/truncate`; trigger de trilha de papéis | **Comportamental**: `is_master()` passa a exigir linha ativa. Antes da migration ninguém tinha papel (não existia caminho de provisionamento), então nenhum acesso de master real é perdido; policies v1 que usam `is_master()` (`events_select`, `participants_select`, `audit_host_select`) continuam iguais para todos os demais. Linhas de `audit_logs` existentes ficam com as colunas novas `null` e passam a ser imutáveis |
| 2 | `20261022000200_event_themes.sql` | EST-001 | `event_themes` + CHECKs; funções `event_theme_*`, `hex_luminance`, `contrast_ratio`, `event_theme_locked`; RLS; Realtime; `event_preview` estendida | Nenhum. A prévia ganha a chave `theme` (null sem tema); clientes v1 que ignoram chaves extras seguem funcionando |
| 3 | `20261022000300_event_assets_branding.sql` | EST-001 | `event_assets`; bucket privado `event-branding`; policies de `storage.objects` do bucket; `begin_asset/finalize_asset/discard_asset`; funções `can_*_branding` | Nenhum (bucket e tabela novos; policies só se aplicam ao bucket novo) |
| 4 | `20261022000400_platform_settings_flags.sql` | SCV-001 | `platform_settings`, `feature_flags`; triggers de auditoria; `admin_set_setting`, `admin_set_feature_flag` | Nenhum |
| 5 | `20261022000500_admin_rpcs.sql` | MAD-004, ANL-001, LGPD | `admin_request_photo_access`, `admin_dashboard_metrics`, `admin_list_events`, `admin_list_organizers`, `admin_lgpd_requests`, `admin_health` | Nenhum (somente funções; leitura agregada). Nenhuma policy nova sobre `photos`/`storage.objects` do bucket de fotos |

Fora do repositório de migrations: `supabase/ops/provision_master.sql` (script de operador, ver abaixo).

## Matriz de papéis (resumo)
| Capacidade | anon | convidado | host | master | support | auditor |
|---|---|---|---|---|---|---|
| Ler `platform_roles` | não | não | não | sim | não | não |
| Escrever `platform_roles` | não | não | não | só via RPC (justificativa) | não | não |
| Ler `audit_logs` | não | não | eventos próprios | tudo | não | tudo |
| Ler tema do evento | não (prévia via RPC) | se membro | próprio | sim | não | não |
| Gravar tema / subir logo-capa | não | não | próprio, antes do bloqueio | não | não | não |
| Settings (ler) / flags não habilitadas (ler) | não | não | não | sim | sim | sim |
| Flags habilitadas (ler) | não | sim | sim | sim | sim | sim |
| Settings/flags (escrever) | não | não | não | só via RPC | não | não |
| Métricas, listas, LGPD, saúde | não | não | não | sim (e-mail completo) | sim (e-mail mascarado) | sim (e-mail mascarado) |
| Acesso excepcional a foto | não | não | não | sim, com justificativa ≥ 10 e auditoria prévia | não | não |

## Decisões de contrato (interpretação — revisar)
1. **Contraste (EST-001)**: o contrato diz "texto sobre superfície ≥ 4.5; profundo/controle conforme contrato" sem números. Implementado: `texto×superficie ≥ 4.5`, `superficie×profundo ≥ 4.5`, `controle×superficie ≥ 3.0` (WCAG 1.4.11) e rótulo do controle ≥ 4.5 (melhor entre superfície e profundo sobre `controle`). `grafismo` é decorativo, sem exigência. Fórmula espelha `web/src/domain/contrast.ts`. Ajuste = `create or replace` em `event_theme_contrast_ok` (CHECK vale para novas gravações).
2. **Fontes / QR / decor**: fontes `birthstone, pinyon, vibes` em `event_theme_allowed_fonts()` (para liberar nova fonte: nova migration com `create or replace`); `qr_style` ∈ `classico, pontos, arredondado` (nomes provisórios, confirmar com o design); `decor` aceita só `motivo` (slug), `intensidade` (0–3), `bordas` (boolean), até 512 bytes. `preset` é um slug livre (a lista de presets vive no cliente).
3. **Bloqueio de edição do tema** = regra de revelação da v1 (`reveal_enabled` e (`revealed_at` ou `now() >= reveal_at`)). Evento sem revelação nunca bloqueia.
4. `welcome_message` permite quebra de linha (`\n`); demais caracteres de controle são rejeitados.
5. `event_assets` ganhou a coluna `upload_status` (reusa o enum da v1), necessária ao ciclo begin/finalize; máximo de 10 assets por evento; logo ≤ 2 MiB, capa ≤ 5 MiB; `width/height` são os declarados pelo cliente (16–8192).
6. `admin_list_*` não expõem o código de convite, caminhos de Storage nem legendas. `admin_request_photo_access` devolve `storagePath`; **a URL de 60 s é assinada fora do banco** (serviço com `service_role`), nunca por cliente.
7. `admin_dashboard_metrics`: `p_to` é exclusivo; fuso padrão `America/Cuiaba` (parâmetro); período máx. 366 dias; "uploads com falha" = `falhou` + `enviando` parado há > 1 h; "revelação atrasada" = pendente com `reveal_at < now()`.
8. Auditoria imutável é por trigger: um superusuário ainda pode desabilitar o trigger, mas isso fica visível (ver `pg_trigger`). Para imutabilidade além do banco, exportar a trilha periodicamente.

## Provisionar o primeiro master (operador, fora do app)
`supabase/ops/provision_master.sql` — sem credencial padrão, a pessoa precisa já existir em `auth.users` (entrou uma vez, e-mail confirmado). Exige exatamente um de `-v email=` ou `-v user_id=` (e opcionalmente `-v reason=`, ≥ 10 caracteres). Cria a linha ativa em `platform_roles`, grava `app_metadata.role = 'master'` e registra `platform_role.granted` + `master.provisioned` em `audit_logs`. Idempotente. A pessoa precisa sair e entrar de novo para receber a claim.
```
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v email='pessoa@empresa.com' -v reason='provisionamento inicial do master' -f supabase/ops/provision_master.sql
```

## Plano de aplicação remota (NÃO executar sem aprovação)
Pré-condições: homologação v1 estável; janela combinada; backup/PITR confirmado; `docs/supabase/REMOTE-CONNECTION-RUNBOOK.md` e `ENVIRONMENT-MATRIX.md` seguidos (conferir o ref do projeto **antes** de qualquer comando).
1. Conferir que o remoto está em `…000600` (`supabase migration list`, com o projeto vinculado de forma explícita e verificada). Rodar `supabase db push --dry-run`: devem aparecer exatamente as 5 migrations v2, na ordem.
2. Revisar o impacto em dados com a consulta de sanidade: `select count(*) from public.audit_logs;` (nada será alterado) e `select public.is_master();` antes/depois com um usuário comum (deve continuar falso).
3. Aplicar as 5 migrations em ordem (1→5) em uma única janela. Todas são transacionais e aditivas; não há passo de dados. Reversão: como são aditivas, o rollback é não usar os novos objetos; se necessário, uma migration de reversão **nova** (nunca editar as aplicadas).
4. Rodar `supabase test db` contra um banco de homologação equivalente (ou o local recém-resetado) antes; no remoto, executar apenas leitura: advisors (`security` e `performance`), `select * from pg_publication_tables where pubname='supabase_realtime'` (deve listar `event_themes`).
5. Provisionar o master com `provision_master.sql` (psql com a connection string do operador, nunca pelo app) e validar `is_master()` após novo login.
6. Smoke: `event_preview` com e sem tema; upload de logo por um host de teste; `admin_dashboard_metrics()` como master; tentativa de `admin_request_photo_access` sem justificativa deve falhar.
7. Rollback de emergência: desligar os caminhos de UI da v2 (feature flag) — o banco aditivo não afeta a v1.

## Fora do escopo desta entrega
- Limpeza dos objetos de `event-branding` quando o evento é apagado: `storage_purge_queue` não tem coluna de bucket e o consumidor (Edge Function) ainda não existe; as linhas de `event_assets` somem em cascata, os objetos ficam órfãos até esse job existir. Recomendação: coluna `bucket` na fila + job.
- Validação do conteúdo da imagem (magic bytes, dimensões reais, reencode/strip de EXIF) — Edge Function.
- Assinatura da URL de 60 s e as rotas `/master/**` (servidor Next), UI do Studio e do Master Admin.
- Teste de API com supabase-js e E2E dos novos fluxos; pg_cron de reconciliação de `platform_roles` com `auth.users` removidos (FK `on delete restrict` impede apagar usuário com papel ativo: revogar antes).
- Aviso de advisor pré-existente da v1 (`photos`: duas policies de SELECT permissivas) — não alterado para não mexer em objetos já aplicados no remoto.
