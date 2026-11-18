# Preços simples, paywall direto e página para o Google — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar os 4 planos pagos por 2 faixas de convidados (R$ 147 até 150, R$ 297 até 300), tirar a escolha de plano/poses do assistente e transformar `/` numa página que o Google lê.

**Architecture:** O catálogo continua no banco (`public.plans`); uma migration cria `ate150`/`ate300` e desliga os antigos sem apagar. As telas já são guiadas pelo catálogo, então mudam só textos, destaque e a linha do WhatsApp. A home vira Server Component (metadados + seções de texto renderizadas no servidor) que mantém o topo atual como ilha cliente.

**Tech Stack:** Next.js 16 (App Router), React 19, Supabase (Postgres + pgTAP), Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-18-precos-simples-e-pagina-google-design.md` · Wireframes: https://claude.ai/artifact/3gAPZB7eY8HQuXiChWCXZk

## Global Constraints

- Faixas: Grátis até 10 convidados (10 poses) · `ate150` "Até 150 convidados" R$ 147,00 (`14700`) · `ate300` "Até 300 convidados" R$ 297,00 (`29700`) · acima de 300: WhatsApp.
- Pagos: `max_shots = 36`. `ate150` é o único `highlighted = true`.
- Planos antigos (`festa`, `celebracao`, `casamento`, `grande`, `festa_36`, `celebracao_36`, `teste1real`): `production_active = false` e `sandbox_active = false`, **nunca** `delete`.
- Domínio canônico: `https://fotosdocasamento.online` (`DEFAULT_SITE_ORIGIN` em `web/src/lib/site.ts`).
- Copy pt-BR, caixa de frase, verbo primeiro nos botões, sem emoji, sem caixa alta (voz Revela).
- Número de vendas do WhatsApp: `NEXT_PUBLIC_SALES_WHATSAPP` (só dígitos, com DDI). Sem a variável, a linha "Mais de 300" cai no e-mail de contato (`contactFrom`).

## Review Focus

1. Evento que já pagou plano antigo (ex.: `casamento`) abre `/painel/[id]/plano`: o cartão "Plano atual" mostra o nome e limites antigos e oferece só planos de rank maior → teste em Task 3.
2. Evento já em `ate300` abre o plano: não há plano maior; mostra só "Mais de 300? Fale no WhatsApp" → teste em Task 3.
3. Catálogo falha ao carregar na home (Supabase fora): a home ainda renderiza preços (fallback fixo) e o HTML continua válido para o Google → teste em Task 5.
4. Código de cortesia pendente (`/c/<código>`) segue sendo aplicado ao criar, mesmo sem o passo de plano → teste em Task 4.
5. `NEXT_PUBLIC_SALES_WHATSAPP` ausente ou com lixo: link cai no e-mail, nunca `wa.me/undefined` → teste em Task 2.

---

### Task 1: Catálogo novo no banco

**Files:**
- Create: `supabase/migrations/20261120000100_plans_faixas_convidados.sql`
- Test: `supabase/tests/database/43_plans_faixas_convidados.test.sql`

**Interfaces:**
- Produces: planos `ate150` (sort 1) e `ate300` (sort 2) visíveis em `list_public_plans()`; `gratis` inalterado (sort 0).

- [ ] **Step 1: Write the failing pgTAP test** (siga o formato de `42_access_analytics.test.sql`, `\ir` da migration nova)

```sql
select plan(6);
select is((select array_agg(code order by sort) from public.plans where production_active and pack_of is null), array['gratis','ate150','ate300'], 'só três planos visíveis');
select is((select price_cents from public.plans where code='ate150'), 14700, 'até 150 = R$ 147');
select is((select price_cents from public.plans where code='ate300'), 29700, 'até 300 = R$ 297');
select is((select max_shots from public.plans where code='ate300'), 36, '36 poses');
select is((select count(*)::int from public.plans where highlighted), 1, 'um destaque');
select ok(exists(select 1 from public.plans where code='casamento' and not production_active), 'antigo preservado e desligado');
select * from finish();
```

