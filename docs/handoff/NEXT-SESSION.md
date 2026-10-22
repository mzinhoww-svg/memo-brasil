# Retomar A.5

## Rodada 5 (22/10/2026) — leia primeiro
Parecer **NO-GO operacional por um único requisito**: texto jurídico final/retenção (as páginas seguem como rascunho). SHA `975a49c`; previews `dpl_HpaBRySf9RzetNukhku4JUMfHTRL` (memoriesmt-v2) e `dpl_59rEWBMxuud3m9STBssRUtd9hgic` (newmemocuiaba, fluxo autenticado). Provado: login Google, aceite, evento Festa, QR, convidado, upload, cron real de revelação, galeria, download, bloqueio de não membro, Master, chave removida da Vercel, telas sem itens de homologação. Abertos: texto jurídico/retenção (operador), INF-005 (e-mail do autor do commit no GitHub), OPS-A5-001 (Redirect URLs do Auth para memoriesmt-v2), PITR e limpeza (adiados). Detalhes: `../supabase/A5-HOMOLOGATION-REPORT.md` (Rodada 5). B, Codex e C seguem **não iniciados**; AppLlama/AbacatePay têm planejamento próprio.

## Rodada 3 (22/10/2026) — leia primeiro
Parecer **NO-GO operacional**; SHA `26d9674`, preview `dpl_25h3hDg1NjF7Q6bhe3fwqfBRSr1m`. Feito: migration `_1100` aplicada no remoto, `purge-storage` v2, alerta em `/master/saude`, contato nos textos. **Falta:** (1) `SUPABASE_SERVICEROLE_KEY` ainda aparece em Production nos metadados (reconferir após o operador remover); (2) o dono escolhe a conta Google do organizador para o fluxo remoto sintético e o cron real; (3) revisão jurídica e retenção; (4) iPhone/Safari e Android/Chrome. Detalhes: `../supabase/A5-HOMOLOGATION-REPORT.md` (Rodada 3). B, Codex e C seguem **não iniciados**.

## Rodada 2 (22/10/2026) — leia primeiro
Parecer **NO-GO operacional**. Fonte: `../supabase/A5-HOMOLOGATION-REPORT.md` (matriz dos nove critérios), `../supabase/OPERATIONAL-RECOVERY.md`, `../supabase/PUBLISH-AND-ROLLBACK.md`, `../supabase/A5-EXECUTION-LEDGER.md`. Código testado `ff712e3`. Falta, por ordem: (1) operador aplica a migration `_1100` e republica `purge-storage`; (2) dono remove a service key da Vercel e revisa termos/retenção; (3) login Google real, evento sintético no preview e cron real de revelação; (4) iPhone/Safari e Android/Chrome. Só então reavaliar o GO. B, Codex e C seguem **não iniciados**.

## Direção vigente: entregar e evoluir

O operador autorizou criar o plano e executar as fases técnicas autonomamente, sem novas aprovações intermediárias. Ler `../superpowers/specs/2026-10-21-operational-release-design.md` e executar `../superpowers/plans/2026-10-21-memoriesmt-ready-for-use.md`. O plano fixa sete entregas para uso operacional assistido; B → Codex → C seguem depois do fechamento formal de A. Não exigir todo o roadmap para disponibilizar a primeira versão utilizável. Pendências adiadas permanecem abertas e o parecer precisa distingui-las de pontos originais de A efetivamente concluídos.

**Atualização de acesso:** o usuário autorizou explicitamente o link temporário do preview. A chamada autorizada `get_access_to_vercel_url` falhou com HTTP 403 em `lookup_deployment`; nenhum link foi criado. Falta escopo efetivo da conexão para equipe/projeto Vercel. Não pedir novamente essa autorização e não repetir a chamada sem mudança comprovada de acesso. Preservar a restrição específica de promoção Production para versão identificada e a proibição de operações destrutivas/dados reais.

## Evidência anterior a preservar

A frente A **não está concluída**; parecer **NO-GO**. Não iniciar B, Codex ou C.

Leia integralmente `MEMORIESMT-MASTER-HANDOFF.md`, `../supabase/A5-HOMOLOGATION-REPORT.md`, `../supabase/A5-MANUAL-RUNBOOK.md`, A4 e o backlog atual. Compare o remoto com o checkout original antes de integrar qualquer coisa: os handoffs/commit 6d84c31 anteriores não estavam no GitHub nesta sessão.

Não repetir provisionamento Master. O operador confirmou `/master`; banco confirmou Google + claim + concessão ativa. SCV-010 foi negado por HTTP com Email desabilitado. Evidências atuais: 266 unitários, 30 probes, typecheck/lint/build; não contar os 430 pgTAP históricos como execução desta rodada.

Retomar: reproduzir falha do wizard com navegador oficial compatível com Playwright (runner alternativo Chromium 153: 1 falha, 15 não executados); sessão Google com refresh/expiração, quatro identidades e E2E completo em preview autorizado; Safari/iOS e Chrome/Android físicos; INF-004/INF-005; monitoramento SCV-009 e higiene QAV-004 conforme o corte e mitigações do plano vigente. Correção HTTP da purga ainda não publicada remotamente. Não executar integração contra dados compartilhados ou limpeza. A rejeição inicial do link por auto-review foi seguida de autorização explícita do usuário e tentativa permitida, bloqueada por escopo 403 conforme atualização acima.

Use Superpowers e conclua o que for tecnicamente possível, registre bloqueios com evidência e emita novo GO/NO-GO antes de liberar a próxima frente.
