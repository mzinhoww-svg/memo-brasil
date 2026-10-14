# 001 — Persistência de produção

- Status: **recomendada** (aguarda aceite do orquestrador)
- Autor: Planejador · Data: 2026-10-13
- Cobre itens 3 e 12 do checklist do MVP.

## Contexto

Hoje tudo vive em `data/db.json` (objeto `db.events[id]` com `photos`, `guests`, `lista`, `equipe`, `recados`, `push`, `avisos` aninhados) e fotos em `data/photos/<evento>/<id>.<ext>`. `save()` reescreve o JSON inteiro a cada mutação, de forma síncrona. Consequências: perda de dados em crash entre `writeFileSync` e `renameSync` é improvável, mas não há concorrência segura com mais de um processo, o arquivo cresce com o número de fotos/convidados, e o isolamento entre casamentos depende só de `getEvent`/`adminOnly`.

Restrições:
- Teto de **R$ 100/mês** somando hospedagem, domínio, armazenamento e e-mail.
- Deploy na **VPS LetsCloud existente** (SAO2, 1 vCPU, 2 GB RAM, 50 GB de disco; é compartilhada com outro projeto, ver "Riscos"). Vercel não serve (sem disco).
- Item 12 pede `tenant_id` em todas as tabelas e RLS testada ("um tenant nunca lê outro, nem com SQL direto"); item 3 pede "troca atrás de uma interface, sem reescrever as rotas".
- O bloqueio das fotos antes da revelação é do servidor; qualquer opção precisa preservá-lo.
- Cliente nativo futuro (Fase lojas) consome a mesma API: o modelo de dados não pode depender da web.

## Opções

### A. SQLite (arquivo no volume) + fotos em disco
- Biblioteca: `better-sqlite3` (síncrona, mesma forma de uso do `save()` atual) ou `node:sqlite`.
- Custo: R$ 0 adicional (cabe na VPS). Backup: `sqlite3 .backup` + cópia de `photos/` (restic/rclone para bucket barato).
- Prós: zero serviço novo, transações, índices, migrações versionadas simples, suíte de testes rápida (banco em memória por teste).
- Contras: **não tem RLS**. O isolamento continua na aplicação; contorna-se com repositório que exige `tenantId` em toda função (ver abaixo) e teste de isolamento, mas "nem com SQL direto" do item 12 não é atendido. Um único escritor (um processo). Escala vertical apenas.

### B. Postgres autogerenciado na VPS + fotos em disco/volume
- Custo: R$ 0 adicional, mas consome RAM (~300-500 MB) numa VPS de 2 GB já dividida.
- Prós: RLS nativa (`tenant_id` + `current_setting('app.tenant_id')`), atende literalmente o item 12, multi-processo, `pg_dump` para backup.
- Contras: operar Postgres (upgrades, backup, vacuum) é trabalho nosso; risco de a VPS compartilhada não aguentar; testes precisam de Postgres no CI (service container, aceitável).

### C. Postgres gerenciado (Supabase) + Storage de objetos para fotos
- Custo: plano Free cobre início (500 MB de banco, 1 GB de storage), mas 1 GB de fotos de casamento estoura rápido; Pro ≈ US$ 25/mês (~R$ 130-150), **acima do teto** sozinho. Projetos Free pausam por inatividade. Egress de fotos conta.
- Prós: RLS, Storage com URL assinada, sem operar banco.
- Contras: estoura o teto em produção real; dependência de vendor para o caminho crítico das fotos; latência VPS(SP)→região do projeto; Supabase Auth traria acoplamento que não escolhemos (ver 002).

### D. Manter JSON + interface
- Só extrai uma interface `Store` e mantém o arquivo.
- Prós: menor esforço. Contras: não resolve concorrência, tamanho nem RLS; **não atende item 3** (pede SQLite ou Postgres). Descartada como destino; vale apenas como o primeiro adaptador de transição.

## Decisão recomendada

**Duas camadas, ordem fixa: interface primeiro, SQLite depois, Postgres quando o gatilho disparar.**

