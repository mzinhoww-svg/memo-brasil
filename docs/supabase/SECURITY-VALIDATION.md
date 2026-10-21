# Validação de segurança

Resultado local (Supabase local, 2026-10-21). O remoto **ainda não recebeu** as migrations (SB-003), portanto estas verificações valem para o código/migrations, não para a produção.

## Controles e como foram provados
| Risco | Controle | Prova |
|---|---|---|
| IDOR entre eventos | `events/participants/photos/reactions/audit_logs` com RLS por host/membro; `is_host`/`is_member` com `search_path` fixo | pgTAP: outro organizador não lê nem altera evento, fotos, arquivo; API: idem |
| Vazamento de foto antes da revelação | `can_see_photo` (host, ou membro + `is_revealed` + visível); Storage usa a mesma função; sem policy de listagem aberta | pgTAP e API: convidado (inclusive o autor) não lê linha, não lista, não baixa, não assina URL; bucket não é público; Realtime não entrega o evento |
| Revelação reaberta | `is_revealed` monotônica (`revealed_at`), trigger por tempo (não pelo espelho), cliente não escreve `revealed_at` | pgTAP: `MM008` ao desligar/adiar depois de revelada; cliente não zera `revealed_at` |
| Escalada de privilégio | `host_id`, `code`, `version`, `revealed_at` imutáveis para o cliente; moderação só muda `status`/`highlighted`; `begin_photo` força autor = `auth.uid()` | pgTAP |
| Criar evento sem conta | policy exige não anônimo | pgTAP e API |
| Rolo/lotação/encerramento | triggers e RPC no servidor; lock por pessoa (`pg_advisory_xact_lock`) contra corrida | pgTAP e API (`MM001/MM002/MM003`) |
| Convites | token aleatório de 24 bytes, só o hash guardado, expiração, limite de usos, revogação, rotação do código, rate limit por pessoa | pgTAP e API |
| Força bruta de código | `check_rate_limit` (20 entradas/10 min, 8 códigos inválidos/10 min por pessoa) | código; sem teste de esgotamento (lacuna) |
| Upload malicioso | bucket 8 MiB, só jpeg/png/webp; só o autor sobe no caminho da própria foto `enviando`; sem upsert; `finalize` confere tamanho/MIME do objeto | API (MIME fora da lista, >8 MiB, caminho alheio, sobrescrita) |
| Auditoria forjada / fila de limpeza | INSERT só por trigger (RLS com `pg_trigger_depth()`); sem escrita direta | pgTAP |
| Funções internas expostas | `EXECUTE` revogado de `public`/`anon`; tarefas e exclusão de conta só para `service_role` | pgTAP (`42501`) |
| Segredos | só `NEXT_PUBLIC_*` (URL e publishable) no app; `service_role` só em testes locais; nenhum segredo no repositório | revisão + ENVIRONMENT-MATRIX |
| XSS / injeção | texto de usuário nunca vira HTML (React); CSP restritiva só ao host do Supabase | auditoria AUD-001 (A3) + build |
| Open redirect no OAuth | `/auth/callback` só aceita `next` que comece com `/` e não `//` | revisão |

## `public.rls_auto_enable()`
Lido no remoto (somente leitura): *event trigger* da plataforma (`ensure_rls`, dispara em `CREATE TABLE` e liga RLS na tabela nova de `public`), `SECURITY DEFINER`, `search_path=pg_catalog`, com `EXECUTE` para `PUBLIC/anon/authenticated`. Não há dependência de aplicação. A migration 5 revoga o `EXECUTE` de clientes (a função segue disparando como event trigger). Validar no remoto depois do push: criar uma tabela de teste e conferir `relrowsecurity` (todas as nossas tabelas já habilitam RLS explicitamente).

## Lacunas conhecidas (viram backlog)
- **SB-005**: o Storage confere só o `Content-Type` declarado; falta checar bytes mágicos e resolução (Edge Function).
- **Moderação de conteúdo**/denúncias: contagem e fila existem; não há ação automática.
- Sem teste de esgotamento do rate limit nem de carga.
- `anonymous_users = 30/h por IP` (padrão do Auth) pode barrar uma festa inteira numa mesma rede; ajustar no remoto conforme o uso.
- Google OAuth não testado (credenciais externas).
- `npm audit` do `web/` reporta avisos de dependências de desenvolvimento; não foram avaliados nesta sessão.
