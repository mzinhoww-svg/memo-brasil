# MemoriesMT — Produto de Produção e Pagamentos AbacatePay — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar o MemoriesMT com acabamento profissional e monetização ponta a ponta. A entrega cobre home, onboarding, criação, plano, pagamento Pix AbacatePay em sandbox, liberação de benefícios pelo servidor, jornada do convidado, painel e Master Admin, e termina homologada com parecer GO/NO-GO.

**Architecture:**
- **Fonte única de limites.** Uma função SQL, `effective_entitlement(event)`, passa a definir os limites de cada evento (convidados e fotos por pessoa). O trigger `events_guard` e o `join_event` aplicam esses limites. É o único mecanismo de autorização de benefícios; não existe um segundo.
- **Pagamentos sem `service_role` na Vercel.** Toda a integração roda em Supabase Edge Functions (Deno), como já fazem `purge-storage` e `finalize-asset`.
- **Divisão de responsabilidades.** As Edge Functions só fazem chamadas ao provedor. A máquina de estados do pedido vive em RPCs SQL `security definer`.
- **O webhook não decide sozinho.** Ele só dispara uma reconsulta ao provedor (`GET /transparents/check`), e o estado é aplicado pela resposta dessa reconsulta. O navegador nunca decide preço nem libera benefício.

**Tech Stack:**
- Next.js 16 (`web/`), React 19, Tailwind v4, Design System MemoriesMT (`web/src/components/memoriesmt`).
- Supabase: Postgres + RLS, pg_cron, pg_net, Vault, Edge Functions (Deno).
- AbacatePay API v2 (`https://api.abacatepay.com/v2`).
- Testes: vitest, Playwright, pgTAP (`supabase test db`).

**Spec / fontes (ler antes de começar):**
- Corte operacional vigente e restrições: `docs/superpowers/specs/2026-10-21-operational-release-design.md`.
- Estado da frente A: `docs/supabase/A5-HOMOLOGATION-REPORT.md` (Rodadas 4–5) e `docs/handoff/NEXT-SESSION.md`.
- Backlog: `docs/backlog/backlog.json`. IDs usados aqui: COM-001/002/003/004/006/007, UXA-1xx, DSV-003, FT-006; adiados com tela desenhada: COM-005, FT-081, BG-071, SB-006, FT-084 e os novos COM-014/015/016 (Task 0).
- Inventário UX anterior: `docs/audit/ux/INVENTARIO.md`. Capturas: `docs/audit/ux/screens/*-375.png`.
- Preços: tabela v0 de `../mb-memoriesmt-gtm/docs/planning/go-to-market/04-pricing.md`, **aprovada e travada pelo dono em 22/10/2026** (D1 e D2, seção 1.6). Depois disso, preço só muda pelo Master › Planos e preços (tela M2).
- **Telas de referência (obrigatórias):** `docs/design/app-proposto/` — `png/*.png` para ver, `*.dc.html` para copiar texto e medidas, `canvas.json` para títulos e notas. Mapa tela → tarefa na seção 1.7.
- Revisão de monetização: `../mb-memoriesmt-roadmap/docs/planning/roadmap-v3/anexos/A8-revisao-monetizacao.md` (RV-M-01…17).
- Estudo AppLlama / auditoria UX de 22/10 (artifacts privados do dono):
  - auditoria: https://claude.ai/artifact/RWopowPewWTHscEF7uuN6v;
  - canvas do app proposto (44 telas): https://claude.ai/artifact/RNRgYo8JmMsQs87N3Y3sRP. A cópia versionada em `docs/design/app-proposto/` é a fonte para a implementação.

  O que importa deles está consolidado na seção 1; não é preciso repetir o estudo.
- AbacatePay, documentação oficial consultada em 22/10/2026:
  - https://docs.abacatepay.com/pages/reference/introduction
  - https://docs.abacatepay.com/pages/transparents/create e `/check`, `/refund`, `/simulate-payment`
  - https://docs.abacatepay.com/pages/webhooks e `/webhooks/security`
  - https://docs.abacatepay.com/pages/production
  - https://docs.abacatepay.com/pages/concepts/pix

## Global Constraints

- **Ordem das frentes:** A → B → Codex → C. Este plano é o **primeiro lote de B** e só é promovido depois do GO operacional de A. Não inicia Growth Factory (Codex) nem GTM/piloto (C).
- **Preservar o existente:** Design System, Studio, Master, RLS, decisões P1–P6 de `docs/supabase/DECISIONS.md`, decisões 004/005 e as funcionalidades atuais. Não recriar Master nem reprovisionar.
- **Banco:** migrations só aditivas, nomeadas `YYYYMMDDNNNN00_snake.sql`, com o próximo número livre depois da última migration da branch base. Nada de reset remoto, exclusão de dados reais ou limpeza destrutiva.
- **`service_role`:** nunca no frontend nem na Vercel. Fica só nas Edge Functions (`Deno.env SUPABASE_SERVICE_ROLE_KEY`).
- **Credenciais AbacatePay:** nunca em arquivo versionado, log, commit, screenshot, evidência ou bundle. Moram só em `supabase secrets` do projeto.
- **Variáveis da AbacatePay:**
  - `ABACATEPAY_API_KEY` (prefixo `abc_dev_` no sandbox, `abc_prod_` em produção);
  - `ABACATEPAY_WEBHOOK_SECRET`;
  - `ABACATEPAY_HMAC_KEY` (chave pública publicada em `/pages/webhooks/security`; copiar de lá);
  - `ABACATEPAY_ENV` (`sandbox` | `production`);
  - `PAYMENTS_CRON_TOKEN`;
  - `ABACATEPAY_BASE_URL`, opcional, aceito só com `ABACATEPAY_ENV=sandbox` e host `localhost`/`127.0.0.1` (fake de testes).
- **Preço e limites:** vêm de `public.plans` no servidor. Valor em centavos (`int`), moeda BRL, Pix mínimo de 100 centavos.
- **Pix:** `expiresIn = 1800` s (30 min), definido pelo servidor.
- **Planos e preços (aprovados em 22/10/2026):** Grátis 10 convidados/10 fotos/R$ 0; Festa 30/24/R$ 29; Celebração 100/24/R$ 89; Casamento 250/36/R$ 189; Grande 500/sem limite/R$ 349. Seed com `sandbox_active=true` e `production_active=true`. Planos pagos só aparecem e só são compráveis com `payments_env` diferente de `desligado`; a venda real continua bloqueada pela seção 6. O executor não altera esses valores; o dono altera pelo Master (M2).
- **Telas:** cada tela implementada segue o artboard indicado na seção 1.7: textos exatos, hierarquia, ordem dos elementos e estados. Componentes vêm do Design System existente (não copiar o HTML dos artboards; ele é referência visual). As anotações tracejadas dos artboards são especificação, não interface. Divergência necessária vira nota no relatório da task, com o motivo.
- **Confiança sem depoimento:** nunca exibir depoimento, nota, número de clientes ou contador que não venha de dado real. O bloco de confiança (`TrustBlock`) usa só fatos do produto: custo por convidado calculado do plano, "o evento já nasce no ar, grátis", "Pix único; se expirar, nada é cobrado", "ninguém é barrado: 10% de folga".
- **Copy:** pt-BR, voz do Design System (espirituosa, afetuosa, precisa), sem emoji, corpo de texto ≥ 17 px no mobile. "MemoriesMT" escrito numa palavra. Não anunciar funcionalidade inexistente.
- **Acessibilidade:** WCAG 2.2 AA (DSV-003). Alvos ≥ 44 px, foco visível, `aria-live` em mudanças de estado de pagamento.
- **Aceite físico:** iPhone/Safari e Android/Chrome reais. Emulação não substitui e deve ser rotulada como emulação.
- **Autonomia:** execução técnica autônoma, sem aprovações intermediárias. **Proibido:** promover produção, fazer cobrança real ou trocar para chave `abc_prod_` sem autorização explícita do dono para aquela versão.

## Review Focus

1. **Pix pago depois que o pedido expirou localmente ou foi substituído.** O pagamento precisa ser reconhecido: o pedido vira `pago` e o benefício é aplicado se o evento não tiver plano igual ou maior. Senão, o pedido é marcado `reembolso_pendente` para o Master. Nunca se perde dinheiro em silêncio. Teste na Task 4 (`late_paid_after_expired`) e na Task 6.
2. **Organizador volta para `/painel/[id]/plano` em outro aparelho ou dias depois.** A página mostra o estado real do pedido aberto (QR válido, expirado ou pago) sem gerar cobrança nova. Teste na Task 9 (e2e `retomar-pedido`).
3. **Evento antigo criado antes deste lote, com capacidade 200 ou ilimitada.** Continua funcionando igual, via direito `legado` criado na migration. Teste na Task 2 (`legacy_events_keep_limits`).
4. **Convidado nº 11 entra numa festa grátis durante o evento.** Entra até o limite de tolerância (`capacity_grace_pct`, padrão 10% → 11º entra, 12º não). O painel avisa o anfitrião. Teste na Task 3 (`grace_allows_eleventh`).
5. **Webhook com `devMode` divergente do ambiente configurado** (evento de sandbox chegando com `ABACATEPAY_ENV=production`, ou o contrário). É rejeitado, registrado e nunca libera benefício. Teste na Task 6 (`rejects_devmode_mismatch`).

---

## 1. Escopo consolidado (corte fechado)

### 1.1 O que o estudo comprovou (base das tarefas)

Referências AppLlama (app e tela). Os IDs abrem em appllama.io pelo "Copy Screen ID".

| Princípio | Referência | Aplicação |
|---|---|---|
| Criação em poucos passos, cada escolha com prévia do efeito | POV `1636032890/onb_y0e6f`, `onb_5tkvu`, `onb_bfw0o` | Assistente em 4 passos com prévia (Task 12) |
| A cobrança vem ao publicar, depois do investimento; grátis pré-selecionado; "inclui / não inclui" | POV `onb_uwatg`, `pay_pkrtk` | Escolha de plano no último passo e na página de plano (Tasks 9, 12) |
| Convite com nome, data e um CTA; câmera pedida com motivo; aviso da revelação antes da 1ª foto | POV `oth_sfl7s`, `oth_0izco`, `oth_n6s7m` | Convite com 3 linhas e pré-permissão (Task 13) |
| Contador grande de fotos restantes; escolha Câmera / Galeria | POV `oth_omhw0`; Momo `1658822260/oth_xmbc5` | Câmera e galeria (Task 13) |
| Revelação apresentada como benefício | Dispo `1491684197/onb_7ctws` | Copy da espera (Task 13) |
| Painel "no ar" com prévia e 3 ações; ajustes com linha do plano | POV `onb_ukgvi`, `oth_yv1xv` | Painel (Task 14) |
| Card de QR "sem baixar app" | POV `oth_7r7pp` | Copy do card A6 (Task 14) |

Mercado: o POV fatura cerca de US$ 200 mil/mês (AppLlama, set/2026) cobrando **por evento, em faixas de participantes**. Isso confirma o modelo por evento do GTM, mas não valida preços em reais.

### 1.2 Defeitos atuais (entram obrigatoriamente)

| ID estudo | Defeito | Prova | Backlog | Task |
|---|---|---|---|---|
| UX-01 | "Entrar como outra pessoa" encerra a sessão anônima na nuvem (perde fotos, fura quota e lotação) | `web/src/app/e/[code]/(app)/voce/page.tsx:92-93`; `repositories/supabase/index.ts:298` | novo | 11 |
| UX-02 | O fallback de galeria usa `capture="environment"` e abre a câmera | `postar/page.tsx:165` | UXA-122 (parcial) | 13 |
| UX-03 | Botões de exemplo da home gravam evento falso no banco remoto | `web/src/app/page.tsx:36-41,75-76`; `features/demo/seed.ts` | UXA-123 | 11 |
| UX-04 | `rate-limited`/`forbidden` aparecem como "Código não confere"; falha de `ensureSession` não tratada | `features/participants/service.ts:21`; `e/[code]/page.tsx:33-35` | novo | 13 |
| UX-05 | Capacidade padrão 50 → aviso "teria valor" + CTA "Criar evento de demonstração" | `features/events/wizard.tsx:43,193-206` | UXA-126 | 12 |
| UX-06 | Textos do modo local na nuvem; painel sem sessão diz que o evento "não existe" | `e/[code]/page.tsx:53`, `(app)/layout.tsx:106`, `painel/[id]/layout.tsx:49`, `downloads/page.tsx:24,38`, `error.tsx:11`, `offline/page.tsx:12`, `StorageBanner.tsx:15` | UXA-112 | 11 |
| UX-07 | Falha de rede vira "Verifique o espaço livre"; barra de progresso fixa em 60; sem nova tentativa | `postar/page.tsx:100,156` | novo (CR-17 parcial) | 13 |
| UX-09 | "Remover" foto e momento num toque, sem confirmação ou desfazer | `painel/[id]/conteudo/page.tsx:41`, `momentos/page.tsx:44` | novo | 14 |
| UX-10 | Agora/painel não atualizam: sem polling nem `visibilitychange` | `features/app/hooks.ts:66-75` | novo | 13 |
| UX-11 | `/painel/<id malformado>` fica "Abrindo o painel…" para sempre (visto no preview) | console `RepositoryError invalid input syntax for type uuid` | BG-107 (parente) | 11 |
| UX-12/13/14/15 | "Copiado" mesmo quando falha; `?erro=login` ignorado; "Baixar foto" mudo; configurações sem retorno de "Salvo" | `criar/pronto/[id]/page.tsx:38,60`; `auth/callback/route.ts:11,14`; `features/photos/share.ts:12`; `configuracoes/page.tsx:32` | novo | 11, 14 |
| RV-M-01 | O organizador grava `capacity`/`shots_per_person` livremente: não existe paywall no servidor | `20261021000200_rls_and_rpcs.sql:23,40-41`; `events_guard` não confere | COM-003 | 2, 3 |