- [ ] **Step 2: Run** `npm run test:db -- supabase/tests/database/43_plans_faixas_convidados.test.sql` → FAIL (plano inexistente).
- [ ] **Step 3: Write the migration**: `insert … on conflict (code) do update` para `ate150`/`ate300` (`max_guests` 150/300, `max_shots` 36, `is_free` false, `sandbox_active` e `production_active` true, `features '{}'`); `update public.plans set production_active=false, sandbox_active=false, highlighted=false where code in (<antigos>)`; `update … set highlighted = (code='ate150')`. Respeite o gatilho de auditoria de planos já existente (`20261117000300_restore_plans_audit_policy.sql`).
- [ ] **Step 4: Run** o mesmo comando → PASS; rode `npm run test:db` inteiro → sem regressão.
- [ ] **Step 5: Commit** `feat(db): planos por faixa de convidados (até 150 e até 300)`.

### Task 2: Link de vendas no WhatsApp

**Files:**
- Modify: `web/src/lib/contact.ts`
- Test: `web/src/lib/contact.test.ts`

**Interfaces:**
- Produces: `salesContactHref(env?: string, fallbackEmail?: string): string` e `SALES_WHATSAPP_TEXT = "Olá! Minha festa tem mais de 300 convidados e quero um orçamento."`.

- [ ] **Step 1: Failing tests**: `salesContactHref("5565999990000")` → `https://wa.me/5565999990000?text=` + `encodeURIComponent(SALES_WHATSAPP_TEXT)`; `salesContactHref(undefined, "a@b.com")` → `mailto:a@b.com?subject=` + `encodeURIComponent("Festa com mais de 300 convidados")`; `salesContactHref("abc")` e `salesContactHref("123")` → mailto (aceita só 10–15 dígitos).
- [ ] **Step 2: Run** `cd web && npx vitest run src/lib/contact.test.ts` → FAIL.
- [ ] **Step 3: Implement** em `contact.ts`; padrão `env = process.env.NEXT_PUBLIC_SALES_WHATSAPP`, `fallbackEmail = CONTACT_EMAIL`. Adicione a variável em `web/.env.example` (se existir) com comentário.
- [ ] **Step 4: Run** → PASS. **Step 5: Commit** `feat: contato de vendas pelo WhatsApp para festas acima de 300`.

### Task 3: Paywall do painel (`/painel/[id]/plano`)

**Files:**
- Modify: `web/src/features/billing/PlanPicker.tsx`, `web/src/features/billing/flow.ts` (`PLAN_TEXT`)
- Test: `web/src/features/billing/PlanPicker.test.tsx` (ajustar fixtures ao catálogo novo)

**Interfaces:**
- Consumes: `salesContactHref` (Task 2).

- [ ] **Step 1: Failing tests** (fixture `plans = [gratis(10/10), ate150(150/36/14700, highlighted), ate300(300/36/29700)]`):
  - `currentCode="gratis"` → `getByRole("heading", { name: "Quantos convidados vão à festa?" })`; dois rádios "Até 150 convidados" e "Até 300 convidados"; `ate150` pré-selecionado; link "Fale no WhatsApp" com `href` de `salesContactHref`.
  - `currentCode="ate300"` → nenhum rádio de plano; link do WhatsApp visível (Review Focus 2).
  - Evento com plano antigo `casamento` (fora de `plans`; passe-o em `lookupPlans`/prop que o cartão "Plano atual" usa hoje) → cartão mostra "Casamento"; rádios oferecem só planos com `maxGuests` maior que 250, ou seja `ate300` (Review Focus 1).
- [ ] **Step 2: Run** `cd web && npx vitest run src/features/billing/PlanPicker.test.tsx` → FAIL.
- [ ] **Step 3: Implement**:
  - `PLAN_TEXT.titulo = "Quantos convidados vão à festa?"`, `PLAN_TEXT.sub = "Pagamento único. Cada convidado tem 36 poses. Pix ou cartão, sem assinatura."`.
  - Remover a constante `RECOMMENDED`; o pré-selecionado é `higher.find(p => p.highlighted) ?? higher[0]`.
  - Plano atual fora do catálogo visível: `planRank` devolve 0 hoje (oferece tudo). Trocar o filtro `higher` por "planos pagos com `maxGuests` maior que o do plano atual (ou `null`)" usando o plano atual obtido por lookup; extrair como `upgradeOptions(plans: PublicPlan[], current: PublicPlan | undefined): PublicPlan[]` em `flow.ts`, com teste unitário em `flow.test.ts`.
  - Linha fixa abaixo dos cartões: "Mais de 300? Fale no WhatsApp" (`<a href={salesContactHref()}>`), também no ramo `paidOff`, onde substitui o e-mail.
  - Lista de garantias da tela 2 do wireframe: "As fotos já tiradas continuam no evento", "Sem app para os convidados", "Download de todas as fotos depois da revelação".
