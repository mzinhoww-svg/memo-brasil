# Homologação do lote produto/pagamentos: parte de pagamentos, backend e segurança

- **Data:** 22/10/2026.
- **Código:** branch `feat/product-production`, SHA `0abaf9a` (onda final de correções da revisão do lote: `c036b9a` e `0abaf9a`, sobre a Task 7A `1a6c982`). Este relatório e o runbook são só documentação.
- **Plano:** `docs/superpowers/plans/2026-10-22-memoriesmt-product-production.md`, seções 5 e 7.
- **Runbook:** `docs/supabase/PAYMENTS-RUNBOOK.md`.

**Escopo deste documento.** Ele cobre as linhas de pagamentos, backend e segurança da matriz, com evidência **local, contra a fake AbacatePay**. A parte de interface, visual e aparelhos físicos é da sessão `memo-reverse-65` (branch `feat/final-ui`), que é também dona do deploy, do merge e da promoção na Vercel. O alvo definitivo é o projeto `newmemocuiaba` (`newmemocuiaba.vercel.app`), e não `memoriesmt-v2`. Não há preview do SHA candidato registrado aqui.

## Estado do ambiente remoto (somente leitura, 22/10/2026)

- **Migrations.** `supabase migration list --linked` mostra local = remoto até `20261022001300`. As de `20261022001400` a `001800` **não estão aplicadas**, e o `db push --dry-run` listou exatamente essas 5.
- **Bloqueio.** O `db push --linked --yes` foi negado pelo classificador de segurança da ferramenta e não foi contornado (Ruling 22). Com isso, as 5 Edge Functions de pagamento também não foram publicadas: elas dependem das migrations.
- **Pagamentos no remoto.** O remoto ainda não tem pagamentos de nenhum tipo. Depois de aplicado, nasce com `payments_env = 'desligado'`, ou seja, cobrança pública desligada.
- **Credencial.** Não existe chave AbacatePay, nem de sandbox nem de produção. Por isso as linhas de sandbox real são **bloqueio externo**.
- **Backup.** O backup prévio está em `~/Backups/memoriesmt/20261022-1902`: schema, dados e `event-photos`, com `SHA256SUMS` 13/13 OK, reconferido nesta rodada.
  - **Lacuna:** o bucket `event-branding` não foi copiado, porque o script não o inclui. O runbook (passo 1) já traz o comando.
- **Rotação de backups:** rotação de backups é manual, executada pelo operador a cada ≤ 30 dias; não é automação ativa.

## Evidência local (22/10/2026, SHA `0abaf9a`)

| Suíte | Comando | Resultado |
|---|---|---|
| pgTAP | `sb db reset && sb test db` (stack isolado 564xx) | **Files=10, Tests=968, PASS** (935 antes da onda final) |
| Web unit | `cd web && npm test` | **39 arquivos, 342 testes, PASS** |
| Typecheck | `npm run typecheck` | saída 0 |
| Lint | `npm run lint` | **0 erros**, 11 avisos (todos anteriores, variáveis não usadas) |
| Build | `npm run build` | saída 0 |
| Unit das functions | `npx vitest run --config vitest.functions.config.ts` | **2 arquivos, 51 testes, PASS** |
| Integração de pagamentos | `sb functions serve --env-file <fictício>` + `vitest.integration.config.ts integration/payments.itest.ts` | **26/26 PASS** (fake AbacatePay; serve parado no fim) |
| Bundle sem segredo | `grep -rE "abc_(dev\|prod)_\|ABACATEPAY\|service_role\|PAYMENTS_CRON" web/.next/static` | **0 ocorrências** (0 arquivos) |
| Log das functions | grep `abc_dev`, `brCode` e `webhookSecret=` no log do `functions serve` da integração | **0 ocorrências**; só `{fn, orderId, status, outcome}` |
| Repositório | `gitleaks detect --source . --no-banner` | **"no leaks found"**, 264 commits, ~16 MB |
| Janela sandbox | `admin_set_setting('payments_env', …)` com claim de Master, no stack local, em transação com ROLLBACK | `sandbox` → `desligado`; valor final `desligado` |
| Fechamento da janela (runbook 8.1) | no stack local, em transação com ROLLBACK: `admin_set_setting` → `desligado`, listagem dos eventos com direito `sandbox/pago/ativo`, `payments_reapply_limits` | evento de teste 250/36 → 10/10, plano efetivo `gratis`; auditoria com o uuid de `'sub'` como ator e o motivo |

