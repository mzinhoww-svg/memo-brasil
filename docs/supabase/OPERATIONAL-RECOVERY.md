# Operação e recuperação mínimas (uso acompanhado)

Escopo: eventos reais acompanhados pelo operador (Aurimar). Sem promessa de RPO/RTO: só o que foi medido abaixo.

## Responsável e rotina de saúde
- **Operador:** Aurimar. Ele confere a saúde ao abrir e ao encerrar cada evento e, durante uploads, de hora em hora.
- **Conferência (somente leitura):**
  1. Console `/master/saude` (exige conta Master). Deve mostrar jobs `mm-*` ativos e sem atraso.
  2. `node supabase/ops/a5-readonly-probe.mjs` (ver `A5-MANUAL-RUNBOOK.md`; usa só URL e chave públicas).
  3. No SQL Editor, `supabase/ops/verify_purge_storage.sql` (fila, jobs e últimas respostas HTTP da purga).
- **Alerta no painel:** `/master/saude` exibe alertas (fila de purga >7200 s, revelação vencida, envio parado, pg_cron fora, job inativo/falho). Só vale com o painel aberto; não notifica.
- **Gatilhos de ação:** fila de purga parada por mais de 7200 s; revelação vencida e não executada; foto presa em `enviando`; qualquer resposta `500` da purga. Tratar pelo `A5-MANUAL-RUNBOOK.md` e registrar no backlog (SCV-009: alerta no painel feito; notificação ativa não existe).

## Backup existente (manual, fora do Git)
- Local: `~/Backups/memoriesmt/20261021-1352/` (`schema.sql`, `data.sql`, `storage/event-photos/` com 13 arquivos) e `~/Backups/memoriesmt/SHA256SUMS.txt`. Permissões 700/600. Nunca publicar.
- **Último ponto recuperável conhecido:** 2026-10-22 (dump manual `~/Backups/memoriesmt/<data-hora>`, antes de aplicar `_1100`; checksums na rodada 3 do relatório). Anterior: 2026-10-21 13:54. Posteriores a isso não estão cobertos.
- **Frequência efetiva:** nenhuma automática comprovada. Backups gerenciados do Supabase e PITR **não foram verificados** (dependem do plano do projeto). Até verificar, o backup é só o manual acima.
- Conferir integridade: `cd ~/Backups/memoriesmt/20261021-1352 && shasum -a 256 -c ../SHA256SUMS.txt`. Resultado em 2026-10-21 (esta A.5): 15 de 15 OK.

## Restauração em destino isolado (comprovada em 2026-10-21)
Procedimento (nunca apontar para o projeto remoto):
1. Subir um Postgres descartável, local e sem expor porta externa: imagem `public.ecr.aws/supabase/postgres:17.11.0.003`, `-p 127.0.0.1:55499:5432`, senha aleatória.
2. `psql` como `supabase_admin`: aplicar `schema.sql` e depois `data.sql`.
3. Conferir contagens e um registro; restaurar objetos copiando `storage/event-photos/` para o bucket do destino.
4. Remover o container.

Resultado medido:
- Schema: 0 erros. Duração da restauração do banco: menos de 1 s para este volume (3 eventos, 1 foto, 30 perfis).
- Leitura restaurada: `events=3`, `photos=1` (pronta), `profiles=30`; o `storage_path` da foto restaurada corresponde a um arquivo existente no backup do Storage.
- **Limite:** as tabelas `auth.*` não restauram em um Postgres puro (8 erros: o GoTrue é quem as cria). Para restauração com autenticação, usar a stack local do Supabase (`supabase start`) ou um projeto novo. A restauração com stack local e a aplicação das migrations sobre os dados restaurados foram testadas antes (A.3.5), sem perda de dados.
- **Duração não é RTO:** o volume é de teste. Medir de novo com volume real antes de prometer prazo.

## O que NÃO está provado
- Backup automático e PITR do projeto remoto.
- Restauração do Storage por API (somente conferência de arquivo e checksum).
- Tempo de recuperação com volume real.
Enquanto isso, a recuperação é **parcial**: serve ao uso acompanhado com export manual antes de cada evento (`supabase db dump` + cópia do bucket, ver `OPERATOR-COMMANDS.md`).

## Resíduos de teste (QAV-004 segue aberto)
Quatro contas de teste (identidade e-mail), 25 sessões anônimas e 9 objetos órfãos em `event-photos`, fora da fila de purga. Não aparecem a usuários indevidos (RLS) e não limitam a capacidade inicial. **Não limpar sem backup recente e autorização do dono.** Retenção sugerida: tratar após o primeiro evento acompanhado.
