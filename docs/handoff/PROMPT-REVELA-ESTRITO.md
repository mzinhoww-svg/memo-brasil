# Prompt: implementar o design Revela 2.0 sem adaptar

Use este texto como instrução para a sessão que continuar o redesign (`mzinhoww-svg/memo-brasil`, app em `web/`, branch `feat/revela-redesign`).

---

Implemente o design **Revela 2.0** exatamente como está em `design-system/revela/telas/` (83 telas, mapa em `TELAS.md`). O design é a especificação. Não é inspiração, não é sugestão e não é ponto de partida.

## Regras que não admitem exceção

1. **Cada tela é refeita a partir do PNG, não do código atual.** É proibido "repintar" uma tela antiga (trocar só cores e fontes e manter a estrutura). Se a estrutura, a ordem dos blocos, a hierarquia ou os componentes da tela atual diferem do PNG, apague o JSX antigo da tela e escreva de novo.
2. **Todo elemento visível no PNG existe no app,** na mesma posição, na mesma ordem e com o mesmo peso visual: títulos, textos de apoio, contadores, câmera 3D, fotos impressas, carimbos, ícones, interruptores, barras de abas, botões secundários, selos de estado ("Rolando agora", "No laboratório"). Nada é omitido por ser difícil.
3. **Nenhum elemento novo entra se não estiver no PNG.** Nada de abas, avisos, listas de tarefas, breadcrumbs, cartões ou botões que o design não mostra. Estados que o design não desenha (erro, carregamento, vazio, sem permissão) são feitos com os mesmos componentes e o mesmo layout da tela mais próxima.
4. **Textos iguais aos do PNG,** palavra por palavra, trocando só os dados de exemplo (nome do evento, números, datas) pelos dados reais. O vocabulário é o do Revela: câmera, poses, revelar, anfitrião, convidados. Nunca "evento criado", "fotos desejadas", "upload", "feed" visível ao usuário quando o PNG diz outra coisa.
5. **Se o domínio não tem o dado que o PNG mostra, crie o dado.** Escreva uma migration aditiva com RLS e teste. Não remova o elemento da tela e não invente um valor falso. Só pare e pergunte se a criação mudar uma regra de negócio existente.
6. **Câmera 3D com o nome impresso.** Onde o PNG mostra o nome do evento na embalagem, o app mostra o nome real sobre a embalagem (camada de texto posicionada sobre o render, com Gloock e o mesmo enquadramento), nas 4 embalagens.
7. **Valores só de `web/src/styles/tokens.css`.** Nenhuma cor, fonte, raio ou sombra fora dos tokens. Nada do kit antigo (`mm-*`, sálvia, Birthstone, Bricolage, Instrument Serif).
8. **Fotos de cenas (`cenas/`) só em `/exemplo`.** Em qualquer outra tela, use as fotos reais do evento ou os objetos 3D.

## Fora do escopo (decisões já tomadas)

- Login por telefone e SMS (telas 02 a 05) não entra. A entrada do anfitrião é Google e link por e-mail; o convidado entra por QR, com nome e e-mail opcional.
- O convidado não vê nenhuma oferta de app, plano ou álbum.
- Preços vêm só da tabela `plans`. O checkout é transparente (ValidaPay), e a liberação vem só do servidor.
- O cartão fica desligado por flag enquanto não houver 3DS.

## Como trabalhar, tela por tela

Para cada tela de `TELAS.md`, nesta ordem: convidado (20a a 24, 23b a 23g), feed (24b a 24i), câmera pronta (15) e plano (14), pagamento (14a a 14h), anfitrião (16 a 17k), QR e convite (25, 26), Você e apoio (27 a 29), Master (M00 a M14).

1. Abra o PNG e liste em `docs/revela/checklist.md` todos os elementos da tela (texto, componente, posição).
2. Escreva a tela do zero seguindo a lista.
3. Capture o app em 390 × 844 com dados equivalentes e gere a imagem lado a lado (app à esquerda, PNG à direita) em `docs/evidence/revela/<id-da-tela>.png`.
4. Compare e corrija até que não falte nenhum item da lista e a diferença de layout fique só nos dados reais. Marque a tela como concluída no checklist só nesse ponto.
5. Confira 360 e 430 px sem rolagem lateral, alvos de toque de 44 px ou mais, e axe sem violações sérias.
6. Atualize os testes unitários e os E2E que quebrarem pela troca de texto e de estrutura, sem apagar cobertura de regra.
7. Faça um commit por tela ou por grupo pequeno de telas.

## Critério de pronto

Uma tela só está pronta com a imagem lado a lado commitada e todos os itens do checklist marcados. "Parecido", "no espírito do design" e "repintado com os tokens" contam como não feito. No relatório final, liste cada uma das 83 telas como **pronta**, **parcial (com o que falta)** ou **não feita**, sem agrupar.

## Publicação

Siga a seção 7 de `docs/supabase/PUBLISH-AND-ROLLBACK.md`. Pare e peça confirmação antes de aplicar migrations em produção e antes de promover o deploy, mostrando o que muda e o ID de rollback.
