# 02 · Avaliação de impacto à proteção de dados (insumo para RIPD)

> **Status: PENDENTE DE APROVAÇÃO JURÍDICA.** Este documento é um insumo técnico preparado pela engenharia. Não é parecer jurídico, não substitui o RIPD exigido pela ANPD e não foi revisado por profissional habilitado. Nenhum tratamento biométrico está ativo.

## 1. Finalidade
Sugerir, a um participante que optou expressamente, fotografias **do mesmo evento** em que ele possa aparecer, a partir de uma imagem de referência fornecida por ele. Não há identificação de terceiros, busca entre eventos, nomes, vigilância, inferência de atributos (idade, gênero, etnia, emoção) nem uso para treinamento, publicidade ou perfis.

## 2. Titulares e dados
| Titular | Dado | Natureza | Onde |
|---|---|---|---|
| Participante que opta | imagem de referência (rosto) | **dado pessoal sensível (biométrico)** quando usada para reconhecimento | bucket privado `face-references` (até revogação/expiração) |
| Participante que opta | consentimento (versão, fonte, horário, revogação) | dado pessoal | `face_consents` (histórico append-only) |
| Participante que opta | lista de fotos sugeridas e ocultadas, faixa `probable/review` | dado pessoal | `face_photo_matches` |
| **Terceiros nas fotos do evento** (convidados, não participantes, possivelmente menores) | rostos analisados pelo motor durante a comparação | **dado sensível de terceiros** | só na memória do worker, durante o job (estratégia A); nada é persistido |
| Todos | favoritas/seleção manual | dado pessoal comum | `personal_photo_items` |

## 3. Base legal (a decidir pelo jurídico)
- Titular que opta: art. 11, I (consentimento específico e destacado) é a hipótese desenhada. O consentimento é separado dos Termos, versionado, desmarcado, revogável a qualquer tempo sem prejuízo do acesso ao evento.
- **Terceiros: questão em aberto e bloqueante.** Comparar a referência com cada foto exige detectar e processar rostos de todos que aparecem nela, inclusive quem não consentiu. O consentimento de um participante não cobre os demais. Sem hipótese legal aprovada para esse tratamento (mesmo transitório), o motor não pode ser ligado. Alternativas a avaliar: consentimento de todos os participantes no ingresso (não cobre não participantes), legítimo interesse (em regra inaplicável a dado sensível), processamento local no aparelho (não dispensa base legal), ou não oferecer o recurso.
- Foto do Google (OAuth `picture`): **não** é consentimento; só é usada se a pessoa escolher e confirmar que é ela.

## 4. Menores
MVP **sem** reconhecimento para menores. Controle técnico atual: só eventos na allowlist `rollout.events` (o master inclui apenas eventos adultos e elegíveis) e só contas Google (não anônimas). Não há verificação de idade e não se usa classificador de idade. **Pendente:** critério documentado de elegibilidade do evento e declaração do organizador; avaliação de como tratar menores que aparecem nas fotos (terceiros).

## 5. Riscos e mitigações implementadas
| Risco | Mitigação no código | Evidência |
|---|---|---|
| Match revelar foto que a pessoa não poderia ver | resultado nunca concede acesso; `smart_album_list_matches` revalida `can_see_photo` + `is_revealed` com o `auth.uid()` real; worker só recebe fotos elegíveis e o banco descarta as demais | pgTAP 39 |
| Antecipar a revelação | job e leitura recusados antes de `is_revealed` (MM017); UI não mostra miniatura nem contagem | pgTAP 39, E2E 4 |
| Busca por outra pessoa (foto de terceiro como referência) | afirmação de titularidade obrigatória (cliente e servidor), busca restrita ao evento e ao próprio titular, sem nomes, rate limit | pgTAP 39 |
| Vazamento da referência | bucket privado, sem política de leitura/remoção para usuários, caminho por perfil, upload único; recompressão no aparelho remove EXIF/GPS | pgTAP 39, unit |
| Embedding persistido | estratégia A: handle opaco só em memória, `dispose` sempre | unit worker |
| Logs/analytics com dado sensível | códigos de erro por regex, auditoria sem caminho/bytes, eventos de produto com lista fechada | unit, pgTAP |
| Uso após bloqueio | `is_member` falso → sem resultados; `smart_album_expire` revoga e apaga | pgTAP 39 |
| Retenção indefinida | `expires_at` ≤ 30 dias (rascunho), revogação e cascata na exclusão do evento | pgTAP 39 |
| Ativação acidental | 5 gates independentes no servidor, todos desligados; worker responde 503 sem motor | pgTAP 39, unit |

## 6. Retenção (proposta, a aprovar)
- Referência: até revogação, troca, bloqueio, ou `least(30 dias, fim do evento + 30 dias)`; purga pelo `purge-storage` (a cada 30 min quando agendado).
- Consentimento: histórico mantido enquanto o evento existir (prova de aceite/revogação); some em cascata na exclusão do evento/conta.
- Jobs: 30 dias. Matches: até revogação/expiração.
- **Pendente:** backups do Supabase (PITR/snapshots) mantêm cópias por tempo próprio; definir procedimento.

## 7. Operadores e transferência internacional
- Supabase (banco/storage) — região do projeto a confirmar (há projeto regional de ensaio em São Paulo). Vercel (pdx1, EUA) não recebe a imagem de referência (upload vai direto ao Storage).
- Motor de reconhecimento: **não escolhido** (ver `04-model-evaluation.md`). Exigir DPA, região compatível, proibição de retenção/treinamento.

## 8. Direitos do titular
Revogação na própria tela (efeito imediato nos resultados; purga assíncrona do objeto). Exclusão completa também ocorre com exclusão do evento/conta (cascata). Contato de privacidade na tela de consentimento.

## 9. Gate jurídico — o que precisa ser aprovado e registrado
1. RIPD formal (ANPD) com parecer de profissional habilitado.
2. Hipótese legal para terceiros nas fotos (bloqueante).
3. Texto final do consentimento e da política específica (publicar nova linha em `face_consent_documents` com `approved = true`).
4. Prazos de retenção e procedimento de backups.
5. Critério de elegibilidade de eventos (adultos) e regra para menores em fotos.
6. Motor/fornecedor com DPA.
7. Registro do aceite em `platform_settings['smart_album.legal_gate']` com `opinion_ref` e `approved_by`.

Referências: ANPD (FAQ dados biométricos; RIPD; agenda regulatória de reconhecimento facial); Google OpenID Connect (`picture` opcional).
