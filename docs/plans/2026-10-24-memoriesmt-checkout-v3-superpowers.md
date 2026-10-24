# MemoriesMT — Plano Superpowers | Checkout V3 incorporado
Data: 2026-10-24
Branch: feat/payment-v3-appllama-mercadopago
PR: https://github.com/mzinhoww-svg/memo-brasil/pull/23
Estado de entrada: NO-GO; plano, não evidência de implementação validada.

## Objetivo e contrato de aceite
O organizador personaliza uma festa, informa 272 convidados, recebe plano do catálogo autoritativo (Grande: até 500 pessoas, R$349 enquanto essa cotação estiver vigente), paga via Pix ou cartão **dentro** do MemoriesMT usando Payment Brick oficial e tem a capacidade liberada apenas após reconciliação backend. Nenhum retorno silencioso ao Checkout Pro. Comprador do evento é o organizador; convidados não pagam. Funcionar também com Pix pendente/expirado, cartão recusado, timeout, reload, duplicidade, upgrade e pedido anterior.

## Superpowers e autonomia
Carregar e usar as skills efetivamente instaladas: using-superpowers, brainstorming (somente lacunas reais), using-git-worktrees, writing-plans, systematic-debugging, test-driven-development, subagent-driven-development ou executing-plans, requesting-code-review e verification-before-completion. Ciclo obrigatório RED → GREEN → REFACTOR → revisão → commit → prova por tarefa. Planejamento granular com caminhos de arquivos, testes e critérios. Sem aprovação entre tarefas técnicas reversíveis. Autonomia nunca autoriza burlar permissões, limites de conta, pagar por créditos, executar transações reais, alterar segredos/chaves de produção, DDL remoto com dados reais, merge ou promoção sem autorização específica. Um bloqueio externo é marcado BLOCKED, e as demais tarefas independentes prosseguem.

## Fase 0 — Baseline
T01. Sincronizar PR #23 e worktree isolada; confirmar commit, inventário e comparativo contra Checkout Pro anterior. Ler docs/payments/V3-EMBEDDED-MERCADOPAGO-RUNBOOK.md e documentação existente.
T02. Rodar em web/: npm ci; npm run typecheck; npm run lint; npm test; npm run build; npm run e2e conforme baseline; testar função Edge com Deno e suite SQL. Consertar erros por causa raiz sem remover testes ou silenciar falhas.
T03. Registrar bloqueio Vercel build-rate-limit com prova; utilizar build local/CI existente para continuar, sem prometer um Preview READY.
G0: código íntegro, base conhecida, plano e repro de testes documentados.

## Fase 1 — Contrato financeiro e segurança
T04. Revisar payments_open_order / payments_reserve_embedded e proteção de corrida com payments_attach_preference, inclusive duas abas e tentativas simultâneas.
T05. Revisar migrations e payments_apply_payment com pagamentos antigos, status, recebedor, live_mode, valor BRL, external_reference, refunds, chargebacks e limite da quota.
T06. Testar ownership/authorization de payments_order_status e recuperação do QR por anon, convidado, organizador de outro evento, organizador titular e master. Nunca revelar CPF, token de cartão, service_role ou payload bruto.
T07. Via MCP Mercado Pago, confirmar contrato real de Payment Brick SDK JS v2: onSubmit/formData, Pix, token, identificação, API /v1/payments, X-Idempotency-Key, 3DS, pares public/access keys da mesma conta.
T08. Tratar timeout/202/aprovação tardia: reconsulta antes de segunda tentativa, nenhum pagamento duplo ou pedido órfão. Cobrir webhook duplicado, perdido e fora de ordem.
T09. Aplicar migration apenas em DB local descartável com dados representativos; testar schema, função security definer, search_path, RLS, permissões, event triggers, integração e rollback.
G1: zero vulnerabilidades críticas; testes transacionais, concorrência e idempotência verificados.

## Fase 2 — UX final e Payment Brick
T10. Validar catálogo: grátis 10, 272 → Grande/500, R$349 quando vigente, preço de upgrade pelo servidor, plano além da capacidade e estados de indisponibilidade.
T11. Revisar V3PaymentJourney.tsx, EmbeddedPaymentCheckout.tsx e rota /painel/[id]/plano. Remover qualquer goToCheckout na jornada nova; verificar SDK efetivo e ausência de tela falsa de cartão/Pix.
T12. Pix: QR Code verdadeiro, BR Code copiável, valor, expiração, status pendente, reload, reconexão e pagamento confirmado sem sair do app.
T13. Cartão: tokenização no Brick, identificação, parcelas só quando oferecidas, recusado, aprovado, 3DS quando aplicável e retorno seguro.
T14. Preservar códigos de presente, evento, QR do convite, galerias, autorização e pedidos antigos. Confirmar fluxo mobile 320/375/390/430/768 e desktop 1024/1440/1920; Safari iOS e Android Chrome.
T15. Acessibilidade WCAG 2.2 AA: foco, teclado, mensagens, aria labels, contraste, safe areas e iframe. Screenshots por estado.
G2: percurso visual completo e sem saída para Checkout Pro antigo.

