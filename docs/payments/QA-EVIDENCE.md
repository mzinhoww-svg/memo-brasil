# Evidências de QA (2026-10-24)
- **pgTAP (Postgres real, recriado do zero):** 11 suítes, 1120/1120 PASS (inclui PAY-001 a PAY-005).
- **Vitest:** web 547/547; Edge Functions (módulos puros) 121/121.
- **Tipos/Lint:** `tsc --noEmit` sem erros; ESLint sem erros (avisos preexistentes).
- **E2E padrão:** 110 passed (62 skipped por dependerem de Supabase local). **E2E Supabase com fake do Mercado Pago:** pagamentos/plano/mobile 26/26; suíte completa 45+ passed.
- **Mobile (EMULAÇÃO Chromium, 360/390/430 px + tela baixa 568):** sem rolagem lateral, alvos >= 44 px, CTA visível; capturas em `docs/evidence/pagamento-mobile/`. Não provado: WebKit/Firefox, teclado aberto, aparelho físico, app nativo.
- **Sandbox oficial:** 1 pagamento aprovado e conciliado (ver GO-LIVE-REPORT §C); `payments-diagnose` (Master): produção 3786909683 `testUser:false`, sandbox 3786688395 `testUser:true`; consulta direta dos pagamentos 184803988907 e 185843516030: `approved`, `refundedCents 0`.
- **Produção:** smoke público (home 360/1280, exemplo, entrar, áreas protegidas) passou em `db9cbce`.