**Distribuição dos `outcome` no log da integração (rodada verde de 26 testes):**
- `cobranca_criada` 17, `aplicado` 13, `nao_aplicado` 5, `provedor_provider` 5, `nao_autenticado` 4, `reembolso_solicitado` 4;
- `duplicado` 2, `reusado` 2, `sem_cobranca` 2;
- 1 de cada: `ambiente_divergente`, `busca_incompleta`, `cobranca_adotada`, `cobranca_nao_confere`, `cobranca_nao_paga`, `ja_estornado`, `pagamento_indisponivel`, `pedido_desconhecido`.

**Coberto pela onda final (revisão do lote inteiro):**
- **Interruptor `desligado`:** direito `production` continua valendo e o Pix de produção pago com `desligado` sobe os limites (pgTAP 07 e 08); `sandbox` não vale em `production` nem em `desligado`; `redeem_code` em evento pago em produção com `desligado` → `ja_incluido` (pgTAP 10); `payments-refund` funciona com `desligado` (integração).
- **Conciliação incompleta:** `complete:false` não falha o pedido; a rodada completa seguinte falha (unit + integração).
- **Dinheiro divergente:** PAID com valor ou cobrança divergente marca `needs_refund` sem mudar o status, é reembolsável pelo Master com reconsulta PAID e fecha em `estornado` (pgTAP 08 e 09, unit, integração); a divergência não expira em 30 dias enquanto houver `needs_refund`.

**E2E de interface:** `master-payments`, `master-studio` e `master-codes` não foram reexecutados nesta rodada. O último resultado verde é o da Task 7 (4/4) e o da Task 7A (5/5), sem mudança de código desde então.

## Matriz H-01…H-17

O critério do plano exige, para fechar cada linha, a jornada pela interface no preview do SHA candidato. Teste automatizado sozinho não fecha a linha. Por isso **nenhuma linha está "aprovada"**: as linhas de backend estão "aprovadas localmente (fake)", à espera do sandbox e da jornada de interface.

