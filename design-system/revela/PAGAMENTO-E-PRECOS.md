# Paywall, checkout ValidaPay e preços no Master

O design é do Revela. A regra de negócio e o backend são os que já existem em `mzinhoww-svg/memo-brasil` (branch `main`). Nada de layout, cor ou componente do repositório entra nas telas.

## 1. Preços (fonte: tabela `public.plans`)

| code | Nome | Convidados | Poses por pessoa | Preço |
|---|---|---|---|---|
| gratis | Grátis | 10 | 10 | R$ 0 |
| festa | Festa | 30 | 24 | R$ 29 |
| celebracao | Celebração | 100 | 24 | R$ 89 |
| casamento | Casamento | 250 | 36 | R$ 189 |
| grande | Grande | 500 | livre | R$ 349 |

- O paywall (tela 14) **nunca** tem preço fixo no app: lê `plans` onde `production_active = true`, em `sort`, e mostra `price_cents`, `max_guests` e `max_shots`.
- A cota que o convidado vê ("27 poses suas") é `events.shots_per_person`, que o anfitrião escolhe até o `max_shots` do plano (tela 10 mostra o limite).
- O plano em destaque no paywall é o campo novo `plans.highlighted` (boolean, um só ativo). É o único campo de banco novo desta parte.

## 2. Jornada de pagamento (telas 14 → 14g)

| Tela | O que faz | Backend que já existe |
|---|---|---|
| 14 Escolha o plano | cards com rolagem lateral, CTA "Continuar · R$ X" | `plans` |
| 14a Resumo e forma de pagamento | total cotado no banco, Pix ou cartão | RPC de cotação + pedido (um pedido aberto por evento, tabela `payment_orders`) |
| 14b Pix | QR + copia e cola, contador de expiração, "Aguardando o pagamento" com polling | Edge Function `payments-validapay` → `POST /v1/charges` com `externalId` e `externalTxid` = id do pedido |
| 14c Cartão | campos tokenizados no navegador pelo SDK oficial; PAN/CVV nunca vão ao Supabase | SDK de tokenização ValidaPay |
| 14d Confirmação do banco | desafio 3DS | SDK 3DS ValidaPay |
| 14e Confirmando | estado intermediário; pode fechar, a câmera libera sozinha | `payments-validapay-webhook` (`payment.success`, HMAC) + `payments-validapay-reconcile` |
| 14f Pago | benefício liberado, comprovante | `event_entitlements` gravado pela RPC de concessão |
| 14g Não deu certo | "nada foi cobrado", oferece Pix | status `CHARGE_FAILED` |
| 14h Trocar de plano | medidores de uso e upgrade | mesma jornada, novo pedido |

Regras que as telas respeitam:
- **Checkout transparente:** tudo acontece dentro do app. Não há redirecionamento para página externa.
- **Liberação só pelo servidor:** a tela "Pago" aparece quando o status do pedido vira pago (webhook ou conciliação), nunca pelo retorno do navegador.
- **Cartão depende de 3DS.** Hoje a conta não tem 3DS liberado (ver `docs/payments/VALIDAPAY-DESIGN.md`). Enquanto isso, o Master deixa "Cartão" desligado e a tela 14a mostra só Pix. Quando o 3DS for liberado, é só ligar o interruptor em M14.
- **Expiração do Pix:** valor configurável em M14 (padrão 15 min). Pedido Pix aberto mantém o preço cotado, mesmo se o Master mudar o preço.

## 3. Master: alterar preços (telas M03 e M04)

- **Edição direta na tabela:** preço, convidados e poses por plano; interruptores de sandbox e produção; "Destacar" no paywall; "Novo plano".
- **Prévia ao vivo:** o celular ao lado mostra o paywall como o anfitrião vai ver, com o valor ainda não publicado.
- **Barra "alterações não publicadas":** acumula as mudanças, com "Descartar" e "Publicar preços".
- **Confirmação (M04):** mostra de → para, o impacto (eventos já pagos não mudam, Pix abertos mantêm o valor) e pede o código do autenticador.
- **O que isso grava:** `update plans set price_cents, max_guests, max_shots, production_active, sandbox_active` + `audit_logs` (`plan.price_changed`, quem, de, para). Direitos já concedidos ficam como estão porque `event_entitlements` guarda os limites na concessão.
- **Histórico de preços:** lista de `audit_logs` filtrada por `plan.*`.

## 4. Telas do Master ligadas ao pagamento

- **M05 Pagamentos:** cobranças conciliadas, filtros por método e situação, "Conciliar agora" (`payments-validapay-reconcile`).
- **M06 Detalhe:** linha do tempo do pedido, ids da ValidaPay, alerta de pagamento em duplicidade e "Estornar" (`payments-validapay-refund`).
- **M07 Cortesias:** códigos que liberam plano sem pagamento (`courtesy_codes`).
- **M14 Configurações:** ambiente sandbox/produção, Pix, cartão (3DS), webhook e flag do checkout.
