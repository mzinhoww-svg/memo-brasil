# MemoriesMT V3 — Mercado Pago integration | audit and release gate

Date: 2026-10-24. Branch: `feat/payment-v3-appllama-mercadopago`. **No production promotion.**

## Verified connections

- Mercado Pago OAuth MCP: two applications listed. `1592042337972998` (App-Checkout-Transparente-20261023-346d726106) is explicitly recorded in `docs/payments/MERCADOPAGO-INTEGRATION.md` as the app currently used; `2913393311286674` (MemoriesMT-CheckoutPro) is not used. **Do not switch app IDs or credentials automatically**.
- Official MCP `notifications_history(1592042337972998)` reports 4 deliveries, all HTTP 200 (3 payment, 1 merchant order). Delivery HTTP 200 is not evidence of signature validation, DB reconciliation or entitlement. Check `payment_events` and provider status separately.
- Supabase project `asyaegeodyttttaubvxh` has 25 migrations as of this audit, seven payment Edge Functions deployed, and `public.payments_env()` returned `production`. This does **not** establish which plans are `production_active`; the change must never enable them implicitly.
- The actual public catalog returned by Supabase is Free 10 guests/R$0, Festa 30/R$29, Celebração 100/R$89, Casamento 250/R$189, Grande 500/R$349, plus a distinct test-only 30/R$1 plan. The V3 code excludes `teste*` from public capacity recommendations, but the **server remains authority for product eligibility and price**.
- The previous V3 prototype was intentionally a simulation of Pix/card, not a payment SDK. No production pricing change is authorized.

## Implemented in this branch

- `web/src/features/billing/v3-plan.ts`: capacity tiers and recommendation logic derived entirely from `listPublicPlans()`; returns Grande 500 for 272 guests; explicitly excludes `teste*`.
- `web/src/features/billing/v3-plan.test.ts`: boundary tests for real Free 10, 272->500, insufficiency, upgrade, malformed input.
- `web/src/features/billing/V3PaymentJourney.tsx` and CSS Module: responsive Event Studio context, guest count, personalized event title/date, premium presentation, benefits, actual quote, payment method explanations, summary, error handling.
- `web/src/app/painel/[id]/plano-v3/page.tsx`: isolated route behind the existing organizer/owner layout.
- Existing `web/src/app/painel/[id]/plano/page.tsx` offers a link to the V3 route (branch only).

The V3 user can preview a plan and start a real Mercado Pago **Checkout Pro** order via `startCheckout()` — only if the authoritative quote allows the upgrade and the server environment/plan is enabled. The order URL is verified and opened by the existing `goToCheckout` bridge. Status recovery uses existing `CheckoutPending`, which calls `payments-status`; payment rights are conferred only by existing server-side reconciliation and RPCs. The client does not handle card PAN/CVV or privileged keys.

## Important limitation — hosted Checkout Pro versus embedded Checkout Bricks

The Paywall V3 visual concept contains internal Pix QR and card form, but the existing system uses **hosted Checkout Pro**. The V3 page therefore shows *informational* Pix/card selectors and transparently states that the **effective payment method is selected at Mercado Pago**. It does NOT mint Pix BR Code, tokenize a card, call Payment Bricks, or select a method in Checkout Pro. The current provider decides available methods.

To implement the exact embedded design: plan a **separate Checkout Bricks/Payments API project** with integration/mode compatibility validation, tokenization, seller/payer separation, webhook signing, payment creation idempotency, persistence of method-specific state (including genuine Pix `qr_code` and `qr_code_base64`), and regression on refunds/chargebacks/entitlements. Never silently route Payments API results through the Checkout Pro preference schema; a new contract and compatible migrations are required. Production stays on Checkout Pro until complete E2E and financial approval. Use Mercado Pago MCP official documentation and quality checklist before choosing the migration.

## Issues requiring sign-off before selling

- `docs/payments/GO-LIVE-REPORT.md` and `docs/payments/LAUNCH-CRITERIA.md` describe pending controlled production refund, actual webhook-to-DB proof and card/Pix acceptance. Latest verification: Mercado Pago MCP shows 4 HTTP-200 webhook deliveries, a **new signal**; evaluate if these correspond to real payment events in the DB, without assuming they do.
- Full secure sandbox and controlled purchase/refund, only with explicit user approval for real charges. Do not charge the operator just to test the design.
- Pix only if the seller is eligible and the method actually appears in Checkout Pro; do not claim Pix is guaranteed.
- Verify that no seller account pays itself; MP can disable pay buttons for payer=seller.
- Refund/terms/benefits/retention/legal text must match approved policy.
- Current Checkout Pro back URLs may return to legacy `/painel/[id]/plano`. Decide whether to preserve this compatibility or version the return URL; V3 must recover purchase state without duplicating an order.
- Commercial naming: DB code is `grande` and name `Grande`; V3 headline "Premium · Grande" is a **UX label**, not a new SKU. No change to DB.
- Prior generated photos are illustrative and not licensed as production photography. V3 branch uses abstract cover artwork plus the real event's text/date; future integration with owned cover assets requires attribution and access control.

## QA status: pending

Files committed in GitHub, but no reliable execution of `npm test`, `npm run typecheck`, `npm run lint`, browser screenshots or sandbox E2E was available through this ChatGPT session. Do not report those as PASS. Run:
1. `cd web && npm ci && npm run typecheck && npm run lint && npm test -- --run` (or use established project commands).
2. Specific `v3-plan.test.ts`, `plano-ui.test.tsx`, existing billing/MP integration tests.
3. Playwright desktop/mobile at 320/375/390/430/768/1024/1440/1920, iOS Safari/Android Chrome when possible; URL and screenshot evidence.
4. Organizer alone can order; guest/anon cannot. All quotas from server. Fresh and expired orders, retry, parallel requests, idempotency, refresh, upgrade, refunds, disputes.
5. Verify hosted Checkout Pro return URLs and no redirect loop or stale payment UI.
6. Confirm admin feature flags, active plan, webhook signature and reconciliation before any payment exposure.

## AppLlama evidence references (read from actual MCP)

- POV Event Camera, paywall `1636032890/pay_pkrtk`, plan cards and pill publish CTA.
- Evite `431685286/pay_u79jo`, pricing tiers by guest counts and sticky order totals.
- Partiful `1662982304/oth_o7osh`, event cover/customization.
- Too Good To Go `1060683933/oth_dtd40`, payment radio list, order summary and CTA.
- Retro `6443709020/pay_815nd`, premium image storytelling.
- Wolt `943905271/oth_hsgsf`, receipt and pay CTA.

The earlier original prototype and visual QA screenshots exist in the user deliverable kit `memoriesmt-appllama-v3-kit.zip`. Do not claim those visuals are the live site.

## GO / NO-GO

**No merge, no production promotion, no payment method migration, no price change yet.**
This branch provides **partial functional integration with the existing hosted Checkout Pro**. Fully embedded Pix/Card and end-to-end remote checkout are not done. Open a draft PR for review and continue with Superpowers in Claude Code or a CI-capable Work session. Do not mark payment integration 100% complete without the provider-approved proof.
