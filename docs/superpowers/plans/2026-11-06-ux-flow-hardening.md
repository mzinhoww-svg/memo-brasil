# UX flow hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or executing-plans.

**Goal:** Close the 25 audited flow/design reliability items and publish verified improvements to newmemocuiaba.

**Architecture:** Bounded repairs in existing components, read-only receipt enrichment and additive catalog/moderation migrations. Five isolated implementation worktrees integrate into one reviewed branch.

**Tech Stack:** Next.js16.4.2, React19, TypeScript, Supabase/PostgreSQL/Edge Functions, Vitest, Playwright.

**Spec:** docs/superpowers/specs/2026-11-06-ux-flow-hardening-design.md

## Global Constraints
- Preserve Next.js/React/Supabase/ValidaPay and the current MemoriesMT visual identity; do not add dependencies without concrete need.
- Prices and limits of commercial plans stay unchanged. Remove only the identified test offer from productive availability; never delete plans, financial rows or entitlements.
- Financial POSTs are never automatically retried. Uncertain attempts keep order identity; production refund creation stays blocked. No fabricated paid states or real test charges.
- No impersonation of productive users, no secret values in reports/logs/source, no direct writes by workers to hosted services.
- Every async action must reach a recoverable, terminal or explicit pending state; retain user input and distinguish network, not-found and access errors.
- Local photo drafts are keyed by event and current user, expire within 24h, clear on successful send/explicit discard, and must not leak between identities. Storage failures require honest fallback.
- Work only in the assigned isolated worktree/owned files. Root integrates commits and performs hosted migrations/deploy.
- Tests must cover the actual reported failure and be observed RED before implementation; targeted tests use at most 2 workers. Root executes the full integrated suite and browser checks.
- User explicitly requested autonomous end-to-end execution and parallel work; no design/permission checkpoint for routine reversible implementation decisions.

## Review Focus
- Async rejection before an operation begins must preserve input and enable retry.
- Recovered financial states must never encourage duplicate charging or infer entitlement.
- A blocked identity cannot re-enter/post through another route; another event's host cannot control it.
- Local drafts cannot cross user/event boundaries or be silently lost during network failure.
- More than50 rows, partial exports, midnight/revelation boundaries and invalid dates must remain truthful.

## Task 1: Onboarding, public journey and recovery

**Audit IDs:** A06 A08 A23 A24 A25 A22(marketing) A14(Pronto)