### 1.3 Acabamento necessário (entra)

- Home com proposta de valor, "como funciona", resumo dos planos ativos e câmera de exemplo sem cadastro em memória (substitui o seed).
- Rodapé público com termos, privacidade, ajuda, contato e dados da empresa.
- Página `/precos` e página `/ajuda`.
- Remover da experiência pública: `/design` (404 em produção), o link "Guia de componentes", `BackendNotice` no modo nuvem, os textos de demonstração de preço e o banner "Rascunho" quando houver versão final dos documentos legais (UXA-123).
- Assistente em 4 passos: identidade sai do assistente e vai para o Studio do painel (UXA-108 parcial, UXA-110 se ainda aberto).
- Convite do convidado com 3 linhas (fotos, revelação, quem vê) a partir de `event_preview`, pré-permissão de câmera e copy de espera e de pós-revelação com "Criar o meu evento".
- Painel com cartão "Plano" e checklist "Antes do grande dia".
- Estados de carregamento visíveis (UXA-111), plural correto (UXA-117) e `<h1>` nas telas (UXA-119).

### 1.4 Monetização (entra)

- **Planos e direitos no banco** (COM-001), **limites impostos pelo servidor** (COM-003) e **Pix AbacatePay com webhook idempotente e conciliação** (COM-002, só Pix).
- **Página de plano e checkout** (COM-006).
- **Master "Pagamentos"** (COM-007 mínimo): lista de pedidos, divergências, cortesia auditada (RV-M-14), reembolso integral solicitado pelo Master e catálogo/ativação de planos com motivo.
- **Tolerância de lotação** configurável (RV-M-02 mínimo).
- **Upgrade cobra só a diferença entre faixas**, calculada no servidor (RV-M-12 mínimo).
- **Códigos de cortesia** (COM-017): o Master gera códigos que liberam um plano sem pagamento (teste ou presente); o organizador resgata no Plano ou em Ajustes, ou por link `/c/<código>`.

### 1.5 Fora do corte (evoluções posteriores, não implementar)

- **Pagamento:**
  - cartão e parcelamento (liberação de conta AbacatePay, RV-M-05);
  - assinatura/B2B e pacotes de parceiro;
  - link de pagamento para terceiros (padrinho) e lista de espera de convidados excedentes;
  - botão de arrependimento self-service e regra automática dos 7 dias (CDC art. 49; depende de D3);
  - congelamento automático em disputa (RV-M-03; aqui disputa só gera alerta).
- **Fiscal e e-mail:** NFS-e (RV-M-08); e-mail transacional (COM-005, tela L3).
- **Convidado** (telas já desenhadas, itens no backlog): fila offline persistente (BG-071; nota em E4); "+10 fotos da galeria depois da festa" (COM-014, tela L1); álbum impresso (COM-015, tela L2, sem preço até existir fornecedor); aviso de revelação por e-mail ou push (COM-005/FT-081, tela L3; o botão "Me avise" de G5 fica oculto neste lote); Agora instantâneo via Realtime (SB-006/FT-084, tela L4).
- **Prova social:** depoimentos reais, com autorização, cadastrados no Master (COM-016). Até lá vale o `TrustBlock`.
- **Organizador e plataforma:** rascunho/publicação do Studio; onboarding de propósito (FT-006); antifraude de eventos grátis múltiplos (RV-M-10).

### 1.6 Decisões comerciais/jurídicas pendentes (o executor NÃO decide; o plano funciona sem elas)

| ID | Decisão | Comportamento até a decisão |
|---|---|---|
| D1 | ~~Preços e limites dos planos pagos~~ **APROVADO em 22/10/2026:** Festa 30/24/R$ 29; Celebração 100/24/R$ 89; Casamento 250/36/R$ 189; Grande 500/ilimitado/R$ 349 | Seed com esses valores, `sandbox_active=true`, `production_active=true`. Alteração futura só pelo Master (M2), com motivo e auditoria |
| D2 | ~~Limite de fotos do Grátis~~ **APROVADO em 22/10/2026:** Grátis = 10 convidados e 10 fotos por pessoa | Eventos existentes mantêm o que têm pelo direito `legado` |
| D3 | Regra de reembolso/arrependimento e texto legal de pagamento | Só reembolso integral iniciado pelo Master com motivo; termos atuais mantidos |
| D4 | Tolerância de lotação | `capacity_grace_pct = 10` em `platform_settings`, alterável no Master sem deploy |
| D5 | CNPJ, razão social, e-mail e telefone de suporte | Rodapé mostra só o que estiver preenchido em `platform_settings`; produção AbacatePay exige CNPJ (ver 6) |
| D6 | NFS-e e regime fiscal | Bloqueia venda real (seção 6), não bloqueia o sandbox |
| D7 | Projeto Supabase separado para homologação | Recomendado; o plano funciona com o projeto único, isolando sandbox por `env` nos direitos |

### 1.7 Telas de referência (seguir na implementação)

Fonte: `docs/design/app-proposto/` (PNG em `png/`). Códigos iguais aos títulos do canvas.

| Tela | Rota / componente | Task |
|---|---|---|
| Main (O0) · E6 home com `?erro=login` | `/` | 14 · 11 |
| O1 Nome · O2 Quando · O3 Fotos · O4 Convidados, plano e aceite | `/criar` (assistente) | 12 |
| O7 Evento criado (inclui falha ao copiar) | `/criar/pronto/[id]` | 11 |
| O5 Painel · P1 Ajustes (aviso de lotação) | `/painel/[id]`, `/painel/[id]/configuracoes` | 14 |
| O6 Card A6 · O9 QR e cards | `/painel/[id]/qr` | 14 |
| O8 Confirmar remoção | `/painel/[id]/conteudo`, `momentos` | 14 |
| O10 Aparência | `/painel/[id]/aparencia` (Studio) | 14 |
| E5 Painel não encontrado | `/painel/[id]` com id inválido | 11 |
| B1 Plano · B2 Pix pendente · B3 Pago · B4 Expirado · B5 Falhou · B6 Provedor fora · B7 Pagamentos desligados | `/painel/[id]/plano` (`PlanPicker`, `PixCheckout`, `TrustBlock`) | 9 |
| G1 Convite · E1 Muita gente · E2 Convite inativo | `/e/[code]` | 13 |
| G2 Permissão · G3 Câmera · G4 Câmera negada · E3 Enviando · E4 Sem sinal | `/e/[code]/postar` | 13 |
| G5 Espera (sem o botão "Me avise") · G6 Revelado (sem o cartão de álbum impresso) | `/e/[code]/agora` | 13 |
| M1 Pagamentos · M2 Planos e preços (desktop) | `/master/pagamentos`, `/master/planos` | 7 |
| M3 Códigos de cortesia (desktop) | `/master/codigos` | 7A |
| B8 Tenho um código (com erro) · B9 Código aplicado | `/painel/[id]/plano` (`RedeemCode`) | 9 |
| P2 Ajustes › Código de presente | `/painel/[id]/configuracoes` (mesmo `RedeemCode` em Sheet) | 14 |
| link `/c/<código>` (sem tela própria) | guarda o código e abre `/criar`; aplica ao criar o evento e mostra B9 | 12 |
| S1 Preços · S2 Ajuda · rodapé (S1/S2) | `/precos`, `/ajuda`, `SiteFooter` | 14 |
| S3 Exemplo | `/exemplo` | 10 |
| L1–L4 | fora do lote (backlog) | — |

Placeholders `{razão social}`, `{cnpj}` e `{e-mail de suporte}` vêm de `get_public_settings()` e somem quando vazios. Dados das tabelas do Master (M1/M2) são ilustrativos.

---

## 2. Estrutura de arquivos

**Banco (`supabase/`)**
- `migrations/<N1>_plans_entitlements.sql`:
  - `plans`, `event_entitlements` e as configurações de pagamento;
  - `effective_entitlement()` e `payments_env()`;
  - backfill `legado`.
- `migrations/<N2>_entitlement_enforcement.sql`:
  - `events_guard` com limites de plano;
  - `join_event` com tolerância;
  - `event_preview` com campos do convite.
- `migrations/<N3>_payments.sql`:
  - `payment_status`, `payment_orders`, `payment_events`;
  - RPCs `payments_*` (organizador e serviço).
- `migrations/<N4>_payments_admin_public.sql`:
  - RPCs `admin_*` de pagamentos;
  - `get_public_settings()` e `list_public_plans()`;
  - job `mm-payments-reconcile`.
- `tests/database/07_entitlements.test.sql`, `08_payments.test.sql`, `09_payments_admin.test.sql`.
- `functions/_shared/abacatepay.ts`: cliente HTTP v2, `fetch` puro, sem SDK.
- `functions/_shared/payments-webhook-auth.ts`: segredo + HMAC, via Web Crypto.
- `functions/_shared/payments-status.ts`: mapeamento de status.
- `functions/_shared/payments.test.ts`: testes puros, rodados por vitest.
- Edge Functions: `functions/payments-checkout/index.ts`, `payments-status/index.ts`, `payments-webhook/index.ts`, `payments-reconcile/index.ts` e `payments-refund/index.ts`.
- `config.toml`: entradas `[functions.payments-*]`.

**Web (`web/src/`)**
- `features/billing/`:
  - `types.ts`;
  - `api.ts` (chama as functions e RPCs);
  - `PlanPicker.tsx`, `PixCheckout.tsx`, `PlanCard.tsx`, `TrustBlock.tsx`;
  - `billing.test.ts`.
- `app/painel/[id]/plano/page.tsx`, `app/precos/page.tsx`, `app/ajuda/page.tsx`, `app/exemplo/page.tsx`.
- `components/memoriesmt/SiteFooter.tsx`.
- `app/master/pagamentos/page.tsx` e `app/master/planos/page.tsx`, mais as entradas em `app/master/modules.ts`.
- Modificar:
  - `app/page.tsx`;
  - `features/events/wizard.tsx` e `features/events/service.ts`;
  - `domain/pricing.ts` (removido; regra vai para o servidor);
  - `domain/options.ts`;
  - `lib/services/index.ts` (remove `localBilling`/`DemoOnlyError`/`purchase`);
  - `app/e/[code]/page.tsx`, `(app)/layout.tsx`, `(app)/postar/page.tsx`, `(app)/voce/page.tsx`, `(app)/agora/page.tsx`;
  - `app/painel/[id]/layout.tsx`, `page.tsx`, `configuracoes/page.tsx`, `conteudo/page.tsx`, `momentos/page.tsx`, `downloads/page.tsx`;
  - `app/criar/pronto/[id]/page.tsx`, `app/design/page.tsx`, `app/error.tsx`, `app/offline/page.tsx`;
  - `features/app/backend-notice.tsx`, `features/app/hooks.ts`, `features/participants/service.ts`;
  - `features/consent/LegalPage.tsx`, `features/studio/AppearanceStudio.tsx`.
- `repositories/types.ts` e `repositories/supabase/index.ts`: preview com campos novos e erro `not-entitled`.
- Testes e configs:
  - `web/e2e/payments.spec.ts`, `web/e2e/produto.spec.ts`;
  - `web/e2e/fixtures/fake-abacatepay.mjs`;
  - `web/vitest.functions.config.ts`;
  - `.github/workflows/ci.yml` (job `web`).

