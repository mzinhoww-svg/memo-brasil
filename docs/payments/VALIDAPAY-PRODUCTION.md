# ValidaPay — preparação de produção

O usuário autorizou merge, deploy e ativação nos projetos Vercel `newmemocuiaba`
e `memoriesmt-v2`. Autorização não equivale a homologação: o checkout só pode ser
ativado depois de configurar os requisitos abaixo. Nenhuma cobrança produtiva
foi criada durante a preparação. POST de estorno produtivo permanece bloqueado.

## Configuração e ordem de ativação

1. Aplicar as migrations aditivas `20261105000100` e `20261105000200`, preservando
   todas as migrations e pedidos existentes. O projeto remoto contém também
   `20261024000100_console_redesign` e `20261024000200_person_names`, ausentes do
   checkout Git. Recuperar suas definições somente para o diretório isolado de
   deploy; o dry-run deve listar apenas as duas migrations ValidaPay novas.
2. Publicar as quatro funções ValidaPay com o checkout desabilitado. Configurar
   `VALIDAPAY_ENVIRONMENT=production`, `CLIENTID_VALIDAPAY`,
   `CLIENTSECRET_VALIDAPAY`, `VALIDAPAY_PRODUCTION_PUBLIC_ID`,
   `VALIDAPAY_PRODUCTION_WEBHOOK_SECRET` e `VALIDAPAY_PRODUCTION_RECONCILE_TOKEN`.
   Confirmar os nomes no runtime antes de enviar secrets. Nunca copiar o publicId
   sandbox: o identificador disponível foi recusado com ACCOUNT_NOT_FOUND na
   criação de sessão produtiva, sem cobrança financeira.
3. Registrar e validar webhook HMAC e agendamento do reconciliador usando o
   contrato oficial. Preservar webhook, cron e secrets Mercado Pago existentes.
4. Confirmar `payments_env=production`, habilitar o feature flag ValidaPay do
   banco e `VALIDAPAY_PRODUCTION_ENABLED=true` somente com callbacks prontos.
5. Nos dois projetos Vercel, configurar `NEXT_PUBLIC_VALIDAPAY_CHECKOUT=1` em
   produção, confirmar o vínculo ao mesmo Supabase e reconstruir/publicar.
   A autenticação CLI Vercel é necessária; `ai-gateway setup` não autoriza deploy.
6. Verificar CORS, configuração autenticada, CSP e jornada real de comprador.
   Um teste de cartão só é conclusivo com 3DS válido; não contornar null/erro do SDK.

## Proteções implementadas

O servidor escolhe ambiente, preço e proprietário. Produção aceita o dono real;
sandbox continua restrito a master. Credenciais e inbox são separados por
ambiente; retomada e todas as respostas verificam o ambiente do pedido. SDKs
recebem o ambiente explicitamente e o navegador falha fechado em divergências.

O registro atômico de tentativa antecede o POST financeiro. Somente uma reserva
sem tentativa pode ser abandonada para nova cotação; timeout preserva o pedido.
Referência, moeda, valor e identificador são conferidos antes da confirmação.
Estornos confirmados podem revogar benefícios em produção, mas solicitar estorno
real via este endpoint continua proibido. Há uma pendência histórica needs_refund
no projeto remoto; esta implantação não a resolve nem altera seu pedido.

CORS admite os dois domínios e previews pertencentes à equipe conhecida. A flag
de build adiciona os hosts produtivos dos SDKs à CSP. O domínio memoriesmt-v2
apresentava proteção Vercel durante a inspeção; não foi desabilitada.

## Evidência e limites

Na preparação local passaram 584 testes web, 186 testes puros e 1.176 testes SQL;
typecheck, Deno e build passaram. O teste CORS adicional passou. A evidência
financeira sandbox está em `evidence/2026-11-05-validapay-sandbox.json`.
Isso não comprova webhook remoto, desafio 3DS nem compra produtiva. O runbook
sandbox registra os resultados históricos do primeiro PR; consultar este arquivo
e os Checks do commit para a preparação de produção.

Rollback de ativação: desabilitar o flag de checkout no frontend e no backend;
manter webhook e reconciliador ativos para liquidar pedidos já existentes.
Não remover tabelas, migrations, transações ou histórico Mercado Pago.
