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

---

# v2 (Event Studio + Master Admin) — backend, Supabase LOCAL, 2026-10-22

Branch `feat/memoriesmt-studio`. Somente banco local descartável (portas 55420–55429); nada foi aplicado no projeto remoto. Migrations em `supabase/migrations/20261022000100…500` (ver `MIGRATIONS-V2.md`).

| Camada | Ferramenta | Resultado | Onde |
|---|---|---|---|
| Suíte v1 (inalterada, exceto 1 asserção: a prévia agora tem 12 chaves, `theme` incluída) | pgTAP | **75/75** | `supabase/tests/database/01_security_and_reveal.test.sql` |
| v2: temas, assets/branding, papéis, auditoria imutável, acesso a foto, settings/flags, analytics, LGPD, saúde | pgTAP | **267/267** | `supabase/tests/database/02_v2_studio_admin.test.sql` |
| **Total** (`supabase test db`, após `supabase db reset --local`) | pgTAP | **342 / 342 passam, 0 falham** | — |
| Advisors locais (`supabase db advisors --local`) e `db lint` | CLI | lint sem erros; 1 aviso de performance **pré-existente da v1** (`photos`: duas policies de SELECT permissivas, migration `…000600`); nenhum aviso novo | — |
| Script de operador `supabase/ops/provision_master.sql` | psql no container local | recusa sem parâmetro, com os dois parâmetros, usuário inexistente, e-mail não confirmado, motivo curto; cria linha + claim + auditoria; reexecução idempotente | manual (ver abaixo) |

## O que o pgTAP v2 cobre
- **Papéis (MAD-001)**: master = claim **e** linha ativa; claim sem linha, linha sem claim e claim de outro papel são negados; anon, convidado, host e master sem linha tentam INSERT/UPDATE/DELETE em `platform_roles` e falham (`42501`); só master lê; RPC de concessão exige master + justificativa; histórico não é apagado nem reescrito; último master não é revogável.
- **Auditoria (MAD-002)**: UPDATE/DELETE/TRUNCATE bloqueados (`MM010`) para o dono, para `service_role` e para clientes; `admin_log` só master, justificativa ≥ 10 em ação sensível (`view.*` dispensa); host só lê a auditoria dos próprios eventos, auditor lê tudo, support nada.
- **Temas (EST-001)**: hex inválido (sem `#`, 3 dígitos, letras fora de hex) é rejeitado sem erro de cast; contrastes (texto×superfície, superfície×profundo, controle×superfície) abaixo do AA rejeitados; fonte fora da lista, mensagem > 280 ou com caractere de controle, `qr_style` e `decor` inválidos rejeitados; RLS por papel (anônimo, convidado membro, convidado não-membro, host, outro host, master com/sem linha, support, auditor); isolamento A×B; bloqueio de edição igual ao da revelação v1; cascata; Realtime só em `event_themes`; `event_preview` mantém os 11 campos e acrescenta `theme`.
- **Assets/Storage**: bucket privado, 5 MiB, MIME sem SVG; `begin_asset`/`finalize_asset` (MIME declarado × real, teto por tipo, 10 por evento, evento bloqueado); policies reais de `storage.objects` (só o host, só o caminho aberto, sem sobrescrever, sem UPDATE, leitura por host/membro/master, nunca por não-membro ou outro host).
- **Foto privada (MAD-004)**: master não lê `photos` nem `storage.objects` do bucket de fotos, nem antes nem depois da RPC; a RPC recusa justificativa < 10 caracteres, grava a auditoria (com evento, alvo, papel, motivo) antes de devolver o caminho e o organizador enxerga o acesso; host, support, auditor, master sem linha e anon não executam.
- **Settings/flags (SCV-001)**: leitura de flags habilitadas para authenticated, settings só para staff, escrita só master via RPC, todo caminho de escrita (inclusive `service_role`) auditado, valor de configuração fora do log.
- **Analytics (ANL-001)**: estado vazio devolve zeros; com dados, contagens batem com o cenário (eventos, ativos/encerrados, organizadores, participantes, fotos, uploads com falha, revelações pendentes/atrasadas, bytes reais em Storage, série diária); paginação (limite máx. 100, além do fim vazio, busca com `%` literal); e-mail mascarado para auditor/support e completo para master; host/anon/master sem linha negados.
- **LGPD/saúde**: pedidos pendentes/atrasados (15 dias), dias em aberto, atraso de revelação, envios parados, fila de limpeza, jobs `mm-*` do pg_cron com último run.

## Achados durante a implementação
1. `is_master()` precisou virar `SECURITY DEFINER` (lê `platform_roles` sem passar pela própria RLS, que a usa → recursão). Continua com `search_path` fixo e sem EXECUTE para anon.
2. Em PL/pgSQL, campos de uma variável `record` são resolvidos no plano do comando inteiro: um `CASE` não protege `r.enabled` quando o gatilho roda para outra tabela. O gatilho de auditoria de settings/flags usa `to_jsonb(r) -> 'campo'`.
3. Um `AND` em SQL não garante ordem de avaliação: as funções de cor/decor usam `CASE` para nunca converter hex inválido (senão o CHECK explodiria com erro de cast em vez de violação limpa).
4. O Storage bloqueia `DELETE` direto em `storage.objects` (trigger `protect_delete`): a limpeza de teste usa `session_replication_role = replica`; a policy de delete do host é verificada pela função `can_delete_branding`.
5. O banco local estava com resíduo de testes de integração antigos (os 3 testes "falhos" do baseline eram contagens sujas); `supabase db reset --local` restabeleceu os 75/75. As suítes pgTAP assumem banco recém-resetado.

## Não coberto no v2 (ver `MIGRATIONS-V2.md`, "Fora do escopo")
Limpeza dos objetos de `event-branding` de eventos apagados (a fila `storage_purge_queue` não tem coluna de bucket), validação de conteúdo/dimensões reais da imagem (magic bytes; largura/altura são as declaradas), assinatura da URL de 60 s (feita fora do banco, pelo serviço com `service_role`), rotas `/master` e UI, testes de API (supabase-js) e E2E dos novos fluxos.
