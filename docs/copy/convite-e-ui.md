# Textos de interface e convite — Memo Brasil

> **Rascunho v0.1 · 13/10/2026 · Redator.** Base: `public/*.html` da `main` (commit 469792b).
> Tom: acolhedor, caloroso, direto. Português do Brasil, "você", frases curtas, sem gíria pesada, sem jargão técnico.
> Textos de usuário (nome, título, recado) são **sempre inseridos como texto, nunca como HTML**.
> `{variável}` = valor dinâmico. "Hoje" = texto atual do arquivo; "Proposta" = texto novo. Onde não há mudança, está "mantém".
> Nada aqui é copiado do app Memo – Capture momentos.

## Voz do produto

| Faça | Evite |
|---|---|
| "Os noivos", "o casal", "a festa", "momentos" | "usuário", "upload", "conteúdo", "erro 403" |
| Convidar: "Que bom ter você aqui" | Ordens secas: "Insira seu nome" |
| Explicar o porquê: "para os noivos te reconhecerem" | Só rótulos |
| Erros que ajudam: o que houve + o que fazer | "Erro", "Falha", "Inválido" |

**Marca:** o nome "Memo Brasil" é provisório até a definição de nome e domínio (pendência do orquestrador). Usar a variável `{marca}` no código.

---

# A. Jornada do convidado (escura, celular)

## A1. Convite — `/e/:id` (`convite.html`)

| Elemento | Hoje | Proposta |
|---|---|---|
| Título da aba | `Você está convidado!` / `{titulo}` | `{titulo} · Convite` |
| Etiqueta | `CONVITE` | `VOCÊ ESTÁ CONVIDADO` |
| Título | `Você está convidado!` | `Que bom ter você aqui!` |
| Nome do evento | `{titulo}` | mantém |
| Texto de apoio | `Capture as melhores memórias. Seus cliques viram parte do álbum dos noivos.` | `Neste casamento, quem faz as fotos é você. Cada clique seu vira uma lembrança do álbum dos noivos.` |
| Regra (antes) | `Você tem {n} fotos. Elas ficam escondidas e são reveladas para todos ao mesmo tempo, no fim da festa.` | `Você tem **{n} fotos** para registrar a festa. Elas ficam escondidas e são reveladas para todos juntos, às **{data e hora}**.` |
| Aviso de consentimento | — | ver `consentimento-convidado.md` §1 (obrigatório) |
| Rótulo do nome | `Seu nome (aparece nas suas fotos)` | `Seu nome (os noivos vão ver ao lado das suas fotos)` |
| Placeholder | `Como os noivos te chamam?` | `Como os noivos te chamam?` (mantém) |
| Botão | `Entrar no álbum` | `Entrar no álbum` (mantém) |
| Erro: nome vazio | (mensagem do servidor) | `Diga seu nome para a gente te apresentar aos noivos.` |
| Erro: fora da lista (`apenasLista`) | (mensagem do servidor) | `Não achamos esse nome na lista dos noivos. Confira a grafia ou fale com eles.` |
| Convite não encontrado | `Convite não encontrado · {erro} Confira o QR Code com os noivos.` | **`Não encontramos este convite`** · `O QR Code pode estar incompleto ou o endereço digitado errado. Peça aos noivos para conferir.` |
| Evento revelado | `O evento terminou e as fotos já foram reveladas.` | `A festa acabou e as fotos já foram reveladas. Venha ver o que a galera registrou.` |
| Botão (revelado) | `Ver álbum` | `Ver o álbum` |
| Evento suspenso | — | **`Este álbum está em pausa`** · `Por enquanto não é possível entrar. Fale com os noivos.` |
| Em manutenção | — | **`Voltamos já`** · `Estamos cuidando de alguns detalhes. Tente de novo em alguns minutos.` |

## A2. Início — `/e/:id/inicio` (`inicio.html`)

