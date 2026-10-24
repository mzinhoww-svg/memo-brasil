# Jornada de pagamento mobile (Checkout Pro) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (execução autônoma já autorizada pelo dono no chat; não há parada de revisão entre tarefas). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Fechar as lacunas mobile da jornada plano → resumo → Checkout Pro → retorno → liberação, sem trocar provedor, preços ou regras.

**Architecture:** Mantém redirecionamento de página inteira para o Checkout Pro (sem pop-up) e confirmação só pelo backend. Extrai a abertura/retorno externos para uma ponte (`CheckoutBridge`) que a versão web implementa e um app Capacitor poderá substituir. Ajusta UI/CSS e estados de erro de `PlanPicker`, `CheckoutPending` e `plano/page.tsx`.

**Tech Stack:** Next.js (App Router), React, vitest + Testing Library, Playwright (E2E com fake do Mercado Pago local), CSS em `web/src/styles/app.css`.

**Spec:** pedido do dono no chat (2026-10-24, "Incorpore à integração Mercado Pago… otimização completa da jornada de pagamento para mobile") + `docs/superpowers/specs/2026-10-23-mercadopago-design.md`.

## Global Constraints
- Checkout Pro com redirecionamento; sem formulário próprio de cartão, sem segundo checkout, sem pop-up.
- Preços, planos, regras e textos comerciais existentes preservados (Festa R$ 29, Celebração R$ 89, Casamento R$ 189, Grande R$ 349).
- Liberação do plano só pelo backend; `?retorno=` é só dica de texto.
- Não alterar telas fora da jornada de pagamento; preservar home e convite/PDF das outras sessões.
- Pix e cartão: oferecer só o que o Checkout Pro oferece (sandbox não paga Pix; Pix exige chave Pix do vendedor).
- Viewports de verificação: 360, 390 e 430 px de largura; alvos de toque ≥ 44 px; sem rolagem horizontal.
- Não declarar teste em aparelho físico nem compatibilidade nativa sem execução.

## Review Focus
- Clique duplo/toque repetido em "Pagar": exatamente um pedido e uma navegação. (Task 2)
- Voltar do Mercado Pago pelo botão/gesto do sistema (bfcache) com o pedido já pago ou ainda pendente: tela reflete o servidor, sem spinner eterno. (Task 3)
- Falha de rede ao consultar o status: aviso visível com ação manual "Atualizar", sem travar. (Task 3)
- Pedido pendente sem `checkoutUrl`: ação "Atualizar" em vez de texto sem saída. (Task 3)
- Botão de pagar encoberto pela barra do aparelho/teclado em 360 px: CTA com `safe-area-inset-bottom`. (Task 4)

---

### Task 1: Ponte de abertura/retorno do checkout (`CheckoutBridge`)

**Files:**
- Modify: `web/src/features/billing/checkout-nav.ts`
- Test: `web/src/features/billing/checkout-nav.test.ts`

**Interfaces:**
- Produces: `interface CheckoutBridge { open(url: string): void; resumeEvents(onResume: () => void): () => void }`; `export const webCheckoutBridge: CheckoutBridge`; `export function setCheckoutBridge(b: CheckoutBridge): void`; `export function getCheckoutBridge(): CheckoutBridge`; `goToCheckout(url)` continua exportada e delega à ponte atual.
- `resumeEvents` registra retorno ao app: na web, `visibilitychange` visível e `pageshow` com `persisted`; devolve função de limpeza.

- [ ] **Step 1: Write the failing test** — `checkout-nav.test.ts`: (a) `goToCheckout` chama `getCheckoutBridge().open` com a URL; (b) `setCheckoutBridge` substitui a implementação e `goToCheckout` usa a nova; (c) `webCheckoutBridge.resumeEvents` chama o callback em `pageshow` com `persisted: true` e em `visibilitychange` quando visível, e não chama após a função de limpeza.
- [ ] **Step 2: Run** `cd web && npx vitest run src/features/billing/checkout-nav.test.ts` — Expected: FAIL (exports ausentes).
- [ ] **Step 3: Implement** a ponte em `checkout-nav.ts`; `open` usa `window.location.assign`. Documentar no cabeçalho que um app nativo troca a ponte (browser in-app / Custom Tabs / ASWebAuthenticationSession) sem mexer na UI.
- [ ] **Step 4: Run** o mesmo comando — Expected: PASS.
- [ ] **Step 5: Commit** `feat(pagamentos): ponte CheckoutBridge para abertura e retorno do checkout`.

### Task 2: Resumo do pedido, botão fiel e proteção contra clique duplo

**Files:**
- Modify: `web/src/features/billing/PlanPicker.tsx`, `web/src/app/painel/[id]/plano/page.tsx`
- Test: `web/src/features/billing/plano-ui.test.tsx`; ajustar `web/e2e/payments.spec.ts`, `web/e2e/plano-mercadopago.spec.ts`, `web/e2e/produto-planos.spec.ts` e demais que usem o rótulo "Pagar R$ …"

**Interfaces:**
- Consumes: `formatBRL(cents: number): string` de `./api`.
- Produces: bloco `data-testid="resumo-pedido"` com plano, total e "Pagamento único" (sem assinatura); botão com texto `Pagar com Mercado Pago · R$ 29,00` (acessível: `aria-busy` e rótulo `Abrindo o Mercado Pago…` enquanto `busy`).

