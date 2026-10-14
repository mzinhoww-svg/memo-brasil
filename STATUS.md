# STATUS — Memo Brasil

> Atualizado em 2026-10-13 pelo Planejador. Estado real **da `main`** e dos PRs abertos; nada abaixo conta como "feito" se não estiver mergeado. Fonte do checklist: `docs/prompt-orquestrador.md`.

**Resumo:** `main` ainda é o protótipo funcional do convidado + painel básico (JSON em disco, token estático). Há 9 PRs abertos; **nenhum mergeado**. Nada publicado. Bloqueios de merge: #2 e #9 devolvidos, #7 com ajustes, CI do #1 falhando.

## Os 15 itens

| # | Item | Estado | Onde / o que falta |
|---|---|---|---|
| 1 | Testes da API + CI | **Em PR — CI vermelho** | #1 (`feat/testes`): suíte e gitleaks; o job `test` falha em ~2 s sem log disponível (causa não verificada). Baseline de falhas em #3. Não conta como verde. |
| 2 | QA visual/funcional | **Parcial** | Baseline em #4 (`docs/qa/`); relatório "depois" incluído. Falta rodar o fluxo completo sobre a main integrada, sem erro de console, 390×844 e 1440×900. |
| 3 | Persistência de produção | **Em PR — ajustes** | #7: SQLite atrás de `Store`, migrações, backup. Pendências: `save()` apaga por cascata (A1), exclusão/backup (A2), FKs de convidado (A3). Decisão 001 aceita (#5). |
| 4 | Publicação com HTTPS | **Não iniciado** | Depende de itens 3, 5, 13 e de plano/custo aprovados. Ver `docs/ACTIONS.md` (VPS, domínio, e-mail, backup). |
| 5 | Conta do organizador | **Em PR — devolvido** | #9: link mágico + sessão. Bloqueios B1 (vínculo por `eventoId` do corpo), B2, B3, B5. Decisão 002 recomendada, sem aceite formal. |
| 6 | Painel completo | **Parcial na main** | Painel, lista, fotos e ZIP existem; faltam QR em PNG/PDF A5, remover convidado e "estender/encerrar revelação" a validar. Sem PR dedicado. |
| 7 | Convidado sem fricção | **Parcial na main** | Entrada por nome existe; `guestId` sem segredo (reentrada/saldo frágeis), mensagens de estado em #6, navegador embutido do Instagram/WhatsApp não testado. |
| 8 | Revelação e retrospectiva | **Parcial na main** | Revelação por relógio do servidor e retrospectiva existem; e-mail ao organizador depende do provedor de e-mail (sem credencial). Textos em #6. |
| 9 | Moderação e privacidade (LGPD) | **Em PR — devolvido** | Textos em #2 (devolvido, B1–B6) e #6 (aprovado com condições). Faltam em código: exportar/apagar evento em um comando, job de retenção, denúncia, aviso de consentimento no fluxo (decisão 004 recados). |
| 10 | Identidade pt-BR | **Em PR — aprovado** | #4 aprovado (Lume é candidato; INPI/domínio humanos). Lighthouse ≥90 não medido; textos dependem de #2/#6. |
| 11 | Observabilidade e limites | **Não iniciado** | Rate limit parcial em #9 (spoofável por `X-Forwarded-For`, B8); falta log sem PII, healthcheck, Sentry, teto por evento (limite atual 20.000 fotos vs 50 GB de disco). |
| 12 | Banco e RLS (Postgres) | **Pós-MVP imediato** | Decisão 001 (#5): início automático quando este STATUS final for publicado; gatilhos G1–G4 antecipam. Aceite migra do SQLite. |
| 12b | Plano das lojas | **Em PR — aprovado** | `docs/lojas.md` em #5: PWA no MVP, Capacitor só para convidado depois. Valores e prazos a reconferir. |
| 13 | Admin master seguro | **Em PR — devolvido** | #9: scrypt + TOTP + auditoria encadeada, mas B3 (auditoria não grava ações), B4 (token estático ainda vale em `adminOnly`), B6 (TOTP em claro por padrão), captcha ainda não. Decisão 003 recomendada. |
| 14 | Painel ao vivo + STATUS final | **Em andamento** | Painel :3300 em #8 (não auditado por mim). Este arquivo é o STATUS parcial; o **final** só após os demais itens. |

## PRs abertos

| PR | Conteúdo | Parecer do Planejador |
|---|---|---|
| #1 | Testes e CI | CI falhando — verificar |
| #2 | Textos pt-BR (privacidade, termos, UI, e-mails) | **Devolvido** (B1–B6) |
| #3 | QA baseline da API | Relatório; sem parecer de segurança pendente |
| #4 | Identidade Lume | **Aprovado** (head `f13954e` reavaliado) |
| #5 | Decisões 001–004, fase 2, lojas | **Aprovado** |
| #6 | Textos de estados, retrospectiva, painel | **Aprovado com condições** |
| #7 | SQLite atrás de interface | **Ajustes** (A1–A3) |
| #8 | Painel ao vivo | Não auditado |
| #9 | Autenticação | **Devolvido** (B1–B8) |

Ordem de merge sugerida: #5 → #4 → #6 → #1 (com CI verde) → #7 (corrigido) → #9 (corrigido). #2 volta quando o Redator resolver B1–B6.

## Limitações conhecidas (main atual)

- Token do organizador e do master na query string e em `localStorage`; token estático do master ainda vale em todas as rotas de organização.
- `GET /recados` e `/buscar` sem credencial; `guestId` sem segredo.
- Mimetype de upload confiado ao cliente; EXIF/GPS não removido.
- `save()` síncrono reescreve o JSON inteiro a cada mutação.
- Sem HTTPS, sem e-mail transacional, sem backup externo, sem job de retenção.