| # | Cenário | Evidência | Ambiente | Físico ou emulado | Resultado |
|---|---|---|---|---|---|
| H-01 | Novo organizador entende a oferta e cria evento | — | — | — | **pendente — sessão memo-reverse-65 (feat/final-ui)** |
| H-02 | Compra sandbox aprovada libera exatamente o plano | Integração: "simulate-payment + webhook libera plano: effective_entitlement = casamento"; checkout cria pedido `pendente` com brCode, ~30 min e metadata `{orderId, eventId, planCode, env}`; pgTAP 08_payments (apply_status, 1 direito por pedido) | local, fake AbacatePay | emulado (sem navegador) | **Backend aprovado localmente.** Sandbox real: **BLOQUEIO EXTERNO** (sem chave; remoto não aplicado). Tela "Plano Casamento ativo": **pendente — sessão memo-reverse-65 (feat/final-ui)** |
| H-03 | Pendente, expirado e falho não liberam | Integração: provedor 500 → 502 com orderId, reconcile → `falhou`, novo checkout permitido; pgTAP 08 (expirado/falhou sem direito); pgTAP 07: UPDATE capacity=200 sem plano → MM012 | local, fake AbacatePay | emulado | **Backend aprovado localmente.** Expiração no sandbox (30 min): **BLOQUEIO EXTERNO**. Mensagens na tela: **pendente — sessão memo-reverse-65 (feat/final-ui)** |
| H-04 | Recarregar e voltar depois preserva o estado | Integração: mesma chave de idempotência → mesmo pedido e 1 create; `payments-status` reconsulta o provedor só depois de 15 s | local, fake AbacatePay | emulado | **Backend aprovado localmente.** Outro navegador e mesmo QR: **pendente — sessão memo-reverse-65 (feat/final-ui)** |
| H-05 | Clique repetido e webhook duplicado não duplicam | Integração: clique duplo concorrente → 1 create; webhook repetido 3x (mesmo id) + entregas novas → 1 direito; `payment_events` `duplicado` | local, fake AbacatePay | emulado | **Backend aprovado localmente.** Reenvio pelo dashboard AbacatePay: **BLOQUEIO EXTERNO** |
| H-06 | Isolamento | Integração: organizador B → `payments-checkout` 403 e `payments-status` 404; convidado anônimo → 403; pgTAP 07–10 (RPCs Master → MM004 para não-master; `redeem_code` → MM004 para quem não é anfitrião) | local, fake AbacatePay | emulado | **Backend aprovado localmente.** `/painel/<A>/plano` por B: **pendente — sessão memo-reverse-65 (feat/final-ui)** |
| H-07 | Quotas no servidor | pgTAP 07_entitlements e 01/02: excesso de `shots_per_person` → MM001; 12º convidado no Grátis → MM003; 11º entra pela tolerância (com 0% o 11º é recusado) | local (pgTAP) | emulado | **Aprovado localmente.** Repetir no remoto depois do `db push` |
| H-08 | Falha do provedor tem recuperação | Integração: "webhook perdido: reconcile aplica pago"; reconcile sem token → 401; pgTAP 09: `payments_schedule_reconcile()` só agenda com os dois segredos do Vault | local, fake AbacatePay | emulado | **Backend aprovado localmente.** Webhook desativado no sandbox e job real a cada 5 min: **BLOQUEIO EXTERNO** (sem chave; Vault e job não criados no remoto) |
| H-09 | Reembolso | Integração: `admin_request_refund` + `payments-refund` + webhook refunded → pedido e direito `estornado`, evento volta ao Grátis; repetido → 200 sem nova chamada; cancelado com `needs_refund` → `estornado` (Ruling 16); cobrança sem PAID → 422 `cobranca_nao_paga`; PAID com valor divergente → `needs_refund` → reembolso → `estornado`; reembolso com `payments_env='desligado'`; pgTAP 09: `audit_logs payment.refund_requested` | local, fake AbacatePay | emulado | **Backend aprovado localmente.** Reembolso no sandbox: **BLOQUEIO EXTERNO**. "Fotos e participantes intactos" não foi verificado explicitamente nesta rodada. Tela do Master: e2e da Task 7 (verde, não reexecutado) |
| H-10 | Cortesia | pgTAP 09: `admin_grant_courtesy` cria direito `cortesia/nenhum` com os limites do plano, audita `entitlement.courtesy_granted` e recusa não-master (MM004) e plano grátis (MM005) | local (pgTAP) | emulado | **Backend aprovado localmente.** UI M1: e2e da Task 7 (verde, não reexecutado). Remoto: depois do `db push` |
| H-11 | Convidado continua funcionando | — | — | — | **pendente — sessão memo-reverse-65 (feat/final-ui)** |
| H-12 | Câmera negada e rede caindo | — | — | — | **pendente — sessão memo-reverse-65 (feat/final-ui)** |
| H-13 | Acabamento visual | — | — | — | **pendente — sessão memo-reverse-65 (feat/final-ui)** |
| H-14 | Aparelhos físicos | — | — | — | **pendente — sessão memo-reverse-65 (feat/final-ui)**; sem aparelho registrado: **NO-GO físico** |
| H-15 | Segredos | Bundle 0 ocorrências; gitleaks "no leaks found" (258 commits); log das functions 0 ocorrências de chave, brCode ou segredo; runbook e relatório só com nomes de segredo | local | — | **Aprovado localmente.** Repetir o grep no build candidato do `newmemocuiaba` e nos prints da sessão memo-reverse-65 |
| H-16 | Modo desligado | Integração: `payments_env='desligado'` → checkout 503 `pagamento_indisponivel`, refund continua; pgTAP 09: `list_public_plans()` com desligado → só o Grátis; pgTAP 07/08/10: compra de produção continua valendo e Pix de produção pago sobe os limites; stack local depois do reset: `payments_env()` = `desligado`, 1 plano público | local, fake AbacatePay | emulado | **Backend aprovado localmente.** Tela "só Grátis e Fale com a gente": **pendente — sessão memo-reverse-65 (feat/final-ui)** |
| H-17 | Código de cortesia | pgTAP 10_courtesy_codes: código guardado só como hash e `code_hint`; resgate libera `codigo/nenhum` e audita `code.redeemed`; segundo evento ou código esgotado → `invalido` neutro; 5 falhas em 10 min → `muitas_tentativas` (serializado por usuário); evento encerrado → `evento_encerrado`; auditoria sem o texto tentado. M3: e2e da Task 7A (verde, não reexecutado) | local (pgTAP) | emulado | **Backend aprovado localmente.** Resgate em Ajustes: **pendente — sessão memo-reverse-65 (feat/final-ui)** |