- [ ] **Step 4: Run** o teste + `npx vitest run src/features/billing` → PASS. **Step 5: Commit** `feat(paywall): escolha por faixa de convidados e WhatsApp acima de 300`.

### Task 4: Assistente sem passo de poses e sem escolha de plano

**Files:**
- Modify: `web/src/features/events/wizard.tsx`, `web/src/features/events/plan-catalog.ts`
- Test: os testes existentes do assistente (`grep -rl "CameraPoses\|poseOption" web/src --include=*.test.*`) ajustados

**Interfaces:**
- Consumes: `freeShots(plans)` (já existe em `plan-catalog.ts`).

- [ ] **Step 1: Failing tests**: o assistente vai de "Revelação" direto para "Filtro" (sem `CameraPoses`); `buildCreateInput` recebe `desiredShots = freeShots(catalog)` (10); a tela de publicar não mostra cartões de plano e o botão diz "Criar câmera"; com código pendente, `redeemCode` continua sendo chamado após criar (Review Focus 4).
- [ ] **Step 2: Run** os testes do assistente → FAIL.
- [ ] **Step 3: Implement**: remover o passo 4 e renumerar (`step` 0–6; `CameraRevelacao step={4}` segue, `CameraFiltro`/`CameraPrivacidade`/`CameraPublicar` sobem um); remover `desiredShots`/`planCode`/`planTouched`/`packOn` e o ramo `chosen && !chosen.isFree` de `create()` (o evento sempre nasce Grátis); `CameraPublicar` sem `plans`/`pack`, `posesLabel` = `"${freeShots} por pessoa"`. Em `plan-catalog.ts`, apagar `POSE_STEPS`, `poseOptions`, `poseOption`, `poseNotice`, `planForShots` se ficarem sem uso (e seus testes).
- [ ] **Step 4: Run** `cd web && npm run typecheck && npx vitest run src/features/events` → PASS. **Step 5: Commit** `feat(criar): evento nasce no Grátis; plano só no painel`.

### Task 5: Home pública indexável (`/`) e `/precos`

**Files:**
- Create: `web/src/features/home/HomeHero.tsx` (o conteúdo cliente atual de `app/page.tsx`, movido sem mudar comportamento)
- Create: `web/src/features/marketing/Landing.tsx` (Server Component: Como funciona, Preços, Dúvidas, CTA final)
- Create: `web/src/features/marketing/pricing.ts` (faixas para a página pública)
- Create: `web/src/features/marketing/faq.ts`
- Modify: `web/src/app/page.tsx` (vira Server Component), `web/src/features/marketing/PrecosView.tsx` + `web/src/revela/screens/ApoioPrecos.tsx`
- Test: `web/src/features/marketing/Landing.test.tsx`, `web/src/features/marketing/pricing.test.ts`, `PrecosView.test.tsx` (ajustar)

**Interfaces:**
- Consumes: `salesContactHref` (Task 2).
- Produces: `type Tier = { code: string; label: string; price: string; note: string; highlighted: boolean }`; `PRICING_FALLBACK: Tier[]` (Grátis/R$ 147/R$ 297 com os textos do wireframe); `tiersFromPlans(plans: PublicPlan[]): Tier[]`; `loadPublicTiers(): Promise<Tier[]>` (servidor: RPC `list_public_plans` com o cliente anon, `next: { revalidate: 3600 }`, qualquer erro → `PRICING_FALLBACK`); `FAQ: { q: string; a: string }[]` (5 perguntas do wireframe, respostas reais do produto: sem app, sobra de convidados não é cobrada, troca para plano maior paga a diferença, revelação na hora escolhida, retenção conforme `/privacidade`).

