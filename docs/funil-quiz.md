# Funil de quiz com oferta de entrada (Revela)

Cinco quizzes, um por nível de consciência, todos levando à mesma oferta: **câmera para até 50 convidados por R$ 19,90 no Pix
(ValidaPay), válida por 30 minutos** a partir do fim do quiz.

## Caminho da pessoa
1. Anúncio → `/q/<slug>` (uma pergunta por tela, tudo sobre ela).
2. Fim do quiz → nasce o **lead** (sem nome, telefone ou e-mail) e o relógio de 30 minutos começa no servidor.
3. "Para onde eu mando o seu resultado?" → botão abre o WhatsApp com a mensagem pronta. Quando ela envia, **o bot responde
   sozinho com o texto da oferta** e o link `/oferta?l=<lead>`. Também dá para ver o resultado na hora, sem WhatsApp.
4. `/oferta` → perfil do resultado, plano travado, contagem regressiva real e o botão "Destravar por R$ 19,90 no Pix".
5. `/criar` → ao criar o evento, o lead é ligado a ele e a pessoa cai direto no checkout ValidaPay do plano da oferta.
6. Passou de 30 minutos: a página e o painel voltam ao catálogo normal (grátis até 10, R$ 147 até 150, R$ 297 até 300).

Quem comprou a oferta e precisa de mais lugares sobe de faixa pagando só a diferença (R$ 147 − R$ 19,90).

## Os 5 quizzes (endereço do anúncio)
| Nível | Formato | Endereço |
|---|---|---|
| 1. Inconsciente | Diagnóstico, 7 perguntas | `/q/diagnostico` |
| 2. Consciente do problema | Checklist de sinais | `/q/sinais` |
| 3. Consciente da solução | Isso ou aquilo | `/q/descartavel-ou-qr` |
| 4. Consciente do produto | Recomendação com perfil | `/q/camera-ideal` |
| 5. Mais consciente | 2 perguntas e a oferta | `/q/rapido` |

Use UTM no anúncio (`?utm_source=meta&utm_medium=campanha&utm_campaign=<nome>`): a origem vai para o lead, o evento e o pedido.
Perguntas e textos ficam em `web/src/features/funnel/quizzes.ts`; o motor é um só.

## Entrada direta (Instagram, link na bio, mensagem)
`/oferta` sem lead cria um lead na hora e dá os mesmos 30 minutos. É o link para colocar numa mensagem automática de
boas-vindas no Instagram (a automação da DM é feita na ferramenta de mensagens do Instagram, fora deste repositório):

> Oi! Que bom te ver por aqui 📸 No Revela, cada convidado do seu casamento fotografa pelo celular, sem baixar aplicativo, e as
> fotos se revelam juntas na hora que você escolher. Para quem chegou agora: câmera para até 50 convidados por R$ 19,90 no Pix.
> A oferta vale 30 minutos depois que você abrir o link: https://fotosdocasamento.online/oferta?utm_source=instagram&utm_medium=dm&utm_campaign=boas-vindas

## Texto que o bot manda no WhatsApp
Montado em `supabase/functions/_shared/wa-funnel.ts` (`buildOfferText`), com o preço e o limite lidos do plano `ate50`:

> Seu resultado chegou! 📸
>
> Numa festa de 130 convidados, as fotos mais verdadeiras ficam no celular de cada convidado. Depois da festa quase ninguém
> manda, e o que chega pelo grupo vem em baixa qualidade.
>
> O Revela junta tudo: cada convidado aponta o celular para o QR da mesa e fotografa, sem baixar aplicativo. As fotos ficam
> guardadas e se revelam juntas na hora que você escolher.
>
> Oferta de quem fez o teste: câmera para até 50 convidados por R$ 19,90 no Pix. Vale por 30 minutos. Sua festa é maior?
> Comece com 50 e aumente depois pagando só a diferença.
>
> Ver meu resultado e garantir: https://fotosdocasamento.online/oferta?l=…
>
> Para não receber mais mensagens, responda SAIR.

## Regras que o servidor garante
- O plano `ate50` é **só de oferta** (`plans.offer_only`): não aparece em `/precos` nem no seletor de planos.
- A cotação só vende `ate50` para o evento ligado a um lead **dentro do prazo**. Pix aberto no prazo segue a validade normal do Pix.
- Um lead vale para um evento; o desconto de 20% do limite do grátis não se soma à oferta.
- Criação de lead limitada a 8 por hora por IP (só o hash do IP vira chave). Refazer o quiz dá um novo prazo: é uma promoção de
  entrada, não um cupom único por pessoa.
- Privacidade: o lead não guarda dado pessoal. O telefone de quem manda a mensagem não é gravado; o banco só marca
  "contato confirmado".

## Medir (os portões por quiz)
`select public.admin_funnel_report(30);` (equipe): por quiz, visitantes da página, quiz terminado (lead), contato no WhatsApp,
evento criado, pedido aberto, pedido pago e receita. Conserta-se sempre o primeiro portão quebrado.

## Publicar
```
supabase db push                                   # migration 20261127000100_funil_quiz.sql
supabase functions deploy funnel-lead --no-verify-jwt        # aberta a visitantes; valida o corpo e limita por IP
supabase functions deploy whatsapp-webhook --no-verify-jwt   # passa a reconhecer o subject lead.<id>
```
- O app precisa de `NEXT_PUBLIC_VALIDAPAY_CHECKOUT=1` (o mesmo do checkout atual) e do ValidaPay ligado em produção.
- O WhatsApp usa os segredos que já existem (`WA_GATEWAY_URL`, `WA_GATEWAY_API_KEY`, `WA_GATEWAY_WEBHOOK_SECRET`). Sem o gateway,
  o funil funciona igual, só que o resultado abre direto na página.
- Desligar a oferta: Master → Planos → desativar `ate50` (a página da oferta passa a mostrar o caminho normal).

## Fora desta entrega
- Mensagens de recuperação para o lead (por exemplo "faltam 10 minutos"): exigiriam guardar o telefone do lead.
- Preencher o assistente de criação com as respostas do quiz.
- Tela no Master para o relatório (hoje é a consulta acima).
