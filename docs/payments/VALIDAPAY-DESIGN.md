# Checkout ValidaPay — desenho e limites

## Objetivo
Checkout Pix/cartão nativo em Next.js, com Supabase como autoridade de preços,
pedidos e benefícios. A missão fornecida pelo usuário autoriza a implementação
autônoma e proíbe produção, cobranças reais e resolução de pendências históricas.

## Arquitetura escolhida
Adaptador aditivo, sem substituir Mercado Pago. A alternativa de trocar o provedor
global quebraria pedidos históricos e foi descartada. Reaproveitar o PR #23 por
inteiro também foi descartado: ele ainda não foi homologado e depende do SDK MP.
Seu desenho de jornada pode orientar a UI, sem incorporar código não validado.

1. Contrato de domínio independente: valores em centavos inteiros, identificador
   do pedido, ambiente, moeda e estado confirmado.
2. Adaptador ValidaPay: OAuth, POST /v1/charges com externalId estável, recuperação
   de 409 pelo chargeId, GET status para polling e GET detalhe para conciliação.
3. Assinatura sobre bytes brutos; janela de cinco minutos; eventos deduplicados
   em armazenamento durável antes da confirmação financeira assíncrona.
4. RPCs específicas e transacionais: autenticação, cotação no banco, locks por
   evento/pedido, vínculos únicos e concessão/revogação idempotente.
5. Checkout protegido por flag desligada por padrão; sandbox restrito a master.
   Tokenização e 3DS oficiais no navegador; nunca encaminhar PAN/CVV ao Supabase.

## Contratos consultados
MCP https://docs.validapay.com.br/mcp: initialize, tools/list, get_endpoint
POST /v1/charges, get_webhook_event payment.success, get_guide segurança.
Complementos: OpenAPI, llms-full.txt, /sdks/tokenizacao.md, /sdks/3ds.md,
/webhooks/seguranca.md. Consultados em 2026-11-05 (America/Sao_Paulo).

externalId deduplica POST /v1/charges; 409 DUPLICATE_CHARGE traz
error.details.chargeId. POST /v1/charges/pix não é idempotente e não será usado.
OAuth usa formulário client_credentials e scopes mínimos. Token tem validade
variável. HMAC SHA-256: `<timestamp-ms>.<corpo-bruto>`, header t=...,v1=....

## Estado após homologação parcial
- As variáveis sandbox específicas foram fornecidas e OAuth passou (200).
- Pix real de sandbox, tokenização oficial, aprovação/recusa e estorno diagnóstico
  de cartão sem 3DS foram exercitados. Ver evidências sanitizadas no runbook.
- O SDK authenticate retornou null: a conta não disponibiliza 3DS. O produto
  continua recusando cartão sem autenticação; diagnóstico não é homologação da UI.
- O sandbox devolve SANDBOX_cha_ e CHARGE_FAILED, agora aceitos explicitamente.
- Referências externalId diferentes retornaram 409 para o mesmo comprador/valor.
  GET detalhe não retorna externalId, mas persiste externalTxid. Enviamos também
  externalTxid=UUID do pedido e exigimos esse vínculo antes de anexar, confirmar
  ou cancelar. Isso recusa a cobrança de outro pedido devolvida pelo sandbox.
- Segredo/entrega de webhook público e Supabase remoto ainda não disponíveis.
- Banco remoto, migrations aplicadas e needs_refund históricos não inspecionados.
- Nenhum deploy, migration remota ou mudança financeira autorizada foi executado.

A etapa A permanece aberta. Testes com transporte simulado não são homologação.
