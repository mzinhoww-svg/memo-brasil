# Textos prontos para colar — `public/*.html`

> **v0.1 · 13/10/2026 · Redator.** Base: `public/*.html` da `main` (commit 469792b).
> Formato: **arquivo → elemento → texto atual → texto novo**. A coluna "Novo" é **texto puro**, pronto para `textContent`/atributo; **sem Markdown**. `{x}` é valor dinâmico já calculado pelo código.
> `=` na coluna "Novo" = manter o atual. 🔧 = só entra quando a funcionalidade existir. ⚖️ = depende de revisão jurídica (ver `docs/copy/README.md` do PR #2).
> Tom acolhedor, pt-BR, "você". Nada copiado do app Memo. Textos legais e de consentimento completos ficam em `politica-privacidade.md`, `termos-de-uso.md` e `consentimento-convidado.md` (PR #2); aqui só as frases curtas das telas.
> Texto de usuário (nome, título, recado) continua sempre como texto, nunca HTML.

Variável de marca: onde aparecer `MEMO BRASIL`, usar a constante de marca do projeto; o nome é provisório.

---

## `index.html` (criar o evento)

| Elemento | Atual | Novo |
|---|---|---|
| `<title>` | Memo Brasil — cada convidado é seu fotógrafo | Memo Brasil · Cada convidado é seu fotógrafo |
| Etiqueta (p) | MEMO BRASIL | MEMO BRASIL |
| h1 | Cada convidado é seu fotógrafo | = |
| Parágrafo | Crie o álbum do casamento, compartilhe o QR Code e receba os melhores momentos sob o olhar de quem estava lá. As fotos ficam guardadas e só são reveladas na hora que você escolher. | Crie o álbum do seu casamento, compartilhe o QR Code e receba a festa pelos olhos de quem estava lá. As fotos ficam guardadas e só são reveladas na hora que você escolher. |
| label `titulo` | Nome do evento | Nome do casamento |
| placeholder `titulo` | Casamento Ana & Pedro | Ex.: Casamento de Ana & Pedro |
| label `contato` | Seu e-mail ou WhatsApp (para o suporte falar com você) | Seu e-mail (para entrar depois e receber o aviso da revelação) |
| label `dataEvento` | Data e hora do casamento | = |
| label `local` | Local | = |
| placeholder `local` | Ex.: Espaço Villa Jardim | = |
| label `revealAt` | Quando revelar as fotos | = |
| ajuda abaixo de `revealAt` (novo p) | — | Dica: muita gente escolhe o dia seguinte, de manhã. Dá para mudar depois. |
| label `fpg` | Fotos por convidado | = |
| ajuda abaixo de `fpg` (novo p) | — | 20 fotos por convidado costuma ser um bom número. |
| Aviso legal acima do botão (novo p) ⚖️🔧 | — | Ao criar o álbum, você concorda com os Termos de Uso e a Política de Privacidade e se compromete a avisar seus convidados de que as fotos serão vistas por todos. |
| Botão `go` | Criar evento | Criar o álbum do casamento |
| Rodapé | Área da organização (casal e cerimonial). Os convidados entram só pelo QR Code, em outra jornada. | Esta é a área da organização (casal e cerimonial). Os convidados entram só pelo QR Code. |
| Erro: cadastro fechado | (mensagem do servidor) | Os novos casamentos estão em pausa por enquanto. Volte em breve ou escreva para o nosso suporte. |
| Erro: título vazio | (mensagem do servidor) | Dê um nome ao casamento para continuar. |

---

## `convite.html` (convidado entra pelo QR Code)

| Elemento | Atual | Novo |
|---|---|---|
| `<title>` inicial | Você está convidado! | Você está convidado! |
| `document.title` | {titulo} | {titulo} · Convite |
| Etiqueta (p) | CONVITE | VOCÊ ESTÁ CONVIDADO |
| h1 | Você está convidado! | Que bom ter você aqui! |
| `#titulo` (carregando) | … | … |
| Parágrafo do envelope | Capture as melhores memórias. Seus cliques viram parte do álbum dos noivos. | Neste casamento, quem faz as fotos é você. Cada clique seu vira uma lembrança do álbum dos noivos. |
| `#regra` (antes) | Você tem {n} fotos. Elas ficam escondidas e são reveladas para todos ao mesmo tempo, no fim da festa. | Você tem {n} fotos para registrar a festa. Elas ficam escondidas e são reveladas para todos juntos, em {data e hora}. |
| `#regra` (revelado) | O evento terminou e as fotos já foram reveladas. | A festa acabou e as fotos já foram reveladas. Venha ver o que a galera registrou. |
| label `nome` | Seu nome (aparece nas suas fotos) | Seu nome (os noivos vão ver ao lado das suas fotos) |
| placeholder `nome` | Como os noivos te chamam? | = |
| Aviso de consentimento (novo bloco) ⚖️🔧 | — | Suas fotos serão vistas por todos os convidados quando o álbum for revelado, com o seu nome. Os noivos e a equipe do Memo Brasil também podem ver as fotos para organizar e moderar. |
| Link do aviso (novo) 🔧 | — | Saiba mais |
| Caixa de aceite (novo) ⚖️🔧 | — | Li e concordo com o uso das minhas fotos como descrito. |
| Erro: aceite não marcado 🔧 | — | Para entrar, precisamos do seu "de acordo". É rapidinho. |
| Botão submit | Entrar no álbum | Entrar no álbum |
| Botão `ver` | Ver álbum | Ver o álbum |
| Erro: nome vazio | (mensagem do servidor) | Diga seu nome para a gente te apresentar aos noivos. |
| Erro: fora da lista | (mensagem do servidor) | Não achamos esse nome na lista dos noivos. Confira a grafia ou fale com eles. |
| Erro: convite inexistente — h1 | Convite não encontrado | Não encontramos este convite |
| Erro: convite inexistente — p | {erro} Confira o QR Code com os noivos. | O QR Code pode estar incompleto ou o endereço digitado errado. Peça aos noivos para conferir. |
| Evento suspenso — h1 (novo) | — | Este álbum está em pausa |
| Evento suspenso — p (novo) | — | Por enquanto não é possível entrar. Fale com os noivos. |
| Evento apagado — h1 (novo) 🔧 | — | Este álbum não está mais disponível |
| Evento apagado — p (novo) 🔧 | — | O prazo de guarda terminou e os arquivos foram apagados, como combinado. Se precisar, fale com os noivos. |

---

## `inicio.html` (hub do convidado)

| Elemento | Atual | Novo |
|---|---|---|
| `<title>` inicial | Início | Início |
| `#saud` | OLÁ, {NOME} | = |
| `#quando` | {data} · {local} | = |
| Placar 1 — rótulo `#restamLbl` (antes) | Para revelar | Falta para a revelação |
| Placar 1 — rótulo (depois) | Álbum aberto | = |
| Placar 1 — valor (depois) | Revelado | Aberto |
| Placar 2 | Suas fotos restantes | Fotos que ainda restam |
| Placar 3 | Momentos do evento | Momentos já guardados |
| Aviso dos noivos (título acima do `#avTit`, novo) | — | Recado dos noivos |
| Cartão câmera — título | Abrir câmera | Abrir a câmera |
| `#sCamera` (com fotos) | {n} de {total} fotos disponíveis | Você ainda tem {n} de {total} fotos |
| `#sCamera` (sem fotos) | — | Suas fotos acabaram. Foi um prazer! |
| `#sCamera` (revelado) | O evento terminou | A festa acabou |
| Cartão álbum — título | Álbum do evento | Álbum da festa |
| `#sAlbum` (antes) | Fotos escondidas até a revelação | As fotos estão guardadas até a revelação |
| `#sAlbum` (depois) | As fotos foram reveladas — veja o que a galera viu | As fotos foram reveladas. Veja a festa pelos olhos de todos |
| Cartão programação | Programação e local / Horários, endereço e como chegar | = |
| Cartão presença — título | Confirmar presença | = |
| `#sPres` (pendente) | Avise os noivos se você vai | Conte para os noivos se você vai |
| `#sPres` (confirmado) | Você confirmou presença ✓ | Presença confirmada ✓ |
| `#sPres` (recusado) | Você respondeu que não vai | = |
| Cartão recados | Deixar um recado / Uma mensagem para os noivos | Deixar um recado / Uma mensagem de carinho para os noivos |
| PWA — título | Instale o app deste casamento | Deixe o álbum na tela inicial |
| PWA — texto (Android, com prompt) | Fique com o álbum na tela inicial e receba um aviso quando as fotos forem reveladas. | Assim você abre o álbum com um toque e a gente avisa quando as fotos forem reveladas. |
| PWA — texto (iPhone) | No iPhone: toque em Compartilhar (□↑) e depois em "Adicionar à Tela de Início". Depois abra pelo ícone para ativar os avisos. | No iPhone: toque em Compartilhar (□↑) e escolha "Adicionar à Tela de Início". Depois, abra o álbum pelo ícone para ativar os avisos. |
| PWA — texto (outros) | No menu do navegador, escolha "Instalar app" ou "Adicionar à tela inicial" para receber os avisos do casamento. | = |
| Botão `pwaInstalar` | Instalar app | Instalar |
| PWA — texto (ativar avisos) | Receba um aviso quando as fotos forem reveladas e novidades dos noivos. | Quer saber quando o álbum abrir? A gente manda um aviso. |
| Botão `pwaNotif` | 🔔 Ativar avisos | = |
| Link `#sair` | Não sou essa pessoa — trocar de nome | Não é você? Trocar de nome |
| Rodapé (novo link) ⚖️🔧 | — | Sobre suas fotos e seus dados |

---

## `camera.html`

| Elemento | Atual | Novo |
|---|---|---|
| `<title>` | Câmera | Câmera |
| `#voltar` (texto) | ← Início | = |
| `#voltar` aria-label | Voltar ao início | = |
| `#resta` (antes) | {tempo} restantes | Revela em {tempo} |
| `#resta` (depois) | Evento encerrado | Festa encerrada |
| `#fotos` | {n} restantes | {n} fotos restam |
| `#semcam` h2 | Toque para fotografar | = |
| `#semcam` p | Seu navegador abre a câmera do celular direto no botão abaixo. | A câmera do seu celular vai abrir. Tire a foto e ela entra no álbum. |
| `#virar` aria-label | Virar câmera | Virar a câmera |
| `#clicar` aria-label | Tirar foto | = |
| `#album` aria-label | Álbum | Ver álbum |
| Toast: sucesso | Momento guardado ✓ | = |
| Toast: evento terminou | O evento terminou. | A festa terminou. Obrigado por registrar! |
| Toast: fotos acabaram | Suas fotos acabaram. | Suas fotos acabaram. Valeu por registrar a festa! |
| Toast: poucas restam (novo, ≤3) | — | Só restam {n} fotos. Escolha bem! |
| Toast: última (novo) | — | Essa foi a última. Curta a festa! 💛 |
| Câmera negada — título (novo, em `#semcam`) | — | Não conseguimos abrir a câmera |
| Câmera negada — texto (novo) | — | Sem problema! Toque no botão para usar a câmera do seu celular; a foto entra no álbum do mesmo jeito. |
| Câmera negada — botão (novo) | — | Usar a câmera do celular |
| Câmera ocupada (novo) | — | A câmera está ocupada. Feche o outro aplicativo que usa a câmera e tente de novo. |
| Enviando (novo) | — | Guardando seu momento… |
| Erro: arquivo grande | (mensagem do servidor) | Essa foto ficou grande demais. Tente de novo. |
| Erro: arquivo inválido | (mensagem do servidor) | Esse arquivo não parece uma foto. Tire outra, por favor. |
| Erro: sem conexão (novo) | — | Sem conexão agora. Sua foto não foi enviada; tente de novo. |
| Erro: muitos envios | (mensagem do servidor) | Calma! Muitas fotos de uma vez. Espere um instante. |
| Erro: limite do evento | (mensagem do servidor) | O álbum atingiu o limite de fotos. Fale com os noivos. |
| Navegador embutido — título (novo) 🔧 | — | Abra no navegador do celular |
| Navegador embutido — iPhone 🔧 | — | Para a câmera funcionar bem, abra este álbum no Safari. Toque em ⋯ (ou no ícone de compartilhar) e escolha "Abrir no Safari". |
| Navegador embutido — Android 🔧 | — | Para a câmera funcionar bem, abra este álbum no Chrome. Toque em ⋮ e escolha "Abrir no Chrome" (ou "Abrir no navegador"). |
| Navegador embutido — botões 🔧 | — | Copiar link / Continuar mesmo assim |
| Navegador embutido — copiado 🔧 | — | Link copiado! Cole no Safari ou no Chrome. |

---

## `album.html`

| Elemento | Atual | Novo |
|---|---|---|
| `<title>` inicial | Álbum | Álbum |
| Placar 1 | Momentos | = |
| Placar 2 — rótulo (antes) | Restantes | Falta |
| Placar 2 — rótulo (depois) | Álbum aberto | = |
| Placar 2 — valor (depois) | Revelado | Aberto |
| Placar 3 | Pessoas | Fotógrafos |
| Botão `retro` | ✨ Ver retrospectiva | ✨ Ver a retrospectiva |
| Botão `camera` | 📷 Abrir câmera | 📷 Abrir a câmera |
| Botão `convidar` | Convidar | = |
| Foto bloqueada | 🔒 + Revela em {tempo} | = |
| Revelação em instantes (novo, menos de 1 min) | — | Revelando em instantes… |
| Alt da foto | Foto de {autor} | = |
| `#vazio` (antes) | Ainda não há momentos. Abra a câmera e faça o primeiro. | Ainda não há momentos por aqui. Abra a câmera e faça o primeiro! |
| `#vazio` (depois, novo) | — | Ninguém enviou fotos desta vez. Se foi algum problema, fale com os noivos. |
| Botão `fechar` | Fechar | = |
| Erro: h1 | Álbum não encontrado | Não encontramos este álbum |
| Compartilhar (novo botão) 🔧 | — | Compartilhar o álbum |
| Compartilhar — texto 🔧 | — | Envie o link para quem estava lá. Quem receber vê as fotos de todos os convidados. |
| Compartilhar — mensagem pronta 🔧 | — | O álbum de {titulo} abriu! 💛 As fotos da festa estão aqui: {link} |
| Denunciar (novo link na foto aberta) 🔧 | — | Algo errado com esta foto? |
| Denunciar — confirmação 🔧 | — | Obrigado. Os noivos vão olhar com cuidado. |
| Retrospectiva — abertura (novo) 🔧 | — | {titulo}. {n} momentos, {m} pessoas. Um dia para guardar. |
| Retrospectiva — controles (novo) 🔧 | — | Pausar · Continuar · Próxima · Anterior · Fechar |
| Retrospectiva — fim (novo) 🔧 | — | Fim da retrospectiva. Obrigado por fazer parte desse dia. |
| Retrospectiva — música 🔧 | — | Música desligada · Música ligada |

---

## `programacao.html`

| Elemento | Atual | Novo |
|---|---|---|
| `<title>` / h1 | Programação | Programação do dia |
| `#vazio` | Os noivos ainda não publicaram a programação. | Os noivos ainda estão ajeitando a programação. Volte logo! |
| Seção `#local` h2 | Local | Onde vai ser |
| Botão `#mapa` | Abrir no mapa | Ver no mapa |

---

## `presenca.html`

| Elemento | Atual | Novo |
|---|---|---|
| `<title>` | Confirmar presença | = |
| h1 | Você vai? | = |
| Parágrafo | Avise os noivos para eles se organizarem. Dá para mudar a resposta depois. | Conte para os noivos para eles se organizarem. Você pode mudar a resposta depois. |
| Botão confirmado | Vou, sim 🎉 | = |
| Botão recusado | Não consigo ir | Não vou conseguir |
| Label `n` | Quantos acompanhantes além de você? | Vai levar alguém? Quantas pessoas, além de você? |
| Botão `salvar` | Enviar resposta | = |
| Aviso (novo p) | — | Sua resposta é só para os noivos. |
| Sucesso (novo, antes de voltar ao início) | — | Pronto! Os noivos já sabem. |
| Erro: resposta vazia (novo) | — | Escolha uma das opções para continuar. |

---

## `recados.html`

| Elemento | Atual | Novo |
|---|---|---|
| `<title>` / h1 | Recados / Recados para os noivos | Recados / Recados para os noivos |
| Label `t` | Seu recado | = |
| Placeholder `t` | Deixe uma mensagem carinhosa… | Escreva algo que os noivos vão guardar para sempre… |
| Contador (novo) | — | {n} de 400 caracteres |
| Aviso de visibilidade (novo p) ⚖️ | — | Os recados aparecem para todos os convidados, com o seu nome. Escreva pensando que todo mundo vai ler. |
| Botão `enviar` | Enviar recado | = |
| Lista vazia | Seja o primeiro a deixar um recado. | = |
| Autor (`small`) | — {autor} | = |
| Erro: recados desligados | (mensagem do servidor) | Os noivos desligaram os recados por enquanto. |
| Erro: recado vazio | (mensagem do servidor) | Escreva uma mensagem antes de enviar. |

*O aviso de visibilidade segue o comportamento atual (recados públicos entre convidados). Se o produto decidir tornar privados, trocar por: "Seu recado é só para os noivos."*

---

## `painel.html` (organização)

### Estrutura e acesso

| Elemento | Atual | Novo |
|---|---|---|
| `<title>` | Organização — Memo Brasil | Organização · Memo Brasil |
| `#who` (padrão) | Organização | = |
| `#who` (preenchido) | {nome} · Casal/Cerimonial | = |
| Menu: Resumo | 📊 Resumo | Resumo |
| Menu: Convidados | 👥 Convidados | Convidados |
| Menu: Programação | 🗓️ Detalhes e programação | Detalhes e programação |
| Menu: Fotos | 🖼️ Fotos e recados | Fotos e recados |
| Menu: Avisos | 🔔 Avisos aos convidados | Avisos aos convidados |
| Menu: Convite | 🔗 Convite e QR Code | Convite e QR Code |
| Menu: Config | ⚙️ Configurações | Configurações |
| Menu: Equipe | 🤝 Equipe | Equipe |
| Acesso negado — h1 | Acesso restrito | Não conseguimos abrir o painel |
| Acesso negado — p | {erro} Abra o painel pelo link de acesso que o casal recebeu, ou peça um novo link na aba Equipe. | Entre pelo link que chegou no seu e-mail ou peça um novo à equipe do casamento. |
| Acesso negado — link | Voltar ao início | = |

### Resumo

| Elemento | Atual | Novo |
|---|---|---|
| Sem detalhes | Complete os detalhes do casamento na aba "Detalhes e programação". | Conte para os convidados quando e onde será. Complete em "Detalhes e programação". |
| Indicador 1 | Convidados na lista | Na lista |
| Indicador 2 | Pessoas confirmadas | Confirmados |
| Indicador 3 | Sem resposta | = |
| Indicador 4 | Entraram na câmera | Já entraram na câmera |
| Indicador 5 | Fotos enviadas | = |
| Indicador 6 | Com avisos ativos | = |
| Indicador 7 | Para a revelação (valor "Aberto") | Falta para a revelação (valor "Álbum aberto") |
| Painel próximos passos — h2 | Próximos passos | = |
| Passo: lista | Monte a lista de convidados | = |
| Passo: programação | Publique a programação do dia | = |
| Passo: local | Informe o local do casamento | = |
| Passo: QR | Imprima o QR Code para a entrada | Imprima o QR Code para a entrada e as mesas |
| Painel revelação — h2 | Hora da revelação | = |
| Botão | Salvar | = |
| Sucesso | Horário atualizado. | Pronto! Novo horário salvo. |
| Erro: hora passada (novo) | — | Escolha uma hora que ainda não passou. |
| Ajuda (novo) 🔧 | — | Os convidados são avisados da mudança. |
| Botão revelar agora (novo) 🔧 | — | Revelar agora |
| Confirmação revelar agora 🔧 ⚖️ | — | Revelar o álbum agora? Todos os convidados passam a ver todas as fotos neste instante, com o nome de quem tirou. A câmera fecha e não dá para voltar atrás. |
| Botões da confirmação 🔧 | — | Cancelar · Sim, revelar agora |
| Adiar (novo) 🔧 | — | Adiar a revelação · +1 hora · +1 dia · Escolher outra hora |
| Adiar — confirmação 🔧 | — | Os convidados ganham mais tempo para fotografar. A revelação passa para {dia}, às {hora}. |
| Encerrar câmera (novo) 🔧 | — | Encerrar a câmera. Ninguém mais envia fotos, mas o álbum continua escondido até a hora da revelação. |
| Reabrir câmera (novo) 🔧 | — | Reabrir a câmera |
| Aviso do master | Você está como admin master neste casamento.{ Contato: ...} | Você está neste casamento como administração do Memo Brasil. Seus acessos ficam registrados.{ Contato: ...} |

### Convidados

| Elemento | Atual | Novo |
|---|---|---|
| h1 | Convidados | = |
| Subtítulo | A lista do casamento: quem foi convidado e quem confirmou. Aceita milhares de nomes. | Quem foi convidado e quem já respondeu. Cabem milhares de nomes. |
| h2 | Adicionar convidados | = |
| Placeholder textarea | Um por linha. Opcional: Nome; Grupo; Acompanhantes / Maria Silva; Família da noiva; 1 / João Souza; Amigos do noivo | Um por linha. Opcional: Nome; Grupo; Acompanhantes / Maria Silva; Família da noiva; 1 / João Souza; Amigos do noivo |
| Botão | Adicionar à lista | = |
| Dica | Dica: cole direto de uma planilha (colunas separadas por tab). | Dica: dá para colar direto de uma planilha. |
| Resultado | {n} adicionados{, m já estavam na lista}. Total: {t}. | {n} adicionados{, m já estavam na lista}. Total: {t}. |
| Aviso de dados (novo) ⚖️🔧 | — | Você está inserindo nomes de convidados. Garanta que eles sabem que farão parte do álbum. |
| Botão CSV | ⬇ Exportar lista (CSV) | Baixar lista (CSV) |
| Filtro: todos | Todos ({n}) | = |
| Filtro: confirmados | Confirmados ({n}) | = |
| Filtro: pendentes | Sem resposta ({n}) | = |
| Filtro: recusaram | Recusaram ({n}) | Não vão ({n}) |
| Busca | Buscar por nome ou grupo | = |
| Cabeçalhos | Nome · Grupo · + · Resposta · Câmera | Nome · Grupo · Acompanhantes · Resposta · Câmera |
| Opção: pendente | Sem resposta | = |
| Opção: confirmado | Confirmado | Confirmou |
| Opção: recusado | Recusou | Não vai |
| Botão linha | Remover | = |
| Confirmação de remoção | Remover {nome} da lista? | Remover {nome} da lista? As fotos já enviadas por essa pessoa continuam no álbum. |
| Vazio | Nenhum convidado aqui ainda. | Nenhum convidado aqui ainda. Cole uma lista acima para começar. |
| Limite de linhas | Mostrando 300 de {n}. Use a busca para filtrar. | = |
| Remover — opção 🔧 | — | Apagar também as fotos desta pessoa. Atenção: {n} fotos serão apagadas para sempre. |
| Remover — sucesso 🔧 | — | {nome} foi removido da lista. |

### Detalhes e programação

| Elemento | Atual | Novo |
|---|---|---|
| h1 | Detalhes e programação | = |
| Subtítulo | O que os convidados veem na página "Programação e local". | Isto é o que os convidados veem em "Programação e local". |
| h2 | O casamento | = |
| Labels | Nome do evento · Data e hora da cerimônia · Local · Endereço · Mensagem aos convidados · Fotos por convidado | Nome do casamento · Data e hora da cerimônia · Local · Endereço · Mensagem de boas-vindas · Fotos por convidado |
| Placeholder mensagem | Uma mensagem de boas-vindas aos convidados. | Escreva algo caloroso para quem vai chegar. |
| Placeholder endereço | Rua, número, cidade | = |
| h2 programação | Programação do dia | = |
| Placeholders da linha | Ex.: Cerimônia · Detalhe (opcional) | = |
| Botão adicionar | + Adicionar momento | = |
| Botão salvar | Salvar alterações | = |
| Sucesso | Salvo. | Salvo! |

### Fotos e recados

| Elemento | Atual | Novo |
|---|---|---|
| h1 | Fotos e recados | = |
| Aviso (antes) | Atenção: ver as fotos agora estraga a surpresa. Use só para moderar conteúdo impróprio. Os convidados continuam sem ver nada até a hora da revelação. | Cuidado: ver as fotos agora tira a surpresa. Use só para moderar conteúdo impróprio. Os convidados continuam sem ver nada até a revelação. |
| Aviso (depois) | O álbum já foi revelado. | O álbum já foi revelado. Todos os convidados podem ver as fotos. |
| Aviso menores (novo) ⚖️🔧 | — | Fotos de crianças e adolescentes pedem cuidado extra. Apague o que os responsáveis não gostariam de ver exposto. |
| h2 resumo | Resumo por pessoa | = |
| `{n} foto(s)` | {n} foto / fotos | = |
| Vazio (resumo) | Ninguém entrou na câmera ainda. | = |
| Botão moderar (antes) | Moderar fotos e recados (ver agora) | = |
| Botão ver (depois) | Ver fotos e recados | = |
| Botão ZIP | ⬇ Baixar álbum completo (ZIP) | Baixar o álbum completo (ZIP) |
| Título fotos | Fotos ({n}) | = |
| Vazio fotos | Ninguém enviou fotos ainda. | = |
| Título recados | Recados ({n}) | = |
| Botão apagar | Apagar | = |
| Confirmação apagar foto | Apagar esta foto para sempre? | Apagar esta foto para sempre? Não dá para desfazer. |
| Apagar — sucesso (novo) | — | Foto apagada. |
| Apagar — erro (novo) | — | Não foi possível apagar agora. Tente de novo. |
| Ocultar (novo) 🔧 | — | Ocultar do álbum · Mostrar de novo |
| Apagar em lote 🔧 | — | Apagar {n} fotos selecionadas? Não dá para desfazer. |
| Denunciadas (novo) 🔧 | — | Fotos denunciadas ({n}) |
| Prazo de guarda (novo) 🔧 | — | Guardamos o álbum por 12 meses depois da revelação. Baixe o ZIP antes de {data} para ficar com tudo. |
| Erro ZIP | Não foi possível baixar. | Não conseguimos montar o arquivo agora. Tente de novo em instantes. |

### Avisos

| Elemento | Atual | Novo |
|---|---|---|
| h1 | Avisos aos convidados | = |
| Subtítulo | Mande uma notificação push para quem instalou o app do casamento. O aviso também aparece no início do app. Até 5 por hora. | Mande uma notificação para quem instalou o app do casamento. O aviso também aparece na tela inicial dos convidados. Até 5 por hora. |
| Cartão 1 | Aparelhos com avisos ativos | = |
| Cartão 2 | Pessoas que entraram | = |
| h2 | Novo aviso | = |
| Labels | Título · Mensagem | = |
| Placeholder título | Ex.: A festa vai começar! | = |
| Placeholder mensagem | Ex.: Abram a câmera e registrem o primeiro dueto dos noivos. | Ex.: Abram a câmera e registrem a primeira dança dos noivos. |
| Botão | Enviar aviso | = |
| Resultado | Enviado para {x} de {y} aparelhos. | Aviso enviado para {x} de {y} aparelhos. |
| Erro: limite | (mensagem do servidor) | Você já enviou 5 avisos nesta hora. Tente de novo em alguns minutos. |
| h2 histórico | Enviados | = |
| Vazio | Nenhum aviso enviado ainda. | = |
| Nota | Para receber avisos, o convidado precisa instalar o app na tela inicial e aceitar as notificações. No iPhone isso só funciona com o app instalado (iOS 16.4 ou mais) e o site em HTTPS. | Para receber avisos, o convidado precisa instalar o app na tela inicial e aceitar as notificações. No iPhone, só funciona com o app instalado (iOS 16.4 ou mais). |

### Convite e QR Code

| Elemento | Atual | Novo |
|---|---|---|
| h1 | Convite e QR Code | = |
| Subtítulo | Imprima o QR Code em placas na entrada e nas mesas. Quem escanear recebe o convite e entra na jornada de convidado. | Imprima o QR Code em placas na entrada e nas mesas. Quem escanear recebe o convite e já pode fotografar. |
| Alt do QR | QR Code do convite | = |
| Botão copiar | Copiar link | = |
| Copiado | Link copiado. | Link copiado! |
| Botão baixar | Baixar QR Code | Baixar o QR Code |
| Botão ver | Ver como convidado | = |
| Aviso HTTPS | Para a câmera ao vivo funcionar no celular dos convidados, o endereço precisa ser HTTPS. Em rede local (HTTP) o app usa a câmera nativa do celular. | Exibir só em rede local (HTTP); em produção, ocultar. |
| Texto para os convidados (novo) 🔧 | — | Escaneie o QR Code, tire fotos durante a festa e veja tudo junto depois. Suas fotos serão vistas por todos os convidados. |
| PDF para imprimir (novo) 🔧 | — | Baixar placa para imprimir (PDF) |

### Configurações

| Elemento | Atual | Novo |
|---|---|---|
| h1 | Configurações | = |
| Subtítulo | Regras do seu casamento. O que a plataforma limita fica com o administrador do Memo. | As regras do seu casamento. Os limites da plataforma ficam com a nossa administração. |
| h2 | Convidados | = |
| Opção 1 | Só quem está na lista entra / O nome digitado precisa existir na aba Convidados. Evita penetras no álbum. | Só quem está na lista entra / O nome digitado precisa estar na aba Convidados. Evita penetras no álbum. |
| Opção 2 | Permitir recados / Convidados podem deixar mensagens para os noivos. | Permitir recados / Os convidados podem deixar mensagens para vocês. |
| Opção 3 | Mostrar o nome de quem tirou cada foto / Desligue se preferir um álbum sem identificação. | Mostrar o nome de quem tirou cada foto / Desligue se preferir um álbum sem identificação. Os convidados verão o aviso atualizado. |
| Salvo | Salvo. | Salvo! |
| h2 limites | Limites deste casamento | Limites do seu casamento |
| Texto limites | Convidados na câmera: até {a} · Lista: até {b} · Fotos no evento: até {c}. Precisa de mais? Fale com o suporte do Memo. | Convidados na câmera: até {a} · Lista: até {b} · Fotos no evento: até {c}. Precisa de mais? Fale com o nosso suporte. |
| Seção dados (novo) 🔧 | — | Seus dados |
| Exportar tudo 🔧 | — | Baixar tudo do evento. Reunimos em um arquivo as fotos, os recados e a lista de convidados do casamento, para você guardar com carinho. |
| Botão exportar 🔧 | — | Baixar tudo (ZIP) |
| Exportar — preparando 🔧 | — | Preparando o arquivo… pode levar alguns minutos. |
| Excluir — título 🔧 | — | Excluir este álbum? |
| Excluir — texto 🔧 ⚖️ | — | Vamos apagar para sempre as fotos, os recados, a lista de convidados e os dados do evento. Os convidados deixam de ter acesso. Não dá para desfazer. Antes, que tal baixar tudo? |
| Excluir — botões passo 1 🔧 | — | Baixar tudo primeiro · Continuar |
| Excluir — confirmação 🔧 | — | Para confirmar, digite o nome do casamento: {titulo} |
| Excluir — campo 🔧 | — | Digite o nome exato |
| Excluir — erro 🔧 | — | O nome não confere. Digite exatamente como aparece acima. |
| Excluir — botões passo 2 🔧 | — | Cancelar · Excluir para sempre |
| Excluir — sucesso 🔧 | — | Álbum excluído. Obrigado por usar o Memo Brasil. |

### Equipe

| Elemento | Atual | Novo |
|---|---|---|
| h1 | Equipe | = |
| Subtítulo | Cerimonial e outros membros do casal acessam esta área por link próprio. Cerimonial gerencia lista, programação e fotos, mas não altera a equipe. | Quem ajuda a organizar acessa esta área por um link próprio. O cerimonial cuida da lista, da programação e das fotos, mas não altera a equipe. |
| h2 | Convidar para a organização | Chamar para a organização |
| Placeholder | Nome | = |
| Opções | Cerimonial · Casal | = |
| Botão | Gerar link de acesso | = |
| h2 | Quem tem acesso | = |
| Vazio | Só você, por enquanto. | = |
| Botão copiar | Copiar link | = |
| Botão remover | Remover | = |
| Confirmação remover | Remover o acesso de {nome}? | Remover o acesso de {nome}? Essa pessoa não consegue mais entrar no painel. |
| Aviso do link (novo) 🔧 | — | Este link dá acesso ao painel. Envie só para quem você confia. |

---

## `master.html` (admin interno; linguagem direta, sem tom festivo)

| Elemento | Atual | Novo |
|---|---|---|
| `<title>` | Admin master — Memo Brasil | Administração · Memo Brasil |
| Marca | MEMO BRASIL · ADMIN MASTER | MEMO BRASIL · ADMINISTRAÇÃO |
| Botão sair | Sair | = |
| Login — h1 | Admin master | Administração |
| Login — texto | Acesso a todos os casamentos e às variáveis da plataforma. Toda ação sensível fica registrada. | Acesso a todos os casamentos e às variáveis da plataforma. Toda ação fica registrada, inclusive o acesso a fotos. |
| Login — placeholder | Senha do admin master | Senha da administração |
| Login — botão | Entrar | = |
| Login — erro | Senha inválida ou ausente. | Senha inválida. Confira e tente de novo. |
| Login — 2º fator (novo) 🔧 | — | Código de 6 dígitos do aplicativo autenticador |
| Login — bloqueio 🔧 | — | Muitas tentativas. Aguarde alguns minutos para tentar de novo. |
| Abas | Casamentos · Fotos por casamento · Plataforma · Avisos globais · Auditoria · Políticas de acesso | Casamentos · Fotos por casamento · Plataforma · Avisos a todos · Registro de acessos · Quem pode o quê |
| Totais | Casamentos · Pessoas na câmera · Fotos · Convidados nas listas | = |
| Busca | Buscar casamento ou contato | = |
| Sem contato | sem contato | sem contato |
| Cabeçalhos | Casamento · Criado · Revelação · Confirmados · Câmera · Fotos · espaço · Push · Status | = |
| Status | Suspenso · Revelado · Em andamento | = |
| Botões | Abrir · Limites · Suspender/Reativar · Novo link do casal · Excluir | = |
| Vazio | Nenhum casamento encontrado. | = |
| Confirmar novo link | Gerar um novo link de acesso para o casal de "{titulo}"? O link antigo para de funcionar. | = |
| Prompt novo link | Novo link do casal (copie e envie): | = |
| Limites — prompts | Máximo de pessoas na câmera para "{titulo}" (atual {a}; vazio volta ao padrão da plataforma): / Máximo de convidados na lista (atual {b}): / Máximo de fotos no evento (atual {c}): | = |
| Excluir — prompt | Excluir "{titulo}" e todas as {n} fotos para sempre? Digite o id do evento para confirmar: {id} | Excluir "{titulo}" e todas as {n} fotos para sempre? Esta ação fica registrada. Digite o id do evento para confirmar: {id} |
| Acesso a conteúdo (novo, antes de abrir fotos) 🔧 ⚖️ | — | Este acesso será registrado. Informe o motivo: suporte, moderação, segurança ou ordem legal. |
| Fotos — aviso | Álbuns separados por casamento. Mostrando as {n} fotos mais recentes de {total}. Os convidados e os noivos só veem na hora da revelação de cada evento; você vê agora. | Álbuns separados por casamento. Mostrando as {n} fotos mais recentes de {total}. Os convidados só veem na hora da revelação; você vê agora, e este acesso fica registrado. |
| Fotos — vazio | Ainda não há fotos. | = |
| Fotos — botão | Moderar este álbum | = |
| Plataforma — h2 | Variáveis da plataforma | = |
| Plataforma — botão | Salvar variáveis | = |
| Plataforma — sucesso | Variáveis salvas e já em vigor. | = |
| Rótulos das variáveis | (ver `ROTULOS` em master.html) | = ; exceto retenção: "Retenção (dias após a revelação)" / "Prazo em dias. Quando a exclusão automática estiver ativa, o evento é apagado ao fim deste prazo." 🔧 |
| Avisos — h2 | Aviso para todos os casamentos | Aviso a todos os casamentos |
| Avisos — texto | Vai como notificação push para quem instalou o app em qualquer evento ativo. | = |
| Avisos — placeholder | Título · Mensagem para todos os aparelhos com o app instalado | = |
| Avisos — confirmar | Enviar este aviso para todos os casamentos? | = |
| Avisos — botão | Enviar a todos | = |
| Avisos — resultado | Entregue a {x} de {y} aparelhos. | = |
| Auditoria — h2 | Auditoria (só inserção) | Registro de auditoria (não pode ser editado) |
| Auditoria — cabeçalhos | Quando · Quem · Evento · Ação · Detalhe | = |
| Auditoria — vazio | Nenhuma ação registrada ainda. | = |
| Políticas — h2 | Isolamento entre casamentos · Quem pode o quê | = |
| Políticas — cabeçalhos | Papel · Acessa · Não pode | = |

---

## Estados e componentes comuns (`common.js`, `app.css`, PWA)

| Elemento | Atual | Novo |
|---|---|---|
| Carregando | (nenhum) | Um instante… |
| Sem conexão | (nenhum) | Sem conexão. Verifique sua internet e tente de novo. |
| Erro inesperado | (mensagem do servidor) | Algo não saiu como esperado. Tente de novo; se continuar, fale com os noivos. |
| Muitas tentativas | (mensagem do servidor) | Muitas tentativas seguidas. Respire e tente de novo em instantes. |
| Em manutenção — título | (mensagem global) | Voltamos já |
| Em manutenção — texto | {avisoGlobal} | Estamos cuidando de alguns detalhes. Tente de novo em alguns minutos. |
| Push: revelação | (mensagem do servidor) | Título: O álbum de {titulo} abriu! 🎉 · Corpo: Veja a festa pelos olhos de todo mundo. |
| Push: teste | (nenhum) | Título: Avisos ativados ✓ · Corpo: A gente avisa quando as fotos forem reveladas. |
| Crumb inicial do convidado | {titulo} › Início | = |

---

## Para quem aplica

1. Substituir por `=` não exige mudança. Linhas "(novo)" criam um elemento; combinar posição com o Designer.
2. Itens 🔧 só entram quando a funcionalidade existir; não deixar texto de recurso ausente na tela.
3. Itens ⚖️ aguardam revisão jurídica (PP, TU, CG, ES nos outros PRs).
4. Mensagens do servidor ("mensagem do servidor") ficam em `server.js`; esta tabela dá o texto final desejado, para o autor do backend alinhar.
5. As telas nunca foram abertas em navegador; revisar o encaixe de frases mais longas em 390 px.
