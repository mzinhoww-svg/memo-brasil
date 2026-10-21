# 00 · Relatório executivo da auditoria independente (AUD-001)

Data: 2026-10-21 · Alvo: `feat/memoriesmt` @ `3266e26` (preview validado em `5d8df4a`; commits posteriores só documentação) · Método: 4 auditores independentes (agentes de IA sem acesso às minhas conclusões) + linha de base e verificações do consolidador. Os auditores trataram os documentos de QA do autor como afirmações a verificar, não como requisitos.

## Resposta objetiva
**"O MemoriesMT está pronto para integrar o Supabase sem retrabalho estrutural significativo?" Ainda não.** O domínio, a interface e a revelação programada estão sólidos para a fase pré-backend, mas os contratos de repositório foram desenhados para armazenamento local e confiável, a visibilidade das fotos só existe como filtro de interface e o plano de integração tem contradições. O retrabalho é **moderado e localizado** (contratos, leitura por papel, autoridade do servidor, identidade), estimado pelo auditor A4 em 2 a 3 semanas antes de escrever o DDL. Não é reescrita do produto.

## Decisão: **NO-GO para iniciar a integração agora** (caminho curto para CONDITIONAL GO)
- P0: **0**. P1: **12** achados brutos, agrupados em **7 itens de backlog** (1 de produto, 6 de integração). P2: **22**. P3: **31**. Total bruto: **65**. Mais 3 itens de infraestrutura (INF-001..003).
- Vira **CONDITIONAL GO** quando: `BG-101` e `ITG-101..ITG-106` estiverem DONE e `AUD-002` (reauditoria) passar. Detalhes em `11-RELEASE-GATE.md` e `10-REMEDIATION-BACKLOG.md`.

## Nota geral de maturidade: **7.7 / 10** (pré-backend, sem contar Supabase: 7.9)
| Critério | Peso | Nota (0–10) | Justificativa |
|---|---|---|---|
| Funcionalidade (jornadas, regras do REA, revelação) | 25% | 8.0 | 46 E2E + 29 testes de auditoria passam; critérios AC e F confirmados por evidência. Desconta: P1 BG-101 (revelação 'ao terminar' não acompanha o fim, caminho padrão do wizard) e 5 P2 de revelação/papéis |
| Fidelidade visual ao Design System v1 | 15% | 9.0 | Classes mm-* idênticas às do kit; 284 estados capturados sem contraste <4,5:1 (exceto desabilitado), sem sombra/gradiente/emoji; desconta: revelação invertida na Noite, estouro do seletor do painel |
| Arquitetura e qualidade de código | 15% | 7.0 | Camadas claras, domínio puro e testado. Desconta: visibilidade só em filtro de UI, contratos de repositório locais, todas as páginas como Client Components, erros engolidos |
| Segurança (cliente pré-backend) | 15% | 7.5 | Sem segredos (árvore e histórico), sem XSS, sem requisição externa, EXIF/GPS descartados, produção 0 vulnerabilidades. Desconta: sem limite de dimensão no upload, CSP com unsafe-inline, autorização só de UI (inerente ao pré-backend) |
| Testes automatizados | 10% | 8.5 | 131 unitários, 46 E2E, paridade com o kit, axe, revelação com relógio falso. Desconta: sem WebKit/Firefox, SW sem teste unitário, hooks sem teste |
| PWA e offline | 5% | 6.5 | Manifest e instalabilidade ok; offline só para URLs visitadas; atualização do SW apaga páginas guardadas |
| Performance | 5% | 9.0 | Lighthouse mobile 93–95 (LCP 2,9–3,3 s simulado), desktop 100 (exceto CLS no painel sem dados); 200 fotos em 1,7 s |
| Prontidão para o Supabase | 10% | 5.0 | Domínio pronto; contratos 'inadequados' em 7 pontos; plano com contradições; sem env, tipos nem suíte de contrato v2 |
Pesos são do auditor consolidador e podem ser contestados; as notas são julgamento sobre as evidências citadas, não medição. A soma ponderada é 7.65.

