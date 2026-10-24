# Critérios de lançamento: primeira compra produtiva controlada × abertura pública

Atualizado em 2026-10-24. Objetivo: separar o que destrava a **primeira compra real controlada** (feita pelo dono) do que só se exige para **abrir as vendas ao público**, sem bloqueio circular. A avaliação oficial de qualidade do Mercado Pago (Preferences) mede `payment_id` produtivo; ela nunca é pré-requisito da primeira compra, e sim consequência dela.

## A. Antes da primeira compra produtiva controlada (dono compra o menor plano, Festa R$ 29, em evento próprio)

| # | Critério | Estado em 2026-10-24 | Evidência |
|---|---|---|---|
| A1 | Sandbox: aprovação, retorno, conciliação e concessão única | Provado | pedido `235e0088…`, pagamento `184803988907`, 1 direito `festa` |
| A2 | PAY-001 a PAY-005 | DONE | pgTAP 11 suítes, 1120/1120; PAY-004 também no remoto |
| A3 | Token de produção da conta esperada (`testUser:false`, conta `3786909683`) e `MERCADOPAGO_WEBHOOK_SECRET` cadastrados | Cadastrados (só nomes verificados) | `payments-diagnose` |
| A4 | Webhook de produção salvo no painel | Salvo via `save_webhook` | URL `…/functions/v1/payments-webhook` |
| A5 | Reconciliação ativa como rede de segurança (a cada 5 min, teto de 7 dias) | Ativa | job `mm-payments-reconcile` |
| A6 | Rollback pronto e janela sandbox fechada | Pronto / fechada | `PUBLISH-AND-ROLLBACK.md` §7, `payments_env=desligado` |
| A7 | Chave Pix na conta recebedora (só se Pix for oferecido; sem ela o checkout mostra só cartão) | **Não verificável por API**; confirmar no app do Mercado Pago | documentação oficial: Pix só aparece com chave cadastrada |
| A8 | Valor e operação autorizados pelo dono (plano, R$, reembolso posterior) | Aguarda autorização específica | — |

A compra controlada **é** o teste de webhook e de reembolso reais (itens abaixo), porque o sandbox com vendedor de teste não os exercita (ver `GO-LIVE-REPORT.md`, seção "Webhook e reembolso").

Execução (runbook §14, passos 3 a 5): `payments_env=production` somente com `production_active` apenas no plano Festa; compra pelo dono; conferir `payment_events` com `event_type` de webhook (não `apply.reconcile`) e `outcome=aplicado`; reembolso pelo Master até `estornado`; voltar a `desligado` se qualquer item falhar.

Critérios de sucesso da compra controlada:
1. Pedido `pago`, 1 cobrança `approved` com `live_mode=true` e `collector_id` esperado, 1 direito ativo.
2. **Pelo menos uma linha de `payment_events` de webhook** (tipo `payment:*`) com `outcome=aplicado`. Só se existir ela o webhook de produção está comprovado.
3. Reembolso aceito pelo Mercado Pago, `refunded_cents` = valor, pedido `estornado`, direito revogado.

## B. Para abrir as vendas ao público (depois de A, plano a plano)

| # | Critério | Estado |
|---|---|---|
| B1 | A concluída com sucesso (inclui webhook e reembolso reais) | Pendente |
| B2 | D3: política de arrependimento e reembolso (CDC art. 49) decidida e refletida em Termos/Política | Pendente (decisão do dono) |
| B3 | D5: razão social e CNPJ (rodapé e `/ajuda`); e-mail de suporte `mazinhoww@gmail.com` já gravado em `support_email`; telefone opcional | Razão social e CNPJ pendentes |
| B4 | D6: NFS-e e regime fiscal | Pendente (decisão do dono) |
| B5 | Revisão jurídica dos textos (versão 2026-10-22-v1) | Pendente |
| B6 | `production_active` ligado por plano, um de cada vez | Pendente |
| B7 | Cenários negativos no checkout oficial (recusado, pendente, cancelado) com cartões de teste do Mercado Pago | Pendente: o agente não digita cartão em página do Mercado Pago; cobertos só por teste local com fake |
| B8 | Testes físicos iPhone/Android/WebKit e teclado aberto | Pendente (só emulação Chromium) |
| B9 | Pix: chave cadastrada e uma cobrança Pix real | Pendente |

## C. Depois do primeiro pagamento produtivo (não bloqueia A nem B)

- Avaliação oficial de qualidade (`quality_evaluation`) com o `payment_id` da compra controlada; pontuação mínima 73 e ações do checklist. É medição posterior; corrigir o que ela apontar antes de ampliar a divulgação.
- Revisão do `quality_checklist` e das ativações de planos maiores.
