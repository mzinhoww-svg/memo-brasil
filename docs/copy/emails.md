# E-mails transacionais — Memo Brasil

> **Rascunho v0.1 · 13/10/2026 · Redator.** Tom acolhedor, direto, sem enfeite que atrapalhe a leitura.
> 🔧 = depende de recurso a construir (envio de e-mail ainda não existe; chaves do provedor ausentes — ver decisão 002).
> ⚖️ **EM-n** = revisão jurídica. `{variável}` = valor dinâmico. Todo valor de usuário (`{titulo}`, `{nome}`) é inserido como **texto escapado**.

## Regras gerais

| Regra | Detalhe |
|---|---|
| Remetente | `{marca} <nao-responda@{dominio}>`; responder vai para `{suporte}` (Reply-To) |
| Assunto | até 60 caracteres, sem caixa-alta nem emoji exagerado |
| Formato | HTML simples + **versão em texto puro** sempre |
| Link | Um link principal por e-mail; HTTPS; sem rastreamento de clique em e-mail de acesso |
| Conteúdo | **Nunca** anexar nem incorporar fotos, e **nunca** colocar dados de convidados |
| Rodapé padrão | ver abaixo |
| Idioma | pt-BR |

**Rodapé padrão (todos os e-mails):**
> Você recebeu este e-mail porque pediu acesso ao {marca} com este endereço.
> Dúvidas? Escreva para {suporte}. · [Política de Privacidade] · [Termos de Uso]
> {RAZÃO SOCIAL} · CNPJ {CNPJ} · {ENDEREÇO}

⚖️ **EM-1 — Rodapé.** Confirmar dados exigidos (identificação do remetente) e se e-mails transacionais dispensam link de descadastro (não são marketing). Nada aqui é publicidade; se virar newsletter, precisa de consentimento e opção de saída.

---

## 1. Link mágico de acesso (entrar no painel)

**Quando:** a pessoa informou o e-mail e pediu para entrar (ou criou o primeiro evento).
**Validade:** 15 minutos, uso único (decisão 002). 🔧

**Assunto:** `Seu link para entrar no {marca}`
**Pré-visualização:** `Vale por 15 minutos e só funciona uma vez.`

**Corpo:**

> Olá! 👋
>
> Para entrar no painel do seu casamento, é só tocar no botão:
>
> **[ Entrar no {marca} ]** → `{link}`
>
> Este link **vale por 15 minutos** e só funciona **uma vez**.
>
> Se o botão não funcionar, copie e cole este endereço no navegador:
> `{link}`
>
> **Cuidado:** não encaminhe este e-mail a ninguém. Quem tiver este link entra na sua conta.
>
> **Não foi você?** Pode ignorar este e-mail. Nada vai acontecer.
>
> Com carinho,
> Equipe {marca}

**Variações:**

- **Primeiro acesso (criou o evento):** trocar a primeira linha por `Seu álbum de **{titulo}** foi criado. Para abrir o painel e compartilhar o QR Code, toque abaixo:`
- **Link expirado (tela do site, não e-mail):** `Este link já foi usado ou expirou. Sem problema: peça um novo e a gente envia na hora.`
- **Aviso de novo acesso (opcional, segurança) 🔧:** assunto `Um novo acesso ao seu painel`; texto `Registramos um acesso ao painel de {titulo} em {data e hora}. Foi você? Se não, escreva para {suporte}.`

**Notas de segurança (para quem implementa):** o link deve concluir o login **no navegador que o abriu**; mensagem de envio no site é genérica ("Se o e-mail estiver correto, você receberá o link"), para não revelar contas existentes.

---

## 2. A revelação abriu (para o organizador)

**Quando:** no horário da revelação, uma única vez por evento (item 8 do checklist). 🔧
**Destinatário:** e-mail do organizador (e membros da equipe com e-mail, se houver).

**Assunto:** `O álbum de {titulo} está aberto! 🎉`
**Pré-visualização:** `{n} momentos de {m} pessoas esperando por vocês.`

**Corpo:**

