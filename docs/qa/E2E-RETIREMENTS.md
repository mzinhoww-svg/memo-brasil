
# Testes E2E retirados ou reescritos (Revela 2.0)

| Arquivo | Teste | Motivo | Cobertura substituta |
|---|---|---|---|
| web/e2e/produto.spec.ts | home mostra a linha de preço só do Grátis quando não há plano pago ativo | A abertura (Main) não tem mais a linha de preço "Grátis até 10 convidados." | `/precos local mostra só o Grátis...` no mesmo arquivo (preço, aviso "planos pagos voltam em breve") |
| web/e2e/produto.spec.ts | /precos: as 3 perguntas ("Como pago?", "E se passar do limite?", "Posso pedir reembolso?") e o link "Fale com a gente" | A tela de preços 30 é só h1, plano(s), aviso e botão "Montar câmera"; as perguntas de pagamento estão em /ajuda | `/ajuda é pública...` (perguntas e suporte por e-mail) |
| web/e2e/produto.spec.ts | rodapé nas rotas /precos e /ajuda | Só a abertura (/) tem rodapé; Preços e Ajuda são telas próprias sem `contentinfo` | `rodapé tem Termos...` (agora só em `/`, ausente no painel e no convite) |
| web/e2e/produto.spec.ts | cartão de mesa do QR: um cartão por mesa e a linha "Cada um tem N fotos. Revelamos..." | A tela 25 mostra um cartão em 4 modelos; o download por mesa vive na folha de download, e a linha do rolo não aparece mais no cartão | `QR das mesas: cartão com a redação do modelo...`; `qr-download.spec.ts` (SVG/PNG por mesa); `qr-copy.test.ts` (vitest) |
| web/e2e/studio-local.spec.ts | tema personalizado (paleta Oceano, `data-event-theme`, `--evento-superficie`) | Cores e fontes por evento foram removidas; a identidade é embalagem + filme + mensagem | `aparência: embalagem e mensagem valem na entrada do convidado...` |
| web/e2e/produto.spec.ts | home: 3 passos, "Grátis até 10 convidados." e CTA "Criar meu evento grátis" na abertura; "Minhas fotos"/"Agora" no /exemplo | Abertura nova (Main) com uma promessa e dois botões; o /exemplo não tem mais a aba "Minhas fotos" | `home mostra a proposta...` e `/exemplo: até 5 fotos...` |
# Testes E2E aposentados ou substituídos (Revela 2.0)

| Arquivo | Nome antigo | Motivo | Cobertura substituta |
| web/e2e/consent.spec.ts | organizador: caixas nascem desmarcadas; uma sem a outra não cria; as duas criam (alerta "Aceite os Termos...") | O consentimento do organizador agora é o diálogo "Antes de criar"; o botão Aceitar fica desabilitado até as duas caixas, sem alerta | Mesmo arquivo: "organizador: diálogo 'Antes de criar'..." (botão desabilitado com 0/1 caixa, habilitado com as 2) |
| web/e2e/consent.spec.ts | convidado: sem as duas confirmações não entra... (campo "Como te chamam na festa?", "Entrar e abrir a câmera") | Convidado agora usa "Seu nome", "Entrar e fotografar" e o diálogo "Antes de fotografar" | Mesmo arquivo: teste do convidado reescrito com a mesma intenção |
| web/e2e/home-exemplo.spec.ts | home não lista eventos; Meus eventos mostra os ativos com Painel | /eventos virou "Suas câmeras" (câmera em destaque, sem região "Ativos" nem link "Painel"); home tem "Minhas câmeras" | Mesmo arquivo: "...Minhas câmeras mostra a câmera ativa com acesso ao painel (QR)" |
| web/e2e/home-exemplo.spec.ts | home por teclado / ações visíveis / "Entrar com código" | Ações da home agora: Tenho um convite, Montar câmera, Experimentar câmera | Mesmo arquivo, nomes novos |
| web/e2e/a11y.spec.ts | axe nos 4 passos do assistente ("Passo N de 4") | Assistente tem 8 passos ("N/8") | Mesmo arquivo: "axe: 0 violações nos 8 passos..." |
| web/e2e/a11y.spec.ts | rota /design no teste de tema | Página /design não existe mais | Rotas /exemplo e /termos adicionadas ao teste de tema |
| web/e2e/revela-wizard.spec.ts | switch "Permitir baixar em alta" marcado no passo 7 | Opção escondida de propósito (sem efeito de download em alta) | Mesmo teste: confirma que o switch não é oferecido |

