# Auditoria final (independente) e disposição dos achados

Auditor: agente separado, sem acesso às minhas conclusões, instruído a ser cético e a verificar as afirmações dos documentos de QA contra o código (commit auditado `ac290ea`). Resultado bruto: nenhum item bloqueante; 3 altos, 9 médios, vários baixos. Abaixo, o que cada achado virou. Números de teste desta versão: **107 unitários, 35 E2E** (32 locais + 3 de smoke contra o ambiente publicado).

## Veredito por dimensão (após as correções)
| # | Dimensão | Antes | Depois | Observação |
|---|---|---|---|---|
| 1 | Cobertura funcional | ressalva | OK com ressalvas | A1 e M6 corrigidos; pendências na tabela abaixo |
| 2 | Fidelidade ao design system | ressalva | OK | texto corrido ≥17px; componentes do kit mantêm os tamanhos do kit |
| 3 | Navegação | ressalva | OK | 404/erro em pt-BR; "Continuar como" evita beco sem saída do anfitrião |
| 4 | Persistência local | falha | OK com ressalvas | migrações, handlers, sem cache de falha, update seguro; cascata não é atômica (retry seguro) |
| 5 | Qualidade de código | ressalva | OK | |
| 6 | Testes | ressalva | OK com ressalvas | lacunas listadas |
| 7 | Responsividade | não comprovada | parcial | safe-area e quebra de nome longo adicionados; nome longo a 375 px não medido |
| 8 | PWA | ressalva | OK com ressalvas | cache versionado por deploy; rota dinâmica nunca visitada continua sem offline |
| 9 | Segurança | ressalva | OK | CSP/headers; relógio de teste fora do bundle de produção |
| 10 | Deploy Vercel | OK com ressalva | ver `DEPLOY.md` | |

## Disposição dos achados
| Achado | Disposição | Evidência |
|---|---|---|
| A1 término do wizard deriva | **Corrigido**: duração resolvida no instante da criação (`features/events/duration.ts`) | `duration.test.ts` |
| A2 IndexedDB sem migração | **Corrigido**: `MIGRATIONS[]` por versão, `blocking`/`terminated`, falha de abertura não fica em cache | teste "migração de schema" |
| A3 rolo/vagas burláveis | **Corrigido** na aba e entre abas (`withLock`: Web Locks, fallback em fila): 12 postagens simultâneas = 5; 12 entradas = 5 | `features.test.ts`, `lock.test.ts` |
| A3 "outra pessoa" perde o painel | **Corrigido**: identidades ficam no aparelho; "Continuar como" na tela inicial e no convite | E2E "volta ao painel" |
| A3 rolo novo ao trocar de pessoa | **Aceito (inerente ao pré-backend)**: sem conta real, cada identidade local tem seu rolo. Está explicado na tela Você ("Demonstração") e em `ARCHITECTURE.md` | — |
| M1 sem headers | **Corrigido**: nosniff, frame DENY, referrer, Permissions-Policy (câmera só própria origem) e CSP em produção | E2E "cabeçalhos de segurança" |
| M2 404 em inglês | **Corrigido**: `not-found.tsx`, `error.tsx` | E2E "rota inexistente" |
| M3 relógio de teste no bundle | **Corrigido**: env fixada em `"0"` no build (código eliminado) e, mesmo ligado, só vale em localhost | verificação no deploy |
| M4 PWA | **Parcial**: cache por versão de deploy, instalação tolera falha de uma URL, máx. 40 páginas, `id` no manifest, aquecimento das 4 rotas do evento (1×/sessão). **Pendente**: rota dinâmica nunca visitada offline; `theme_color` do manifest é único | E2E PWA |
| M5 cota/erros de escrita | **Parcial**: aviso global (`StorageBanner`) para `StorageUnavailableError` em qualquer ação; `photos.update` não ressuscita; cascata remove o evento por último (falha deixa o evento visível para repetir) | testes de repositório |
| M6 regras do REA | **Corrigido**: capacidade não fica abaixo dos convidados; `react` valida foto/evento/visibilidade; retrospectiva só após fim e revelação; aviso de preço ao passar de 10 na configuração. **Não alterado**: trocar revelação após encerrar (REA não proíbe) | testes de domínio/feature |
| M7 escala de fotos | **Parcial**: miniaturas aparecem uma a uma e o feed pagina de 20 em 20. Não medido com 7.200 fotos | — |
| M8 tipografia | **Corrigido** para texto corrido (consentimento, avisos ≥17px). **Mantido** o que o kit define (erro 15px, chip 14px, linha de tabela 15px, ajuda de campo 13px) | paridade com o kit |
| M9 lacunas de teste | **Parcial**: adicionados migração, concorrência, lock, retrospectiva, CSV, duração, 404, headers, "Continuar como". **Ainda faltam**: lógica do service worker além do E2E, `useEventData`/`usePhotoUrls`, revelação "depois de N dias" em E2E, axe fora de 390 px, Safari/Firefox | — |
| Baixos | Safe-area do iPhone, quebra de nome longo, CSV com espaço antes de `=`, `signIn("")` recusado, `visual.spec` só grava PNG com `SAVE_SHOTS=1`, sem `waitForTimeout`: **corrigidos**. Painel/guarda só no cliente: **aceito** e documentado (sem backend não há segurança de servidor) | — |

## O que continua sem verificação
Safari/iOS, Firefox, câmera real, notificações reais, atualização do service worker após um segundo deploy, variáveis de ambiente do projeto Vercel, 7.200 fotos num evento e a revisão linha a linha de `editor.tsx`, `capture.ts` e `qr.ts`.