### Linhas com bloqueio externo (sandbox real)

H-02, a parte sandbox de H-03, H-05, H-08 e H-09. Os motivos são dois:
1. não existe chave AbacatePay de sandbox;
2. o remoto não tem as migrations 001400–001800 nem as functions de pagamento.

Têm só evidência local contra a fake. Os pontos que **só o sandbox real confirma**, pendentes desde a Task 6:
- se o `check` real devolve `amount`. Se não devolver, a função usa `transparents/get`;
- se a listagem traz `externalId` ou `metadata.orderId` nos itens PIX. Se não trouxer, nada é adotado e o pedido vira `falhou`, que é o lado seguro;
- se o `webhookSecret` em hex é aceito como está na query string.

## Pendências técnicas (não exigem pessoa; exigem as condições acima)

1. Depois que o operador aplicar o passo 3: rodar as verificações SQL do runbook e repetir H-07, H-10 e H-16 no remoto.
2. Depois do passo 4: `functions list` com as 5 ACTIVE, e `payments-webhook` e `payments-reconcile` sem credencial → 401 (ou 503 antes dos segredos).
3. Com a chave sandbox: executar H-02, H-03, H-05, H-08 e H-09 pela interface do preview `newmemocuiaba` do SHA candidato, com prints sanitizados, contagens SQL e `orderId` nos logs. Depois, voltar `payments_env` para `"desligado"`.
4. Sessão memo-reverse-65: H-01, H-11–H-14 e a parte de interface de H-02, H-03, H-04, H-06, H-16 e H-17, no preview `newmemocuiaba`. Também o teste de restauração do backup `20261022-1902`.
5. Acrescentar `event-branding` ao script de backup (`backup_and_rotate.sh`, branch `feat/final-ops`).
6. Itens menores adiados no ledger: link "Revisar" nas divergências; busca de eventos na cortesia; limite de 200 linhas na lista de pagamentos; cancelamento de solicitação de reembolso que falhou. (`complete:false` do reconcile como "tentar depois": feito na onda final.)

## Obrigações que exigem atendimento humano

Separadas das pendências técnicas: nenhuma delas pode ser feita pelo agente.

1. **Aplicar as migrations e as functions.** O classificador bloqueou o agente. O operador roda os passos 1 a 4 do runbook: backup com `event-branding`, `migration list`, `db push --linked --dry-run`, `db push --linked --yes` e os dois `functions deploy`.
2. **Conta AbacatePay.**
   - Criar a conta e uma chave de **sandbox** (dev mode) com `TRANSPARENT:CREATE`, `TRANSPARENT:READ`, `REFUND:CREATE` e `WEBHOOK:CREATE`, e entregá-la só via `supabase secrets set --env-file` (passo 5).
   - Para produção: CNPJ (MEI/ME), site com contato, termos, privacidade e CNPJ no rodapé, aprovação de até 3 dias úteis e chave `abc_prod_` nova.