| Elemento | Hoje | Proposta |
|---|---|---|
| Saudação | `OLÁ, {NOME}` | `OLÁ, {NOME}` (mantém) |
| Subtítulo | `{data} · {local}` | mantém |
| Placar 1 | `Para revelar` / `Revelado` | `Falta para a revelação` / `Álbum aberto` |
| Placar 2 | `Suas fotos restantes` | `Fotos que ainda restam` |
| Placar 3 | `Momentos do evento` | `Momentos já guardados` |
| Cartão da câmera | `Abrir câmera` | `Abrir a câmera` |
| Apoio (câmera) | `{n} de {total} fotos disponíveis` / `O evento terminou` | `Você ainda tem {n} de {total} fotos` / `A festa acabou` / `Suas fotos acabaram. Foi um prazer!` |
| Cartão do álbum | `Álbum do evento` | `Álbum da festa` |
| Apoio (álbum) | `Fotos escondidas até a revelação` / `As fotos foram reveladas — veja o que a galera viu` | `As fotos estão guardadas até a revelação` / `As fotos foram reveladas. Veja a festa pelos olhos de todos` |
| Cartão da programação | `Programação e local` / `Horários, endereço e como chegar` | `Programação e local` / `Horários, endereço e como chegar` (mantém) |
| Cartão da presença | `Confirmar presença` / `Avise os noivos se você vai` | `Confirmar presença` / `Conte para os noivos se você vai` |
| Presença (feita) | `Você confirmou presença ✓` / `Você respondeu que não vai` | `Presença confirmada ✓` / `Você respondeu que não vai` |
| Cartão dos recados | `Deixar um recado` / `Uma mensagem para os noivos` | `Deixar um recado` / `Uma mensagem de carinho para os noivos` |
| Cartão de instalação | `Instale o app deste casamento` | `Deixe o álbum na tela inicial` |
| Texto (Android) | `Fique com o álbum na tela inicial e receba um aviso quando as fotos forem reveladas.` | `Assim você abre o álbum com um toque e a gente avisa quando as fotos forem reveladas.` |
| Texto (iPhone) | `No iPhone: toque em Compartilhar (□↑) e depois em "Adicionar à Tela de Início". Depois abra pelo ícone para ativar os avisos.` | `No iPhone: toque em Compartilhar (□↑) e escolha **Adicionar à Tela de Início**. Depois, abra o álbum pelo ícone para ativar os avisos.` |
| Texto (outro navegador) | `No menu do navegador, escolha "Instalar app" ou "Adicionar à tela inicial" para receber os avisos do casamento.` | `No menu do navegador, escolha **Instalar app** ou **Adicionar à tela inicial** para receber os avisos do casamento.` |
| Botão | `Instalar app` | `Instalar` |
| Botão de avisos | `🔔 Ativar avisos` | `🔔 Ativar avisos` |
| Texto (ativar avisos) | `Receba um aviso quando as fotos forem reveladas e novidades dos noivos.` | `Quer saber quando o álbum abrir? A gente manda um aviso.` |
| Trocar de nome | `Não sou essa pessoa — trocar de nome` | `Não é você? Trocar de nome` |
| Aviso dos noivos | `{avTit}` / `{avCorpo}` | mantém (rótulo acima: `Recado dos noivos`) |
| Acesso ao consentimento | — | rodapé: `Sobre suas fotos e seus dados` → abre `consentimento-convidado.md` §3 |

## A3. Câmera — `/e/:id/camera` (`camera.html`)

| Elemento | Hoje | Proposta |
|---|---|---|
| Voltar | `← Início` | `← Início` |
| Contador de tempo | `{tempo} restantes` / `Evento encerrado` | `Revela em {tempo}` / `Festa encerrada` |
| Contador de fotos | `{n} restantes` | `{n} fotos restam` |
| Fallback (sem câmera ao vivo) | `Toque para fotografar` / `Seu navegador abre a câmera do celular direto no botão abaixo.` | `Toque para fotografar` / `A câmera do seu celular vai abrir. Tire a foto e ela entra no álbum.` |
| Sucesso | `Momento guardado ✓` | `Momento guardado ✓` (mantém) |
| Evento terminou | `O evento terminou.` | `A festa terminou. Obrigado por registrar!` |
| Fotos acabaram | `Suas fotos acabaram.` | `Suas fotos acabaram. Valeu por registrar a festa!` |
| Permissão da câmera negada | — | **`Não conseguimos abrir a câmera`** · `Libere a câmera nas configurações do navegador ou toque no botão para usar a câmera do celular.` |
| Foto grande demais | (mensagem do servidor) | `Essa foto ficou grande demais. Tente de novo.` |
| Arquivo inválido | (mensagem do servidor) | `Esse arquivo não parece uma foto. Tire outra, por favor.` |
| Falha de rede | (mensagem do servidor) | `Sem conexão agora. Sua foto não foi enviada; tente de novo.` |
| Limite de envios | — | `Calma! Muitas fotos de uma vez. Espere um instante.` |
| Rótulos acessíveis | `Voltar ao início`, `Virar câmera`, `Tirar foto`, `Álbum` | `Voltar ao início`, `Virar a câmera`, `Tirar foto`, `Ver álbum` |