**Requirements and files:** Own wizard.tsx, wizard-input.ts and related tests; features/events/service.ts only createEvent; app/criar/pronto/[id]/page.tsx; app/auth/callback/route.ts; home login-error recovery; features/marketing/PrecosView.tsx/PricingLine.tsx; SiteFooter; app/ajuda/page.tsx. Do not touch photo service, checkout component, repositories, panels or master.
Implement complete try/catch/finally around create; validate explicit Other date finite/nonempty; explain desired photos versus effective Free limit and offer explicit plan recommendation without silent upgrade; show reliable retry for Pronto read errors. Preserve a safe intended path through OAuth failure with actionable retry (reject //, backslash/external destinations). Add visible public Prices navigation and truthful current-provider copy; FAQ must say own photos remain guarded until revelation and visibility depends on event rules. Keep event creation idempotent existing constraints; no new paid order from validation.
Tests: profile/code lookup rejection releases busy/preserves fields; Other date empty stays on step; quantity/recommendation shows true limits; OAuth invalid/safe destinations; public copy/nav; Pronto error/retry distinct from not-found.

- [ ] Write failing regression tests for the reported states.
- [ ] Observe RED with targeted command.
- [ ] Implement bounded changes and preserve interfaces/global constraints.
- [ ] Run targeted tests and self-review.
- [ ] Commit owned files and provide report.
- [ ] Controller integrates, reviews task and marks closure matrix.

## Task 2: Payment state and truthful fulfillment

**Audit IDs:** A09 A10 A11 A12 A13 A22(pending)

**Requirements and files:** Own ValidaPayCheckout.tsx/tests, validapay-client.ts, billing/types.ts/api.ts only receipt/disposition mapping, CheckoutPending.tsx and its tests. Own supabase/functions/payments-validapay/index.ts only safe receipt readback; additive migration 20261107000200_payment_receipt_disposition.sql and SQL tests for it. Do not touch provider transport/money/idempotency/HMAC/refund write or marketing owned by task1.
Unify restored order plan/value/method; mismatched created orders must explain conflict and allow abandonment only when server says canAbandon. Add retry of initial configuration/recover/quote. An uncertain criado/canAbandon=false needs manual/poll status and pending wording, no request for new financial submit/card data. Clear obsolete submit error when readback recovers paid. Return/render needsRefund:boolean and entitlementActive:boolean from actual read-only entitlement existence, not paid-status inference; fields optional in types only for compatibility but unknown cannot assert active. Preserve RPC auth/owner guards. Extend public payments_order_status JSON additively for safe disposition so legacy receipt can show paid-but-unfulfilled/refund pending honestly. Production refund POST remains forbidden. Provider-specific pending instructions depend on order.provider. Improve safe recoverable card/3DS error wording where possible, no secret/provider payload leakage.
Tests: submit timeout→paid has success without error; created uncertain consultation/no secondPOST; quote/recover retry; mismatched plan displays actual reservation; needsRefund/unfulfilled never claims active; legacy provider copy preserved; SQL RPC owner/auth grants unchanged.

- [ ] Write failing regression tests for the reported states.
- [ ] Observe RED with targeted command.
- [ ] Implement bounded changes and preserve interfaces/global constraints.
- [ ] Run targeted tests and self-review.
- [ ] Commit owned files and provide report.
- [ ] Controller integrates, reviews task and marks closure matrix.

## Task 3: Resilient photo send, drafts and camera

**Audit IDs:** A02 A03 A21 A20(postar)

**Requirements and files:** Own app/e/[code]/(app)/postar/page.tsx, features/photos/service.ts ONLY post/postLocked/upload preflight (leave reportPhoto to task4), features/photos/capture.ts, new local draft module/tests. Do not modify repository interfaces/adapters or invite/guest layouts.
Bring preflight count/reserve into typed network recovery and catch unexpected UI rejects; busy always recovers. Persist per-event/per-current-user draft bytes+caption+moment+attempt metadata required for retry in a dedicated IndexedDB store; TTL24h, clear on confirmed post or explicit discard, handle quota/unavailable storage honestly with exit guard. Restore via explicit resume/discard UI; avoid double reservation on resumed attempts and never claim sent before finalization. Guard navigation/reload with unsaved bytes, revoke preview resources correctly. Differentiate permission-denied, missing/occupied/transient camera and preserve gallery fallback. Derive audience/revelation copy from event.everyoneSeesAll/reveal status: when restricted, author+organizer, not everyone; before reveal photos guarded.
Tests: counts/reserve/bytes/finalize failure recovery; draft remount/reload/current-user separation/TTL/discard/successclear/storagefailure; stable retry identity; camera NotReadable/Abort vs denied; visibility copy. Report interface needs before touching another owner's file.

- [ ] Write failing regression tests for the reported states.
- [ ] Observe RED with targeted command.
- [ ] Implement bounded changes and preserve interfaces/global constraints.
- [ ] Run targeted tests and self-review.
- [ ] Commit owned files and provide report.
- [ ] Controller integrates, reviews task and marks closure matrix.

## Task 4: Persistent moderation and public catalog

**Audit IDs:** A01 A04 A05

**Requirements and files:** Own repositories/types.ts, memory/indexeddb/Supabase adapters, features/admin/service.ts only removeGuest/block/unblock; features/participants/service.ts; host painel/[id]/convidados/page.tsx; photos/service.ts ONLY reportPhoto and necessary import; photos/components.tsx report action feedback. Own additive migration 20261107000100_catalog_and_moderation.sql and SQL tests. Do not edit guest invite page (task5), postar/capture (task3), financial handler/migration (task2).
Disable productive availability only for identified code teste1real at price100 cents (guard name/test conditions if needed); retain plan, price, orders and rights. Do not pattern-hide legitimate commercial offers. Use existing report_photo RPC from Supabase path with honest success/error and at-most-once per UI action. Implement persistent blocked state recognized by local/Supabase join and post permissions; do not delete participant to block. Prefer optional capability methods to avoid breaking repository implementations, but blockedAt?:number metadata must persist locally and be returned for host management. Provide explicit unblock UI. Existing blocked_at server column/guards should be reused; new RPCs must enforce host auth, event scope, grants/RLS. Expose join reason bloqueado when needed and notify controller/task5 so UI maps it safely.
Tests: remove/block→sameidentity cannot join/post; unblock permits; otherhost cannot block/unblock; existing event/photo history preserved; report uses RPC not generic photo update and failure shown; no inactive test offer public/quotable; paid history unchanged. Local adapters must agree with cloud contract.

- [ ] Write failing regression tests for the reported states.
- [ ] Observe RED with targeted command.
- [ ] Implement bounded changes and preserve interfaces/global constraints.
- [ ] Run targeted tests and self-review.
- [ ] Commit owned files and provide report.
- [ ] Controller integrates, reviews task and marks closure matrix.

## Task 5: Guest entry, panel recovery, exports and admin navigation

**Audit IDs:** A07 A14(layouts) A15 A16 A17 A18 A19 A20(invite)

**Requirements and files:** Own guest app/e/[code]/page.tsx and app/e/[code]/(app)/layout.tsx; host painel/[id]/layout.tsx; features/invitations/invite-copy.ts; app/offline/page.tsx; downloads page/export helper/app copy; master data/list modules/ui; panel configuracoes destructive confirmations and Sheet/ConfirmSheet focus; event hooks only if essential (coordinate first). Do not touch wizard/Pronto(marketing task1), postar/capture/photos service(task3), repositories/block participants/task4, billing(task2).
Validate trimmed guest name before busy and catch/finally every enter await; keep input/consent and recover from network; handle bloqueado reason from task4. Read data.error before notfound/access in guest/host layouts and retry same event; offline retry should retain original safe internal destination. Export must report saved+missing and recover after preparation failures, never claim complete on partial. Master list pages must paginate/search server-side and reveal-pending queries must filter/count independently of a first50 batch (not load all private rows to client). Explain actual date/audience consequence of End now, and focus cancel/safe action on destructive dialogs. Invite copy agrees with author+host restricted visibility and own-photo reveal rule. Add direct Meus eventos navigation when sensible.
Tests: blank name correction recovers; network vs404 vsauth states andretry; ZIP partial/preparationerror; >50 list/pending fixture pagination; End now anchor+0 vsfixed consequence; focus safe/cancel; audience strings. No destructive actions or actual cloud accounts in tests.

- [ ] Write failing regression tests for the reported states.
- [ ] Observe RED with targeted command.
- [ ] Implement bounded changes and preserve interfaces/global constraints.
- [ ] Run targeted tests and self-review.
- [ ] Commit owned files and provide report.
- [ ] Controller integrates, reviews task and marks closure matrix.

## Task 6: Flow and design explanation

- [ ] Produce docs/design/UX-FLOW-IMPROVEMENTS.md and standalone guide with before/after decisions, map and success metrics.
- [ ] Separate implemented corrections from future product opportunities.

## Integration and publication

- [ ] Combine commits and resolve shared photo-service import/function boundaries.
- [ ] Perform per-task and whole-branch review, remediate material findings.
- [ ] Full web/function/SQL tests, types/lint/build, focused browser flows desktop/mobile.
- [ ] GitHub PR+CI, authorized merge, guarded additive migrations and required function deploy.
- [ ] Confirm newmemocuiaba Ready/current commit, health/copy/catalog and produce A01–A25 closure evidence.
