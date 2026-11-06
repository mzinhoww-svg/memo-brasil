# ValidaPay Implementation Plan

**Goal:** Checkout transparente com confirmação financeira validada no backend.
**Architecture:** Adaptador aditivo ao fluxo Mercado Pago; RPCs transacionais e UI protegida.
**Tech Stack:** TypeScript, Next.js 16, React 19, Supabase/PostgreSQL/Deno, Vitest, Playwright.
**Spec:** docs/payments/VALIDAPAY-DESIGN.md e missão anexada pelo usuário.

## Restrições globais
Não operar produção, não estornar dinheiro real, não modificar histórico financeiro.
Documentar bloqueios; não apresentar mocks como homologação. Não criar worktree.

## Revisão prioritária
Timeout depois da criação deve reutilizar externalId; valor fracionário inválido
deve ser recusado; webhook futuro/repetido deve ser rejeitado/deduplicado;
pedido histórico deve permanecer no adaptador MP; falha 3DS não pode cobrar.

## Tarefas
- [x] Conversão monetária central `centsToReais`/`reaisToCents`: testes de 1 centavo,
  R$189,00, limites do banco, NaN, negativos, decimais além de duas casas.
- [x] Adaptador puro: OAuth sandbox explícito, cache por instância, single-flight,
  timeout, payload allowlist, idempotência e recuperação 409; testes RED→GREEN.
- [x] HMAC: bytes brutos, timestamp, comparação constante e testes de adulteração,
  replay, assinatura inválida e timestamp futuro.
- [ ] RPCs e Edge Functions: novo provedor sem alterar histórico; integração em
  PostgreSQL isolado antes de aplicação remota. Preço e autorização no banco.
- [ ] Interface: SDKs oficiais, 3DS, Pix, retomada e flag desligada. Testes unitários
  e navegador mobile/desktop; nenhuma credencial privilegiada no cliente.
- [ ] Homologação real sandbox: OAuth, Pix aprovado/expirado/cancelado, cartão
  aprovado/recusado/3DS e estorno sandbox documentado. Bloqueada sem credenciais válidas.
- [ ] Rodar suites existentes, typecheck/lint/build, revisar, abrir PR draft e
  registrar evidências, rollback e NO-GO enquanto critérios estiverem pendentes.

Cada implementação começa por teste falhando, seguido de código mínimo e suíte
aprovada; commits por entrega. Não iniciar integração remota sem projeto isolado.

## Registro de execução

Implementação inline, com revisão independente de código. A autorização explícita
de autonomia da missão substitui os gates conversacionais das skills.

- RPCs/migration aplicadas apenas no PostgreSQL descartável local; testes SQL e
  regressão Mercado Pago passaram. Edge Functions verificadas pelo Deno, não publicadas.
- UI e SDKs implementados com flags desligadas. Testes de componente/contratos e
  navegador no estado bloqueado executados; UI ativa com PSP não homologada.
- Credenciais sandbox fornecidas durante a execução: OAuth 200; Pix criado/pago/
  cancelado; SDK real tokenizou e API aprovou/recusou cartão diagnóstico sem 3DS.
- Prova real Pix + banco local: preço do banco, confirmação reconsultada e benefício
  único. Transação local revertida. Entrega de webhook não comprovada.
- Ruling: usar externalTxid=UUID do pedido como referência comercial adicional,
  verificada no detalhe. O sandbox retornou 409 entre externalIds distintos;
  confiar só no chargeId retornado poderia vincular dinheiro de outro pedido.
- Ruling: cartão do produto exige 3DS no browser e backend. O SDK da conta sandbox
  retornou null; diagnóstico sem 3DS não muda essa política nem autoriza produção.
- Revisão encontrou retomada incerta, repetição após expiração, CSP, backoff,
  divergência financeira, 3DS server-side e cancelamento antes da verificação de
  vínculo. Foram criados testes de regressão e aplicadas correções.
- Estorno/revogação sandbox implementados com reserva única e valor do banco
  verificado antes de POST; prova real de R$1,42 + RPC local confirmou revogação
  idempotente. Testes cobrem estorno antes de PAID e confirmação repetida.
- Etapa A continua aberta pelos gates de VALIDAPAY-RUNBOOK.md: validação HTTP da
  UI ativa, Supabase remoto, 3DS, webhook real, CI e preview ainda pendentes.