## A4. Álbum — `/e/:id/album` (`album.html`)

| Elemento | Hoje | Proposta |
|---|---|---|
| Placar | `Momentos` / `Restantes` / `Pessoas` | `Momentos` / `Falta` / `Fotógrafos` → depois da revelação: `Momentos` / `Álbum aberto` / `Fotógrafos` |
| Botões | `✨ Ver retrospectiva` · `📷 Abrir câmera` · `Convidar` | `✨ Ver a retrospectiva` · `📷 Abrir a câmera` · `Convidar` |
| Foto bloqueada | `🔒` + `Revela em {tempo}` | `🔒` + `Revela em {tempo}` |
| Vazio | `Ainda não há momentos. Abra a câmera e faça o primeiro.` | `Ainda não há momentos por aqui. Abra a câmera e faça o primeiro!` |
| Álbum não encontrado | `Álbum não encontrado` | `Não encontramos este álbum` |
| Texto da foto | `Foto de {autor}` | `Foto de {autor}` (mantém) |
| Fechar | `Fechar` | `Fechar` |
| Denunciar (🔧) | — | `Algo errado com esta foto?` → `Avisar os noivos` |
| Confirmação de denúncia (🔧) | — | `Obrigado. Os noivos vão olhar com cuidado.` |
| Revelação (primeira abertura) | — | `O álbum abriu! 🎉 {n} momentos de {m} pessoas. Boa viagem pelas lembranças.` |

## A5. Programação e local — `/e/:id/programacao`

| Elemento | Hoje | Proposta |
|---|---|---|
| Título | `Programação` | `Programação do dia` |
| Vazio | `Os noivos ainda não publicaram a programação.` | `Os noivos ainda estão ajeitando a programação. Volte logo!` |
| Seção local | `Local` | `Onde vai ser` |
| Botão | `Abrir no mapa` | `Ver no mapa` |

## A6. Presença — `/e/:id/presenca`

| Elemento | Hoje | Proposta |
|---|---|---|
| Título | `Você vai?` | `Você vai?` |
| Texto | `Avise os noivos para eles se organizarem. Dá para mudar a resposta depois.` | `Conte para os noivos para eles se organizarem. Você pode mudar a resposta depois.` |
| Opções | `Vou, sim 🎉` · `Não consigo ir` | `Vou, sim 🎉` · `Não vou conseguir` |
| Acompanhantes | `Quantos acompanhantes além de você?` | `Vai levar alguém? Quantas pessoas, além de você?` |
| Botão | `Enviar resposta` | `Enviar resposta` |
| Sucesso (🔧) | — | `Pronto! Os noivos já sabem.` |
| Aviso de privacidade | — | `Sua resposta é só para os noivos.` (ver `consentimento-convidado.md` §5.2) |

## A7. Recados — `/e/:id/recados`

| Elemento | Hoje | Proposta |
|---|---|---|
| Título | `Recados para os noivos` | `Recados para os noivos` |
| Rótulo | `Seu recado` | `Seu recado` |
| Placeholder | `Deixe uma mensagem carinhosa…` | `Escreva algo que os noivos vão guardar para sempre…` |
| Botão | `Enviar recado` | `Enviar recado` |
| Vazio | `Seja o primeiro a deixar um recado.` | `Seja o primeiro a deixar um recado.` (mantém) |
| Contador | — | `{n} de 400 caracteres` |
| Aviso de privacidade | — | ver `consentimento-convidado.md` §5.2 (CG-3) |
| Recados desligados | (mensagem do servidor) | `Os noivos desligaram os recados por enquanto.` |

## A8. Estados gerais (todas as telas do convidado)

