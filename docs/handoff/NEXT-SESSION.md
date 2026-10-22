# Retomar A.5

A frente A **não está concluída**; parecer **NO-GO**. Não iniciar B, Codex ou C.

Leia integralmente `MEMORIESMT-MASTER-HANDOFF.md`, `../supabase/A5-HOMOLOGATION-REPORT.md`, `../supabase/A5-MANUAL-RUNBOOK.md`, A4 e o backlog atual. Compare o remoto com o checkout original antes de integrar qualquer coisa: os handoffs/commit 6d84c31 anteriores não estavam no GitHub nesta sessão.

Não repetir provisionamento Master. O operador confirmou `/master`; banco confirmou Google + claim + concessão ativa. SCV-010 foi negado por HTTP com Email desabilitado. Evidências atuais: 266 unitários, 30 probes, typecheck/lint/build; não contar os 430 pgTAP históricos como execução desta rodada.

Retomar: reproduzir falha do wizard com navegador oficial compatível com Playwright (runner alternativo Chromium 153: 1 falha, 15 não executados); sessão Google com refresh/expiração, quatro identidades e E2E completo em preview autorizado; Safari/iOS e Chrome/Android físicos; INF-004/INF-005; monitoramento SCV-009 e higiene QAV-004 conforme restrições. Correção HTTP da purga ainda não publicada remotamente. Não executar integração contra dados compartilhados, limpeza ou promoção Production sem autorização própria. Link temporário que dispensa login Vercel foi rejeitado por auto-review; não contornar.

Use Superpowers e conclua o que for tecnicamente possível, registre bloqueios com evidência e emita novo GO/NO-GO antes de liberar a próxima frente.
