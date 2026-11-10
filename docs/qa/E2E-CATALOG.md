# Catálogo dos specs E2E (rodada de 2026-11-10, build de produção local)

Legenda: **passou / pulado / falhou**. "Pulado" = depende de Supabase real, servidor falso ou site publicado e não roda sem as chaves/URLs. Specs "auditoria" têm configuração própria (`playwright.audit.config.ts`) e não rodam na suíte padrão.
Como rodar: `cd web && npx playwright test -c playwright.config.ts <spec>` (o `webServer` faz o build com `NEXT_PUBLIC_MM_DEV_TOOLS=1 NEXT_PUBLIC_MM_TEST_CLOCK=1`). O CI roda só os dois **gates**: `ux-flow-hardening` e `validapay-local`.
Testes retirados ou reescritos por causa do redesign: `docs/qa/E2E-RETIREMENTS.md`.

| Spec | O que cobre | Categoria / exige | OK / pulado / falhou | Estado |
|---|---|---|---|---|
| `a11y.spec.ts` | Axe WCAG 2.1 AA: home, preços, ajuda, painel, plano, 8 passos do assistente, tema | local | 8 / 0 / 0 | ✅ passa |
| `audit-a1-exposure-roles.spec.ts` | Auditoria A1: exposição de dados por papel (anfitrião/convidado/master) | auditoria (config própria: playwright.audit.config.ts, AUDIT_BASE_URL) | 0 / 0 / 0 | — não executado nesta rodada (config própria) |
| `audit-a1-journeys.spec.ts` | Auditoria A1: jornadas completas do convidado e do anfitrião | auditoria | 0 / 0 / 0 | — não executado nesta rodada (config própria) |
| `audit-a1-reveal.spec.ts` | Auditoria A1: revelação, fusos e relógio (usa resumo-revelacao antigo: precisa atualizar) | auditoria | 0 / 0 / 0 | — não executado nesta rodada (config própria) |
| `audit-a2-crawl.spec.ts` | Auditoria A2: varredura de rotas e links | auditoria | 0 / 0 / 0 | — não executado nesta rodada (config própria) |
| `audit-a2-focus.spec.ts` | Auditoria A2: ordem de foco | auditoria | 0 / 0 / 0 | — não executado nesta rodada (config própria) |
| `audit-a2-offline-post.spec.ts` | Auditoria A2: envio offline (usa openDemo antigo: precisa atualizar) | auditoria | 0 / 0 / 0 | — não executado nesta rodada (config própria) |
| `audit-a2-overflow.spec.ts` | Auditoria A2: textos longos sem vazar | auditoria | 0 / 0 / 0 | — não executado nesta rodada (config própria) |
| `audit-a2-perf.spec.ts` | Auditoria A2: desempenho | auditoria | 0 / 0 / 0 | — não executado nesta rodada (config própria) |
| `audit-a2-perf200b.spec.ts` | Auditoria A2: desempenho com 200 fotos | auditoria | 0 / 0 / 0 | — não executado nesta rodada (config própria) |
| `audit-a2-pwa.spec.ts` | Auditoria A2: PWA e service worker | auditoria | 0 / 0 / 0 | — não executado nesta rodada (config própria) |
| `audit-a3-resilience.spec.ts` | Auditoria A3: resiliência a falhas de rede | auditoria | 0 / 0 / 0 | — não executado nesta rodada (config própria) |
| `audit-a3-upload.spec.ts` | Auditoria A3: envio de arquivos grandes/ inválidos | auditoria | 0 / 0 / 0 | — não executado nesta rodada (config própria) |
| `audit-a3-xss-network.spec.ts` | Auditoria A3: XSS e rede | auditoria | 0 / 0 / 0 | — não executado nesta rodada (config própria) |
| `capture-screens.spec.ts` | Captura de telas para documentação (CAPTURE=1) | utilitário | 0 / 2 / 0 | ⏭ pulado (exige utilitário) |
| `consent.spec.ts` | Consentimento do organizador e do convidado | local | 3 / 0 / 0 | ✅ passa |
| `convite.spec.ts` | Convite/QR: pré-visualização e nome longo | local | 3 / 0 / 0 | ✅ passa |
| `feed-revela.spec.ts` | Feed revelado, comentários, e-mail, galeria e 19b | local | 3 / 0 / 0 | ✅ passa |
| `flows.spec.ts` | Fluxos principais: assistente, convidado, painel, revelação, downloads, segurança | local | 30 / 0 / 0 | ✅ passa |
| `home-exemplo.spec.ts` | Home, teclado, viewports e /exemplo | local | 8 / 0 / 0 | ✅ passa |
| `home.prod-smoke.spec.ts` | Smoke da home em produção (E2E_BASE_URL) | produção (somente leitura) | 0 / 4 / 0 | ⏭ pulado (exige produção (somente leitura)) |
| `master-codes.spec.ts` | Master: códigos de cortesia | nuvem (Supabase real + chaves) | 0 / 1 / 0 | ⏭ pulado (exige nuvem (Supabase real + chaves)) |
| `master-exports.spec.ts` | Master: exportações CSV | nuvem (Supabase real + chaves) | 0 / 1 / 0 | ⏭ pulado (exige nuvem (Supabase real + chaves)) |
| `master-payments.spec.ts` | Master: pagamentos | nuvem (Supabase real + chaves) | 0 / 1 / 0 | ⏭ pulado (exige nuvem (Supabase real + chaves)) |
| `master-studio.spec.ts` | Master: navegação e estúdio (menu antigo "Módulos do console": precisa atualizar) | nuvem (Supabase real + chaves) | 0 / 3 / 0 | ⏭ pulado (exige nuvem (Supabase real + chaves)) |
| `pagamento-mobile.spec.ts` | Pagamento em celular (Mercado Pago legado) | local/legado | 0 / 3 / 0 | ⏭ pulado (exige local/legado) |
| `payments.spec.ts` | Pagamentos Mercado Pago com servidor falso (PAYMENTS_MP_FAKE) | local com servidor falso | 0 / 8 / 0 | ⏭ pulado (exige local com servidor falso) |
| `plano-mercadopago.spec.ts` | Plano e checkout Mercado Pago (legado) | local/legado | 0 / 14 / 0 | ⏭ pulado (exige local/legado) |
| `plano.spec.ts` | Tela de plano (checkout transparente) | local | 3 / 0 / 0 | ✅ passa |
| `print-order.spec.ts` | Pedido de impressão (19b) e lista de pedidos | local | 1 / 0 / 0 | ✅ passa |
| `prod-smoke.spec.ts` | Smoke em produção (E2E_BASE_URL) | produção (somente leitura) | 0 / 2 / 0 | ⏭ pulado (exige produção (somente leitura)) |
| `produto-planos.spec.ts` | Planos e produto na nuvem | nuvem (Supabase real + chaves) | 0 / 11 / 0 | ⏭ pulado (exige nuvem (Supabase real + chaves)) |
| `produto.spec.ts` | Home, ajuda, preços, rodapé, QR e cópia de convite | local | 14 / 0 / 0 | ✅ passa |
| `public-surface.spec.ts` | Superfície pública (headers, rotas) — config de auditoria | auditoria | 0 / 0 / 0 | — não executado nesta rodada (config própria) |
| `pwa.spec.ts` | PWA: manifesto, cache, offline (só em build de produção) | local (build de produção) | 2 / 0 / 0 | ✅ passa |
| `qr-download.spec.ts` | Baixar QR code (SVG/PNG) e decodificação | local | 4 / 0 / 0 | ✅ passa |
| `remote-flow.spec.ts` | Fluxo remoto completo contra site publicado | nuvem/publicado (ALLOW_REMOTE_TEST) | 0 / 1 / 0 | ⏭ pulado (exige nuvem/publicado (ALLOW_REMOTE_TEST)) |
| `remote.spec.ts` | Revelação programada no site publicado | publicado (E2E_BASE_URL) | 0 / 5 / 0 | ⏭ pulado (exige publicado (E2E_BASE_URL)) |
| `reveal-visual.spec.ts` | Revelação em 390 px: configuração, espera, transição, galeria (axe) | local | 5 / 0 / 0 | ✅ passa |
| `reveal.spec.ts` | Revelação: configurar, esperar, revelar, relógio do aparelho | local | 11 / 0 / 0 | ✅ passa |
| `revela-a11y.spec.ts` | Revela: rolagem lateral e Axe a 360/390/430 px | local | 3 / 0 / 0 | ✅ passa |
| `revela-wizard.spec.ts` | Assistente de 8 passos até criar a câmera | local | 1 / 0 / 0 | ✅ passa |
| `session.spec.ts` | Sessão, navegação do Master e convidado (parte exige Supabase) | local + nuvem | 0 / 3 / 0 | ⏭ pulado (exige local + nuvem) |
| `smoke.spec.ts` | Smoke da home e navegação básica | local | 2 / 0 / 0 | ✅ passa |
| `studio-local.spec.ts` | Embalagem e mensagem de boas-vindas | local | 1 / 0 / 0 | ✅ passa |
| `supabase.spec.ts` | Integração Supabase (RLS, realtime) | nuvem (Supabase real + chaves) | 0 / 3 / 0 | ⏭ pulado (exige nuvem (Supabase real + chaves)) |
| `ux-flow-hardening.spec.ts` | GATE do CI: rascunho, histórico, foco, bloqueio | local (gate) | 6 / 0 / 0 | ✅ passa |
| `uxa-evento-criado.spec.ts` | Tela "câmera pronta": overflow, botão, cópia | local | 2 / 0 / 0 | ✅ passa |
| `validapay-local.spec.ts` | GATE do CI: checkout ValidaPay local | local (gate) | 1 / 0 / 0 | ✅ passa |