| Situação | Texto |
|---|---|
| Carregando | `Um instante…` |
| Sem conexão | `Sem conexão. Verifique sua internet e tente de novo.` |
| Erro inesperado | `Algo não saiu como esperado. Tente de novo; se continuar, fale com os noivos.` |
| Excesso de tentativas | `Muitas tentativas seguidas. Respire e tente de novo em instantes.` |
| Navegador embutido (Instagram/WhatsApp) | `Para a câmera funcionar melhor, abra este link no navegador do celular (Safari ou Chrome).` |
| Evento apagado/expirado | **`Este álbum não está mais disponível`** · `O prazo de guarda terminou e os arquivos foram apagados, como combinado. Se precisar, fale com os noivos.` |

---

# B. Jornada da organização (clara, computador)

## B1. Criar evento — `/` (`index.html`)

| Elemento | Hoje | Proposta |
|---|---|---|
| Etiqueta | `MEMO BRASIL` | `{marca}` |
| Título | `Cada convidado é seu fotógrafo` | `Cada convidado é seu fotógrafo` (mantém) |
| Texto | `Crie o álbum do casamento, compartilhe o QR Code e receba os melhores momentos sob o olhar de quem estava lá. As fotos ficam guardadas e só são reveladas na hora que você escolher.` | `Crie o álbum do seu casamento, compartilhe o QR Code e receba a festa pelos olhos de quem estava lá. As fotos ficam guardadas e só são reveladas na hora que você escolher.` |
| Rótulos | `Nome do evento` / `Seu e-mail ou WhatsApp (para o suporte falar com você)` / `Data e hora do casamento` / `Local` / `Quando revelar as fotos` / `Fotos por convidado` | `Nome do casamento` / `Seu e-mail (para entrar depois e receber o aviso da revelação)` / `Data e hora do casamento` / `Local` / `Quando revelar as fotos` / `Fotos por convidado` |
| Placeholder | `Casamento Ana & Pedro` · `Ex.: Espaço Villa Jardim` | `Ex.: Casamento de Ana & Pedro` · `Ex.: Espaço Villa Jardim` |
| Ajuda (revelação) | — | `Dica: muita gente escolhe o dia seguinte, de manhã. Dá para mudar depois.` |
| Ajuda (fotos) | — | `20 fotos por convidado costuma ser um bom número.` |
| Botão | `Criar evento` | `Criar o álbum do casamento` |
| Rodapé | `Área da organização (casal e cerimonial). Os convidados entram só pelo QR Code, em outra jornada.` | `Esta é a área da organização (casal e cerimonial). Os convidados entram só pelo QR Code.` |
| Aviso legal (🔧) | — | `Ao criar o álbum, você concorda com os [Termos de Uso] e a [Política de Privacidade] e se compromete a avisar seus convidados de que as fotos serão vistas por todos.` |
| Cadastro fechado | (mensagem do servidor) | `Os novos casamentos estão em pausa por enquanto. Volte em breve ou escreva para {suporte}.` |

## B2. Painel — `/painel/:id` (`painel.html`)

### Menu lateral
| Hoje | Proposta |
|---|---|
| `📊 Resumo` | `Resumo` |
| `👥 Convidados` | `Convidados` |
| `🗓️ Detalhes e programação` | `Detalhes e programação` |
| `🖼️ Fotos e recados` | `Fotos e recados` |
| `🔔 Avisos aos convidados` | `Avisos aos convidados` |
| `🔗 Convite e QR Code` | `Convite e QR Code` |
| `⚙️ Configurações` | `Configurações` |
| `🤝 Equipe` | `Equipe` |

### Resumo
| Elemento | Hoje | Proposta |
|---|---|---|
| Indicadores | `Convidados na lista` · `Pessoas confirmadas` · `Sem resposta` · `Entraram na câmera` · `Fotos enviadas` · `Com avisos ativos` · `Para a revelação` | `Na lista` · `Confirmados` · `Sem resposta` · `Já entraram na câmera` · `Fotos enviadas` · `Com avisos ativos` · `Falta para a revelação` |
| Estado | `Aberto` | `Álbum aberto` |
| Sem detalhes | `Complete os detalhes do casamento na aba "Detalhes e programação".` | `Conte para os convidados quando e onde será. Complete em "Detalhes e programação".` |
| Próximos passos | `Monte a lista de convidados` · `Publique a programação do dia` · `Informe o local do casamento` · `Imprima o QR Code para a entrada` | `Monte a lista de convidados` · `Publique a programação do dia` · `Informe o local do casamento` · `Imprima o QR Code para a entrada e as mesas` |
| Revelação | `Hora da revelação` / `Salvar` / `Horário atualizado.` | `Hora da revelação` / `Salvar` / `Pronto! Novo horário salvo.` |
| Aviso do master | `Você está como admin master neste casamento.` | `Você está neste casamento como administração do {marca}. Seus acessos ficam registrados.` |