**Docs**
- `docs/supabase/PAYMENTS-RUNBOOK.md`: configuração, segredos, webhook, conciliação, reembolso, troca para produção, rollback.
- `docs/supabase/PRODUCT-PRODUCTION-HOMOLOGATION.md`: matriz preenchida com evidências.

---

## 3. Contratos

### 3.1 Estados

`public.payment_status` é o enum: `criado | pendente | pago | expirado | cancelado | falhou | estornado | em_disputa | perdido`.

| Status do provedor (`transparent.status`) | Estado local |
|---|---|
| `PENDING` | `pendente` |
| `PAID`, `APPROVED` | `pago` |
| `EXPIRED` | `expirado` |
| `CANCELLED` | `cancelado` |
| `FAILED` | `falhou` |
| `REFUNDED` | `estornado` |
| `UNDER_DISPUTE` | `em_disputa` |
| `REDEEMED` | não usado; tratado como `pago` só se `amount = 0`, senão divergência |
| desconhecido | não aplica; registra divergência |

Transições permitidas, validadas por `payments_apply_status`:
- `criado → pendente | falhou`
- `pendente → pago | expirado | cancelado | falhou`
- `expirado → pago` e `falhou → pago` (pagamento tardio aceito; o provedor manda)
- `pago → estornado | em_disputa`
- `em_disputa → pago | perdido | estornado`

Qualquer outra transição é ignorada (no-op idempotente) e registrada em `payment_events.outcome='transicao_ignorada'`. Como o estado aplicado vem sempre de uma reconsulta, eventos fora de ordem convergem para o estado real do provedor.

### 3.2 SQL (assinaturas que as tasks seguintes consomem)

**Ambiente e plano efetivo**
- `public.payments_env() returns text`: `'desligado' | 'sandbox' | 'production'`, lido de `platform_settings.payments_env`.
- `public.effective_entitlement(p_event uuid) returns table(plan_code text, max_guests int, max_shots int, source text)`:
  - considera direitos `status='ativo'` com `env in (payments_env(), 'nenhum')`;
  - `max_guests`/`max_shots` são o maior valor, e `null` significa sem limite e vence;
  - sem direito válido, usa o plano `gratis`.

**RPCs do organizador** (só `authenticated`, só o anfitrião do evento)
- `public.payments_quote(p_event uuid, p_plan text) returns jsonb`: `{planCode, fromPlanCode, amountCents, payable, reason}`.
  - `reason` ∈ `ja_incluido | plano_inativo | evento_encerrado | ok`.
  - `amountCents = price(p_plan) − price(plano pago atual)`, nunca negativo.
- `public.payments_open_order(p_event uuid, p_plan text, p_idempotency_key uuid) returns jsonb`: `{orderId, status, amountCents, brCode, brCodeBase64, expiresAt, reused}`.
  - Reusa o pedido aberto (`criado|pendente` e não vencido) do mesmo evento.
  - Recusa, com `MM013 pedidoaberto`, um plano diferente enquanto houver Pix pendente válido.
- `public.payments_order_status(p_order uuid) returns jsonb`: `{orderId, status, planCode, amountCents, brCode, brCodeBase64, expiresAt, paidAt}`.

**RPCs de serviço** (só `service_role`)
- `public.payments_attach_charge(p_order uuid, p_charge_id text, p_brcode text, p_brcode_base64 text, p_expires_at timestamptz, p_dev_mode boolean) returns void`.
- `public.payments_apply_status(p_order uuid, p_charge_id text, p_status public.payment_status, p_amount_cents int, p_dev_mode boolean, p_source text) returns jsonb`: `{applied boolean, from, to, entitlementId}`. `p_source` ∈ `webhook | status | reconcile`.
- `public.payments_record_event(p_provider_event_id text, p_type text, p_order uuid, p_outcome text, p_detail jsonb) returns boolean`: `false` se o evento é duplicado.

**RPCs do Master** (`is_master()` e motivo de 10 a 500 caracteres)
- `public.admin_list_payments(p_status text default null, p_limit int default 100) returns setof jsonb`.
- `public.admin_payment_divergences() returns setof jsonb`.
- `public.admin_grant_courtesy(p_event uuid, p_plan text, p_reason text) returns uuid`.
- `public.admin_request_refund(p_order uuid, p_reason text) returns void`.
- `public.admin_set_plan(p_code text, p_price_cents int, p_sandbox_active boolean, p_production_active boolean, p_reason text) returns void`: plano pago exige `p_price_cents >= 100`; o `gratis` não muda de preço; grava `audit_logs` com valor anterior e novo; não toca em pedidos existentes (o valor do pedido é gravado nele na criação).
- `public.admin_list_plans() returns setof jsonb`: todos os planos, ativos ou não, com `updated_at` e as 10 últimas alterações de `audit_logs` (para M2).

**Códigos de cortesia** (COM-017)
- Tabelas: `public.courtesy_codes(id uuid pk, code_hash text unique not null, code_hint text not null, plan_code text not null references plans, max_uses int not null check (max_uses between 1 and 1000), uses int not null default 0, expires_at timestamptz not null, note text not null, created_by uuid not null, created_at timestamptz default now(), revoked_at timestamptz)` e `public.courtesy_redemptions(id uuid pk, code_id uuid references courtesy_codes, event_id uuid references events on delete cascade, user_id uuid not null, entitlement_id uuid, created_at timestamptz default now(), unique(code_id, event_id))`. Sem grant direto para clientes.
- Código: `MMT-XXXX-XXXX` com alfabeto sem ambiguidade (`ABCDEFGHJKMNPQRSTUVWXYZ23456789`), 8 caracteres aleatórios de `gen_random_bytes`. Guardado só como `code_hash = encode(digest(upper(regexp_replace(code,'[^A-Za-z0-9]','','g')),'sha256'),'hex')`; `code_hint` = primeiros 8 caracteres (`MMT-7KQ4`).
- `public.admin_create_code(p_plan text, p_max_uses int, p_expires_at timestamptz, p_note text) returns text`: só Master; nota de 3 a 200 caracteres; devolve o código inteiro **uma única vez**; audita sem o código.
- `public.admin_list_codes() returns setof jsonb` e `public.admin_revoke_code(p_code_id uuid, p_reason text) returns void` (motivo 10–500).
- `public.redeem_code(p_event uuid, p_code text) returns jsonb` (`authenticated`, só anfitrião): `{applied boolean, planCode, reason}` com `reason` ∈ `ok | ja_incluido | invalido | muitas_tentativas`.
  - inexistente, expirado, esgotado e revogado → todos `invalido` (mesma resposta);
  - 5 `invalido` por usuário em 10 min → `muitas_tentativas` por 10 min (contagem em `audit_logs` ou tabela própria);
  - evento já com plano igual ou maior → `ja_incluido`, sem consumir uso;
  - `ok` → `uses = uses + 1` com `select … for update`, cria direito `source='codigo'`, `env='nenhum'`, e aplica capacidade/fotos como o pagamento;
  - mesmo código no mesmo evento duas vezes → `ja_incluido` (unique).

**Públicas** (`anon` + `authenticated`)
- `public.get_public_settings() returns jsonb`: só as chaves `support_email`, `support_phone`, `company_legal_name`, `company_cnpj`, `payments_env`.
- `public.list_public_plans() returns jsonb`: planos ativos no ambiente vigente, mais o `gratis`.

**Novos erros**
- `MM012 notentitled`: capacidade ou fotos acima do plano.
- `MM013 pedidoaberto`.
- `MM014 pagamentoindisponivel`: `payments_env='desligado'` ou plano inativo.

### 3.3 Edge Functions

| Função | Auth | Entrada | Saída |
|---|---|---|---|
| `payments-checkout` | `verify_jwt=true` (anfitrião) | `POST {eventId, planCode, idempotencyKey}` | `200 {orderId,status,amountCents,brCode,brCodeBase64,expiresAt}`; `409 {error:"pedido_aberto", orderId}`; `422 {error:"plano_inativo"\|"ja_incluido"\|"evento_encerrado"}`; `502 {error:"provedor_indisponivel", orderId}` |
| `payments-status` | `verify_jwt=true` (anfitrião) | `POST {orderId}` | `200` igual a `payments_order_status`. Se `pendente` e `last_checked_at` tiver mais de 15 s, reconsulta o provedor antes |
| `payments-webhook` | `verify_jwt=false`; `?webhookSecret` + `X-Webhook-Signature` | corpo bruto AbacatePay `{id, event, apiVersion:2, devMode, data}` | `200 {ok:true}` (inclusive duplicado ou ignorado); `401` sem autenticação válida; `500` só se o banco falhar (força retentativa) |
| `payments-reconcile` | `verify_jwt=false`; `Authorization: Bearer PAYMENTS_CRON_TOKEN` | `POST` | `200 {verificados, aplicados, falhas}` |
| `payments-refund` | `verify_jwt=true`; chamador precisa de `rpc('is_master')=true` | `POST {orderId}` (pedido com `refund_requested_at`) | `200 {ok:true}`; o estado `estornado` chega pelo webhook ou pela reconsulta |

Cliente AbacatePay (`supabase/functions/_shared/abacatepay.ts`):
- `type AbacateConfig = { apiKey: string; baseUrl: string; fetchImpl?: typeof fetch }`.
- `createPixCharge(cfg, { amountCents: number; expiresInSec: number; description: string; externalId: string; metadata: Record<string,string> }): Promise<{ id: string; status: string; brCode: string; brCodeBase64: string; expiresAt: string; devMode: boolean; amount: number }>`
  - `POST /transparents/create`, corpo `{method:"PIX", data:{amount, expiresIn, description, externalId, metadata}}`.
  - Sem `customer`, para não coletar CPF.
- `checkPixCharge(cfg, id: string): Promise<{ id: string; status: string; devMode: boolean; amount?: number; expiresAt?: string }>`: `GET /transparents/check?id=`.
- `refundCharge(cfg, id: string, reason: string): Promise<void>`: `POST /transparents/refund`.
- `simulatePixPayment(cfg, id: string): Promise<void>`: `POST /transparents/simulate-payment?id=`. Recusa se `cfg.apiKey` não começa com `abc_dev_`.
- Em todas: `Authorization: Bearer <apiKey>`. Verificar `success === true` no envelope `{data, success, error}`. Lançar `AbacateError { kind: 'auth'|'permission'|'rate_limit'|'provider'|'network'|'invalid', status }` sem incluir a chave nem o corpo bruto.

---

## 4. Tarefas

### Task 0: Registrar no backlog os itens adiados que já têm tela

**Files:** Modify `docs/backlog/backlog.json` (fonte de verdade) e regenerar `docs/backlog/BACKLOG.md` com `docs/backlog/tools/backlog.py`.

- [ ] **Step 1:** Acrescentar, no épico comercial e no formato dos COM existentes, com status `BACKLOG`, origem "telas do app proposto 2026-10-22" e a tela como evidência de desenho:
  - `COM-014` "+10 fotos da galeria depois da festa (por convidado, até a revelação)" — tela L1; depende de COM-003;
  - `COM-015` "Álbum impresso da festa (sob encomenda; sem preço até haver fornecedor)" — tela L2;
  - `COM-016` "Depoimentos reais com autorização, cadastrados no Master e exibidos no plano e em /precos" — telas O4/B1/S1; depende de COM-007;
  - `COM-017` "Códigos de cortesia: Master gera, organizador resgata (Plano, Ajustes ou link /c/)" — telas M3/B8/B9/P2; status `READY`, entra neste lote (Task 7A).
- [ ] **Step 2:** Nos itens existentes `COM-005`, `FT-081`, `BG-071`, `SB-006` e `FT-084`, acrescentar a referência à tela (L3, L3, E4, L4, L4) sem mudar status.
- [ ] **Step 3:** Rodar o gerador e conferir que `BACKLOG.md` lista os três IDs novos.
- [ ] **Step 4:** Commit `docs(backlog): registra itens com tela desenhada (COM-014/015/016/017)`.

> Antes da Task 1: criar a worktree com superpowers:using-git-worktrees, branch `feat/product-production` a partir de `origin/feat/memoriesmt-studio` (A). Ao iniciar, rodar `git log -1 --format=%H origin/feat/memoriesmt-studio`, registrar o SHA base e numerar as migrations a partir da última existente nele. Se A avançar durante a execução, fazer rebase antes da homologação final.

### Task 1: Base de testes e CI do `web/`

**Files:**
- Modify: `.github/workflows/ci.yml`
- Create: `web/vitest.functions.config.ts`

**Interfaces:**
- Produces: comando `npx vitest run --config vitest.functions.config.ts` (executado em `web/`), que roda `../supabase/functions/_shared/**/*.test.ts` em ambiente `node` com Web Crypto.