- [ ] **Step 1: Write the failing test** em `plano-ui.test.tsx`: (a) com Festa escolhida existe `resumo-pedido` contendo "Festa", "R$ 29,00" e "Pagamento único"; (b) o botão se chama `Pagar com Mercado Pago · R$ 29,00`; (c) com `busy` o botão fica `disabled`, `aria-busy="true"` e mostra "Abrindo o Mercado Pago…"; (d) dois cliques seguidos chamam `onPay` uma vez no componente de página (teste do handler com guarda de reentrada).
- [ ] **Step 2: Run** `npx vitest run src/features/billing/plano-ui.test.tsx` — Expected: FAIL.
- [ ] **Step 3: Implement** o resumo e o rótulo em `PlanPicker.tsx`; em `plano/page.tsx` proteger `pay()` com `useRef` de reentrada (ignora chamadas enquanto uma está em curso) e usar `goToCheckout` da ponte.
- [ ] **Step 4: Run** testes unitários e atualizar as specs E2E que referenciam o rótulo antigo — Expected: PASS.
- [ ] **Step 5: Commit** `feat(pagamentos): resumo do pedido, 'Pagar com Mercado Pago' e guarda contra clique duplo`.

### Task 3: Estados de retorno, rede e recuperação em `CheckoutPending`

**Files:**
- Modify: `web/src/features/billing/CheckoutPending.tsx`
- Test: `web/src/features/billing/plano-ui.test.tsx` (ou novo `checkout-pending.test.tsx`)

**Interfaces:**
- Consumes: `getCheckoutBridge().resumeEvents(cb)` (Task 1).
- Produces: aviso `data-testid="sem-conexao"` após 3 consultas de status seguidas falhando, com botão "Atualizar" que consulta na hora; no pendente sem `checkoutUrl`, botão "Atualizar"; ao voltar ao app (`resumeEvents`) consulta o status na hora.

- [ ] **Step 1: Write the failing test**: (a) `orderStatus` rejeitando 3 vezes mostra `sem-conexao`, e o botão "Atualizar" volta a consultar e some o aviso quando responde; (b) pendente sem `checkoutUrl` mostra botão "Atualizar" (não só texto); (c) disparar o callback de `resumeEvents` consulta o status uma vez; (d) pedido que vira `pago` na consulta mostra `checkout-pago` com link "Voltar ao painel".
- [ ] **Step 2: Run** o arquivo — Expected: FAIL.
- [ ] **Step 3: Implement** contador de falhas consecutivas em `useOrderPolling` (expõe `failures` e `refresh`), o aviso, o botão e o registro de `resumeEvents`.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `feat(pagamentos): aviso de rede, atualizar manual e retomada ao voltar do Mercado Pago`.

### Task 4: Layout mobile (360/390/430), CTA com área segura e alvos de toque

**Files:**
- Modify: `web/src/styles/app.css` (apenas blocos `.plano-*` e `.mm-btn` na jornada de plano)
- Create: `web/e2e/pagamento-mobile.spec.ts`

**Interfaces:**
- Produces: CTA do plano fixo na base em telas estreitas com `padding-bottom: max(16px, env(safe-area-inset-bottom))`; alvos de toque ≥ 44 px; `overflow-wrap:anywhere` nos nomes longos.

- [ ] **Step 1: Write the failing test** `pagamento-mobile.spec.ts` (Playwright, fake do Mercado Pago, viewports 360×740, 390×844, 430×932): plano com nome de evento de 80 caracteres; asserta (a) `document.documentElement.scrollWidth <= innerWidth`; (b) o botão de pagar e os radios têm altura ≥ 44 px; (c) o botão está inteiro dentro da viewport sem rolar; (d) com o teclado simulado (viewport reduzida a 360×420) o botão continua acessível por rolagem. Salva capturas em `docs/evidence/pagamento-mobile/`.
- [ ] **Step 2: Run** `npx playwright test pagamento-mobile` (modo Supabase local do runbook §12) — Expected: FAIL em pelo menos um viewport.
- [ ] **Step 3: Implement** os ajustes de CSS mínimos para cada falha observada.
- [ ] **Step 4: Run** — Expected: PASS nos três viewports.
- [ ] **Step 5: Commit** `fix(pagamentos): layout mobile da jornada de plano (360/390/430) e CTA com área segura`.

### Task 5: Documentação nativa, runbook, backlog e verificação final

**Files:**
- Create: `docs/design/PAGAMENTO-MOBILE-NATIVO.md`
- Modify: `docs/supabase/PAYMENTS-RUNBOOK.md`, `docs/backlog/backlog.json`

- [ ] **Step 1:** Escrever `PAGAMENTO-MOBILE-NATIVO.md`: ponte `CheckoutBridge`, URLs de retorno por esquema/universal link, ciclo de vida (retomar → consultar status), o que depende de teste no app e de regras das lojas (bens digitais/compra no app), e a separação fake × sandbox × emulação × aparelho físico, com o que NÃO foi testado.
- [ ] **Step 2:** Rodar `npx tsc --noEmit`, `npx eslint .`, `npx vitest run`, `npx vitest run --config vitest.functions.config.ts` e a suíte Playwright do modo Supabase — Expected: tudo verde.
- [ ] **Step 3:** Atualizar o backlog (itens novos PAY-MOB-*) e o runbook (§18).
- [ ] **Step 4: Commit** `docs(pagamentos): jornada mobile, adaptação nativa e evidências`.
- [ ] **Step 5:** Candidato `target=production` do SHA final (procedimento do PUBLISH-AND-ROLLBACK §7), validação, promoção, smoke e `main` por fast-forward, coordenando com a sessão d0.
