# MemoriesMT (web)

Câmera coletiva para eventos. Versão **pré-Supabase**: tudo funciona neste aparelho (IndexedDB); a colaboração entre aparelhos chega com o backend (`../docs/supabase/INTEGRATION-PLAN.md`).

```bash
npm install
npm run dev        # http://localhost:3000
npm run lint && npm run typecheck && npm test   # 91 testes unitários
npm run e2e        # Playwright: build de teste + 29 testes (fluxos, PWA, visual, axe)
npm run build && npm start
```
Documentação: `../docs/architecture/ARCHITECTURE.md`, `../docs/qa/VISUAL-VALIDATION.md`, `../docs/qa/TRACEABILITY-MATRIX.md`, plano em `../docs/plans/`. Guia de componentes: rota `/design`.
Design system: `../design-system/MemoriesMT-design-system` (tokens, fontes, logos, ícones e componentes são cópias do kit; `scripts/gen-assets.mjs` e `scripts/gen-pwa-icons.mjs` regeneram dados de ícones e PNGs do PWA).
Variável de teste: `NEXT_PUBLIC_MM_TEST_CLOCK=1` habilita `?agora=<ms>` (apenas no build de E2E).