3. **Registrar o webhook** no sandbox (dashboard dev mode ou `POST /webhooks/create`), com URL `…/payments-webhook?webhookSecret=<hex>` e os 4 eventos `transparent.*`. Na produção, outro webhook com segredo novo.
4. **Segredos do Vault.** Criar `mm_payments_cron_token` (= `PAYMENTS_CRON_TOKEN`) e `mm_payments_reconcile_url` pelo painel e rodar `select public.payments_schedule_reconcile();` (passo 6).
5. **Backup e rotação.** Rotação de backups é manual, executada pelo operador a cada ≤ 30 dias; não é automação ativa. A alternativa persistente é instalar o LaunchAgent no Mac do operador, a partir do exemplo em `feat/final-ops` (persiste só com o Mac ligado). Também cabe ao operador incluir `event-branding` no backup.
6. **Legal e fiscal.** D3 (termos com cláusula de pagamento e reembolso), D5 (CNPJ e dados da empresa no rodapé e em `/ajuda`) e D6 (NFS-e). São decisões do dono e não foram tomadas pelo agente.
7. **Aparelhos físicos.** iPhone/Safari e Android/Chrome reais para H-11, H-12 e H-02 a partir do celular (H-14), com modelo e versão registrados.
8. **Janela de homologação.** Abrir `payments_env = "sandbox"` com motivo (passo 8) e fechá-la pelo passo 8.1: voltar a `"desligado"` e rodar `payments_reapply_limits` nos eventos de teste pagos no sandbox, listados pela consulta do runbook (nada é apagado). Não há tela no Master para mudar `payments_env`; a auditoria registra como ator o uuid posto em `'sub'`.

## Parecer GO/NO-GO do lote de pagamentos (seção 7 do plano)

**NO-GO para o sandbox real.** Os motivos:
1. Não existe chave AbacatePay de sandbox (bloqueio externo).
2. O remoto não tem as migrations 001400–001800 nem as 5 functions de pagamento: a aplicação pelo agente foi bloqueada pelo classificador e cabe ao operador.
3. A matriz não tem evidência pela interface no preview do SHA candidato: H-01 e H-11–H-14 são da sessão memo-reverse-65. Sem aparelho físico, o parecer é também **NO-GO físico**.

**Prontidão técnica comprovada localmente:**
- pgTAP 968/968, web 342/342, functions 51/51 e integração de pagamentos 26/26 contra a fake;
- typecheck, lint (0 erros) e build com saída 0;
- bundle e log sem segredo; gitleaks limpo.
- A integração cobre, contra a fake AbacatePay e sem chave real:
  - checkout idempotente;
  - webhook autenticado e deduplicado;
  - divergência de ambiente;
  - recuperação por conciliação, inclusive do create sem resposta;
  - reembolso com reconsulta do provedor, inclusive de PAID divergente e com `desligado`;
  - isolamento entre organizadores;
  - modo desligado.

**Para virar GO do sandbox:**
1. o operador executa os passos 1 a 7 do runbook com a chave sandbox;
2. as linhas H-02, H-03, H-05, H-08 e H-09 são executadas pela interface do preview `newmemocuiaba` e preenchidas com evidência;
3. a sessão memo-reverse-65 fecha as linhas de interface e H-14 com aparelhos físicos.

**Produção.** Continua fora de escopo. Exige ainda D3, D5 e D6, a seção 6 do plano completa e a autorização explícita do dono. A cobrança pública permanece **desligada**.

**Limitações externas e decisões comerciais.**
- Limitações externas: chave AbacatePay, bloqueio do classificador, Vercel (com a sessão memo-reverse-65) e aparelhos físicos.
- Decisões comerciais pendentes: D3 a D7.
- Nenhuma delas foi tomada ou simulada aqui.