- [ ] **Step 1:** Adicionar ao `ci.yml` o job `web`, com `working-directory: web`:
  - `npm ci`;
  - `npm run typecheck`;
  - `npm run lint`;
  - `npm test`;
  - `npx vitest run --config vitest.functions.config.ts`.

  Manter o job `test` e o Gitleaks existentes.
- [ ] **Step 2:** Criar `web/vitest.functions.config.ts` com `test.include: ["../supabase/functions/_shared/**/*.test.ts"]` e `environment: "node"`.
- [ ] **Step 3:** Run: `cd web && npm test && npx vitest run --config vitest.functions.config.ts --passWithNoTests`. Expected: suíte atual verde (≥ 278) e 0 falhas.
- [ ] **Step 4:** Commit `ci(web): roda typecheck, lint e testes do web/ e das functions`.

### Task 2: Planos, direitos e backfill (COM-001)

**Files:**
- Create: `supabase/migrations/<N1>_plans_entitlements.sql`
- Test: `supabase/tests/database/07_entitlements.test.sql`

**Interfaces:**
- Produces:
  - tabelas `public.plans(code text pk, name text not null, max_guests int null, max_shots int null, price_cents int not null check (price_cents >= 0), sort int not null, is_free boolean not null default false, sandbox_active boolean not null default false, production_active boolean not null default false, features jsonb not null default '[]', updated_at timestamptz not null default now())`;
  - `public.event_entitlements(id uuid pk default gen_random_uuid(), event_id uuid not null references events on delete cascade, plan_code text not null references plans, max_guests int null, max_shots int null, source text not null check (source in ('gratis','legado','pago','cortesia','codigo')), order_id uuid null, status text not null default 'ativo' check (status in ('ativo','estornado','revogado')), env text not null check (env in ('sandbox','production','nenhum')), reason text, created_by uuid, created_at timestamptz not null default now())`;
  - `payments_env()` e `effective_entitlement()` (seção 3.2);
  - chaves em `platform_settings`: `payments_env` = `"desligado"`, `capacity_grace_pct` = `10`, `support_email`, `support_phone`, `company_legal_name`, `company_cnpj` = `null`.
- RLS:
  - `plans`: select para `anon`/`authenticated` só via `list_public_plans`, sem grant direto;
  - `event_entitlements`: select para o anfitrião (`is_host(event_id)`) e para o Master; sem insert/update/delete de cliente.

- [ ] **Step 1: Write the failing test** `07_entitlements.test.sql`, com fixtures de `02_v2_studio_admin` como modelo. Asserts:
  - `legacy_events_keep_limits`: evento criado antes da migration com `capacity=200, shots=36` → `effective_entitlement` = `(legado, 200, 36)`;
  - evento com `capacity null` → `max_guests is null`;
  - `free_default`: evento novo sem direito → `('gratis', 10, 10)`;
  - `seed_prices`: `select code, max_guests, max_shots, price_cents, sandbox_active, production_active from plans order by sort` devolve exatamente os 5 planos aprovados (seção Global Constraints), todos ativos nos dois ambientes;
  - `sandbox_ignored_when_off`: direito `pago` com `env='sandbox'` e `payments_env='desligado'` → volta ao grátis;
  - com `payments_env='sandbox'` → o direito vale;
  - `cortesia` com `env='nenhum'` vale em qualquer ambiente;
  - organizador não lê direitos de evento alheio;
  - organizador não insere em `event_entitlements` (erro de privilégio).
- [ ] **Step 2:** Run `supabase test db` (stack local). Expected: FAIL em 06.
- [ ] **Step 3: Implement** a migration:
  - seed de `plans`:
    - `('gratis','Grátis',10,10,0,0,true,true,true)`;
    - os 4 planos aprovados em 22/10/2026 (D1) com `sandbox_active=true, production_active=true`: `festa` 30/24/2900, `celebracao` 100/24/8900, `casamento` 250/36/18900, `grande` 500/null/34900;
  - backfill: um direito `legado`/`nenhum`/`ativo` para **cada evento existente** com seus `capacity`/`shots_per_person` atuais;
  - funções `stable security definer set search_path=''`.
- [ ] **Step 4:** Run `supabase test db`. Expected: PASS, mais as suítes 01–05 continuam verdes.
- [ ] **Step 5:** Commit `feat(db): planos, direitos por evento e backfill legado (COM-001)`.

### Task 3: Limites impostos pelo servidor (COM-003, RV-M-01/02)

**Files:**
- Create: `supabase/migrations/<N2>_entitlement_enforcement.sql`
- Modify: `web/src/repositories/supabase/index.ts` (mapear `MM012` → `RepositoryErrorCode` `"not-entitled"`), `web/src/repositories/types.ts`
- Test: `supabase/tests/database/07_entitlements.test.sql` (acrescentar)

**Interfaces:**
- Consumes: `effective_entitlement` (Task 2).
- Produces:
  - `events_guard`, quando o chamador não é privilegiado e **o valor mudou** (`new.capacity is distinct from old.capacity` no UPDATE, sempre no INSERT), levanta `MM012` se:
    - `capacity` for `null` e o plano tiver limite;
    - `capacity` passar de `max_guests`;
    - o mesmo valer para `shots_per_person`/`max_shots`.

    Editar outros campos de um evento que ficou acima do plano (por exemplo, depois de um estorno) nunca é bloqueado.
  - No INSERT sem `capacity`, ela vira `max_guests` do grátis (10); sem `shots_per_person`, vira `max_shots` do grátis (10).
  - `join_event`:
    - recusa com `MM003` só quando `participants >= capacity + ceil(capacity * capacity_grace_pct / 100.0)`;
    - ao passar de `capacity`, grava `audit(event,'capacity.grace_used', {count})`.
  - `event_preview` passa a devolver também `shotsPerPerson`, `revealAt`, `revealStatus`, `timezone`, `everyoneSeesAll` e `planCode`.

- [ ] **Step 1: Write failing tests:**
  - `host_cannot_raise_capacity_without_plan`: UPDATE `capacity=200` como anfitrião → `throws_ok(…,'MM012')`;
  - o mesmo com `capacity=null`;
  - o mesmo com `shots_per_person=36` quando o direito tem `max_shots=24`;
  - `host_can_lower_capacity`: 10 → 8 passa;
  - `edit_title_over_plan_allowed`: evento com `capacity=100` e direito grátis (pós-estorno) → UPDATE só do `title` passa;
  - `grace_allows_eleventh`: grátis, 10 participantes → 11º `join_event` ok; 12º → `MM003`;
  - `service_role_can_set_capacity`;
  - `event_preview` contém as chaves novas.
- [ ] **Step 2:** Run `supabase test db`. Expected: FAIL nas novas.
- [ ] **Step 3: Implement** com `create or replace` de `events_guard`, `join_event` e `event_preview`, preservando integralmente a lógica atual (copiar a versão vigente da migration mais recente que a define). Mapear `MM012` no adaptador.
- [ ] **Step 4:** Run `supabase test db && cd web && npm test`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(db): limites de plano no servidor e tolerância de lotação (COM-003)`.

### Task 4: Pedidos, eventos de pagamento e máquina de estados (COM-002, RV-M-09)

**Files:**
- Create: `supabase/migrations/<N3>_payments.sql`
- Test: `supabase/tests/database/08_payments.test.sql`

**Interfaces:**
- Consumes: `plans`, `event_entitlements`, `effective_entitlement`.
- Produces:
  - `public.payment_orders`:
    - colunas `id uuid pk`, `event_id uuid not null references events`, `host_id uuid not null`, `plan_code text not null references plans`, `from_plan_code text null`, `amount_cents int not null check (amount_cents >= 100)`, `currency text not null default 'BRL'`, `status payment_status not null default 'criado'`;
    - `provider text not null default 'abacatepay'`, `provider_env text not null check (provider_env in ('sandbox','production'))`, `provider_charge_id text unique`;
    - `idempotency_key uuid not null`, `brcode text`, `brcode_base64 text`, `expires_at timestamptz`, `paid_at timestamptz`, `last_checked_at timestamptz`;
    - `refund_requested_at timestamptz`, `refund_reason text`, `needs_refund boolean not null default false`;
    - `created_at`, `updated_at`, `version int not null default 1`;
    - índices `unique (host_id, idempotency_key)` e `unique (event_id) where status in ('criado','pendente')`.
  - `public.payment_events`: `id bigint identity pk`, `provider text`, `provider_event_id text`, `event_type text`, `order_id uuid null`, `received_at timestamptz default now()`, `outcome text`, `detail jsonb` (sem dados pessoais), com `unique (provider, provider_event_id)`.
  - RPCs da seção 3.2: organizador + serviço.
  - Auditoria via `public.audit(event, 'payment.<to>', {orderId, plan, amountCents, env})`.

- [ ] **Step 1: Write failing tests:**
  - `quote_difference`: com plano `celebracao` pago, cotar `casamento` → `amountCents = 10000`;
  - `quote_inactive_plan` → `payable=false, reason='plano_inativo'` quando `payments_env='production'` e `production_active=false`;
  - `open_order_reuses`: 2 chamadas com a mesma chave → mesmo `orderId`, `reused=true`;
  - com chave diferente e pedido pendente válido do mesmo plano → reusa;
  - de outro plano → `MM013`;
  - `open_order_forbidden_other_host` → `MM004`;
  - `apply_paid_grants`: `payments_apply_status(order,'ch1','pago',8900,true,'webhook')` com env `sandbox` → `applied=true`, direito `pago` ativo, `events.capacity = 100`;
  - repetir → `applied=false` (no-op) e um único direito;
  - `rejects_amount_mismatch`: `amount 100` em pedido de 8900 → `applied=false`, `outcome` registrado, sem direito;
  - `rejects_devmode_mismatch`: `dev_mode=false` com `provider_env='sandbox'` → `applied=false`;
  - `late_paid_after_expired`: `expirado → pago` aplica;
  - pedido pago tardio sobre evento que já tem plano igual ou maior → `needs_refund=true` e nenhum direito novo;
  - `refund_reverts`: `pago → estornado` → direito `estornado` e `effective_entitlement` volta ao anterior; `capacity` nunca fica abaixo dos participantes atuais;
  - `record_event_dedup`: segundo `payments_record_event` com o mesmo id → `false`;
  - `client_cannot_call_service_rpcs`: `authenticated` em `payments_apply_status` → erro de permissão;
  - o organizador só lê os próprios pedidos (RLS select `host_id = auth.uid()`).
- [ ] **Step 2:** Run `supabase test db`. Expected: FAIL.
- [ ] **Step 3: Implement** a migration:
  - `payments_open_order` usa `select … for update` na linha do evento;
  - `payments_apply_status` usa `select … for update` no pedido e valida transição, valor e ambiente;
  - ao entrar em `pago`, insere o direito (`source='pago'`, `env=provider_env`, `order_id`) e faz `update events set capacity = greatest(coalesce(capacity,0), plan.max_guests)` e `shots_per_person` análogo, em contexto privilegiado (`null` = ilimitado tem prioridade).
- [ ] **Step 4:** Run `supabase test db`. Expected: PASS em 01–07.
- [ ] **Step 5:** Commit `feat(db): pedidos Pix, idempotência e máquina de estados (COM-002)`.

### Task 5: Cliente AbacatePay e autenticação de webhook (puros, testáveis)

**Files:**
- Create: `supabase/functions/_shared/abacatepay.ts`, `supabase/functions/_shared/payments-webhook-auth.ts`, `supabase/functions/_shared/payments-status.ts`
- Test: `supabase/functions/_shared/payments.test.ts`

**Interfaces:**
- Produces:
  - `abacatepay.ts`: assinaturas da seção 3.3.
  - `verifyWebhookRequest(input: { url: string; rawBody: string; signatureHeader: string | null; expectedSecret: string; hmacKey: string }): Promise<boolean>`:
    - verdadeiro só se `?webhookSecret` for igual a `expectedSecret` (comparação de tempo constante);
    - **e** se `base64(HMAC-SHA256(hmacKey, rawBody))` for igual ao header (tempo constante, comprimentos iguais).
  - `mapProviderStatus(s: string): PaymentStatus | null`, conforme a tabela 3.1.

- [ ] **Step 1: Write failing tests** em vitest, usando `fetchImpl` falso:
  - `createPixCharge envia method PIX, amount em centavos, expiresIn 1800, sem customer, com Authorization Bearer`;
  - `lança AbacateError kind 'auth' em 401 e 'permission' em 403 e 'rate_limit' em 429 sem conter a chave na mensagem`;
  - `trata success:false com HTTP 200 como erro provider`;
  - `simulatePixPayment recusa chave abc_prod_`;
  - `verifyWebhookRequest aceita corpo assinado com a chave publicada e segredo correto`;
  - `recusa segredo errado`, `recusa assinatura de outro corpo`, `recusa header ausente`;
  - `mapProviderStatus('PAID')==='pago'`, `('UNDER_DISPUTE')==='em_disputa'`, `('XYZ')===null`.
- [ ] **Step 2:** Run `cd web && npx vitest run --config vitest.functions.config.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement só com `fetch`, `crypto.subtle` e `btoa`. Nada de `Deno.*`, para que vitest e Deno importem o mesmo arquivo.
- [ ] **Step 4:** Run o mesmo comando. Expected: PASS.
- [ ] **Step 5:** Commit `feat(payments): cliente AbacatePay v2 e verificação de webhook`.