> Chegou o momento! 💛
>
> O álbum de **{titulo}** acabou de abrir. Seus convidados registraram **{n} momentos**, feitos por **{m} pessoas**.
>
> **[ Ver o álbum ]** → `{link_album}`
>
> **O que acontece agora**
> - Todos os convidados já podem ver as fotos.
> - Vocês podem ver a retrospectiva e **baixar o álbum completo (ZIP)** pelo painel.
> - Se alguma foto não deveria estar ali, é só apagar pelo painel.
>
> **Guarde com carinho**
> Mantemos o álbum por **12 meses** depois da revelação, até **{data_limite}**. Recomendamos baixar o ZIP agora.
>
> **[ Abrir o painel ]** → `{link_painel}`
>
> Foi um prazer fazer parte desse dia.
> Equipe {marca}

**Se `{n}` for 0:**
> O álbum de **{titulo}** abriu, mas ninguém enviou fotos desta vez. Se foi um problema técnico, escreva para {suporte}.

**Mensagem padrão para o casal enviar aos convidados (bloco copiável dentro do e-mail):**
> O álbum do nosso casamento abriu! 💛 Vejam as fotos aqui: {link_album}

---

## 3. Aviso de que o álbum vai ser apagado 🔧

**Quando:** 30 dias e 7 dias antes do fim dos 12 meses (job de retenção).

**Assunto:** `O álbum de {titulo} será apagado em {dias} dias`
**Pré-visualização:** `Baixe seu álbum antes do fim do prazo.`

**Corpo:**

> Olá!
>
> Como combinado, guardamos o álbum de **{titulo}** por 12 meses depois da revelação. O prazo termina em **{data_limite}**.
>
> Depois dessa data, **apagamos as fotos, os recados e a lista de convidados**, e não será possível recuperá-los.
>
> **Para ficar com as lembranças:**
> **[ Baixar o álbum completo (ZIP) ]** → `{link_painel}`
>
> Precisa de mais tempo? Escreva para {suporte} antes de {data_limite}.
>
> Com carinho,
> Equipe {marca}

⚖️ **EM-2 — Extensão de prazo.** Definir se é possível estender (e como), e se estender exige novo consentimento dos convidados.

---

## 4. Confirmação de exclusão do evento 🔧

**Quando:** depois que o organizador exclui o álbum ou o prazo expira.

**Assunto:** `O álbum de {titulo} foi apagado`
**Pré-visualização:** `Confirmamos a exclusão dos seus dados.`

**Corpo:**

> Olá!
>
> Confirmamos que o álbum de **{titulo}** foi apagado em **{data e hora}**.
>
> **O que foi removido:** fotos, recados, lista de convidados e dados do evento.
> **O que guardamos por mais tempo:** apenas o registro de que a exclusão ocorreu e os registros de segurança exigidos, por até **{prazo}**.
> **Cópias de segurança:** eliminadas em até **{30} dias**.
>
> Obrigado por ter confiado em nós para guardar um dia tão especial.
>
> Equipe {marca}

⚖️ **EM-3 — O que permanece.** Alinhar a lista do que fica (auditoria, e-mail do organizador) com os prazos da Política (PP-4 e PP-9).

---

## 5. Pedido do titular (dados pessoais) 🔧

**Quando:** alguém escreve para o encarregado e o pedido é registrado.

**Assunto:** `Recebemos seu pedido sobre seus dados`

**Corpo:**

> Olá!
>
> Recebemos seu pedido sobre dados pessoais e vamos responder em até **{15} dias**.
>
> **Protocolo:** {protocolo}
>
> Se precisar acrescentar alguma informação, responda este e-mail.
>
> Equipe {marca}

⚖️ **EM-4 — Prazo e canal.** O prazo de atendimento e a forma de confirmar a identidade do solicitante dependem da regulamentação da ANPD e da política interna.

---

## Matriz de variáveis

| Variável | Origem | Observação |
|---|---|---|
| `{marca}` | configuração | nome ainda provisório |
| `{titulo}` | evento | escapar |
| `{link}` | servidor | um uso, 15 min |
| `{link_painel}` / `{link_album}` | servidor | HTTPS no domínio público |
| `{n}` / `{m}` | contagem | fotos e pessoas |
| `{data_limite}` | revelação + 12 meses | formato `dd/mm/aaaa` |
| `{suporte}` | configuração | e-mail de suporte |
| `{protocolo}` | servidor | sem dados pessoais |
