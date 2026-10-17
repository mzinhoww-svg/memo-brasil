# STATUS — Memo Brasil

> Atualizado em 2026-10-17 pelo Planejador. Estado real **da `main`** e dos PRs abertos; nada abaixo conta como "feito" se não estiver mergeado. Fonte do checklist: `docs/prompt-orquestrador.md`.

**Resumo:** `main` ainda é o protótipo funcional do convidado + painel básico (JSON em disco, token estático). Há 17 PRs abertos (#1–#17); **nenhum mergeado**. Nada publicado. Em 17/10: auditei #12, #13 e #14 (todos com condições) e o item 1 do #9; #15, #16, #17 e #8 auditados no mesmo dia (#15 devolvido). Decisões 002, 003 e 004 aceitas pelo Orquestrador em 17/10 (forma recomendada). Bloqueios de merge: #2 devolvido, #7 com ajustes, #9 a reauditar por inteiro, #14 devolvido (B1–B4), CI do #1 falhando.

## Os 15 itens

| # | Item | Estado | Onde / o que falta |
|---|---|---|---|
| 1 | Testes da API + CI | **Em PR — CI vermelho** | #1 (`feat/testes`): suíte e gitleaks; o job `test` falha em ~2 s sem log; o QA cruzado atribui a falha à cobrança/Actions, não ao código (19 testes passam localmente). Baseline de falhas em #3. Não conta como verde até o CI rodar. |
| 2 | QA visual/funcional | **Parcial** | Baseline em #4 (`docs/qa/`); relatório "depois" incluído. Falta rodar o fluxo completo sobre a main integrada, sem erro de console, 390×844 e 1440×900. |
| 3 | Persistência de produção | **Em PR — ajustes** | #7: SQLite atrás de `Store`, migrações, backup. Pendências: `save()` apaga por cascata (A1), exclusão/backup (A2), FKs de convidado (A3). Decisão 001 aceita (#5). |
| 4 | Publicação com HTTPS | **Em PR — com condições** | #17 (`feat/deploy`): Docker, Caddy HTTPS, systemd, scripts. Continua dependendo de itens 3, 5, 13 e de plano/custo aprovados. Ver `docs/ACTIONS.md` (VPS, domínio, e-mail, backup). |
| 5 | Conta do organizador | **Em PR — devolvido** | #9: link mágico + sessão. Bloqueios B1 (vínculo por `eventoId` do corpo), B2, B3, B5. Decisão 002 **aceita** (17/10). |
| 6 | Painel completo | **Parcial na main** | Painel, lista, fotos e ZIP existem; faltam QR em PNG/PDF A5, remover convidado e "estender/encerrar revelação" a validar. Sem PR dedicado. |
| 7 | Convidado sem fricção | **Em PR — com condições** | #13 (`feat/convidado`, 59cae82): token de 32 bytes, só hash, tempo constante, reentrada, navegador embutido. Condições C1–C5: unificar com o #14 (só hash), convidados antigos, `tokenHash` fora das respostas, leitura sem token. |
| 8 | Revelação e retrospectiva | **Em PR — com condições** | #16 (`feat/revelacao`): e-mail ao organizador, job idempotente, GET retrospectiva. Antes: | Revelação por relógio do servidor e retrospectiva existem; e-mail ao organizador depende do provedor de e-mail (sem credencial). Textos em #6. |
| 9 | Moderação e privacidade (LGPD) | **Em PR — devolvido** | Textos em #2 e #6. Código: #15 (`feat/lgpd`) traz denúncia, ocultar/apagar, consentimento e scripts de exportar/apagar/retenção; **devolvido** em 17/10 (B1–B5). #14 (`feat/upload`) trata EXIF/GPS e tipo por conteúdo: **devolvido** (B1–B4), ver abaixo. |
| 10 | Identidade pt-BR | **Em PR — aprovado** | #4 aprovado; nome **Lume** decidido por Aurimar (domínio e busca INPI pendentes). Lighthouse ≥90 não medido; textos dependem de #2/#6. |
| 11 | Observabilidade e limites | **Em PR — com condições** | #12 (`feat/obs`, d213505): log sem PII, healthz, teto de fotos, Sentry opcional. Condições: Sentry pode enviar trecho do corpo em `err.message`, nunca token em caminho, retenção do hash de IP. Rate limit por `req.ip` já corrigido no #9. |
| 12 | Banco e RLS (Postgres) | **Pós-MVP imediato** | Decisão 001 (#5): início automático quando este STATUS final for publicado; gatilhos G1–G4 antecipam. Aceite migra do SQLite. |
| 12b | Plano das lojas | **Em PR — aprovado** | `docs/lojas.md` em #5: PWA no MVP, Capacitor só para convidado depois. Valores e prazos a reconferir. |
| 13 | Admin master seguro | **Em PR — devolvido** | #9: scrypt + TOTP + auditoria encadeada, mas B3 (auditoria não grava ações), B4 (token estático ainda vale em `adminOnly`), B6 (TOTP em claro por padrão), captcha ainda não. Decisão 003 **aceita** (17/10). |
| 14 | Painel ao vivo + STATUS final | **Em andamento** | Painel :3300 em #8 (**aprovado**, 17/10). Este arquivo é o STATUS parcial; o **final** só após os demais itens. |

## PRs abertos

| PR | Conteúdo | Parecer do Planejador |
|---|---|---|
| #1 | Testes e CI | CI falhando (cobrança/Actions segundo o QA); QA devolveu por falta de teste da listagem pré-revelação |
| #2 | Textos pt-BR (privacidade, termos, UI, e-mails) | **Devolvido** (B1–B6) |
| #3 | QA baseline da API | Relatório; sem parecer de segurança pendente |
| #4 | Identidade Lume | **Aprovado** (head `f13954e` reavaliado) |
| #5 | Decisões 001–004, fase 2, lojas | **Aprovado** |
| #6 | Textos de estados, retrospectiva, painel | **Aprovado com condições** |
| #7 | SQLite atrás de interface | **Ajustes** (A1–A3) |
| #8 | Painel ao vivo | **Aprovado** (observações: ambiente limpo no `npm test`, URL do PR, checklist JSON desatualizado) |
| #10 | Tabela de textos por tela (`docs/copy`) | Não auditado; herda os bloqueios do #2 até a correção |
| #11 | Este STATUS/TASKS | Documento |
| #12 | Observabilidade (log sem PII, Sentry) | **Aprovado com condições** (C1–C5) |
| #13 | Convidado com token e navegador embutido | **Aprovado com condições** (C1–C5) |
| #14 | Uploads seguros (tipo por conteúdo, EXIF) | **Devolvido** (B1 token em claro, B2 token na query, B3 JPEG mantém bytes após o EOI, B4 teste com GPS real) |
| #15 | LGPD: denúncia, ocultar/apagar, retenção | **Devolvido** (B1 retenção apaga evento futuro; B2 scripts em `db.json` com servidor rodando e fora do `Store`; B3 token em claro e `?token=`; B4 consentimento não exigido pelo servidor; B5 denúncia só por `guestId`) |
| #16 | Revelação e retrospectiva | **Aprovado com condições** (e-mail a `contato` não verificado, job sem trava/timeout, console em produção, retrospectiva sem filtro de ocultas, operador no exterior) |
| #17 | Deploy (Docker, Caddy, systemd) | **Aprovado com condições** (B1 imagem sem `src/` e `scripts/`; B2 log do Caddy com tokens e IP; B3 `.env` inteiro no Caddy; restore ressuscita exclusões LGPD) |
| #9 | Autenticação (head db94646) | **Devolvido** (B1–B8); em 17/10 conferi só o item 1: a rota de arquivo de foto já compara token por hash (`verifyToken`), mas ainda aceita `?token=` na query (remover). Reauditoria completa pendente |

Ordem de merge sugerida: #5 → #4 → #6 → #1 (com CI verde) → #7 (corrigido) → #9 (corrigido) → #13 → #14 (rebaseado no #13) → #12 → #16 → #17 (com B1–B3) → #8; #15 só depois de B1–B5. #2 volta quando o Redator resolver B1–B6.

## Limitações conhecidas (main atual)

- Token do organizador e do master na query string e em `localStorage`; token estático do master ainda vale em todas as rotas de organização.
- `GET /recados` e `/buscar` sem credencial; `guestId` sem segredo (corrigido só no #13).
- Mimetype de upload confiado ao cliente; EXIF/GPS não removido (tratado no #14, ainda devolvido).
- `save()` síncrono reescreve o JSON inteiro a cada mutação.
- Sem HTTPS, sem e-mail transacional, sem backup externo, sem job de retenção.