1. **Interface `Repo` (obrigatória, independe de banco).** Módulo `src/repo/index.js` expondo operações por intenção, não por tabela: `eventos.criar/obter/atualizar/excluir`, `convidados.*`, `fotos.*`, `lista.*`, `equipe.*`, `recados.*`, `push.*`, `avisos.*`, `auditoria.append/listar`, `config.*`. **Toda função de tenant recebe `eventoId` como primeiro argumento**; não existe `listarFotos()` sem evento. Rotas deixam de tocar em `db.events[...]`. Adaptadores: `repo-json` (código atual, para migrar sem big bang) e `repo-sqlite`.
2. **Banco do MVP: SQLite** (opção A) com `tenant_id` (= `evento_id`) em todas as tabelas filhas, chaves estrangeiras `ON DELETE CASCADE` (exclusão de evento em cascata e auditada), migrações numeradas em `migrations/NNN_*.sql` com tabela `schema_migrations`, WAL ligado, `busy_timeout`. Fotos em `DATA_DIR/photos/<evento>/` num **volume persistente**, atrás de uma segunda interface `Blobs` (`put/get/delete/listar`), para trocar por objeto (S3-compatível) sem tocar rotas.
3. **Item 12 (RLS) cumprido por gatilho, não por data.** O SQL das migrações é escrito já compatível com Postgres (tipos simples, sem recursos exclusivos do SQLite, `tenant_id` sempre presente e indexado). Migrar para Postgres com RLS quando ocorrer **qualquer um**: (a) segundo processo/instância da API, (b) mais de ~50 eventos ativos ou >20 GB de fotos, (c) exigência contratual/LGPD de isolamento comprovado em banco, (d) cliente nativo exigir escrita concorrente. Nesse momento: opção B (Postgres na VPS ou em instância própria) com fotos migradas para objeto; a opção C só se o orçamento mudar.
4. **Isolamento testado em dois níveis desde já:** teste de API (token de A nunca lê B, já existe) e teste do Repo (propriedade: para qualquer função do Repo chamada com `eventoId` X, nenhuma linha com `tenant_id` ≠ X é retornada). Quando vier o Postgres, o mesmo teste roda com `SET app.tenant_id` e SQL direto.

### Por que não ir direto para Postgres (B)?
O item 12 é literal, e a recomendação **o adia de propósito**: com 1 vCPU/2 GB compartilhados e R$ 100 de teto, operar Postgres agora troca risco operacional por um benefício (RLS) que só vale com SQL direto exposto, o que não ocorre numa API de processo único. A interface `Repo` + SQL portável faz a troca custar dias, não semanas. **Isto é um desvio consciente do aceite literal do item 12; o orquestrador deve confirmar ou mandar ir direto para B.** Se mandar B, o restante do plano de fase 2 não muda (a interface é a mesma); só o adaptador e o CI.

## Consequências

- `server.js` perde `db`, `save()`, `PHOTO_DIR`; ganha injeção de `repo` e `blobs` (permite teste com banco em memória).
- Migração do JSON: script idempotente `scripts/migrate-json.js` (lê `db.json`, grava via Repo, verifica contagens, **não apaga o JSON**); nenhum dado de evento real é apagado sem aprovação humana.
- Backup: `scripts/backup.sh` diário (`.backup` do SQLite + `photos/`), criptografado, para bucket (≤ R$ 10/mês) + teste de restauração documentado.
- Retenção: job (item 9/12) roda sobre o Repo, lê `retencaoDiasAposRevelacao`, expira evento inteiro, audita.
- Concorrência: o relógio da revelação e o `setInterval` de push saem de `server.js` para um módulo de jobs, ainda no mesmo processo.

## Riscos

- VPS `reinerscloud` já abriga outro serviço: medir RAM/disco antes de instalar; se faltar, upgrade de plano entra no teto (a estimar em STATUS.md antes de contratar).
- Disco de 50 GB: 20.000 fotos × ~3 MB por evento no limite padrão = 60 GB. **O limite padrão por evento (`maxFotosPorEvento`) precisa ser reduzido ou fotos recomprimidas no upload** (ver Forja-Dados/Revela). Sem isso um único evento grande enche o volume.
- `better-sqlite3` é módulo nativo: confirmar build no CI e na VPS (Ubuntu 26.04).