### Task 6: Edge Functions de pagamento

**Files:**
- Create: `supabase/functions/payments-checkout/index.ts`, `payments-status/index.ts`, `payments-webhook/index.ts`, `payments-reconcile/index.ts`, `payments-refund/index.ts`
- Modify: `supabase/config.toml`:
  - `[functions.payments-checkout] verify_jwt = true`;
  - `[functions.payments-status] verify_jwt = true`;
  - `[functions.payments-refund] verify_jwt = true`;
  - `[functions.payments-webhook] verify_jwt = false`;
  - `[functions.payments-reconcile] verify_jwt = false`.
- Create: `web/e2e/fixtures/fake-abacatepay.mjs`: servidor HTTP local que implementa `/v2/transparents/create|check|refund|simulate-payment` com estado em memória e envia webhook assinado para a URL configurada.
- Test: `web/integration/payments.itest.ts`: stack local + `supabase functions serve` + fake.

**Interfaces:**
- Consumes: Tasks 4–5.
- Produces: contratos da tabela 3.3.
- Regras comuns:
  - ler `ABACATEPAY_ENV` e recusar operar (503 `pagamento_indisponivel`) se ele divergir de `payments_env()` ou se `payments_env()='desligado'`;
  - `externalId = orderId`;
  - `metadata = {orderId, eventId, planCode, env}`, sem nome/e-mail;
  - logs com `console.log(JSON.stringify({fn, orderId, status, outcome}))`, nunca com chave, `brCode` ou corpo bruto.
- Fluxo do webhook:
  1. Autenticar com `verifyWebhookRequest`; senão 401.
  2. `payments_record_event(id, event, orderFromMetadata, 'recebido', {event, devMode})`. Se duplicado → 200.
  3. Achar o pedido por `data.transparent.externalId` ou `metadata.orderId`; se não houver → 200 com `outcome='pedido_desconhecido'`.
  4. Se `devMode` ≠ `(ABACATEPAY_ENV==='sandbox')` → 200 com `outcome='ambiente_divergente'`.
  5. `checkPixCharge(id)` e `payments_apply_status(..., source 'webhook')` com o status **da reconsulta**. O tipo do evento (`transparent.completed|refunded|disputed|lost`) serve só de gatilho.
  6. Erro de banco → 500, para forçar a retentativa do provedor.
- `payments-reconcile`:
  - pedidos `pendente` com mais de 60 s e `last_checked_at` com mais de 60 s → reconsulta;
  - pedidos `criado` com mais de 5 min sem `provider_charge_id` → `falhou`;
  - pedidos com `refund_requested_at` e status `pago` → reconsulta;
  - lote de 50, respeitando 429 com backoff.
- `payments-refund`: confere `is_master` com o JWT do chamador e `refund_requested_at not null`, chama `refundCharge` e não muda o estado. O `estornado` chega pelo webhook ou pela reconsulta.

- [ ] **Step 1: Write failing integration tests** (`payments.itest.ts`):
  - `checkout cria pedido pendente com brCode e expiresAt ~30min`;
  - `segundo checkout com a mesma chave devolve o mesmo pedido e o fake recebeu 1 create`;
  - `clique duplo concorrente (Promise.all de 2 chamadas) gera 1 create`;
  - `simulate-payment + webhook libera plano: effective_entitlement = casamento`;
  - `webhook repetido 3x mantém 1 direito`;
  - `webhook sem segredo → 401 e nada muda`;
  - `webhook com devMode divergente não libera`;
  - `webhook perdido: reconcile aplica pago`;
  - `checkout com provedor 500 → 502 provedor_indisponivel, pedido criado vira falhou no reconcile, novo checkout permitido`;
  - `organizador B não consulta pedido de A (payments-status → 404)`;
  - `refund: admin_request_refund + payments-refund + webhook refunded → estornado`;
  - `convidado anônimo chama payments-checkout → 403`.
- [ ] **Step 2:** Run:

  ```bash
  supabase start
  supabase functions serve --env-file <arquivo fora do repo>
  node web/e2e/fixtures/fake-abacatepay.mjs &
  cd web && npx vitest run --config vitest.integration.config.ts integration/payments.itest.ts
  ```

  Expected: FAIL.
- [ ] **Step 3:** Implement as cinco funções.
- [ ] **Step 4:** Run os mesmos comandos. Expected: PASS. Em seguida, `grep -rn "abc_dev_\|abc_prod_" supabase web --include=*.ts --include=*.tsx --include=*.mjs` deve mostrar só testes com valores fictícios (`abc_dev_fake`).
- [ ] **Step 5:** Commit `feat(payments): edge functions de checkout, status, webhook, conciliação e reembolso`.

### Task 7: Master — pagamentos, cortesia, catálogo e configuração pública (COM-007 mínimo)

**Files:**
- Create: `supabase/migrations/<N4>_payments_admin_public.sql`, `supabase/tests/database/09_payments_admin.test.sql`, `web/src/app/master/pagamentos/page.tsx`, `web/src/app/master/planos/page.tsx`
- Modify: `web/src/app/master/modules.ts` (acrescentar `{ rota: "pagamentos", rotulo: "Pagamentos" }` e `{ rota: "planos", rotulo: "Planos e preços" }`)
- Telas: **M1** (Pagamentos, com a Sheet de reembolso) e **M2** (Planos e preços, com a Sheet de edição).

**Interfaces:**
- Produces:
  - RPCs Master e públicas da seção 3.2;
  - job `mm-payments-reconcile` a cada 5 minutos, via `net.http_post` com header `Authorization: Bearer` lido do Vault (`mm_payments_cron_token`), no mesmo padrão de `mm-purge-storage` (`docs/supabase/OPERATOR-COMMANDS.md:69`). A migration cria o job **só** se o segredo existir no Vault; senão emite `notice` e o runbook manda criar.
- O que a página mostra:
  - ambiente vigente (selo DESLIGADO/SANDBOX/PRODUÇÃO);
  - totais por status;
  - tabela de pedidos (data, evento, plano, valor, status, provedor, `needs_refund`);
  - divergências: pago sem direito, direito pago sem pedido pago, `pendente` com mais de 1 h, `needs_refund`, `em_disputa`;
  - ações com motivo obrigatório (Sheet existente): "Conceder cortesia" e "Solicitar reembolso" (depois chama `payments-refund`).
- **`/master/planos` (M2):**
  - tabela de `admin_list_plans()`: plano, convidados, fotos/pessoa, preço, ativo no sandbox, ativo em produção, alterado em;
  - Sheet "Editar {plano}": preço em reais, os dois interruptores de ativação, motivo obrigatório, prévia do cartão como o organizador vê e histórico das alterações;
  - texto fixo: "Mudanças valem para pedidos novos; um Pix já gerado mantém o valor dele." e "Limites de convidados e fotos mudam só por migration.";
  - salvar chama `admin_set_plan` e recarrega a lista; o preço novo aparece em `/precos`, no assistente e em `/painel/[id]/plano` sem deploy.

- [ ] **Step 1: Write failing tests** (pgTAP):
  - não-master chama `admin_grant_courtesy` → `MM004`;
  - motivo curto → `MM011`;
  - cortesia cria direito `cortesia/nenhum` e `audit_logs` com `actor_role='master'`;
  - `admin_set_plan` altera preço e audita com valor anterior e novo;
  - `admin_set_plan` com plano pago e `p_price_cents < 100` → erro; mudar o preço do `gratis` → erro;
  - `price_change_keeps_open_order`: pedido `pendente` de R$ 189 continua com `amount_cents=18900` depois de o Casamento ir para R$ 199, e `payments_quote` passa a devolver 19900;
  - `list_public_plans` reflete o preço novo imediatamente;
  - `admin_list_plans` devolve também planos inativos e só para o Master;
  - `get_public_settings` como `anon` devolve só as chaves permitidas;
  - `list_public_plans` com `payments_env='production'` e nenhum plano ativo em produção → só `gratis`;
  - `admin_payment_divergences` lista o pedido com `needs_refund`.
- [ ] **Step 2:** Run `supabase test db`. Expected: FAIL.
- [ ] **Step 3:** Implement a migration e a página (padrão `requireMaster()` + `rpc(sb,"admin_…")` de `master/data.ts`).
- [ ] **Step 4:** Run `supabase test db && cd web && npm test && npm run typecheck`. Expected: PASS.
- [ ] **Step 4b:** e2e `master altera o preço do Casamento com motivo e /precos mostra o novo valor` (stack local).
- [ ] **Step 5:** Commit `feat(master): pagamentos, cortesia auditada e edição de preços (COM-007)`.

### Task 7A: Códigos de cortesia (COM-017)

**Files:**
- Create: `supabase/migrations/<N5>_courtesy_codes.sql`, `supabase/tests/database/09_courtesy_codes.test.sql`, `web/src/app/master/codigos/page.tsx`
- Modify: `web/src/app/master/modules.ts` (acrescentar `{ rota: "codigos", rotulo: "Códigos" }`)
- Tela: **M3**.

**Interfaces:** Produces as RPCs de códigos da seção 3.2.

- [ ] **Step 1: Write failing tests** (pgTAP):
  - não-master chama `admin_create_code` → `MM004`;
  - `admin_create_code` devolve `MMT-XXXX-XXXX`; a tabela não contém o texto do código, só hash e `code_hint`;
  - `redeem_code` com o código em minúsculas e sem hífens → `ok`, direito `codigo/nenhum` com os limites do plano, `uses=1`;
  - segundo evento com código de `max_uses=1` → `invalido`;
  - código expirado ou revogado → `invalido`;
  - evento que já tem Casamento pago resgata código de Festa → `ja_incluido` e `uses` não muda;
  - 6ª tentativa inválida em 10 min do mesmo usuário → `muitas_tentativas`;
  - convidado ou outro organizador chama `redeem_code` no evento → `MM004`;
  - direito `codigo` vale com `payments_env='desligado'` (env `nenhum`).
- [ ] **Step 2:** Run `supabase test db`. Expected: FAIL em 09.
- [ ] **Step 3:** Implement a migration e a página M3:
  - tabela com código (só `code_hint` + "…"), plano, usos "{uses} de {max_uses}", validade, nota, status (ativo, usado, expirado, revogado);
  - Sheet "Gerar código": plano (Festa, Celebração, Casamento, Grande), usos (1, 5, 20, outro), validade (padrão hoje + 30 dias), nota obrigatória; depois de gerar, o cartão "Código gerado · copie agora" com "Copiar código" e "Copiar link" (`{origin}/c/{código}`) e o aviso "Por segurança ele aparece inteiro só agora; depois, só o começo.";
  - ação "Revogar" com motivo.