### Convidados
| Elemento | Hoje | Proposta |
|---|---|---|
| Título/subtítulo | `Convidados` / `A lista do casamento: quem foi convidado e quem confirmou. Aceita milhares de nomes.` | `Convidados` / `Quem foi convidado e quem já respondeu. Cabem milhares de nomes.` |
| Painel | `Adicionar convidados` | `Adicionar convidados` |
| Dica | `Dica: cole direto de uma planilha (colunas separadas por tab).` | `Dica: dá para colar direto de uma planilha.` |
| Ações | `Adicionar à lista` · `⬇ Exportar lista (CSV)` · `Remover` | `Adicionar à lista` · `Baixar lista (CSV)` · `Remover` |
| Filtros | `Todos` / `Confirmados` / `Sem resposta` / `Recusaram` | `Todos` / `Confirmados` / `Sem resposta` / `Não vão` |
| Respostas | `Sem resposta` / `Confirmado` / `Recusou` | `Sem resposta` / `Confirmou` / `Não vai` |
| Vazio | `Nenhum convidado aqui ainda.` | `Nenhum convidado aqui ainda. Cole uma lista acima para começar.` |
| Confirmação | `Remover {nome} da lista?` | `Remover {nome} da lista? As fotos já enviadas por essa pessoa continuam no álbum.` |
| Aviso de dados (🔧) | — | `Você está inserindo nomes de convidados. Garanta que eles sabem que farão parte do álbum.` |

### Detalhes e programação
| Elemento | Hoje | Proposta |
|---|---|---|
| Subtítulo | `O que os convidados veem na página "Programação e local".` | `Isto é o que os convidados veem em "Programação e local".` |
| Rótulos | `Nome do evento` / `Data e hora da cerimônia` / `Local` / `Endereço` / `Mensagem aos convidados` / `Fotos por convidado` | `Nome do casamento` / `Data e hora da cerimônia` / `Local` / `Endereço` / `Mensagem de boas-vindas` / `Fotos por convidado` |
| Placeholder | `Uma mensagem de boas-vindas aos convidados.` | `Escreva algo caloroso para quem vai chegar.` |
| Seção | `Programação do dia` / `+ Adicionar momento` | `Programação do dia` / `+ Adicionar momento` |
| Botão | `Salvar alterações` / `Salvo.` | `Salvar alterações` / `Salvo!` |

### Fotos e recados
| Elemento | Hoje | Proposta |
|---|---|---|
| Aviso (antes) | `Atenção: ver as fotos agora estraga a surpresa. Use só para moderar conteúdo impróprio. Os convidados continuam sem ver nada até a hora da revelação.` | `Cuidado: ver as fotos agora tira a surpresa. Use só para moderar conteúdo impróprio. Os convidados continuam sem ver nada até a revelação.` |
| Aviso (depois) | `O álbum já foi revelado.` | `O álbum já foi revelado. Todos os convidados podem ver as fotos.` |
| Aviso de privacidade (🔧) | — | `Fotos de crianças e adolescentes pedem cuidado extra. Apague o que os responsáveis não gostariam de ver exposto.` |
| Botões | `Moderar fotos e recados (ver agora)` / `Ver fotos e recados` / `⬇ Baixar álbum completo (ZIP)` | `Moderar fotos e recados (ver agora)` / `Ver fotos e recados` / `Baixar o álbum completo (ZIP)` |
| Apagar | `Apagar esta foto para sempre?` | `Apagar esta foto para sempre? Não dá para desfazer.` |
| Vazio | `Ninguém enviou fotos ainda.` | `Ninguém enviou fotos ainda.` |
| Ocultar (🔧) | — | `Ocultar do álbum` / `Mostrar de novo` |
| Denúncias (🔧) | — | `Fotos denunciadas ({n})` |
| Prazo de guarda (🔧) | — | `Guardamos o álbum por 12 meses depois da revelação. Baixe o ZIP antes de {data} para ficar com tudo.` |

