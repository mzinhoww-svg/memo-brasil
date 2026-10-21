# 13 — Critérios de aceitação (verificáveis)

Formato Given/When/Then. Cada critério cita a evidência de origem.

**AC-01 (F-17)** Dado o passo de término, quando escolho horário < agora+30 min, então o "Próximo" fica bloqueado e aparece "Escolha um horário no futuro — pelo menos 30 minutos a partir de agora."; datas passadas não são selecionáveis.
**AC-02 (F-12/F-11)** Dado o código `NFVARBQX`, quando digito em minúsculas, então vira maiúsculo; caracteres 0, O, 1, I, L não são gerados por o gerador de código (`ShareCode`) (alfabeto `23456789ABCDEFGHJKMNPQRSTUVWXYZ`, 8 chars).
**AC-03 (F-05)** Dado código inexistente/encerrado/lotado, quando tento entrar, então vejo mensagem específica e posso "Tentar de novo" ou "Continuar sem entrar no evento".
**AC-04 (F-22)** Dado `guest_capacity ≤ 10`, então o preço é "Grátis" e o botão é "Criar evento grátis"; dado `> 10` sem Memo+, então o botão é "Pagar {preço} e criar"; dado Memo+ ativo e capacidade ≤ 200, então "Incluído na sua assinatura Memo+".
**AC-05 (F-21)** Opções de convidados = {5,10,20,50,100,150,200,Ilimitado}; fotos/pessoa = {5,10,16,24,36,Ilimitadas}.
**AC-06 (F-26)** Dado rolo de N fotos, após N capturas o botão de disparo é bloqueado e exibe "Você usou todas as suas fotos deste evento."
**AC-07 (F-28)** Dado upload recusado com `shotlimitreached`, então a foto sai do rolo local e aparece "Suas fotos neste evento acabaram — esta não entrou no rolo."
**AC-08 (F-29)** Dado offline, ao capturar, a foto é guardada localmente e marcada pendente; ao voltar a rede, é enviada sem ação do usuário; falha permanente não perde a foto local.
**AC-09 (F-31)** Dado `reveal_timing = AFTER_EVENT` e evento ativo, então fotos de outros ficam ocultas ("Foto ainda não revelada"); após `endAt`, ficam visíveis. Para `ADDITIONAL_DELAY=N`, visíveis em `endAt + N dias`.
**AC-10 (F-32)** Dado uma foto, reagir duas vezes com emojis diferentes mantém **uma** reação por usuário (a última); "Quem reagiu" lista autores; sem reações mostra "Ninguém reagiu a esta foto ainda."
**AC-11 (F-36)** Dado álbum encerrado com fotos, então o editor de término não permite reabrir e informa o motivo; "Encerrar agora" encerra imediatamente.
**AC-12 (F-36)** Excluir evento exige confirmação ("Excluir evento?"), apaga fotos e reações; se a remoção remota falha, mostra "O álbum saiu deste aparelho, mas não conseguimos removê-lo da nuvem…".
**AC-13 (F-34)** Exportar mostra progresso (baixando → salvando) e relatório final com contagens de salvas/não baixadas/ausentes; álbum vazio mostra "Este álbum ainda não tem fotos".
**AC-14 (F-38)** Para evento com fim T: notificações em T−1 dia, T−1 h, T−10 min (conforme ativas), em T (encerrou) e na revelação; ao reabrir o app reagenda.
**AC-15 (F-37)** Sair mostra "Sair da conta?" e volta ao onboarding mantendo álbuns locais; Excluir conta exige confirmação e remove dados.
**AC-16 (F-24)** Texto de convite: `Você foi convidado para "{título}" no Memo! Entre com o código {código} ou pelo link: {link}` (marca final a definir).
**AC-17 (F-02)** Slides: textos exatos de `02`; indicador com 3 pontos; "Próximo" avança até Welcome. (OBS)
**AC-18 (F-04)** Login por e-mail permanece desabilitado/indicado como indisponível, replicando o original (ou removido por decisão registrada).
**AC-PWA** Lighthouse PWA instalável; funciona offline (shell + fotos locais); manifest com tema `#0B0B0C`.
**AC-DS** Tokens de cor/raio/espaçamento de `06` aplicados; contraste texto/fundo ≥ 4.5:1 (onBackground `#F5F3EF` sobre `#0B0B0C`, secundário `#9B9AA0` verificar).
**AC-LGPD** Câmera só após consentimento; exclusão de conta remove dados pessoais e fotos próprias.
