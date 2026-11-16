# 01 · PRD — Revela Smart Album · Minhas Fotos

## 1. Problema e visão
"Quero entrar no evento, acessar Minhas Fotos, escolher uma foto minha do Google, galeria ou câmera, e receber, quando as fotos forem reveladas, sugestões de fotografias do evento em que apareço."

Entrega em duas camadas independentes:
- **Álbum pessoal (sem biometria)** — Fotos que tirei + Favoritas. Pronto para homologação atrás da chave `smart_album_ui`.
- **Busca facial voluntária** — infraestrutura completa (consentimento, referência privada, jobs, worker, resultados, revogação), **desligada** até os gates de `07-release-gates.md`. Nenhum motor real existe nesta entrega.

## 2. Jornadas implementadas

| # | Jornada | Onde | Prova |
|---|---|---|---|
| J1 | Convidado vê a aba **Minhas Fotos** (só com a chave ligada) sem perder Feed/Minhas/Você nem a câmera | `web/src/revela/GuestTabs.tsx` | `guest-tab.test.tsx`, E2E 1 e 4 |
| J2 | Primeiro acesso abre o mini onboarding (1 vez por evento/pessoa, pulável) | `MinhasFotos.tsx`, `Onboarding.tsx` | E2E 2 |
| J3 | Escolha da foto: **Google** (se houver `picture`), **galeria**, **câmera frontal** (com fallback para a câmera do sistema), **Fazer depois** | `Onboarding.tsx`, `CameraCapture.tsx`, `reference.ts` | E2E 2, 5; unit `reference` |
| J4 | Revisão: prévia, dicas, erros (pequena, formato, sem rosto/vários rostos quando o navegador detecta), confirmação "Esta foto é minha e mostra o meu rosto" | `Onboarding.tsx` | E2E 2 |
| J5 | Autorização específica (texto-base do plano, checkbox desmarcado, links de privacidade/contato, versão, retenção). Com a busca indisponível: "ainda não está liberada… Nada da sua foto foi enviado" + álbum manual | `Onboarding.tsx` (`ConsentStep`) | E2E 2, 3 |
| J6 | Hub: Encontradas (só com busca ativa) / Que tirei / Favoritas, grade 3 colunas, esqueleto, vazio, erro com "Tentar de novo" | `MinhasFotos.tsx` | E2E 2–4 |
| J7 | Antes da revelação: nenhuma miniatura, nenhuma contagem de sugestões; só "N poses guardadas" (contagem que o convidado já vê em Minhas poses) | `MinhasFotos.tsx` | E2E 4; pgTAP |
| J8 | Foto aberta: Favoritar, Baixar (mesma regra `canDownloadOriginal` do feed), "Não sou eu · ocultar" nas sugestões | `MinhasFotos.tsx` (`Viewer`) | E2E 2, 3 |
| J9 | Trocar referência, procurar de novo, **desativar e apagar** com confirmação e aviso honesto ("enviada para exclusão… em até 1 hora") | `MinhasFotos.tsx` (`FaceCard`) | E2E 3; pgTAP |

## 3. Estados (seção 4.4 do plano)

| Estado | Tratamento |
|---|---|
| Chave desligada / rota direta | "Minhas Fotos ainda não está disponível neste evento." + voltar ao feed |
| Não logado / sessão anônima | álbum manual funciona; a busca facial explica que precisa da conta Google (servidor recusa anônimo) |
| Foto Google ausente | botão desabilitado + "Sua conta não tem foto do Google disponível" |
| Foto Google não representa o titular | a pessoa não confirma a titularidade → não avança |
| Pulou / não aceitou | álbum manual; convite volta pelo card "Encontre fotos em que você aparece" |
| Sem câmera / permissão negada / erro | mensagem + "Usar a câmera do aparelho" (input `capture="user"`) |
| Arquivo grande / formato / pequena | mensagens de `referenceProblemText` |
| Sem rosto / vários rostos | no aparelho, quando há `FaceDetector`; senão, o worker devolve `no_face`/`multiple_faces` e o card pede troca |
| Evento não revelado | sem conteúdo; job recusado (MM017) |
| Sem permissão sobre o evento | RPC MM004 → texto de acesso |
| Fila / processando / timeout / falha | card "Procurando seus momentos…" com consulta a cada 8 s; falha com texto e "Procurar de novo" |
| Sem resultados / resultados / falso positivo | vazio com saída; "Fotos que podem ser suas"; ocultar |
| Foto moderada/excluída | some na próxima leitura (servidor revalida `can_see_photo`) |
| Consentimento revogado / purga | card volta ao convite; aviso de purga enfileirada |
| Offline | banner do layout do convidado (existente); erro de rede com "Tentar de novo" |
| Retomada após abrir PWA | estado vem do servidor (`smart_album_state`), nada fica só no aparelho |

## 4. Acessibilidade e mobile
- Folhas (`Sheet`) com foco preso, Esc, botão voltar fecha; abas com `role=tablist` e setas; botões ≥ 44 px; `prefers-reduced-motion` desliga a animação do esqueleto.
- Testado em 360 px (sem rolagem horizontal) e desktop no E2E. **Não testado** em iPhone/Android físicos (pendência).

## 5. Métricas
Eventos de `analytics.ts` (lista fechada, sem PII): viewed, onboarding_started, source_selected (google|gallery|camera|skip), consent_granted, consent_revoked, job_started, results_opened (faixa de contagem), match_hidden, reference_changed, manual_favorite_added. `job_completed/failed` ficam do lado do worker (log sem PII). O repositório não tem coletor: os eventos saem como `CustomEvent('mm:analytics')`.

## 6. Decisões de UX
1. **Rótulo "Minhas Fotos" ao lado de "Minhas" (poses).** Mantido o texto do plano e a aba homologada intacta. Recomendação para decisão do dono: renomear "Minhas" para "Poses" quando a chave for ligada, para evitar confusão.
2. O convite de onboarding abre **uma vez** por evento/pessoa (preferência não biométrica no `localStorage`); depois só pelo card.
3. A aba atual é fixada ao abrir uma foto (ocultar a última sugestão não leva a pessoa para outra aba — bug achado pelo E2E e corrigido).
4. Avatar: mostra a inicial (como em "Você"). A foto do Google como avatar persistido **não** foi implementada (exigiria coluna/bucket novo em `profiles`); fica como pendência de produto.