# E2E: testes e comportamentos aposentados no Revela 2.0

Uma linha por teste (ou asserção) removido ou substituído. Colunas: arquivo | teste | motivo | cobertura substituta.

| web/e2e/flows.spec.ts | tema Noite persiste ao recarregar e vale para o app inteiro | O redesenho removeu o tema Dia e o botão "Mudar para o tema Noite"; o app é só escuro (`data-theme="dark"`). | `flows.spec.ts` › "o app é só Noite: tema escuro fixo, sem alternador..." (sem botão, mesmo tema e fundo após recarregar e em /entrar). |
| web/e2e/flows.spec.ts | cria evento grátis em 4 passos (asserções "Passo N de 4", "Na manhã seguinte (10h)", `contador-previa`, `selo-plano`) | O assistente tem 8 passos com selo "n/8"; "Na hora"/"Escolher dia" e a prévia do contador do rolo não existem mais. | `flows.spec.ts` › "cria evento grátis pelos 8 passos..." e `revela-wizard.spec.ts`. |
| web/e2e/flows.spec.ts | wizard valida ... botão "Outra data" / campo "Escolha o horário" | Passo "Quando é a festa?" usa Dia/Começa/Termina; "Outra data" saiu. A mensagem de término curto continua a mesma. | `flows.spec.ts` › "wizard valida nome do evento e término curto..." (usa "Começa"/"Termina"). |
| web/e2e/flows.spec.ts | manhã seguinte revela às 10h | Opção virou "No dia seguinte" e o aviso é às 12:00. | `flows.spec.ts` › "revelar no dia seguinte marca o aviso às 12h no fuso do evento". |
| web/e2e/flows.spec.ts | anfitrião cria evento e vê o convite com código e QR (alt "QR Code do convite", "Evento criado.") | A tela 15 "A câmera está pronta" não mostra mais o QR; ele fica em /painel/[id]/qr ("Baixar QR code"). | Mesmo teste, agora verifica heading "está pronta", código, link do convite e a navegação até a tela de QR. |
| web/e2e/flows.spec.ts | mais opções ... editor (desenho, texto, colagem, desfazer) | O editor (25) agora só tem filme, cortar, girar, data, baixar e salvar. Desenho, texto, colagem e Desfazer/Refazer foram removidos de propósito. | Mesmo teste cobre quem reagiu, baixar foto e as ferramentas atuais do editor com os dois downloads. |
| web/e2e/flows.spec.ts | avisos do evento: botão "Ativar avisos" / "Avisos ligados neste aparelho." | A tela "Você" tem o switch "Avisar quando revelar" (sem texto de confirmação). | Mesmo teste verifica o switch `aria-checked` e `Notification.permission === "granted"`. |
| web/e2e/flows.spec.ts | convite mostra fotos, revelação e quem vê ("Revela sex, 10h", "Até lá, só Emy pode ver.", "Quem vê:") | O convite (20b) mostra só as poses e "Ninguém vê as fotos antes da revelação."; linhas de data de revelação e "quem vê" saíram. | `flows.spec.ts` › "convite mostra as poses..." e "espera: 'no laboratório'..." (dia da revelação na tela de espera). |
| web/e2e/flows.spec.ts | convite com revelação desligada diz que as fotos aparecem na hora | A frase "As fotos aparecem na hora." não existe no convite novo. | `flows.spec.ts` › "convite de evento com 5 poses mostra 5 poses suas". |
| web/e2e/flows.spec.ts | pré-permissão: "Ela destrava suas 5 fotos" / "Cada foto vai para o álbum..." e botão "Prefiro escolher da galeria" | Textos trocados na tela 23; "Agora não" leva à tela "Tudo bem, use a galeria". O seletor da galeria é o rolo (aceita várias fotos). | Testes de pré-permissão atualizados no mesmo arquivo. |
| web/e2e/flows.spec.ts | rede cai no envio: "Não feche esta tela..." e contador do rolo na prévia | Frase removida; a prévia não mostra o contador. A mensagem "Sua pose ainda não foi confirmada" e a quota ("1 de 5" em Você) cobrem. | Mesmo teste. |
| web/e2e/flows.spec.ts | join recusado: "Este convite não está mais ativo." / "Tenho outro código" / "Conhecer o Revela" | Tela 20g agora: "Este convite não vale mais" com o único link "Digitar outro código". | Mesmo teste. |
