# Auditoria do sistema existente (memo-brasil)

Data: 2026-10-20 · Repo: `mzinhoww-svg/memo-brasil` (privado) · Base da auditoria: `origin/main` @ `25a7ad9` · Branch de trabalho: `feat/memoriesmt` (worktree `~/projetos/mb-memoriesmt`).

## Contexto verificado
- O MVP é um **álbum colaborativo de casamento** em Node 22+/Express 5 (`server.js`, 1.609 linhas), SQLite atrás de `Store` (`src/store/sqlite.js`), HTML/JS puro em `public/`, testes `node --test` (~30 arquivos), Docker + Caddy + systemd para VPS (projeto Ladob). Nome "Lume" era **nome de trabalho** (`docs/design/identidade.md`); a instrução atual define **MemoriesMT**.
- O repositório local principal (`~/projetos/memo-brasil`) está na branch `docs/status` com `.maestri/` e `docs/ORQ-LOG.md` não rastreados; há ~30 worktrees `mb-*` de PRs abertos (#2, #3, #10, #11, #14, #18, #19 abertos). **Nada disso foi tocado.**
- Vercel (time `mzinhoww-gmailcoms-projects`): 10 projetos; nenhum vinculado a `memo-brasil`. `newmemocuiaba` existe, vazio, sem deploys nem repositório (criado ~hoje). Nenhum `.vercel/` no repo. CLI `vercel` **não autenticada**; o conector Vercel (MCP) está autenticado.
- GitHub: `gh` autenticado como `mzinhoww-svg`; push à branch nova é permitido.

## Decisão de fundação
Next.js entra em **`web/`** (subpasta) na branch `feat/memoriesmt`. Motivos: (1) a raiz carrega `package.json`, Dockerfile, Caddy e scripts de deploy do MVP Express usados pelo Ladob; trocar a raiz quebraria o deploy; (2) migração incremental pedida: lógica de domínio é portada para TypeScript antes de qualquer descarte; (3) Vercel aceita *Root Directory* = `web`. O Express **não é removido** nesta etapa.

## Classificação por módulo
| Módulo (origem) | Função | Decisão | Destino / justificativa |
|---|---|---|---|
| `src/reveal/retrospectiva.js`, regras de revelação em `server.js` | revelação por relógio, retrospectiva | **Migrar** | `web/src/domain/reveal.ts` + testes portados; REA F-31 confirma modos DURING/AFTER/+N dias |
| `src/reveal/job.js` | job idempotente de e-mail na revelação | **Substituir** | depende de SMTP/servidor; vira `NotificationScheduler` (stub) e plano Supabase |
| `src/lgpd/consentimento.js`, `denuncia.js` | consentimento, denúncia, ocultar/apagar | **Migrar** | regras viram `domain/moderation.ts` e `domain/consent.ts`; copy do consentimento vem do design system |
| `src/lgpd/exportar.js`, `retencao.js`, `dados.js` | exportação/retenção | **Refatorar (adiar)** | só fazem sentido com backend; documentados em `docs/supabase/INTEGRATION-PLAN.md` |
| `src/store/sqlite.js` + migrações | persistência | **Substituir** | por repositórios IndexedDB (fase 1) → Supabase (fase 2); esquema SQL serve de insumo ao ERD |
| `src/email/index.js` | e-mail transacional | **Substituir** | sem backend nesta fase; contrato em `NotificationScheduler` |
| `src/obs/*` (logger, Sentry, limites) | observabilidade | **Descontinuar nesta fase** (mediante aprovação futura) | sem servidor próprio; decisão de Aurimar (17/10) já tirou Sentry do MVP |
| `server.js` (rotas de evento, convidado, fotos, recados, avisos, master) | API | **Migrar como contratos** | cada rota vira método de repositório/serviço (`09-API-AND-INTEGRATIONS.md`); Express fica intacto |
| `server.js` auth (link mágico, TOTP, master) | auth | **Substituir** | auth real é fase Supabase; fase 1 usa identidade local de convidado/organizador |
| `public/*.html` (album, camera, painel, master, recados, programação) | UI | **Substituir** | reconstruída em React com o design system MemoriesMT; fluxos servem de referência |
| `public/sw.js`, `manifest` dinâmico | PWA | **Refatorar** | novo SW com cache de shell e fotos locais |
| `test/*.test.js` | testes do Express | **Reutilizar (casos)** | cenários portados para Vitest nos módulos de domínio; suíte Express mantida |
| `docs/decisions/001–005` | decisões | **Reutilizar** | 005 (RSVP fora do escopo) é respeitada; 001 (SQLite→Postgres) vira Supabase |
| `Dockerfile`, `Caddyfile`, `deploy/`, `scripts/` | deploy VPS | **Manter intactos** | pertencem ao projeto Ladob |
| `docs/design/*` (Lume) | identidade antiga | **Descontinuar (mediante aprovação)** | superada pelo design system MemoriesMT v1; mantida no histórico, sem uso no produto novo |

## Comparação MVP × PRD do REA
| Tema | MVP Express | PRD REA (Memo Android) | Resolução |
|---|---|---|---|
| Entrada | QR/link + token de convidado | código de 8 caracteres, link, deep link | suportar código **e** link/QR |
| Revelação | por relógio do servidor | DURING / AFTER / AFTER+N dias | modelo do REA |
| Limite de fotos | teto por convidado (obs) | 5/10/16/24/36/∞ por pessoa | modelo do REA |
| Capacidade | não existe | 5…200/ilimitado; ≤10 grátis | modelo do REA (sem cobrança real) |
| Reações | não existe (recados) | 4 reações, 1 por foto/usuário | design system usa chips de reação ("Amei", "Esse momento") — rótulos do DS, regra de unicidade do REA |
| Moderação | denúncia/ocultar/apagar | sem evidência de moderação no Android | mantida (DS tem AdminNav/Tabs/CountBadge de moderação) |
| Mesas/QR por mesa, Avisos do cerimonial | existe (lista, avisos) | sem evidência | vêm do design system (TableCard, Notice); marcadas como "decisão de produto", não REA |
| RSVP | removido (decisão 005) | inexistente | fora do escopo |

## Riscos
Rótulos do DS (Amei/Esse momento) divergem dos emojis do REA; DS proíbe emoji → rótulos textuais prevalecem (hierarquia: REA define comportamento, DS define linguagem). Regras de pagamento do REA não são implementadas (sem cobrança real).
