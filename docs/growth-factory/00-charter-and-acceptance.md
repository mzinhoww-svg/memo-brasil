# MemoriesMT / Revela — Growth Factory (GF-00)
**Início:** 19/11/2026  
**Governança:** A (V2/go-live) e B (backlog) aceitas pelo responsável. Etapa atual: Codex/Growth Factory. Etapa C (GTM) bloqueada até aceite formal de GF.  
**Repositório:** `mzinhoww-svg/memo-brasil` — branch `feat/growth-factory-foundation-20261119`.

## 0. Escopo deste primeiro PR
Criar uma definição versionada, testável e não executável do funil. **Este PR não instrumenta eventos, não cria tabelas, não dispara mensagens, não modifica pagamentos, não habilita tracking novo nem realiza deploy.**

Entregas iniciais:
- `web/src/features/growth/taxonomy.ts` — nomes, fontes confiáveis e fórmula defensiva de conversão.
- `web/src/features/growth/taxonomy.test.ts` — contrato e casos negativos.
- Este documento — definição, backlog, critérios de aceite, riscos e plano de execução.

## 1. Descoberta comprovada em 19/11/2026
| Sistema existente | Arquivo ou tabela | Observação |
|---|---|---|
| Acessos, origem, UTM, dispositivo | `web/src/lib/access/Tracker.tsx`, `web/src/app/api/acesso/route.ts`, `public.access_hits` | Contagem sem cookies e sem IP armazenado; visitante é hash diário. Não suporta atribuição multi-dia por usuário. |
| Dashboard Master | `web/src/app/master/acessos/page.tsx`, `web/src/lib/master/access-stats.ts` | Visualização de acessos, sem funil financeiro completo. |
| Eventos criados | `public.events` | `id`, `host_id`, `created_at`. Excluir eventos removidos conforme política. |
| Pedidos e pagamentos | `public.payment_orders`, `public.payment_events` | `payment_orders.status`, `amount_cents`, `currency`, `paid_at`; fonte para pagamento validado, não o browser. |
| Benefícios contratados | `public.event_entitlements` | Verificação dos direitos comerciais decorrentes do pagamento. |
| Uso pós-criação | `public.participants`, `public.photos`, `public.events` | Ativação por primeiro convidado, primeiro upload e revelação. |
| Consentimento e limites | `public.user_consents`, `public.participant_whatsapp`, textos legais | Não presumir que termos gerais permitem marketing ou atribuição entre sessões. |
| Feature flags | `public.feature_flags` | Rollout e kill switch por capacidades. |

Snapshot **não comparável como funil** (consulta agregada, somente leitura, 19/11/2026): 35 linhas em `access_hits`; 37 eventos não excluídos; 16 pedidos; 22 eventos de pagamento. Contadores abrangem janelas e universos diferentes. Não derivar conversão a partir desses números.

## 2. North Star e sistema de métricas
**North Star:** eventos pagos que chegaram à primeira utilização real da experiência (ex.: ao menos 1 convidado e 1 foto válida), em uma coorte definida.

Métricas principais:
- Visitantes **diários** e origens (conforme atual `access_hits`); não chamar soma de hash diário de MAU nem usuários únicos cross-day.
- Eventos criados = `events` válidos criados na coorte / período.
- Taxa de ativação = eventos da coorte que obtiveram primeiro convidado e foto válida / eventos criados na coorte.
- Checkout iniciado = número de eventos com primeiro pedido de pagamento criado (definição separada de tentativas).
- Conversão de pagamento = eventos da coorte com pedido efetivamente pago / eventos elegíveis da mesma coorte, com janela de conversão declarada.
- GMV bruto aprovado = soma de pedidos pagos em centavos com critério de deduplicação de `order_id`; reembolsos e chargebacks devem ser apresentados separadamente. Não equivale a receita líquida.
- Tempo até primeira foto = diferença entre criação do evento e primeira foto válida; medir por coorte.
- Canal/campanha atribuída = **somente quando existir mecanismo lícito e confiável de atribuição**. Na primeira fase, reportar origens de acesso e conversões do produto em painéis separados. Não inferir ROAS por proximidade temporal.

Cada indicador deve documentar timezone, janela, coorte, filtros de teste, deduplicação, política de exclusão, fonte e limitações. Nunca misturar eventos pagos com planos de cortesia ou testes.

## 3. Taxonomia v1 (fonte de verdade)
| Evento | Fonte segura | Momento / regra |
|---|---|---|
| `page_viewed` | Coleta existente | Apenas métrica agregada, sem associação por conta. |
| `signup_completed` | Autenticação do servidor | Cadastro concluído; não enviar email para telemetria. |
| `event_created` | Banco `events` | Apenas criação persistida, não clique no wizard. |
| `plan_viewed` | Browser (futuro) | Telemetria opcional após revisão de privacidade; nunca conta como compra. |
| `checkout_started` | Banco `payment_orders` | Pedido criado, deduplicado por id; status inicial separado de pago. |
| `payment_approved` | Provedor -> servidor -> banco | Somente confirmação do servidor, nunca via browser. |
| `first_guest_joined` | Banco `participants` | Primeiro participante válido por evento. |
| `first_photo_uploaded` | Banco `photos` | Primeira foto concluída e válida por evento, respeitando moderação. |
| `album_revealed` | Banco `events` | Revelação confirmada pelo estado do servidor. |
| `invitation_shared` | Browser (futuro) | Clique em compartilhar, não comprovação de entrega. |