### Avisos
| Elemento | Hoje | Proposta |
|---|---|---|
| Subtítulo | `Mande uma notificação push para quem instalou o app do casamento. O aviso também aparece no início do app. Até 5 por hora.` | `Mande uma notificação para quem instalou o app do casamento. O aviso também aparece na tela inicial dos convidados. Até 5 por hora.` |
| Campos | `Título` / `Mensagem` / `Enviar aviso` | `Título` / `Mensagem` / `Enviar aviso` |
| Placeholders | `Ex.: A festa vai começar!` · `Ex.: Abram a câmera e registrem o primeiro dueto dos noivos.` | `Ex.: A festa vai começar!` · `Ex.: Abram a câmera e registrem a primeira dança dos noivos.` |
| Resultado | `Enviado para {x} de {y} aparelhos.` | `Aviso enviado para {x} de {y} aparelhos.` |
| Limite | (mensagem do servidor) | `Você já enviou 5 avisos nesta hora. Tente de novo em alguns minutos.` |
| Nota | `Para receber avisos, o convidado precisa instalar o app na tela inicial e aceitar as notificações. No iPhone isso só funciona com o app instalado (iOS 16.4 ou mais) e o site em HTTPS.` | `Para receber avisos, o convidado precisa instalar o app na tela inicial e aceitar as notificações. No iPhone, só funciona com o app instalado (iOS 16.4 ou mais).` |
| Sem avisos | `Nenhum aviso enviado ainda.` | `Nenhum aviso enviado ainda.` |

### Configurações
| Elemento | Hoje | Proposta |
|---|---|---|
| Subtítulo | `Regras do seu casamento. O que a plataforma limita fica com o administrador do Memo.` | `As regras do seu casamento. Os limites da plataforma ficam com a nossa administração.` |
| Opção 1 | `Só quem está na lista entra` / `O nome digitado precisa existir na aba Convidados. Evita penetras no álbum.` | `Só quem está na lista entra` / `O nome digitado precisa estar na aba Convidados. Evita penetras no álbum.` |
| Opção 2 | `Permitir recados` / `Convidados podem deixar mensagens para os noivos.` | `Permitir recados` / `Os convidados podem deixar mensagens para vocês.` |
| Opção 3 | `Mostrar o nome de quem tirou cada foto` / `Desligue se preferir um álbum sem identificação.` | `Mostrar o nome de quem tirou cada foto` / `Desligue se preferir um álbum sem identificação. Os convidados verão o aviso atualizado.` |
| Limites | `Limites deste casamento` / `Precisa de mais? Fale com o suporte do Memo.` | `Limites do seu casamento` / `Precisa de mais? Fale com o nosso suporte.` |
| Dados (🔧) | — | **`Seus dados`** · `Baixar tudo do evento` · `Excluir o álbum para sempre` (ver textos abaixo) |

#### Exclusão do evento (🔧)
- **Título:** `Excluir este álbum?`
- **Texto:** `Vamos apagar para sempre as fotos, os recados e a lista de convidados. Não dá para desfazer. Antes, que tal baixar o álbum completo?`
- **Botões:** `Baixar o álbum primeiro` · `Excluir para sempre`
- **Confirmação por digitação:** `Para confirmar, digite o nome do casamento: {titulo}`
- **Sucesso:** `Álbum excluído. Obrigado por usar o {marca}.`

### Convite e QR Code
| Elemento | Hoje | Proposta |
|---|---|---|
| Subtítulo | `Imprima o QR Code em placas na entrada e nas mesas. Quem escanear recebe o convite e entra na jornada de convidado.` | `Imprima o QR Code em placas na entrada e nas mesas. Quem escanear recebe o convite e já pode fotografar.` |
| Botões | `Copiar link` · `Baixar QR Code` · `Ver como convidado` / `Link copiado.` | `Copiar link` · `Baixar o QR Code` · `Ver como convidado` / `Link copiado!` |
| Nota | `Para a câmera ao vivo funcionar no celular dos convidados, o endereço precisa ser HTTPS. Em rede local (HTTP) o app usa a câmera nativa do celular.` | Interno/dev: só em rede local. Em produção (HTTPS): não exibir. |
| Texto para os convidados (🔧) | — | `Escaneie o QR Code, tire fotos durante a festa e veja tudo junto depois. Suas fotos serão vistas por todos os convidados.` |

