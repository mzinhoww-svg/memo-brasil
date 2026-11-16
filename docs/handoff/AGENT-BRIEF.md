# Brief para os agentes do Revela 2.0 (G4–G7)

Repositório `mzinhoww-svg/memo-brasil`, app em `web/` (Next.js 16, React 19, Supabase). Objetivo: portar as telas de referência
(`design-system/revela/html/*.html`) para React com **o mesmo markup, classes, textos e ordem**, ligadas a dados reais, com prova
visual por tela. Regras do usuário: sem adaptações, sem extras, sem omissões; **nenhum hex fora de `web/src/styles/tokens.css`**;
decisões de regra de negócio: decida sozinho, registre a divergência no CHECKLIST (coluna "Ligação ao app") e siga; não peça autorização.

## O que já existe (use como modelo)
- 89 componentes gerados em `web/src/revela/screens/*.tsx` (um por HTML; `registry.ts` lista id/título/html/webp). O CSS da referência
  já está em `web/src/styles/revela2.css`. NÃO rode `html-to-tsx.mjs --force` (apaga as ligações); edite os componentes à mão.
- Padrão: o componente aceita props e tem como padrão os dados do desenho (fixture), para `/dev/revela/<html>` continuar igual à
  referência. A rota real passa dados reais. Handlers inline dentro do componente exigem `"use client"` na primeira linha
  (senão `/dev/revela/...` dá erro 500).
- Exemplos prontos: `Convidado*.tsx`, `Camera{Data,Poses,Revelacao,Publicar}.tsx` (+ `WizardSheet.tsx`), `Pagamento*.tsx`,
  `AnfitriaoInicio.tsx`, `Voce.tsx`, `CameraPronta.tsx`; `GuestTabs.tsx`, `HostTabs.tsx` (abas). Rotas ligadas: `app/e/[code]/(app)/*`,
  `app/eventos`, `app/eventos/voce`, `app/criar`, `features/billing/ValidaPayCheckout.tsx`.
- Backend: não altere RPCs/serviços existentes; só migrations aditivas novas em `supabase/migrations/` (timestamp > 20261109000500)
  com testes pgTAP em `supabase/tests/database/`. Já existem: `post_comment`, `list_photo_comments`, `comment_counts`,
  `toggle_comment_like`, `report_comment`, `moderate_comment`, `set_my_email`, `get_my_email`, `email_opt_out(_mine)`,
  `claim_reveal_emails`, `admin_publish_plans` (aal2), `my_pose_times`.

## Como trabalhar
1. `cd web` (use o `node_modules` do repositório principal: `ln -s /home/user/memo-brasil/web/node_modules node_modules` no seu worktree).
2. Servidor de desenvolvimento no SEU porto (dado no prompt): `NEXT_PUBLIC_MM_BACKEND=local NEXT_PUBLIC_MM_DEV_TOOLS=1 NEXT_PUBLIC_MM_TEST_CLOCK=1 npx next dev -p <porto>`.
3. Prova: `BASE=http://localhost:<porto> node scripts/revela-evidence.mjs <ids...>` gera `docs/evidence/revela-fiel/<id>.png`
   (referência | implementação | diferença; meta < 3%; telas com vídeo/animação/3D podem passar, explique) e atualiza `CHECKLIST.md`.
   Depois edite a coluna "Ligação ao app" das suas telas (rota real + divergências).
4. Qualidade antes de cada commit: `npx tsc --noEmit`, `npx eslint src`, `npx vitest run` (atualize os testes que quebrarem com a UI
   nova; não pule testes). Tokens: `grep` por `#[0-9a-fA-F]{3,8}` em arquivos novos deve dar vazio fora de `tokens.css`.
5. Commits pequenos por tela ou subgrupo, mensagem em português, terminando com:
   `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` e `Claude-Session: https://claude.ai/code/session_01994gw9KsAjHvPVjPmEWyHE`.
   Faça push para a branch indicada no prompt. Não faça PR. Não mexa em produção, Vercel ou Supabase remoto.
6. Não edite arquivos de outras áreas (cada agente tem a sua lista); conflitos só no CHECKLIST (edite apenas as suas linhas).
7. E2E: o gate do CI é `e2e/ux-flow-hardening.spec.ts` e `e2e/validapay-local.spec.ts`; se sua mudança quebrar os helpers
   de `e2e/helpers.ts`, atualize-os. Config local: `web/pw.local.config.ts` (porta via `E2E_PORT`).
