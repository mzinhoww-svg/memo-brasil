# UX and flow reliability design

User mandate: “Ajuste tudo, faça sozinho do inicio ao fim. Em paralelo preciso entender o que aprimorar de fluxo e de design”.

## Goal
Resolve all 25 items of the audit at /workspace/scratch/ux-audit-newmemocuiaba/AUDITORIA-FLUXOS.md and explain the resulting flow/design improvements. Target deployment is newmemocuiaba.

## Approach
Repair existing components and contracts in bounded independent batches rather than replace the product architecture. Keep the creation-at-Free rule and make intent versus effective capacity explicit. Preserve provider history and financial invariants. Use common recovery patterns, reliable per-user drafts, explicit moderation actions and truthful receipts.

## Decisions made under delegated autonomy
- The exact teste1real offer at 100 cents is homologation inventory; disable its productive availability without deleting it or changing its price/history.
- Photo quantity in the wizard is a recommendation, not a silent paid upgrade; expose effective Free limits and the plan needed.
- Moderation removal means persistent block plus explicit unblock, matching current UI promise.
- Paid status and active entitlement are separate facts.
- Keep aesthetics, improve hierarchy/copy/focus/states; broader rebranding or scheduled event start are future suggestions only.

## Global constraints
- Preserve Next.js/React/Supabase/ValidaPay and the current MemoriesMT visual identity; do not add dependencies without concrete need.
- Prices and limits of commercial plans stay unchanged. Remove only the identified test offer from productive availability; never delete plans, financial rows or entitlements.
- Financial POSTs are never automatically retried. Uncertain attempts keep order identity; production refund creation stays blocked. No fabricated paid states or real test charges.
- No impersonation of productive users, no secret values in reports/logs/source, no direct writes by workers to hosted services.
- Every async action must reach a recoverable, terminal or explicit pending state; retain user input and distinguish network, not-found and access errors.
- Local photo drafts are keyed by event and current user, expire within 24h, clear on successful send/explicit discard, and must not leak between identities. Storage failures require honest fallback.
- Work only in the assigned isolated worktree/owned files. Root integrates commits and performs hosted migrations/deploy.
- Tests must cover the actual reported failure and be observed RED before implementation; targeted tests use at most 2 workers. Root executes the full integrated suite and browser checks.
- User explicitly requested autonomous end-to-end execution and parallel work; no design/permission checkpoint for routine reversible implementation decisions.

## Boundaries
No real charges/refunds or production test identities. Core fixes include server-authoritative catalog/moderation/receipt changes through additive migrations; workers never apply them remotely.

## Acceptance
Each A01–A25 has a closing test or explicit before/after evidence in the final matrix. Integrated unit/type/lint/build/SQL and focused browser journeys pass; review has no unresolved material findings; productive deployment and nonfinancial health are verified. Financial certification still requires an actual authorized purchase.