### Equipe
| Elemento | Hoje | Proposta |
|---|---|---|
| Subtítulo | `Cerimonial e outros membros do casal acessam esta área por link próprio. Cerimonial gerencia lista, programação e fotos, mas não altera a equipe.` | `Quem ajuda a organizar acessa esta área por um link próprio. O cerimonial cuida da lista, da programação e das fotos, mas não altera a equipe.` |
| Painel | `Convidar para a organização` / `Gerar link de acesso` | `Chamar para a organização` / `Gerar link de acesso` |
| Papéis | `Cerimonial` / `Casal` | `Cerimonial` / `Casal` |
| Vazio | `Só você, por enquanto.` | `Só você, por enquanto.` |
| Remover | `Remover o acesso de {nome}?` | `Remover o acesso de {nome}? Essa pessoa não consegue mais entrar no painel.` |
| Aviso de link (🔧) | — | `Este link dá acesso ao painel. Envie só para quem você confia.` |

### Acesso restrito
| Hoje | Proposta |
|---|---|
| `Acesso restrito` · `{erro} Abra o painel pelo link de acesso que o casal recebeu, ou peça um novo link na aba Equipe.` | **`Não conseguimos abrir o painel`** · `Entre pelo link que chegou no seu e-mail ou peça um novo à equipe do casamento.` |

---

# C. Admin master (interno, linguagem direta)

Interface interna. Manter objetiva, em português, sem tom festivo.

| Elemento | Hoje | Proposta |
|---|---|---|
| Aviso global | `Aviso para todos os casamentos` | `Aviso a todos os casamentos` |
| Auditoria | `Auditoria (só inserção)` | `Registro de auditoria (não pode ser editado)` |
| Exclusão | confirmação pelo id | `Esta ação apaga o evento {titulo} em definitivo. Digite o id do evento para confirmar.` |
| Acesso ao conteúdo (🔧) | — | Antes de abrir fotos antes da revelação: `Este acesso será registrado. Informe o motivo (suporte, moderação, segurança, ordem legal).` |

---

# D. Avisos push (texto que aparece na tela do celular)

| Gatilho | Título | Corpo |
|---|---|---|
| Revelação aberta (automático) | `O álbum de {titulo} abriu! 🎉` | `Veja a festa pelos olhos de todo mundo.` |
| 24 horas antes (🔧) | `Amanhã o álbum abre` | `Falta pouco para ver as fotos de {titulo}.` |
| Aviso da organização | `{titulo do aviso}` | `{corpo do aviso}` |
| Teste de inscrição | `Avisos ativados ✓` | `A gente avisa quando as fotos forem reveladas.` |

Limites: título até 60 caracteres, corpo até 200 (iguais aos do painel).

---

# E. Convite para repassar (mensagem do casal ao grupo)

> **Oi, família e amigos! 💛**
> No nosso casamento, **cada um de vocês é o nosso fotógrafo**.
> Escaneiem o QR Code, tirem fotos da festa e, no dia **{data}**, as fotos serão reveladas para todos de uma vez.
> **Lembrando: as fotos serão vistas por todos os convidados.**
> Com carinho, {nomes}.

Variações: *curta* (WhatsApp), *formal* (cerimonial), *impressa* (placa da mesa: "Faça um clique. Guarde um momento. {nomes}").

---

## Pendências

- ⚖️ **UI-1:** textos legais curtos (rodapé, aviso de criação, aviso de convidados) dependem da revisão em `politica-privacidade.md` e `termos-de-uso.md`.
- **UI-2:** substituir `{marca}`, `{suporte}` e os links assim que nome e domínio estiverem definidos.
- **UI-3:** itens 🔧 só entram na interface depois que o recurso existir; não publicar texto de funcionalidade ausente.
- **UI-4:** as telas nunca foram validadas em navegador (README); revisar o encaixe de textos mais longos em 390 px.
