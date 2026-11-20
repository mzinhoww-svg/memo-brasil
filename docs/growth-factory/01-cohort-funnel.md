# GF-01 — Funil por coorte de criação de evento (proposta para homologação)

**Status:** implementado em branch de desenvolvimento, **não aplicado em produção**.  
**Dependência:** GF-00 (PR #43) precisa ser revisto e aceito antes do merge da GF-01.  
**GTM:** permanece bloqueado até conclusão de GF-01...GF-06 e aceite formal da Growth Factory.

## Motivação / fonte dos dados
Os acessos ao site já são medidos em `access_hits` por hash de visitante que muda a cada dia. Ele **não permite** ligar visitantes anônimos a cadastros ou pagamentos entre sessões. Por isso, o painel de crescimento separa:
- **Acessos e UTMs:** continuam em `/master/acessos`.
- **Funil de eventos reais:** novo painel `/master/pagamentos/crescimento`, usando apenas estados persistidos de banco e PSP.

Não há atribuição de receita por mídia nesta fase. CAC, ROAS e ROI por campanha não devem ser inferidos por simples divisão ou proximidade temporal.

## Semântica exata dos indicadores

**Coorte:** eventos criados entre o início do primeiro dia e o fim do último dia corrido, no fuso `America/Cuiaba` (7, 30 ou 90 dias). Excluem-se `events.is_test`, hosts marcados em `profiles.is_test` e eventos atualmente excluídos (`deleted_at IS NOT NULL`). Status de eventos criados no passado pode mudar com exclusões posteriores.

**Acompanhamento pós-criação:** participações, fotos, checkouts e pagamentos são avaliados no estado atual do banco, mesmo que tenham ocorrido depois da janela inicial de criação. Coortes mais novas tiveram menos tempo para converter. **Não** fazer comparação de conversão como se tivessem a mesma maturidade.

| Chave JSON | Regra de contagem |
|---|---|
| `created` | Quantidade de eventos da coorte |
| `withGuests` | Eventos com pelo menos um participante não bloqueado diferente do anfitrião |
| `withPhotos` | Eventos com pelo menos uma foto `pronta`, `visivel`, não excluída |
| `activated` | Interseção `withGuests` e `withPhotos`; foto não precisa ter sido tirada pelo convidado |
| `checkoutEvents` | Eventos com pelo menos um pedido na `payment_orders` em `provider_env='production'` e BRL, de qualquer status |
| `paidEvents` | Eventos distintos com pedido em produção, BRL, status atual `pago` e `paid_at IS NOT NULL` |
| `paidOrders` | Quantidade de pedidos atualmente pagos (inclui upgrades, não deduplica por evento) |
| `paidCents` | Soma bruta, em centavos, de `amount_cents` de pedidos atualmente pagos. NÃO é receita líquida e pode conter estornos parciais não refletidos neste indicador |
| `courtesyEvents` | Eventos com benefício ativo de fonte `codigo` ou `cortesia`. Pode se sobrepor a eventos pagos |
| `reversedOrDisputedOrders` | Pedidos em produção cujo status atual é `estornado`, `em_disputa` ou `perdido`; não fazem parte de `paidCents` |

A série diária **agrupa pelo dia de criação**, não pelo dia do pagamento. Somar a série deve reproduzir os totais de eventos criados, ativados, checkout e pagos. Pedidos sandbox, fotos com upload falho e eventos de teste não contam.

## Segurança
- Função `public.admin_growth_cohort(int)` em `SECURITY DEFINER`, `search_path=''`, com verificação **interna** `public.is_master()`: claim de plataforma e linha ativa em `platform_roles`.
- EXECUTE revogado de PUBLIC e anon; apenas authenticated recebe permissão de invocação e deve passar pelo teste de Master.
- Rota Master verifica `requireRole('pagamentos')` e o banco confirma novamente o papel.
- O retorno é agregado, sem nome, CPF, email, IP, telefone, ID de usuário, fotografia ou biometria.
- Nenhum evento de rastreamento, campanha ou mensagem é disparado pela RPC.

## Arquivos
- `supabase/migrations/20261122000100_admin_growth_cohort.sql`: função e grants.
- `supabase/tests/database/46_growth_cohort.test.sql`: fixtures e regressões de RLS, duplicidade, pagamento real x sandbox, teste e cortesia.
- `web/src/features/growth/cohort.ts` + `cohort.test.ts`: contrato/formatadores.
- `web/src/revela/screens/MasterCrescimento.tsx`: interface de indicadores e série temporal.
- `web/src/app/master/pagamentos/crescimento/page.tsx` + teste: guardas de permissão e dados.
- `web/src/app/master/pagamentos/page.tsx`: acesso pelo menu de Pagamentos.

## Sequência para homologação e rollout
1. Merge GF-00 somente após revisão, testes e aceite do gate (PR #43).
2. Revisar o diff deste PR, a taxonomia e os números do SQL de coortes em amostra representativa anonimizada.
3. Aplicar migrations **em banco de teste/preview**, seguindo a ordem de versões do projeto. Não executar DDL em produção como atalho para testar.
4. Executar pgTAP e testes TS/React/Playwright:
   - `cd web && npm run typecheck && npm run lint && npm test`
   - `cd web && npm run e2e` com credenciais/fixtures de teste e a migration aplicada.
   - SQL via comando CLI suportado pela versão instalada (`supabase --help` e `supabase migration --help`) e fluxo CI existente.
5. Comparar `created`, `paidEvents`, `paidOrders`, `paidCents` e a soma da série contra consultas de conferência feitas por auditor independente. Incluir caso de reembolso parcial, com limitação anotada.
6. Verificar papel Master x support x auditor x anfitrião; sem acesso para guest/anon e sem dados brutos expostos.
7. Medir tempo de resposta com 7, 30 e 90 dias; otimizar só após medição.
8. Registrar evidência: SHA, CI, prints responsivos, logs de testes, parecer de privacidade e aprovação explícita.
9. Só então migrar, publicar e verificar o deployment ativo; testar rollback.

### Rollback
A migração é aditiva. Em rollback autorizado, retirar o link e a página do frontend e executar em janela de mudança:

```sql
drop function if exists public.admin_growth_cohort(integer);
```

Não há novas tabelas nem cópia de dados, portanto o rollback não deve remover dados existentes.

### Resultados já verificados
A estrutura equivalente de consulta, executada em modo **somente leitura** no Supabase em 19/11/2026, retornou totais coerentes e série de 30 dias. Essa execução **não** equivale a aplicar a migration ou homologar os testes pgTAP e E2E.

### Bloqueios
- [ ] Revisão e aceite GF-00
- [ ] CI, typecheck, lint, Vitest, pgTAP e E2E de GF-01
- [ ] Auditoria independente das métricas e do acesso à RPC
- [ ] Prévia do dashboard em dispositivos móveis
- [ ] Aprovação do release e validação de rollback