- [ ] **Step 4:** Run `supabase test db && cd web && npm test && npm run typecheck`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(master): códigos de cortesia com resgate auditado (COM-017)`.

### Task 8: Camada de billing no web

**Files:**
- Create: `web/src/features/billing/types.ts`, `api.ts`, `billing.test.ts`
- Modify: `web/src/lib/services/index.ts` (remover `BillingService`, `localBilling`, `DemoOnlyError`, `PurchaseRequest`); `web/src/domain/pricing.ts` (excluir; atualizar quem importa); `web/src/domain/options.ts` (manter `CAPACITY_OPTIONS`/`SHOTS_OPTIONS` só para escolhas dentro do plano; remover `PLUS_GUEST_LIMIT`)

**Interfaces:**
- Produces:
  - `type PublicPlan = { code: string; name: string; maxGuests: number | null; maxShots: number | null; priceCents: number; isFree: boolean; features: string[] }`.
  - `type OrderView = { orderId: string; status: "criado"|"pendente"|"pago"|"expirado"|"cancelado"|"falhou"|"estornado"|"em_disputa"|"perdido"; planCode: string; amountCents: number; brCode?: string; brCodeBase64?: string; expiresAt?: string; paidAt?: string }`.
  - `type Quote = { planCode: string; fromPlanCode: string | null; amountCents: number; payable: boolean; reason: "ok"|"ja_incluido"|"plano_inativo"|"evento_encerrado" }`.
  - `type PublicSettings = { supportEmail: string | null; supportPhone: string | null; companyLegalName: string | null; companyCnpj: string | null; paymentsEnv: "desligado"|"sandbox"|"production" }`.
  - `listPublicPlans(): Promise<PublicPlan[]>`, `getPublicSettings(): Promise<PublicSettings>`.
  - `quote(eventId: string, planCode: string): Promise<Quote>`.
  - `startCheckout(eventId: string, planCode: string, idempotencyKey: string): Promise<OrderView>`.
  - `orderStatus(orderId: string): Promise<OrderView>`.
  - `openOrder(eventId: string): Promise<OrderView | null>`.
  - `formatBRL(cents: number): string` → `"R$ 189,00"`.
  - `redeemCode(eventId: string, code: string): Promise<{ applied: boolean; planCode: string | null; reason: "ok"|"ja_incluido"|"invalido"|"muitas_tentativas" }>` e `normalizeCode(input: string): string` (maiúsculas, sem espaços; teste: `" mmt 7kq4-xr2p "` → `"MMT-7KQ4-XR2P"`).
  - Modo local (`backendMode() !== "supabase"`): `listPublicPlans` devolve só o grátis e as demais lançam `BillingUnavailableError`.

- [ ] **Step 1: Write failing tests:**
  - `formatBRL(18900)==="R$ 189,00"` e `formatBRL(100)==="R$ 1,00"`;
  - `startCheckout envia idempotencyKey e mapeia 409 pedido_aberto para OrderView existente`;
  - `modo local lista só Grátis`;
  - `nenhum módulo importa domain/pricing` (teste de import estático com `import.meta.glob`, ou grep no test).
- [ ] **Step 2:** Run `cd web && npx vitest run src/features/billing`. Expected: FAIL.
- [ ] **Step 3:** Implement com `browserSupabase().functions.invoke` e `.rpc`.
- [ ] **Step 4:** Run `npm test && npm run typecheck`. Expected: PASS.
- [ ] **Step 5:** Commit `refactor(billing): preço e plano vêm do servidor; remove billing de demonstração`.

### Task 9: Página de plano e checkout Pix (COM-006)

**Files:**
- Create: `web/src/app/painel/[id]/plano/page.tsx`, `web/src/features/billing/PlanPicker.tsx`, `PixCheckout.tsx`, `PlanCard.tsx`, `TrustBlock.tsx`
- Telas: **B1** (escolha), **B2** (pendente), **B3** (pago), **B4** (expirado), **B5** (falhou/cancelado), **B6** (provedor fora), **B7** (pagamentos desligados), **B8** (Tenho um código) e **B9** (código aplicado).
- Create também `web/src/features/billing/RedeemCode.tsx`: link "Tenho um código" abaixo da lista abre o cartão com campo e "Aplicar". Mensagens: `invalido` → "Esse código não existe, expirou ou já foi usado. Confira as letras e tente de novo."; `muitas_tentativas` → "Muitas tentativas. Tente de novo em 10 minutos."; `ja_incluido` → "Seu evento já tem este plano ou um maior. O código continua livre para outra festa."; `ok` → B9 ("Plano {nome} liberado.", "Até {n} convidados e {m} fotos cada, sem pagar nada. Presente de MemoriesMT."). O cartão aparece também em B7 (pagamentos desligados).
- e2e extra: `código válido libera Casamento sem Pix e o painel mostra o plano`; `código inválido mostra a mensagem neutra`.
- Modify: `web/src/app/painel/[id]/layout.tsx` (acrescentar `{ slug: "plano", label: "Plano" }` depois de "Visão geral")
- Test: `web/e2e/payments.spec.ts`, com `playwright.supabase.config.ts` + fake

**Comportamento:**
- **PlanPicker:**
  - lista `listPublicPlans()`, com o plano atual marcado "Seu plano";
  - planos menores ou iguais ficam desabilitados com "Incluído";
  - cada opção mostra convidados, fotos por pessoa, o que inclui e o preço total à vista (`formatBRL`), mais "Pagamento único por evento, no Pix";
  - sem planos pagos ativos (`payments_env='desligado'`): tela B7, cartão "Evento maior?" com `support_email`;
  - abaixo de "Grande": link "Mais de 500 convidados? Fale com a gente".
- **TrustBlock** (`TrustBlock({ plan }: { plan: PublicPlan })`, usado em B1, O4 e S1): título "{maxGuests} olhares por {formatBRL(priceCents/maxGuests)} cada." (para Grande usa 500; omitido no Grátis) e as 3 linhas fixas "Pague só depois de testar: o evento já nasce no ar, grátis.", "Pix único, sem assinatura. Se expirar, nada é cobrado." e "Ninguém é barrado na festa: 10% de folga e aviso antes de lotar." (a folga vem de `capacity_grace_pct`). Teste vitest: Casamento → "250 olhares por R$ 0,76 cada.".
- **Ao escolher:**
  - gera `idempotencyKey` (UUID) guardada em `sessionStorage` por evento e plano;
  - chama `startCheckout`.
- **PixCheckout, por estado:**
  - `pendente`: QR (`brCodeBase64` como `<img alt="QR Code Pix de R$ 189,00">`), botão "Copiar código Pix" (feedback real, fallback de seleção), contagem regressiva até `expiresAt` e "Aguardando pagamento…" em `aria-live="polite"`. Polling `orderStatus` a cada 3 s com a aba visível, pausado em segundo plano e retomado em `visibilitychange`;
  - `pago`: "Plano Casamento ativo.", "Até 250 convidados e 36 fotos cada. Já vale para quem entrar agora.", comprovante (valor, data e hora, pedido) e os botões "Voltar ao painel" e "Imprimir os cards das mesas";
  - `expirado`: "Este Pix expirou.", "Nada foi cobrado. Gere um código novo quando quiser; ele vale por 30 minutos.", cartão "Pagou agora há pouco? Se o banco confirmou, o plano libera sozinho em alguns minutos. Não pague de novo.", "Gerar novo Pix" e "Escolher outro plano";
  - `falhou`/`cancelado`: "Não conseguimos gerar o Pix. Nada foi cobrado." mais "Tentar de novo";
  - erro 502: "O sistema de pagamento não respondeu. Seu pedido está guardado; tente de novo em 1 minuto.";
  - `estornado`: "Pagamento devolvido em <data>.";
  - `em_disputa`: "Pagamento em análise. Seus convidados continuam usando o evento.".
- **Ao abrir a página:** `openOrder(eventId)` restaura o pedido aberto ou o último pedido. A URL não carrega estado de pagamento.
- **Layout:** mobile em coluna única; desktop ≥ 900 px em duas colunas (planos | resumo).

- [ ] **Step 1: Write failing e2e:**
  - `organizador escolhe Casamento, vê QR e contagem; fake paga; tela mostra plano ativo sem recarregar`;
  - `retomar-pedido`: fechar a aba com Pix pendente, abrir `/painel/[id]/plano` em outro contexto → mesmo pedido e QR, sem novo create no fake;
  - `pix expirado mostra Gerar novo Pix e não libera plano`;
  - `clique duplo em Pagar gera um pedido`;
  - `provedor fora: mensagem de recuperação e nenhum plano liberado`;
  - `/painel/<outro evento>/plano de outro organizador → 'Só o anfitrião abre o painel'`.
- [ ] **Step 2:** Run `cd web && npx playwright test -c playwright.supabase.config.ts e2e/payments.spec.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run o mesmo comando. Expected: PASS. Rodar também `npx playwright test e2e/a11y.spec.ts` incluindo a rota nova: 0 violações axe.
- [ ] **Step 5:** Commit `feat(painel): plano e pagamento Pix com estados de recuperação (COM-006)`.

### Task 10: Remover elementos de demonstração e homologação da experiência pública

**Files:**
- Modify:
  - `web/src/app/page.tsx`: remove `demo()`, os botões de exemplo, o link "Guia de componentes" e `KnownPeople` no modo nuvem;
  - `web/src/app/design/page.tsx`: `notFound()` quando `process.env.VERCEL_ENV === "production"`, mais metadata `robots: { index: false }`;
  - `web/src/app/master/layout.tsx`: metadata `robots: { index: false }`;
  - `web/src/features/app/backend-notice.tsx`: renderiza só se `backendMode()!=="supabase"`;
  - `web/src/features/consent/LegalPage.tsx`: o banner "Rascunho" só aparece se a versão termina em `-rascunho`.
- Create: `web/src/app/exemplo/page.tsx` (tela **S3**). Festa de exemplo **só em memória**: usa `repositories/memory` e `seedDemoEvent` sobre esse repositório, nunca o adaptador ativo. Mostra o selo "Exemplo · nada é salvo".
- Test: `web/e2e/produto.spec.ts` (local) e `web/src/features/demo/demo.test.ts`.

- [ ] **Step 1: Write failing tests:**
  - vitest `demo usa repositório em memória mesmo com backend supabase` (mockar `backendMode`);
  - e2e `home não mostra 'Guia de componentes' nem botões de exemplo; /exemplo abre o Agora com selo de exemplo`;
  - `LegalPage sem banner quando versão não termina em -rascunho`.
- [ ] **Step 2:** Run `npm test && npx playwright test e2e/produto.spec.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run os mesmos comandos. Expected: PASS.
- [ ] **Step 5:** Commit `fix(publico): remove demonstração e guias técnicos da experiência pública (UX-03, UXA-123)`.

### Task 11: Defeitos de sessão, identidade e textos do modo local

**Files:**
- Modify:
  - `web/src/app/e/[code]/(app)/voce/page.tsx`: o bloco "Entrar como outra pessoa" só aparece se `canSwitchIdentity`;
  - textos "neste aparelho" (lista da seção 1.2, UX-06): usar o texto atual só no modo local; na nuvem:
    - convite inválido: "Código não confere. Confira as 8 letras e números no card da mesa.";
    - erro: "Algo deu errado. Suas fotos enviadas estão guardadas.";
    - downloads: "Baixamos N fotos.";
    - excluir: "Excluir este evento e todas as fotos?";
  - `web/src/app/painel/[id]/layout.tsx`:
    - sem sessão na nuvem → "Entre com a conta Google que criou este evento." mais `GoogleButton next=/painel/<id>`;
    - id que não é UUID ou `RepositoryError` → tela de não encontrado em menos de 2 s (UX-11);
  - `web/src/app/page.tsx`: ler `?erro=login` e mostrar o banner "Não conseguimos entrar com o Google. Tente de novo." (UX-13);
  - `web/src/app/criar/pronto/[id]/page.tsx`: na falha do clipboard, selecionar o texto e mostrar "Não conseguimos copiar. O link está selecionado." (UX-12).
- Telas: **E5** (painel não encontrado), **E6** (banner de login), **O7** (evento criado com falha ao copiar).
- Test: `web/e2e/produto.spec.ts` e `web/src/features/features.test.ts`.

- [ ] **Step 1: Write failing tests:**
  - `voce não mostra 'Entrar como outra pessoa' quando canSwitchIdentity=false`;
  - `painel com id inválido mostra não encontrado`;
  - `home com ?erro=login mostra banner`;
  - `clipboard negado não diz copiado`;
  - grep-test `nenhuma string 'neste aparelho' renderizada quando backendMode='supabase'` (render das telas com mock).
- [ ] **Step 2:** Run `npm test && npx playwright test e2e/produto.spec.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run os mesmos comandos. Expected: PASS.
- [ ] **Step 5:** Commit `fix(sessao): identidade do convidado, painel sem sessão e textos por modo (UX-01, UX-06, UX-11–13)`.

### Task 12: Assistente de criação em 4 passos com plano

**Files:**
- Modify: `web/src/features/events/wizard.tsx`, `web/src/features/events/service.ts`
- Test: `web/e2e/flows.spec.ts`, `web/e2e/consent.spec.ts`, `web/e2e/uxa-evento-criado.spec.ts` (atualizar seletores), `web/src/features/features.test.ts`

Telas: **O1–O4**. O O4 mostra os 5 planos de `listPublicPlans()`, o `TrustBlock` do plano marcado, o aceite "Li e aceito os Termos e a Privacidade", o CTA "Criar evento" e a linha "O evento nasce grátis. Com plano pago, você paga no Pix na tela seguinte.". Sem "7 dias para desistir" (D3 pendente) e sem promessa de retenção.

**Comportamento** (`STEPS = ["Nome", "Quando", "Fotos", "Convidados"]`):
1. **Nome:**
   - "Como se chama a festa?";
   - campo do nome do evento com 3 sugestões geradas do tipo e do nome do anfitrião;
   - tipo (padrão Casamento);
   - o "Seu nome" sai do passo: vem de `user.name` do Google e é editável no painel.