- [ ] **Step 1: Failing tests**:
  - `tiersFromPlans` com o catálogo novo → labels `["Até 10 convidados","Até 150 convidados","Até 300 convidados"]`, prices `["Grátis","R$ 147","R$ 297"]`, só `ate150` com `highlighted`.
  - `render(await Landing({ tiers: PRICING_FALLBACK }))` → `h2` "Como funciona", "Quantos convidados vão à festa?", "Dúvidas frequentes"; texto "Mais de 300 convidados?"; um `<script type="application/ld+json">` cujo JSON tem `@type` `FAQPage` com 5 `mainEntity` e um `Product` com 2 `offers` em `BRL` (`147.00`, `297.00`).
  - `loadPublicTiers` com `fetch` rejeitando → devolve `PRICING_FALLBACK` (Review Focus 3).
  - `PrecosView` com o catálogo novo → 3 cartões, título "Quantos convidados vão à festa?", linha do WhatsApp; botão final "Criar evento grátis".
- [ ] **Step 2: Run** `cd web && npx vitest run src/features/marketing` → FAIL.
- [ ] **Step 3: Implement**:
  - `app/page.tsx`: `export const metadata` com `title: { absolute: "Fotos do casamento tiradas pelos convidados | Revela" }`, `description: "Os convidados fotografam pelo celular, sem app, e as fotos se revelam juntas na hora marcada. Grátis até 10 convidados; R$ 147 até 150."`, `alternates: { canonical: "/" }`; `export const revalidate = 3600`; renderiza `<HomeHero />` e depois `<Landing tiers={await loadPublicTiers()} />`. O `<h1>` da página fica no Landing logo abaixo do hero ("As fotos do casamento, tiradas por quem estava lá.") se o `Main` atual não tiver um `h1` com esse texto; nunca dois `h1`.
  - `Landing.tsx`: layout e textos do artboard "Home pública" do wireframe, com as classes/tokens `rv-*` existentes; CTA `href="/criar"`; `id="precos"` e `id="duvidas"` para âncoras.
  - `ApoioPrecos`: título "Quantos convidados vão à festa?", cartões de `Tier`, linha do WhatsApp, botão "Criar evento grátis"; remover `PRECOS_REF` antigo.
- [ ] **Step 4: Run** `npx vitest run src/features/marketing src/app` + `npm run typecheck` + `npm run build` → PASS, e `curl -s localhost:3000/ | grep -c "Quantos convidados"` ≥ 1 com `npm start` (o texto está no HTML do servidor).
- [ ] **Step 5: Commit** `feat(home): página pública com como funciona, preços e dúvidas para o Google`.

### Task 6: Metadados, robots e sitemap

**Files:**
- Modify: `web/src/app/layout.tsx`
- Create: `web/src/app/robots.ts`, `web/src/app/sitemap.ts`
- Test: `web/src/app/seo.test.ts`

**Interfaces:**
- Consumes: `siteOrigin()` de `web/src/lib/site.ts`.

- [ ] **Step 1: Failing tests**: `robots()` → `rules.allow` contém `/`; `rules.disallow` igual a `["/painel", "/master", "/e/", "/api", "/conta", "/eventos", "/criar", "/dev", "/auth"]`; `sitemap` = `${siteOrigin()}/sitemap.xml`. `sitemap()` → URLs `["/", "/precos", "/ajuda", "/privacidade", "/termos"]` prefixadas com `siteOrigin()`, `/` com `priority: 1`.
- [ ] **Step 2: Run** `cd web && npx vitest run src/app/seo.test.ts` → FAIL.
- [ ] **Step 3: Implement** os dois arquivos; em `layout.tsx` adicionar `metadataBase: new URL(siteOrigin())`, `openGraph: { type: "website", locale: "pt_BR", siteName: "Revela", url: "/" }` e trocar `description` para a mesma da home.
- [ ] **Step 4: Run** → PASS; `npm run lint && npm run typecheck && npm test` inteiro → PASS. **Step 5: Commit** `feat(seo): metadataBase, robots e sitemap`.

---

## Depois do merge (manual, fora do código)

1. Aplicar a migration da Task 1 no Supabase de produção (procedimento em `docs/supabase/PUBLISH-AND-ROLLBACK.md`).
2. Definir `NEXT_PUBLIC_SALES_WHATSAPP` na Vercel.
3. Verificar `fotosdocasamento.online` no Google Search Console e enviar `https://fotosdocasamento.online/sitemap.xml`.
