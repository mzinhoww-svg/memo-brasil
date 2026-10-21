# Auditoria final da V2 (2026-10-21)

Branch `feat/memoriesmt-studio` · preview `dpl_HXdWGqLNacSGMEoQCvpQC9L2zsvk` (commit `ed63bc4`, target preview, Next.js correto) · **nada promovido a produção**.
Revisões independentes executadas: A4 segurança, A5 cobertura/regressão, A1/A2 design-UX-a11y. **A3 (arquitetura frontend/performance) não foi executada.**

## O que rodou nesta sessão (medido)
| Verificação | Resultado | Ambiente |
|---|---|---|
| Unitários (`vitest`) | 245/245 | local |
| `tsc --noEmit`, `eslint` | sem erros | local |
| E2E Playwright (modo local, build com relógio de teste) | 51 passaram, 0 falhas, 10 pulados (exigem Supabase) | local |
| pgTAP (v1 + v2) | 366/366 — **antes** do endurecimento A4 | Supabase local |
| Integração `supabase.integration.test.mjs` / adaptador (com tema) | 12/12 e 12/12 — antes de `upload de identidade` | Supabase local |
| E2E modo Supabase (`master-studio` + `supabase`) | 5/5 | Supabase local |
| Smoke HTTP do preview V2 | `/master` e `/master/auditoria` só com o gate; `/criar` 200; CSP/HSTS/XFO/nosniff | Vercel preview |
| **Não rodou** | endurecimento A4 (migration `…0700` e edições) e seus 4 testes pgTAP; teste de upload de identidade (`adapter.itest.ts`); qualquer E2E com navegador logado no preview remoto | Docker indisponível; extensão do navegador desconectada |

## Requisito → implementação → teste → status
| ID | Requisito | Implementação | Teste/evidência | Status |
|---|---|---|---|---|
| UXA-001 | Auditoria 8 larguras | `docs/audit/ux/INVENTARIO.md`, 304 capturas | axe 0 violações, 0 overflow (agente) | **DONE** |
| UXA-002 (101/102/103) | Evento criado | `criar/pronto`, `mm.css`, `app.css` | `uxa-evento-criado.spec.ts` (2) | **DONE** (local) |
| UXA-105/107/110/113/114 | painel, abas, erros, contraste, alvos | `app.css`, `wizard.tsx`, `mm.css` | `uxa-evento-criado.spec.ts` (parcial) + revisão A1/A2 | **PARTIAL** (sem teste dedicado para 105/107/113/114) |
| UXA-104, 106, 108, 109, 111, 112, 115–127 | demais achados | — | — | **NOT IMPLEMENTED** |
| DSV-001 | Tokens por camada | `lib/event-theme`, `admin.css`, `--borda-controle` | `event-theme.test.ts` | **PARTIAL** (faltam `--mm-*` completos) |
| DSV-002 | Componentes v2 documentados em `/design` | — | — | **NOT IMPLEMENTED** |
| DSV-003 | WCAG 2.2 AA | alvos 44px, contraste de chips, erro ligado ao campo | axe medido pelo revisor | **PARTIAL** |
| EST-001 | `event_themes`, `event_assets`, bucket | migrations `…0200/0300` | pgTAP 366/366 (pré-endurecimento) | **DONE** no banco local; endurecimento **não validado** |
| EST-002 | Renderer isolado | `EventTheme`, `themeStyle` | unit + `studio-local.spec.ts` + `master-studio.spec.ts` (isolamento) | **PARTIAL** (sem modo noite; painel não herda o tema) |
| EST-003 | Wizard com prévia do convite | — | — | **NOT IMPLEMENTED** |
| EST-004 | Personalização completa | Studio, upload, mensagem, QR | unit, `studio-local.spec.ts`; upload só escrito | **PARTIAL** (logo/capa só para organizador e membros; upload não executado) |
| EST-005 | Gestão do evento V2 | — | — | **NOT IMPLEMENTED** |
| MAD-001 | Papéis no servidor | `…0100`, `lib/master`, `provision_master.sql` | unit + `master-studio.spec.ts` (4 identidades) + pgTAP | **PARTIAL** (anti pré-sequestro não validado; config remota pendente) |
| MAD-002 | Auditoria imutável com justificativa | `…0100` | pgTAP | **PARTIAL** (`ENABLE ALWAYS` não validado) |
| MAD-003 | 12 módulos | `app/master/*` | `master-studio.spec.ts` carrega as 11 rotas | **PARTIAL** (somente leitura) |
| MAD-004 | Acesso excepcional a foto | RPC `admin_request_photo_access` | pgTAP | **PARTIAL** (sem UI) |
| ANL-001 | Métricas reais | `admin_dashboard_metrics` e páginas | pgTAP com dados reais | **DONE** (local) |
| SCV-001 | Settings e flags | `…0400`, RPCs `admin_set_*` | pgTAP | **PARTIAL** (sem UI; flags ajustadas, não validadas) |
| SCV-002 | Revisão de segurança | A4 | relatório da sessão | **PARTIAL** (achados abertos: SCV-003…008) |
| QAV-001 | Testes completos | ver tabela acima | — | **PARTIAL** |
| QAV-002 | Revisão independente A1–A5 | A1/A2, A4, A5 executadas | relatórios | **PARTIAL** (A3 não executada) |
| RLV-001 | Preview V2 validado | preview READY, front compatível com servidor V1 | smoke HTTP | **BLOCKED** (sem integração remota V2 nem navegador logado) |

## P0/P1 conhecidos que bloqueiam release
1. Endurecimento de segurança não executado em banco (SCV-008) — P0.
2. Pré-sequestro de conta no provisionamento: ação de configuração remota (desligar e-mail/senha) pendente (SCV-003) — P0.
3. Logo/capa não aparecem para quem ainda não entrou; sem magic bytes/dimensões reais (EST-006, SCV-006) — P1.
4. V1 ainda não está em produção (REL-001/SB-008) e o fluxo de convidado com RLS no preview remoto não foi feito pelo navegador (G7).

## Recomendação
**Não promover a V2.** Sequência: (1) restaurar Docker/ambiente e rodar SCV-008 (pgTAP completo + hardening); (2) fechar a V1 (SB-004/SB-008/REL-001, G7); (3) aplicar migrations V2 no remoto **depois** de validadas (front V2 já tolera servidor V1); (4) refazer o preview V2 contra o remoto e executar QAV-003; (5) só então avaliar release.