## 4. Princípios não negociáveis
1. **Sem regressão das etapas A/B:** câmera, fila offline, fotos antes da revelação, privacidade, checkout ValidaPay, cortesias, contratos de planos, WhatsApp e reconhecimento facial são fora de escopo neste PR.
2. Não usar o hash diário de `access_hits` para identificar pessoas ao longo de vários dias nem tentar desanonimizar visitantes.
3. Não coletar IP persistente, email, nome, telefone, selfie, vetor facial, URL com token, QR/código de convite, fotografia ou texto livre em analytics.
4. Acesso a dados analíticos pessoais/operacionais apenas com autorização Master e RLS. Não usar `user_metadata` para privilégios.
5. Mensagens de ativação/recuperação só poderão ser enviadas após revisão do consentimento específico do canal, opt-out, limites e aprovação da campanha; não enviar mensagens neste estágio.
6. Servidor/DB ou PSP são fonte de verdade para pedido pago. Cálculo em navegador só serve para UX, jamais para conversão paga.
7. Agregações idempotentes; separar evento criado, tentativa de pagamento, aprovação, cortesia, reembolso e uso real.
8. Releases por feature flag, observabilidade e rollback; C — GTM permanece bloqueada.

## 5. Backlog executável (ordem e critérios de aceite)

### GF-01 — Data foundation e funil confiável (P0)
- Versionar taxonomia e dicionário; auditar fontes, status e datas.
- Criar queries/RPCs ou views `security_invoker` apropriadas para coortes de criação, ativação e pagamento com deduplicação. Não migrar esquema existente sem análise e testes.
- Dashboards Master separados para aquisições anônimas e conversão de eventos autenticados; nenhuma atribuição falsa.
- Cobertura dos estados: plano gratuito, cortesia, upgrades, Pix/cartão, pedido expirado, falha e reembolso; testes isolados e integrados.
- **Aceite:** cálculos reproduzíveis via SQL de teste, métricas identificadas por coorte, ausência de PII, RLS e tests aprovados, comparação com amostra agregada real.

### GF-02 — Ativação do anfitrião (P1)
- Identificar etapas da jornada: evento criado → convite copiado/compartilhado → primeiro participante → primeira foto → revelação.
- Intervenções apenas dentro do produto inicialmente: checklist, empty states e lembretes contextuais.
- **Aceite:** fluxo E2E e medição de ativação; nenhum envio sem opt-in, sem mudança nos P0.

### GF-03 — Recuperação de checkout (P1)
- Separar abandono real de pedido pendente Pix, pagamento em análise, falha, aprovado e expirado.
- Preparar segmentação; comunicação externa apenas depois dos critérios de marketing e compliance.
- **Aceite:** nunca notificar comprador pago como abandonado; idempotência, janelas e opt-out testados.

### GF-04 — Indicações e convites (P1)
- Propor mecanismo de indicação de anfitriões, com antifraude e regras econômicas; inicialmente medir compartilhamento, sem cashback/desconto automático.
- **Aceite:** atribuição explicitamente consentida onde aplicável; regras comerciais e custo aprovados, testes de abuso.

### GF-05 — Experimentação e relatórios (P1)
- Framework para hipóteses, segmentação determinística, flag desligável, métricas de guarda (pagamentos, câmera, privacidade, suporte).
- **Aceite:** experimento com análise de significância/limitações, rollback testado e auditoria independente.

### GF-06 — Preparação para C / GTM (gate final)
- Painel Master com métricas auditadas, playbooks de ativação e aquisição, controle de custos, campanhas autorizadas, documentação operacional.
- **Aceite:** evidências anexadas a PRs/CI, métricas de negócio verificadas, segurança e LGPD revisadas, aceite formal do responsável. Somente então liberar C.

## 6. Rotina de trabalho / auditoria
- Um PR por gate; revisão independente, sem autopromoção a produção.
- Para cada PR: escopo, SHA base/head, screenshots de UX quando necessário, migrações, plano de rollback, testes executados (não apenas declarados), indicadores pré/pós e riscos.
- Comandos previstos no diretório `web/`: `npm run typecheck`, `npm run lint`, `npm test`, `npm run e2e` (ambiente de teste preparado). Testes SQL via fluxo Supabase já configurado no repositório.
- Registrar **não executado** quando uma verificação não puder ser rodada. Não alegar que o Codex executou tarefas sem log.
- Nenhuma alteração de produção é autorizada por este documento.

## 7. Primeiro handoff para Codex
"Audite o PR inicial da Growth Factory, confirme taxonomia, uso de dados e desenho de coortes. Em branch derivada, implemente GF-01 com SQL testável, RLS explícita e dashboard Master, sem ligar tracking individual ou alterar pagamentos. Entregue CI, testes negativos, amostras agregadas e plano de rollback. Não avance a GF-02 sem aceitar GF-01."

**Status do documento:** em execução; GF-00 iniciada e GF-01 ainda não homologada.
