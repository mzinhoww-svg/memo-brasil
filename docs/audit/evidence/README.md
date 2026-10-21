# Evidências da AUD-001
- `logs/`: linha de base (typecheck, lint, 131 unitários, build, `npm audit`, E2E), inspeção Vercel/Supabase, cabeçalhos de produção, verificação do consolidador e logs dos auditores (a1-, a3-, a4-).
- `test-results/`: JSON do Playwright da linha de base (`e2e-baseline.json`) e dos specs de auditoria (a1-, a2- incluindo Lighthouse, a3-).
- `screenshots/`: 242 capturas (a1- e a2-; 4 larguras × 2 temas nas rotas e estados de revelação).
- Specs de auditoria: `web/e2e/audit-a*-*.spec.ts` (fora da suíte regular; rodam com `web/playwright.audit.config.ts`).
- Nenhum segredo nos artefatos. O link temporário de acesso ao preview não foi gravado.
