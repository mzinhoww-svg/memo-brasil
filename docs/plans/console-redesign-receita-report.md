# Console redesign: frente Receita (pagamentos, planos, códigos)

Testes: 14 novos passando (lib de pagamentos 8, planos 1, códigos 5). `tsc --noEmit` e `eslint` limpos nas três pastas. Sem build nem Playwright; layout em 400 px não verificado no navegador. Nada commitado.

## Arquivos
- `web/src/app/master/pagamentos/{page.tsx, lib.ts, lib.test.ts, page.module.css}`
- `web/src/app/master/planos/{page.tsx, lib.ts, lib.test.ts}`
- `web/src/app/master/codigos/{page.tsx, CodeTemplates.tsx, lib.ts, lib.test.ts, page.module.css}`
- Não alterados: `billing*.ts(x)`, `codes*.ts(x)`, kit, layout, admin.css, migrations.

## Decisões
- Só RPCs existentes: `admin_payments_summary`, `admin_list_payments` (limite subiu de 200 para 500, o máximo da RPC, para agregados mais completos), `admin_payment_divergences`, `admin_list_plans`, `admin_list_codes`, `get_public_settings`. Nenhuma RPC nova, então `rpcOr` e modo degradado não se aplicam: nada some antes do `db push`.
- Ações intactas: `CourtesyButton`, `RefundButton`, `PlanEditButton`, `GenerateCodeButton`, `RevokeCodeButton` com as mesmas props. Nada toca `payments_env`, checkout, webhook ou criação de pedido.
- Pagamentos: bloco do ambiente no topo (Pill + o que significa: desligado, sandbox, produção); divergências logo abaixo, só quando > 0, com link "Ver pedido" (`?q=<orderId>`) e CSV; KPIs; faixa de aviso quando há pendentes há mais de 1 h; funil (criados, pagos) com barra de situação (pagos, em aberto, expirados, outros); receita por plano (só status `pago`, estornos fora); tabela ordenável com busca `?q=` (id do pedido, id de pagamento/cobrança ou título do evento), Pill "há mais de 1 h" por linha pendente e CSV.
- "Pago" no funil inclui pago, em disputa, estornado e perdido (chegou a pagar). Funil sai de `byStatus` do resumo (todos os pedidos, sem janela).
- Planos: colunas novas "R$ por convidado" (`pricePerGuestCents` com `maxGuests`; grátis e sem limite mostram "—"), vendas e receita (pedidos pagos entre os 500 últimos), ordenação por link, CSV. Edição continua só preço e ativação.
- Códigos: três modelos rápidos (teste interno 1 evento/7 dias, parceiro 5/90 com o 2º plano pago, presente 1/30) abrem um formulário pré-preenchido e editável.
- Usos com barra, validade com dias restantes, Pill "vence em breve" (menos de 3 dias), CSV (só o começo do código).

## Desvio a avisar
- Os modelos não puderam pré-preencher o `GenerateCodeButton` sem mexer em `codes-actions.tsx` (estado interno, sem props). Criei `codigos/CodeTemplates.tsx`, um formulário local que chama a MESMA RPC `admin_create_code` com os mesmos parâmetros e as mesmas validações importadas de `codes.ts`. Alternativa mais enxuta, se o dono aprovar: adicionar uma prop opcional `preset` ao `GenerateCodeButton` e apagar o formulário local.

## Pendências
- Skill `dataviz` não carregada: usei só `Funnel` e `StackBar` do kit (cores `--ok/--warn/--adm-s*`); contraste e 400 px por verificar no navegador.
- Receita e vendas são limitadas aos 500 pedidos mais recentes (o texto na página diz isso). Passando disso, vale uma RPC de agregação.
- Busca `?q=` só enxerga os 500 pedidos carregados.
- Toggle de testes e período não foram incluídos nestas páginas: os pedidos não têm marca `is_test` nem janela na RPC atual.
