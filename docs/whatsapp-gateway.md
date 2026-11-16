# Avisos por WhatsApp (Revela) — gateway `wa-gateway`

O convidado opta por receber avisos (hoje: "suas fotos foram reveladas") por um WhatsApp **não oficial** (Baileys, chip dedicado, instância `revela`).
Só recebe quem tocou em "Receber avisos no WhatsApp" **e enviou a primeira mensagem do próprio número**. Sair: enviar `SAIR` a qualquer hora.

## Como funciona
1. Botão (front) → Edge Function `whatsapp-optin` (sessão do convidado; o banco confere participante não bloqueado e o recurso ligado) → gateway `POST /v1/optin/codes`
   com `subjectId = <event_id>.<user_id>`, `prefix REV`, `ttlMinutes 15`, `replyText` com o link de volta `/e/<código>/voce`. Devolve **só o `waLink`**.
2. O convidado envia a mensagem pronta; o bot confirma e o gateway chama `whatsapp-webhook` (`x-wa-signature: sha256=<hmac do corpo bruto>`).
   Assinatura inválida = 401 antes de qualquer parse. `optin.confirmed` / `optin.revoked` são idempotentes e à prova de ordem (`whatsapp_apply_event`). `message.received` é ignorado.
3. A tela faz polling leve (4 s, só com a aba visível, até 15 min) e revalida ao voltar o foco; vira "Ativado ✓" quando o webhook grava.
4. `reveal_due_events()` (pg_cron, 1/min) enfileira `kind='revealed'` em `whatsapp_outbox` **na mesma transação** da revelação, só para opt-in ativo, não bloqueado, com a flag ligada.
5. `whatsapp-dispatch` (pg_cron, 1/min): lote de 4, teto de 55 envios/hora (o gateway limita a 60/h), 1,5 s entre envios. `409 NO_OPT_IN` = marca revogado e nunca reenvia; erros passageiros reagendam (até 5 tentativas); 429/401 param o lote.

## Dados e privacidade (LGPD)
- Telefone só em `participant_whatsapp` (RLS: o convidado lê só a própria linha; anfitrião e outros convidados **não** leem; ninguém grava pelo cliente).
- Sai junto com o convidado, a conta (`process_account_deletion`), o evento (cascata) e quando a pessoa manda `SAIR` (o número é apagado).
- A auditoria (`audit_logs`) registra `whatsapp.optin` / `whatsapp.revoked` **sem telefone**; os logs das funções não têm telefone, corpo nem chave.
- Política de Privacidade **v2** (`2026-11-16-v2`); Termos seguem na v1. Texto sem revisão jurídica profissional registrada (mesmo critério da v1).

## Segredos das Edge Functions (valores só no painel/CLI, nunca no repositório nem no chat)
| Nome | Obrigatório | Para quê |
|---|---|---|
| `WA_GATEWAY_URL` | sim | base do gateway (https, sem caminho) |
| `WA_GATEWAY_API_KEY` | sim | header `x-api-key` nas rotas `/v1/*` |
| `WA_GATEWAY_WEBHOOK_SECRET` | sim | HMAC do webhook |
| `PUBLIC_SITE_URL` | não | origem dos links da mensagem (padrão `https://newmemocuiaba.vercel.app`) |

`SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` já existem no ambiente das funções. CORS usa o `ALLOWED_ORIGINS` já existente.

## Publicar (depois de aprovado o SQL final)
```
supabase db push                                   # migration 20261116000100_whatsapp_optin.sql
supabase secrets set WA_GATEWAY_URL=... WA_GATEWAY_API_KEY=... WA_GATEWAY_WEBHOOK_SECRET=...
supabase functions deploy whatsapp-optin
supabase functions deploy whatsapp-webhook --no-verify-jwt      # o gateway não manda JWT; a autenticação é a assinatura
supabase functions deploy whatsapp-dispatch --no-verify-jwt     # o pg_cron manda a service_role; a função compara por conta própria
# SQL Editor: supabase/ops/schedule_whatsapp_dispatch.sql  (reaproveita o segredo do Vault mm_purge_service_role)
```
No gateway: `WEBHOOK_URL_REVELA=https://<projeto>.supabase.co/functions/v1/whatsapp-webhook`.

## Ligar e desligar
- Ligar (Master): `select public.admin_set_feature_flag('whatsapp_avisos', true, '{}', 'motivo com 10+ caracteres');` — sem linha/flag = desligado e **nenhum botão aparece**.
- Desligar: mesma RPC com `false` (botões somem, o dispatch não retira nada). Pausar o envio: `select cron.unschedule('mm-whatsapp-dispatch');`.

## Teste de ponta a ponta
1. Evento com revelação programada; entre como convidado em `/e/<código>` (passo "Quer um aviso quando as fotos forem reveladas?", pulável).
2. Em **Você → Avisos do evento**: botão → "Aguardando confirmação…" → (envie a mensagem no WhatsApp) → "Ativado ✓" sozinho, com "envie SAIR para desativar".
3. Mande `SAIR`: o cartão volta a oferecer o botão. Na espera da revelação e em "Postar" aparece o lembrete compacto até ativar.
4. Na hora da revelação: 1 mensagem "Suas fotos de … foram reveladas" por opt-in ativo (fila: ~1/min no máximo 55/h).