## Totais da suíte padrão
Última rodada completa: 106 passaram, 62 pulados (nuvem/publicado/servidor falso), 5 falharam e foram corrigidos na sequência (`a11y.spec` 2× rótulo de espera, `ux-flow-hardening` ordem do assistente); reexecutados: 14/14 verdes.

## O que falta para rodar o resto
- **Nuvem** (`supabase`, `session` parte nuvem, `master-*`, `produto-planos`, `remote-flow`): projeto Supabase de teste com `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_KEY` (ver `docs/supabase/`). `master-studio` e `session` ainda esperam o menu antigo "Módulos do console" e precisam ser atualizados antes.
- **Auditoria** (`audit-*`, `public-surface`): `AUDIT_BASE_URL` apontando para um `next start`; `audit-a1-reveal` (usa `resumo-revelacao`) e `audit-a2-offline-post`/`audit-a1-journeys` (usam `openDemo`) precisam atualizar para a UI nova.
- **Produção/publicado** (`prod-smoke`, `home.prod-smoke`, `remote`): `E2E_BASE_URL=https://fotosdocasamento.online`, somente leitura.
- **Mercado Pago legado** (`payments`, `plano-mercadopago`, `pagamento-mobile`): servidor falso `PAYMENTS_MP_FAKE=1`; checkout atual é ValidaPay (cobertura: `validapay-local`).