## Produto × integração × infraestrutura
**Produto (defeitos do app hoje):** `BG-101` (P1) revelação não acompanha o fim; 12 P2 (estado "revelada" não monotônico, remover convidado não bloqueia reentrada, botões presos em falha de escrita, "Carregando…" eterno, foco do Sheet, tela de revelação clara na Noite, SW apaga páginas guardadas, limites só no HTML, lost update, etc.) e P3 de acabamento (lista completa em `09`).
**Integração (lacunas para receber o Supabase):** `ITG-101..ITG-110` (6 P1): leitura escopada por papel, contratos v2, fotos por URL, autoridade do servidor, identidade/migração, plano com contradições.
**Infraestrutura (fora do código):** `INF-001` conector Supabase do Claude não enxerga o projeto `asyaegeodyttttaubvxh` (o projeto existe, segundo o usuário; é bloqueio de acesso do conector, não ausência de infraestrutura); `INF-002` produção serve o build antigo `3a8bf89` sem CSP/headers; `INF-003` projeto Vercel sem repositório vinculado.

## Achados mais importantes (todos conferidos no código pelo consolidador)
1. **BG-101 (P1)** `A1-001`: "ao terminar"/"N dias depois" viram data absoluta. Estender o fim 1 dia deixou a revelação 18 h antes do novo fim; "Encerrar agora" deixou 6 h de espera. Revelada não volta a esconder, então a exposição antecipada é irreversível. É o caminho padrão do wizard. `setEndIn`/`endEventNow` não tocam `revealAt`.
2. **ITG-101 (P1)** `A3-001/A1-005`: `useEventData` carrega todas as fotos para qualquer participante e `visiblePhotos` filtra depois; nenhum serviço recebe `Actor`. Um adaptador Supabase ingênuo exporia fotos bloqueadas e ocultas.
3. **ITG-102 (P1)** contratos sem paginação, erros tipados, versão ou idempotência; PostgREST trunca em 1000 linhas por padrão e feed, ranking, rolo e estatísticas ficariam errados sem erro.
4. **ITG-104 (P1)** `A4-004`: `reconcileReveal` roda em todo cliente, inclusive convidado, e grava `reveal_status`; o contador de rolo no cliente quebra sob RLS.
5. **BG-102 (P2)** `A1-002`: com o relógio do aparelho recuado, fotos voltam a ficar bloqueadas e o organizador volta a poder editar a revelação.
6. **BG-103 (P2)** `A1-003`: "Remover da festa" não impede a reentrada com o mesmo código.
7. **BG-106/BG-107/BG-108 (P2)** falhas de armazenamento: botões presos, carregamento eterno, confirmações falsas sem IndexedDB.
8. **INF-002** produção sem headers/CSP.

## O que está sólido (confirmado por evidência)
Nenhuma foto bloqueada aparece na interface do convidado (feed, Explorar, Você, Postar, retrospectiva, /editar, `<img>`, blob URLs, cache do service worker, rede); borda `now===revealAt` e fusos (Cuiabá, São Paulo, Lisboa com horário de verão) corretos; resumo, prévia e contagem mostram o mesmo instante no fuso do evento; convidado, outro organizador e `/master` com parâmetros não abrem painel nem master e não há senha fixa nem caminho master no código ou no bundle; sem segredos na árvore nem no histórico; sem XSS; EXIF/GPS descartados; Lighthouse acessibilidade/boas práticas/SEO 100.

## Limites da auditoria
Auditores são agentes de IA; nada foi executado em Safari/iOS, Firefox, celular físico ou câmera real; RLS, SQL e Realtime não foram executados (fase Supabase); o preview protegido foi acessado por link temporário oficial; AC-14 (notificações) e o texto de compartilhamento (AC-16) ficaram sem verificação. Os auditores usaram um build de teste com relógio de teste; a ausência do gancho no build de produção foi conferida no bundle de produção da cópia (A3) e no preview (consolidador).

## Entregáveis
`01`..`11` nesta pasta; evidências em `evidence/`; relatórios brutos em `drafts/`; backlog em `../backlog/`.