2. **Quando:**
   - "Quando a festa acaba?" (atalhos e data);
   - "E quando as fotos aparecem?": "Na hora" | "Quando acabar" | "Na manhã seguinte (10h)" | "Escolher dia";
   - prévia da notificação: "O filme de <nome> foi revelado.";
   - copy: "Revelar na manhã seguinte deixa a noite para a pista.".
3. **Fotos:** 10 | 16 | 24 | 36 por pessoa, com prévia do contador "24 FOTOS RESTANTES". Opções acima de 10 (limite do Grátis) aparecem com o selo do plano necessário. A linha "+10 fotos da galeria depois da festa" do O3 **não** entra neste lote (COM-014).
4. **Convidados:**
   - "Quantos convidados vão fotografar?" com os cartões de `listPublicPlans()`;
   - aceite dos termos;
   - CTA "Criar evento" (sempre esse texto; UX-05).
   - Ao criar, o evento nasce no grátis.
   - Plano pago escolhido → `router.push('/painel/<id>/plano?plano=<code>')`.
   - Sem plano pago ativo → cartão "Fale com a gente".
   - Chegou por `/c/<código>` (rota nova `web/src/app/c/[code]/page.tsx`, que guarda o código em `sessionStorage` e redireciona para `/criar`): o O4 mostra "Código {MMT-7KQ4} será aplicado ao criar", e ao criar chama `redeemCode` e mostra B9. Código inválido não impede criar o evento; a mensagem aparece em B8.
   - e2e: `link /c/<código> cria evento já com o plano do código`.

Identidade (estilo, paleta, fonte) sai do assistente e vai para o Studio (`/painel/[id]/aparencia`), com padrões atuais. Remover o aviso "teria valor".

- [ ] **Step 1: Write failing tests:**
  - e2e `cria evento grátis em 4 passos e chega em 'Evento criado'`;
  - `escolher Casamento leva a /painel/<id>/plano?plano=casamento`;
  - `nenhum texto 'demonstração' ou 'teria valor' no assistente`;
  - vitest `createEvent não envia capacity acima do grátis`.
- [ ] **Step 2:** Run `npm test && npx playwright test e2e/flows.spec.ts e2e/consent.spec.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run os mesmos comandos mais `e2e/uxa-evento-criado.spec.ts`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(criar): assistente em 4 passos com escolha de plano no fim (UX-05, UXA-108/126)`.

### Task 13: Jornada do convidado (convite, câmera, envio, atualização)

**Files:**
- Modify:
  - `web/src/app/e/[code]/page.tsx`;
  - `web/src/app/e/[code]/(app)/postar/page.tsx`, `(app)/layout.tsx`, `(app)/agora/page.tsx`;
  - `web/src/features/participants/service.ts`, `web/src/features/photos/service.ts`, `web/src/features/app/hooks.ts`;
  - `web/src/features/reveal/WaitingReveal.tsx`.
- Telas: **G1–G6**, **E1** (muita gente), **E2** (convite inativo), **E3** (enviando), **E4** (sem sinal). Fora do lote: botão "Me avise quando revelar" de G5 (COM-005/FT-081) e cartão de álbum impresso de G6 (COM-015).
- Test: `web/e2e/flows.spec.ts`, `web/e2e/audit-a2-offline-post.spec.ts`, `web/src/features/photos/capture.test.ts`, `web/src/features/features.test.ts`

**Comportamento:**
- **Convite** (usa os campos novos de `event_preview`), 3 linhas antes do nome:
  - "Você tem {n} fotos. Escolha bem, como num filme." (ou "Fotos sem limite");
  - "Revela {dia}, {hora}. Até lá, só {anfitrião} pode ver." (respeita a decisão P2), ou "As fotos aparecem na hora.";
  - "Quem vê: {anfitrião} e quem está na festa." (se `everyoneSeesAll`), senão "Quem vê: só {anfitrião}.";
  - CTA "Entrar e abrir a câmera" → `/postar`.
- **Erros de entrada** (UX-04):
  - `rate-limited` → "Muita gente entrando agora. Tentamos de novo em 30 segundos.", com nova tentativa automática;
  - `forbidden` → "Este convite não está mais ativo. Fale com quem convidou você.";
  - falha de `ensureSession` → mesma mensagem de muita gente, com botão "Tentar de novo".
- **Pré-permissão** antes de `getUserMedia`:
  - cartão "Libere a câmera / Ela destrava suas {n} fotos" e "Cada foto vai para o álbum e aparece para todos {quando}.";
  - botões "Liberar câmera" e "Prefiro escolher da galeria".
- **Galeria** (UX-02): dois inputs, `câmera` (com `capture`) e `galeria` (sem `capture`).
- **Câmera negada:**
  - "Tudo bem, use a galeria.";
  - passos para Safari/Chrome;
  - "Tentar a câmera de novo";
  - para navegador embutido (UA Instagram/FBAN/WhatsApp): "Toque em ⋯ e escolha Abrir no navegador.".
- **Envio** (UX-07):
  - remover o `Progress value={60}` e usar indeterminado "Enviando…";
  - erro de rede: até 3 tentativas automáticas (2 s, 5 s, 15 s) com a mesma `photoId` (idempotente por `begin_photo`);
  - mensagem "Sem sinal." / "Não feche esta tela: sua foto vai assim que a internet voltar." / "Tentativa {n} de 3 · próxima em {s} s" e "Tentar agora" (sem prometer que a foto fica guardada com a tela fechada; isso é BG-071);
  - "Verifique o espaço livre" só para erro de armazenamento;
  - a quota só é descontada pelo servidor.
- **Atualização** (UX-10): `useEventData` refaz a leitura em `visibilitychange→visible` e a cada 45 s com a aba visível.
- **Espera:**
  - título "O filme ainda está no escuro.";
  - linha "Revelamos {dia} às {hora}. A noite fica para a pista." quando a revelação é no dia seguinte.
- **Pós-revelação** (Agora revelado, uma vez por convidado, dispensável): cartão "Tem uma festa vindo aí? Faça a sua do mesmo jeito. Até 10 convidados é grátis." mais "Criar o meu evento" → `/`.

- [ ] **Step 1: Write failing tests:**
  - e2e `convite mostra fotos, revelação e quem vê`;
  - `câmera negada oferece galeria sem capture e posta foto` (Playwright com permissão negada + `setInputFiles`);
  - `rede cai no envio: foto entra uma vez ao voltar, quota desconta 1` (estende `audit-a2-offline-post.spec.ts`);
  - `join rate-limited mostra 'Muita gente entrando agora'`;
  - vitest `useEventData recarrega em visibilitychange`.
- [ ] **Step 2:** Run `npm test && npx playwright test e2e/flows.spec.ts e2e/audit-a2-offline-post.spec.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run os mesmos comandos. Expected: PASS.
- [ ] **Step 5:** Commit `feat(convidado): convite explicativo, câmera/galeria, envio com nova tentativa e atualização (UX-02/04/07/08/10)`.

### Task 14: Painel do organizador, home, preços, ajuda e rodapé

**Files:**
- Create: `web/src/components/memoriesmt/SiteFooter.tsx`, `web/src/app/precos/page.tsx`, `web/src/app/ajuda/page.tsx`
- Modify:
  - `web/src/app/page.tsx`;
  - `web/src/app/painel/[id]/page.tsx`, `configuracoes/page.tsx`, `conteudo/page.tsx`, `momentos/page.tsx`, `qr/page.tsx`;
  - `web/src/features/studio/AppearanceStudio.tsx` (prévia do QR com `window.location.origin`, UX-18);
  - `web/src/app/layout.tsx` (rodapé nas rotas públicas).
- Telas: **Main**, **O5**, **P1**, **O6**, **O8**, **O9**, **O10**, **S1**, **S2** e o rodapé de S1/S2. O cartão de Ajustes "+10 da galeria depois" (P1) fica fora (COM-014).
- Test: `web/e2e/produto.spec.ts`, `web/e2e/a11y.spec.ts`

**Comportamento:**
- **Home:**
  - eyebrow "CÂMERA DESCARTÁVEL COLETIVA";
  - h1 "Seu evento pelo olhar de cada convidado.";
  - subtítulo "Sem baixar app. As fotos ficam no escuro e aparecem juntas, na hora que você escolher.";
  - 3 passos: "Aponta para o QR da mesa" / "Cada um tem seu rolo" / "Tudo revela junto";
  - link "Experimente a câmera agora" → `/exemplo`;
  - CTA "Criar meu evento grátis" → `/criar`, mais "Tenho um código" → `/entrar`;
  - linha de preço vinda de `list_public_plans()`:
    - com pagos ativos: "Grátis até 10 convidados. Planos a partir de {menor preço}, pagos uma vez por evento.";
    - sem pagos ativos: só "Grátis até 10 convidados.".
- **`/precos`:**
  - h1 "Um preço por festa. Sem assinatura.", subtítulo "Comece grátis. Só pague se a festa passar de 10 convidados.";
  - os 5 cartões (só leitura, Casamento destacado), o `TrustBlock` e o CTA "Criar meu evento grátis";
  - perguntas "Como pago?" (Pix, pagamento único por evento), "E se passar do limite?" (tolerância e aviso) e "Posso pedir reembolso?" (texto atual dos termos, D3).
- **`/ajuda`:** perguntas frequentes (como funciona, câmera/galeria, revelação, privacidade, pagamento) e contato de `get_public_settings()`.
- **SiteFooter:** Termos · Privacidade · Ajuda · contato · `company_legal_name`/`company_cnpj` quando preenchidos · assinatura "por MemoriesMT".
- **Visão geral do painel:**
  - cartão "Plano" (plano atual, uso "{n} de {capacidade} convidados", botão "Aumentar" → `/plano`);
  - banner de tolerância "Lotação chegando: {n} de {capacidade}. Ninguém será barrado até {capacidade+folga}.";
  - checklist "Antes do grande dia":
    - evento criado;
    - tirar a 1ª foto como convidado (link `/e/<code>`);
    - imprimir cards (link `/qr`);
    - plano (se pago pendente).
- **Configurações (P1/P2):** linha "Código de presente · Tenho um código" abre o `RedeemCode` em Sheet (P2); capacidade e fotos limitadas ao plano efetivo, com o texto "Seu plano permite até {max}." e o link "Aumentar plano"; status "Salvo" ao lado de cada grupo (UX-15).
- **Conteúdo e momentos:** "Remover" com Sheet de confirmação "Remover esta foto? Os convidados deixam de vê-la." e "Remover momento {m}?" (UX-09).
- **QR:** copy do card A6 "Queremos a festa pelos seus olhos. Aponte a câmera. Sem baixar app." e linha "Cada um tem {n} fotos. Revelamos {quando}." (UXA-124 junto).
- **Gerais:** estados de carregamento com skeleton (UXA-111), plural (UXA-117) e `<h1>` (UXA-119).

- [ ] **Step 1: Write failing tests:**
  - e2e `home mostra proposta, 3 passos e CTA criar`;
  - `/precos mostra os 5 planos com R$ 29, 89, 189 e 349`;
  - `/precos com payments_env=desligado mostra só Grátis e Fale com a gente`;
  - `remover foto pede confirmação`;
  - `configurações não oferece capacidade acima do plano`;
  - `rodapé tem Termos, Privacidade, Ajuda`;
  - axe 0 violações em `/`, `/precos`, `/ajuda`, `/painel/[id]`, `/painel/[id]/plano` a 390 e 1280 px.
- [ ] **Step 2:** Run `npx playwright test e2e/produto.spec.ts e2e/a11y.spec.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run os mesmos comandos mais `npm test && npm run typecheck && npm run lint && npm run build`. Expected: PASS e saída 0.
- [ ] **Step 5:** Commit `feat(produto): home, preços, ajuda, rodapé e painel com plano (UX-09/15/18, UXA-111/117/119/124)`.

### Task 15: Runbook de pagamentos, deploy no sandbox e homologação

**Files:**
- Create: `docs/supabase/PAYMENTS-RUNBOOK.md`, `docs/supabase/PRODUCT-PRODUCTION-HOMOLOGATION.md`

**Runbook (conteúdo obrigatório, sem segredos):**
- **Segredos** (fora do repositório; exemplo com nomes, nunca valores):

  ```bash
  supabase secrets set --project-ref asyaegeodyttttaubvxh \
    --env-file <arquivo fora do repo>
  ```

  com `ABACATEPAY_API_KEY`, `ABACATEPAY_WEBHOOK_SECRET` (gerado com `openssl rand -hex 32`), `ABACATEPAY_HMAC_KEY` (copiado de `/pages/webhooks/security`), `ABACATEPAY_ENV=sandbox` e `PAYMENTS_CRON_TOKEN`. Criar o mesmo token no Vault como `mm_payments_cron_token`.
