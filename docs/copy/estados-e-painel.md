# Estados, retrospectiva e ações do painel

> **Rascunho v0.1 · 13/10/2026 · Redator.** Complementa `convite-e-ui.md` (PR #2) sem alterar nenhum arquivo dele.
> Tom acolhedor, pt-BR, "você". 🔧 = depende de funcionalidade ainda inexistente. ⚖️ = revisão jurídica.
> `{variável}` = valor dinâmico; valores de usuário (`{titulo}`, `{nome}`) sempre inseridos como texto escapado.
> Cada estado traz **título**, **texto** e **ação**. Quando a ação for um botão, o rótulo vem entre [colchetes].

---

# 1. Estados da jornada do convidado

## 1.1 QR Code inválido ou convite não encontrado

| | |
|---|---|
| **Título** | Não encontramos este convite |
| **Texto** | O QR Code pode estar incompleto ou o endereço ter sido digitado errado. Peça aos noivos para conferir o código. |
| **Ação** | [Tentar de novo] |
| **Variação: endereço sem evento** | `Este endereço não leva a nenhum álbum.` |
| **Variação: evento apagado** | **Este álbum não está mais disponível** · `O prazo de guarda terminou e os arquivos foram apagados, como combinado. Se precisar, fale com os noivos.` |

## 1.2 Evento encerrado (revelação já aconteceu)

| | |
|---|---|
| **Título** | A festa acabou, e as fotos estão abertas! |
| **Texto** | As fotos já foram reveladas. Veja a festa pelos olhos de todo mundo. |
| **Ação** | [Ver o álbum] |
| **Na câmera** | `A festa terminou. Obrigado por registrar!` e redireciona ao álbum |
| **Entrada tardia (nome novo)** | `O álbum já está aberto. Entre com seu nome para ver as fotos.` |

## 1.3 Evento suspenso

| | |
|---|---|
| **Título** | Este álbum está em pausa |
| **Texto** | Por enquanto não é possível entrar. Fale com os noivos para saber mais. |
| **Ação** | nenhuma (sem botão; não explicar o motivo ao convidado) |

⚖️ **ES-1.** Não indicar o motivo da suspensão ao convidado. O motivo é tratado com o organizador (ver termos §10).

## 1.4 Ainda sem fotos

| Onde | Texto |
|---|---|
| **Álbum (antes da revelação)** | **Ainda não há momentos por aqui.** `Abra a câmera e faça o primeiro!` · [📷 Abrir a câmera] |
| **Álbum (depois da revelação, vazio)** | **Ninguém enviou fotos desta vez.** `Se foi algum problema, fale com os noivos.` |
| **Início (zero fotos suas)** | `Você ainda não tirou nenhuma foto. Que tal começar?` |
| **Retrospectiva sem fotos** | `Ainda não há fotos para a retrospectiva.` |

## 1.5 Limite de fotos atingido

| Situação | Texto |
|---|---|
| **Tela da câmera (ao clicar)** | `Suas {n} fotos acabaram. Valeu por registrar a festa!` |
| **Aviso quando restam poucas** (≤ 3) | `Só restam {n} fotos. Escolha bem!` |
| **Último clique** | `Essa foi a última. Curta a festa! 💛` |
| **Início (cartão da câmera)** | `Suas fotos acabaram. Foi um prazer!` |
| **Limite do evento (total)** | `O álbum atingiu o limite de fotos. Fale com os noivos.` |
| **Muitos envios seguidos** | `Calma! Muitas fotos de uma vez. Espere um instante.` |

## 1.6 "Revela em Xh" (contagem para a revelação)

| Formato | Texto | Observação |
|---|---|---|
| Acima de 24 h | `Revela em {d} dias` | |
| Entre 1 h e 24 h | `Revela em {h}h` / `Revela em {h}h {m}min` | |
| Menos de 1 h | `Revela em {m} min` | |
| Menos de 1 min | `Revelando em instantes…` | |
| No momento | `O álbum abriu! 🎉` | recarrega a lista |
| Bloqueio na foto (ladrilho) | 🔒 + `Revela em {h}h` | |
| Placar | `Falta para a revelação` | |
| Data fixa | `As fotos serão reveladas em {dia}, às {hora}` | usar no convite |
| Horário alterado pela organização | `Os noivos mudaram a hora da revelação: agora é {dia}, às {hora}.` 🔧 | exige aviso push ou banner |

## 1.7 Câmera sem permissão (com fallback para a câmera nativa)

| Situação | Título | Texto | Ação |
|---|---|---|---|
| **Pedido de permissão** (antes do pop-up do sistema) | Vamos abrir a câmera | `Seu celular vai pedir a permissão da câmera. Toque em **Permitir** para fotografar a festa.` | [Continuar] |
| **Permissão negada** | Não conseguimos abrir a câmera | `Sem problema! Toque no botão para usar a câmera do seu celular; a foto entra no álbum do mesmo jeito.` | [Usar a câmera do celular] |
| **Como liberar depois** (link "Preferir a câmera aqui?") | Para usar a câmera ao vivo | `Libere a câmera para este site nas configurações do navegador e volte para esta tela.` | [Entendi] |
| **Aparelho sem câmera ao vivo** | Toque para fotografar | `A câmera do seu celular vai abrir. Tire a foto e ela entra no álbum.` | [Tirar foto] |
| **Câmera em uso por outro app** | A câmera está ocupada | `Feche o outro aplicativo que usa a câmera e tente de novo.` | [Tentar de novo] |

Princípio: **nunca bloquear o convidado**. Se a câmera ao vivo falhar, o botão da câmera nativa sempre aparece.

## 1.8 Navegador embutido (Instagram, WhatsApp, Facebook etc.)

Detectado pelo user agent. A câmera ao vivo costuma falhar nesses navegadores.

| | |
|---|---|
| **Título** | Abra no navegador do celular |
| **Texto (iPhone)** | `Para a câmera funcionar bem, abra este álbum no **Safari**. Toque em **⋯** (ou no ícone de compartilhar) e escolha **Abrir no Safari**.` |
| **Texto (Android)** | `Para a câmera funcionar bem, abra este álbum no **Chrome**. Toque em **⋮** e escolha **Abrir no Chrome** (ou "Abrir no navegador").` |
| **Texto (genérico)** | `Para a câmera funcionar bem, abra este álbum no navegador do celular (Safari ou Chrome).` |
| **Botão primário** | [Copiar link] → `Link copiado! Cole no Safari ou no Chrome.` |
| **Botão secundário** | [Continuar mesmo assim] |
| **Efeito de continuar** | `Tudo bem. Usaremos a câmera do seu celular.` |

Observação: aviso uma vez por sessão; não repetir a cada tela.

## 1.9 Estados gerais complementares

| Situação | Texto |
|---|---|
| **Sem internet** | `Sem conexão. Verifique sua internet e tente de novo.` |
| **Foto não enviada** | `Sua foto não foi enviada. Toque em tentar de novo.` · [Tentar de novo] |
| **Enviando** | `Guardando seu momento…` |
| **Em manutenção** | **Voltamos já** · `Estamos cuidando de alguns detalhes. Tente de novo em alguns minutos.` |
| **Relógio do aparelho errado** | `A hora do seu celular parece diferente da real. Usamos a hora do servidor, então nada muda para você.` |

---

# 2. Retrospectiva e compartilhar

## 2.1 Retrospectiva (slideshow)

| Elemento | Texto |
|---|---|
| **Botão de entrada** | `✨ Ver a retrospectiva` |
| **Tela de abertura** | **{titulo}** · `{n} momentos, {m} pessoas. Um dia para guardar.` |
| **Autor na foto** | `Foto de {autor}` (ou nada, se o autor estiver oculto) |
| **Controles** | `Pausar` · `Continuar` · `Próxima` · `Anterior` · `Fechar` |
| **Música (🔧, desligada por padrão)** | `Música ligada` / `Música desligada` · dica: `Toque para ouvir uma trilha suave.` |
| **Fim** | **Fim da retrospectiva** · `Obrigado por fazer parte desse dia.` · [Ver de novo] [Compartilhar o álbum] |
| **Sem fotos** | `Ainda não há fotos para a retrospectiva.` |
| **Revelação ainda não aconteceu** | `A retrospectiva fica disponível depois da revelação.` |
| **Acessibilidade** | `Foto {i} de {n}` · `Reprodução automática. Toque para pausar.` |

Preferências do movimento: respeitar `prefers-reduced-motion` (passar fotos sem transição) e nunca tocar som sem ação do usuário.

## 2.2 Compartilhar o álbum 🔧

| Elemento | Texto |
|---|---|
| **Botão (álbum)** | `Compartilhar o álbum` |
| **Título do painel** | Compartilhe a festa |
| **Texto** | `Envie o link para quem estava lá. Só entra quem tem o link.` |
| **Botões** | [Compartilhar] · [Copiar link] |
| **Confirmação** | `Link copiado!` |
| **Mensagem pronta (WhatsApp)** | `O álbum de {titulo} abriu! 💛 As fotos da festa estão aqui: {link}` |
| **Título do compartilhamento do sistema** | `Álbum de {titulo}` |
| **Aviso (privacidade)** | `Quem receber o link vê as fotos de todos os convidados. Compartilhe só com quem você quer.` |
| **Link inválido** | `Este link não funciona mais. Peça um novo aos noivos.` |

⚖️ **ES-2 — Link do álbum.** Hoje o álbum revelado é acessível a quem tem o link do evento. Decidir se o compartilhamento exige entrada com nome (identificação) ou se o link é aberto, e ajustar o aviso. Ver PP-3 e CG-1 no PR #2.

---

# 3. Painel da organização: ações sensíveis

## 3.1 Revelação: antecipar, adiar, encerrar

Estado atual: o painel permite alterar o horário (`PATCH revealAt`). Botões de "revelar agora" e "estender" com confirmação são 🔧.

### Revelar agora 🔧
- **Botão:** `Revelar agora`
- **Título:** Revelar o álbum agora?
- **Texto:** `Todos os convidados passam a ver todas as fotos neste instante, com o nome de quem tirou. A câmera fecha e não dá para voltar atrás.`
- **Botões:** [Cancelar] · [Sim, revelar agora]
- **Sucesso:** `Pronto! O álbum está aberto. {n} momentos já podem ser vistos.`

### Alterar a hora da revelação (existe)
- **Rótulo:** `Hora da revelação`
- **Ajuda:** `Os convidados são avisados da mudança.` 🔧 *(aviso automático)*
- **Sucesso:** `Pronto! Novo horário salvo.`
- **Erro (hora no passado):** `Escolha uma hora que ainda não passou.`

### Estender a revelação (adiar) 🔧
- **Botão:** `Adiar a revelação`
- **Atalhos:** `+1 hora` · `+1 dia` · `Escolher outra hora`
- **Confirmação:** `Os convidados ganham mais tempo para fotografar. A revelação passa para {dia}, às {hora}.`
- **Sucesso:** `Revelação adiada para {dia}, às {hora}.`
- **Se já revelado:** `O álbum já foi revelado e não pode ser adiado.`

### Encerrar a câmera sem revelar 🔧
- **Botão:** `Encerrar a câmera`
- **Texto:** `Ninguém mais envia fotos, mas o álbum continua escondido até a hora da revelação.`
- **Confirmação:** [Cancelar] · [Encerrar a câmera]
- **Reabrir:** `Reabrir a câmera`

⚖️ **ES-3.** Revelar antes do horário informado ao convidado altera a expectativa consentida (ver consentimento §3, item 2). Registrar a alteração na auditoria e avisar os convidados.

## 3.2 Excluir foto (existe)

- **Botão:** `Apagar`
- **Título:** Apagar esta foto?
- **Texto:** `A foto de {autor} sai do álbum para sempre. Não dá para desfazer.`
- **Botões:** [Cancelar] · [Apagar para sempre]
- **Sucesso:** `Foto apagada.`
- **Erro:** `Não foi possível apagar agora. Tente de novo.`
- **Lote 🔧:** `Apagar {n} fotos selecionadas? Não dá para desfazer.`
- **Alternativa 🔧:** `Ocultar do álbum` — `A foto some para os convidados, mas você pode mostrá-la de novo.`
- **Foto de criança 🔧 (aviso na moderação):** `Se a foto expõe uma criança de um jeito que os responsáveis não gostariam, apague.`

## 3.3 Remover convidado (existe)

- **Botão:** `Remover`
- **Título:** Remover {nome} da lista?
- **Texto:** `{nome} sai da lista. As fotos que essa pessoa já enviou continuam no álbum.`
- **Botões:** [Cancelar] · [Remover da lista]
- **Se já entrou na câmera:** `{nome} já entrou na câmera. Ao remover, o acesso é encerrado neste aparelho.` 🔧
- **Opção avançada 🔧:** `Apagar também as fotos desta pessoa` — `Atenção: {n} fotos serão apagadas para sempre.`
- **Sucesso:** `{nome} foi removido da lista.`

## 3.4 Exportar os dados do evento 🔧

- **Título:** Baixar tudo do evento
- **Texto:** `Reunimos em um arquivo as fotos, os recados e a lista de convidados do casamento, para você guardar com carinho.`
- **Botão:** `Baixar tudo (ZIP)`
- **Preparando:** `Preparando o arquivo… pode levar alguns minutos.`
- **Pronto:** `Seu arquivo está pronto.` · [Baixar]
- **Antes da revelação:** `As fotos só entram no arquivo depois da revelação.` *(ou, se o produto permitir à organização, ajustar)*
- **Erro:** `Não conseguimos montar o arquivo agora. Tente de novo em instantes.`

⚖️ **ES-4.** Definir o conteúdo do arquivo (lista com nomes e respostas é dado pessoal de terceiros) e avisar o organizador de que ele passa a ser responsável pelo arquivo baixado.

## 3.5 Excluir o evento para sempre 🔧

Dois passos: lembrar de exportar e confirmar digitando o nome do casamento.

**Passo 1 — Antes de apagar**
- **Título:** Excluir este álbum?
- **Texto:** `Vamos apagar para sempre as fotos, os recados, a lista de convidados e os dados do evento. Os convidados deixam de ter acesso.`
- **Aviso:** `Não dá para desfazer. Antes, que tal baixar tudo?`
- **Botões:** [Baixar tudo primeiro] · [Continuar]

**Passo 2 — Confirmação**
- **Título:** Confirme a exclusão
- **Texto:** `Para confirmar, digite o nome do casamento: **{titulo}**`
- **Campo:** `Digite o nome exato`
- **Botões:** [Cancelar] · [Excluir para sempre] (desabilitado até o nome coincidir)
- **Erro (nome diferente):** `O nome não confere. Digite exatamente como aparece acima.`

**Resultado**
- **Sucesso:** `Álbum excluído. Obrigado por usar o {marca}.`
- **O que ficou:** `Guardamos apenas o registro de que a exclusão aconteceu, como descrito na Política de Privacidade.`
- **Erro:** `Não conseguimos excluir agora. Nada foi apagado. Tente de novo ou fale com {suporte}.`

**Quando é o admin master (interno)**
- `Este evento tem contato {contato}. A exclusão será registrada na auditoria. Digite o id do evento para confirmar.`

⚖️ **ES-5.** Confirmar o que a exclusão "em um comando" remove (arquivos, cópias de segurança, inscrições push, logs) e o que permanece (auditoria). Alinhar com PP-9 e EM-3.

---

## Resumo do que depende de funcionalidade

| Texto | Estado |
|---|---|
| Estados 1.1 a 1.7 | Parcial: telas existem; permissões e variações de mensagem a ajustar |
| Navegador embutido (1.8) | 🔧 detecção de user agent |
| Retrospectiva (2.1) | Existe (aleatória, 3 s); controles, música e fim são 🔧 |
| Compartilhar (2.2) | 🔧 |
| Alterar hora (3.1) | Existe; aviso aos convidados é 🔧 |
| Revelar agora, adiar, encerrar câmera (3.1) | 🔧 |
| Excluir foto (3.2) | Existe; lote e ocultar são 🔧 |
| Remover convidado (3.3) | Existe; apagar fotos junto e encerrar acesso são 🔧 |
| Exportar e excluir evento (3.4, 3.5) | 🔧 |