## Fase 3 — Homologação isolada
T16. Prover clone/projeto sandbox independente. NÃO trocar payments_env=production no Supabase principal. Validar credenciais distintas para sandbox, recebedor e pagador, e chave pública da mesma aplicação MP.
T17. Após backup e ensaio, aplicar migration e publicar payments-embedded somente no ambiente de teste com JWT e flags restritivas; jamais expor segredo nos logs.
T18. E2E real de teste: festa 272, Pix gerado e pago, webhooks/consulta, plano liberado; cartão aprovado e recusado; 3DS quando suportado; comprovantes mascarados.
T19. E2E adversarial: duas abas, refresh, pagamentos repetidos, timeout, webhooks duplicados/desordenados, falha bancária, upgrade e estorno em sandbox.
T20. E2E de permissões: anon/convidado/organizador alheio/master. Ninguém cria pagamento ou recupera Pix alheio.
G3: pagamento Pix e cartão end-to-end em sandbox, com prova de base e provedor; nenhuma compra real.

## Fase 4 — Verificação, CI e entrega pré-produção
T21. Reexecutar tipo/lint/unit/integração/pgTAP/E2E/build contra commit final, guardar logs e contagens.
T22. Resolver bloqueio de preview com mecanismo normal da Vercel, sem contornar limites; abrir Preview READY do SHA correto, confirmar integração com sandbox e ausência de chave privada no bundle.
T23. Reviews independentes de produto/UX, segurança, arquitetura, financeiro; corrigir todos P0/P1 e reexecutar gates. Testar compatibilidade com pedidos já existentes.
T24. Relatório final com URL Preview, SHA, vídeo/capturas mobile/desktop, IDs mascarados, logs de webhook/conciliação e plano de rollback; GO/NO-GO e backlog reconciliado.
G4: evidências reproduzíveis; se qualquer teste crítico falhar, permanece NO-GO.

## Fase 5 — Rollout real: autorização explícita
T25. Apresentar mudança de produção detalhando migration, flags, Edge Function, domínio, assinatura do webhook, rollback e cobrança de teste controlada. Não prosseguir sem aprovação.
T26. Após aprovação específica: backup verificável, migration remota revisada, Edge Function e flags limitadas a operadores, compra controlada/estorno autorizado, auditoria e monitoramento.
T27. Após aceite financeiro, rollout gradual, alertas de falha e plano de rollback que preserve pedidos e direitos dos clientes. Nunca ocultar a falha redirecionando para o Checkout Pro.
G5: GO de produção somente com consentimento explícito e prova end-to-end.

## Evidência obrigatória por tarefa
Registrar ID, status (TODO/IN_PROGRESS/BLOCKED/FAILED/DONE), arquivo/commit, comando, ambiente, resultado concreto, logs/screenshot/link, risco remanescente. Código escrito NÃO equivale a teste aprovado, PR aberto NÃO equivale a deploy, HTTP 200 webhook NÃO equivale a entitlement e Vercel READY NÃO equivale a pagamento real. Preservar IDs de backlog e decisões comerciais.

## Gate final
- [ ] 272 → plano de 500 e preço real do servidor.
- [ ] Checkout Pix/cartão funcional dentro da aplicação e sem redirecionamento antigo.
- [ ] QR Pix real, copiável e recuperável; cartão tokenizado.
- [ ] Recusa/3DS/expiração/timeout/duplicidade e webhook testados.
- [ ] Somente pagamento conciliado habilita quota.
- [ ] Sem cobrança ou acesso em nome de outro usuário.
- [ ] Eventos antigos, convites e códigos de presente sem regressão.
- [ ] Testes e CI verdes + Preview READY do commit final.
- [ ] Homologação em dispositivos reais.
- [ ] Revisão independente + rollback + autorização final de produção.

Ordem: executar T01–T24 autonomamente. T25–T27 sob autorização separada. O relatório deve identificar precisamente o que foi comprovado e o que permaneceu bloqueado.