- **Webhook sandbox:**
  - no dashboard AbacatePay (dev mode) ou por `POST /webhooks/create`;
  - URL `https://asyaegeodyttttaubvxh.supabase.co/functions/v1/payments-webhook?webhookSecret=<segredo>`;
  - eventos `transparent.completed`, `transparent.refunded`, `transparent.disputed`, `transparent.lost`.
- **Deploy:**
  - migrations com backup prévio e `supabase db push --linked` (operador, se a ferramenta bloquear);
  - `supabase functions deploy payments-checkout payments-status payments-refund --project-ref …`;
  - `supabase functions deploy payments-webhook payments-reconcile --no-verify-jwt --project-ref …`;
  - `admin_set_setting('payments_env','"sandbox"', <motivo>)`.
- **Preview:** Vercel `memoriesmt-v2`, raiz `web`, conforme a Rodada 5 do A5.
- **Rollback:**
  - `admin_set_setting('payments_env','"desligado"')` desliga a compra sem deploy;
  - redeploy da versão anterior das functions;
  - migrations não são revertidas;
  - promoção da Vercel volta com `vercel rollback <dpl>`.
- **Diagnóstico:**
  - consultas de `payment_events` e `admin_payment_divergences`;
  - logs das functions filtrados por `orderId`;
  - o que fazer em `needs_refund` e `em_disputa`.

**Steps:**
- [ ] **Step 1:** Escrever o runbook e a matriz (seção 5) com as colunas Evidência/Ambiente/Físico-ou-emulado/Resultado.
- [ ] **Step 2:** Aplicar no remoto, conforme o runbook. Expected: `migration list` com local = remoto; functions `ACTIVE`; `payments-webhook` sem segredo → `401` (`curl -s -o /dev/null -w "%{http_code}"`).
- [ ] **Step 3:** Preview do SHA candidato. Expected: `meta.githubCommitSha` = SHA, READY.
- [ ] **Step 4:** Executar a matriz 5 inteira no preview com sandbox real. Usar `simulate-payment` para pagar; o dinheiro é fictício (`devMode: true`). Preencher as evidências.
- [ ] **Step 5:** Bundle sem segredo:

  ```bash
  cd web && npm run build && grep -rE "abc_(dev|prod)_|ABACATEPAY|service_role|PAYMENTS_CRON" .next/static
  ```

  Expected: nenhuma ocorrência.
- [ ] **Step 6:** Commit `docs(pagamentos): runbook, homologação sandbox e evidências` e escrever o parecer GO/NO-GO (seção 7).

---

## 5. Matriz de homologação (preencher em `PRODUCT-PRODUCTION-HOMOLOGATION.md`)

Cada linha exige evidência no preview do SHA candidato: print sanitizado sem QR legível, código Pix ou dados pessoais; consulta SQL só com contagens e ids; e log com `orderId`. Teste automatizado sozinho não fecha a linha; a jornada é feita pela interface.

| # | Cenário | Como provar | Aprova quando |
|---|---|---|---|
| H-01 | Novo organizador entende a oferta e cria evento | Conta Google de teste do dono: home → criar → 4 passos → "Evento criado" | Menos de 2 min do login ao QR; nenhum texto de demonstração |
| H-02 | Compra sandbox aprovada libera exatamente o plano | Plano Casamento → Pix → `simulate-payment` | Tela "Plano Casamento ativo" sem recarregar; `effective_entitlement` = casamento (250/36); 1 pedido `pago`; 1 `payment_events` processado |
| H-03 | Pendente, expirado e falho não liberam | Pedido sem pagar até expirar (usar `expiresIn` reduzido só no fake, ou aguardar 30 min no sandbox); provedor indisponível no fake local | Plano continua grátis; mensagens corretas; UPDATE de capacity=200 pelo cliente → MM012 |
| H-04 | Recarregar e voltar depois preserva o estado | Fechar a aba com Pix pendente, abrir em outro navegador | Mesmo pedido/QR; nenhum novo `create` (log) |
| H-05 | Clique repetido e webhook duplicado não duplicam | Duplo clique; reenviar o mesmo evento pelo log de webhooks do dashboard (que gera id novo) e pelo replay do mesmo corpo | 1 cobrança; 1 direito; replay com o mesmo id → `payment_events` duplicado ignorado |
| H-06 | Isolamento | Organizador B tenta `payments-status` do pedido de A, `/painel/<A>/plano` e RPCs | 403/404; nenhum dado de A |
| H-07 | Quotas no servidor | Convidado excede `shots_per_person` por chamada direta à RPC; 12º convidado num grátis | MM001; MM003 (11º entra por tolerância) |
| H-08 | Falha do provedor tem recuperação | Webhook desativado temporariamente no sandbox → pagar → conciliação | Plano liberado em até 5 min pelo `mm-payments-reconcile` |
| H-09 | Reembolso | Master solicita reembolso com motivo | `estornado`; plano volta ao anterior; fotos e participantes intactos; `audit_logs` |
| H-10 | Cortesia | Master concede Casamento com motivo | Direito `cortesia`; auditado |
| H-11 | Convidado continua funcionando | QR → entrada → câmera → envio → segundo plano/retorno → revelação → galeria/download | Fluxo completo após este lote |
| H-12 | Câmera negada e rede caindo | Negar câmera → galeria; modo avião no envio | Foto postada pela galeria; foto entra uma vez ao voltar a rede |
| H-13 | Acabamento visual | Capturas 390×844 e 1280×800 de todas as telas da seção 2 (dia e noite) | Sem overflow, sem texto cortado; axe 0 |
| H-14 | Aparelhos físicos | iPhone/Safari e Android/Chrome reais: H-11, H-12 e H-02 a partir do celular | Rotulado "físico", com modelo e versão; emulação registrada à parte |
| H-15 | Segredos | grep no bundle (Task 15 Step 5), nos prints e no repositório (`gitleaks detect`) | Nenhuma ocorrência |
| H-17 | Código de cortesia | Master gera código Casamento (1 uso); organizador resgata em Ajustes; segundo evento tenta o mesmo código; 6 tentativas erradas | Plano liberado sem Pix e auditado; segundo evento recebe a mensagem neutra; bloqueio de 10 min; código inteiro nunca aparece em log ou tabela |
| H-16 | Modo desligado | `payments_env='desligado'` | Só Grátis e "Fale com a gente"; checkout → 503; nada quebra |

---

## 6. Transição para produção (não executar neste lote sem autorização explícita)

O que muda para operar pagamentos reais; não é só trocar a chave:

1. **Conta e aprovação AbacatePay.**
   - Produção exige CNPJ (MEI/ME) e site no ar com contato, termos, privacidade e **CNPJ no rodapé**. A análise leva até 3 dias úteis (`/pages/production`).
   - Depende de D5, mais os textos finais e o domínio.
2. **Credenciais.**
   - Nova chave `abc_prod_` com permissões `TRANSPARENT:CREATE`, `TRANSPARENT:READ` e `REFUND:CREATE`.
   - As permissões não mudam depois de criada a chave.
   - `supabase secrets set ABACATEPAY_API_KEY=… ABACATEPAY_ENV=production ABACATEPAY_WEBHOOK_SECRET=<novo>`.
3. **Webhook.**
   - Criar de novo **no ambiente de produção**, porque webhooks de dev não recebem eventos reais.
   - Usar um segredo novo.
   - Desativar ou excluir o webhook de sandbox apontando para o mesmo endpoint.
4. **Catálogo e ambiente.**
   - Direitos e pedidos de sandbox ficam isolados por `env`.
   - Preços já aprovados (D1) e ativos em produção pelo seed; conferir no Master › Planos e preços (M2).
   - `admin_set_setting('payments_env','"production"')`.
   - Conferir `list_public_plans()` como anônimo.
5. **Domínio e URLs.**
   - Domínio definitivo na Vercel (COM-011), Site URL e redirect URLs do Supabase Auth.
   - O rodapé e `/ajuda` com dados reais.
   - O Pix transparente não usa URL de retorno, então não há callback de retorno a configurar.
6. **Fiscal e legal.**
   - NFS-e (D6) e textos legais finais com cláusula de pagamento e reembolso (D3).
   - Publicar a nova versão em `legal_documents`, em `web/src/lib/consent.ts` e no banner.
7. **Monitoramento.**
   - Job `mm-payments-reconcile` ativo.
   - `/master/pagamentos` revisado diariamente na primeira semana.
   - Alerta em `/master/saude` para pedido `pendente` com mais de 1 h ou `needs_refund`.
8. **Verificação controlada.**
   - Com autorização explícita do dono: 1 compra real do menor plano ativo, por conta do dono e em evento próprio.
   - Conferir o direito, o `platformFee` e o recibo.
   - Reembolsar pelo Master e confirmar `estornado`.
9. **Rollback.**
   - `payments_env='desligado'`.
   - Redeploy anterior das functions.
   - `vercel rollback`.
   - Pedidos já pagos continuam válidos; reembolsos manuais pelo Master.

## 7. Critérios de prontidão e parecer

- **GO do lote (sandbox):**
  - Tasks 0–15 (inclui 7A) concluídas;
  - suites verdes (unit, functions, pgTAP, integração, e2e local);
  - typecheck, lint e build com saída 0;
  - matriz H-01…H-17 aprovada com evidência;
  - H-14 com aparelhos físicos reais;
  - nenhuma falha crítica de acesso, privacidade, integridade, cobrança ou jornada principal.
- **GO de produção:** exige ainda o GO operacional de A, as decisões D3, D5 e D6, a seção 6 completa e a autorização explícita do dono (D1 e D2 aprovados em 22/10/2026).
- **Sem aparelho físico:** sem aparelhos disponíveis, o parecer é **NO-GO físico** e lista o que resta, sem marcar H-14 como feito.
- **Formato do parecer:**
  - URL do preview, SHA, deployment id;
  - contagens dos testes;
  - links para as evidências;
  - limitações externas (Vercel, AbacatePay, aparelhos) separadas de decisões comerciais pendentes (D3–D7);
  - conferência de tela: para cada artboard da seção 1.7, captura a 390 px (e 1280 px no Master) ao lado do PNG de referência.

## 8. Instrução para o Claude implementador

```text
Você vai executar o plano docs/superpowers/plans/2026-10-22-memoriesmt-product-production.md no repositório mzinhoww-svg/memo-brasil (worktree própria, branch feat/product-production a partir de origin/feat/memoriesmt-studio).

1. Leia o plano inteiro e as fontes listadas no cabeçalho. Não repita o estudo AppLlama nem a auditoria: o que importa está na seção 1. Abra as telas da seção 1.7 (docs/design/app-proposto/png) antes de cada task de interface e siga textos, ordem e estados; divergências vão para o relatório da task.
2. Use superpowers:subagent-driven-development (ou executing-plans) e TDD: para cada task, RED → implementação mínima → GREEN → commit. Regras financeiras e de autorização só mudam com teste que falhou antes.
3. Execute até o fechamento, na ordem: Task 0, Tasks 1–15 e a matriz da seção 5. Não pare depois de documentação, commit ou preview. Corrija falhas reproduzíveis dentro do escopo; o que estiver fora do corte vira item novo no relatório, não implementação.
4. Preserve trabalho paralelo: não altere a worktree mb-memoriesmt nem arquivos não commitados de outros agentes; faça rebase sobre A antes da homologação final. Não apague nem altere dados reais; use eventos sintéticos identificados no remoto e stack local para testes destrutivos.
5. Segredos: a chave sandbox da AbacatePay é entregue pelo operador fora do repositório. Configure-a só com supabase secrets; nunca a escreva em arquivo versionado, log, commit, print ou mensagem. Se não houver chave disponível, conclua tudo com o fake local e registre H-02/H-05/H-08/H-09 como bloqueio externo.
6. Respeite bloqueios obrigatórios das ferramentas (classificador, permissões). Quando um comando for bloqueado, registre o comando mínimo para o operador e siga com o restante; não tente contornar.
7. Proibido nesta execução: promover produção, usar chave abc_prod_, fazer cobrança real, alterar os preços aprovados ou decidir termos (D3–D7). Nunca exibir depoimento ou número que não seja real.
8. Entregue: URL do preview, SHA, deployment id, resultados de cada suíte, matriz H-01…H-17 com evidências, parecer GO/NO-GO (seção 7), e duas listas separadas — limitações externas e decisões comerciais pendentes. Não declare "100% concluído" sem evidência linha a linha.
```
