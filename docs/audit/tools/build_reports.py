import json, re, os
AUD = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
def rd(p): return open(os.path.join(AUD, p), encoding="utf8").read()
def body(n):
    t = rd(f"drafts/{n}.md"); i = t.rfind("```json"); return (t[:i] if i > 0 else t).strip()
def sec(t, a, b=None):
    i = t.index(a); j = t.index(b, i + 1) if b and b in t[i + 1:] else len(t); return t[i:j].strip()
def w(n, txt): open(os.path.join(AUD, n), "w", encoding="utf8").write(txt.strip() + "\n")
raw = json.load(open(os.path.join(AUD, "evidence/logs/auditor-findings-raw.json"), encoding="utf8")); R = {a["tid"]: a for a in raw}
def flist(tids): return "\n".join(f"- **{t}** ({R[t]['severity']}) {R[t]['title']}. Evidência: {R[t].get('evidence','')[:160]}" for t in tids if t in R)
A1, A2, A3, A4 = body("A1"), body("A2"), body("A3"), body("A4")
cnt = {k: sum(1 for a in raw if a["severity"] == k) for k in ("P0","P1","P2","P3")}
crit = [("Funcionalidade (jornadas, regras do REA, revelação)",25,8.0,"46 E2E + 29 testes de auditoria passam; critérios AC e F confirmados por evidência. Desconta: P1 BG-101 (revelação 'ao terminar' não acompanha o fim, caminho padrão do wizard) e 5 P2 de revelação/papéis"),
 ("Fidelidade visual ao Design System v1",15,9.0,"Classes mm-* idênticas às do kit; 284 estados capturados sem contraste <4,5:1 (exceto desabilitado), sem sombra/gradiente/emoji; desconta: revelação invertida na Noite, estouro do seletor do painel"),
 ("Arquitetura e qualidade de código",15,7.0,"Camadas claras, domínio puro e testado. Desconta: visibilidade só em filtro de UI, contratos de repositório locais, todas as páginas como Client Components, erros engolidos"),
 ("Segurança (cliente pré-backend)",15,7.5,"Sem segredos (árvore e histórico), sem XSS, sem requisição externa, EXIF/GPS descartados, produção 0 vulnerabilidades. Desconta: sem limite de dimensão no upload, CSP com unsafe-inline, autorização só de UI (inerente ao pré-backend)"),
 ("Testes automatizados",10,8.5,"131 unitários, 46 E2E, paridade com o kit, axe, revelação com relógio falso. Desconta: sem WebKit/Firefox, SW sem teste unitário, hooks sem teste"),
 ("PWA e offline",5,6.5,"Manifest e instalabilidade ok; offline só para URLs visitadas; atualização do SW apaga páginas guardadas"),
 ("Performance",5,9.0,"Lighthouse mobile 93–95 (LCP 2,9–3,3 s simulado), desktop 100 (exceto CLS no painel sem dados); 200 fotos em 1,7 s"),
 ("Prontidão para o Supabase",10,5.0,"Domínio pronto; contratos 'inadequados' em 7 pontos; plano com contradições; sem env, tipos nem suíte de contrato v2")]
total = sum(c[1] * c[2] for c in crit) / 100
pre = sum(c[1] * c[2] for c in crit[:-1]) / sum(c[1] for c in crit[:-1])
ctab = "| Critério | Peso | Nota (0–10) | Justificativa |\n|---|---|---|---|\n" + "\n".join(f"| {a} | {b}% | {c:.1f} | {d} |" for a, b, c, d in crit)
w("00-EXECUTIVE-REPORT.md", f"""# 00 · Relatório executivo da auditoria independente (AUD-001)

Data: 2026-10-21 · Alvo: `feat/memoriesmt` @ `3266e26` (preview validado em `5d8df4a`; commits posteriores só documentação) · Método: 4 auditores independentes (agentes de IA sem acesso às minhas conclusões) + linha de base e verificações do consolidador. Os auditores trataram os documentos de QA do autor como afirmações a verificar, não como requisitos.

## Resposta objetiva
**"O MemoriesMT está pronto para integrar o Supabase sem retrabalho estrutural significativo?" Ainda não.** O domínio, a interface e a revelação programada estão sólidos para a fase pré-backend, mas os contratos de repositório foram desenhados para armazenamento local e confiável, a visibilidade das fotos só existe como filtro de interface e o plano de integração tem contradições. O retrabalho é **moderado e localizado** (contratos, leitura por papel, autoridade do servidor, identidade), estimado pelo auditor A4 em 2 a 3 semanas antes de escrever o DDL. Não é reescrita do produto.

## Decisão: **NO-GO para iniciar a integração agora** (caminho curto para CONDITIONAL GO)
- P0: **{cnt['P0']}**. P1: **{cnt['P1']}** achados brutos, agrupados em **7 itens de backlog** (1 de produto, 6 de integração). P2: **{cnt['P2']}**. P3: **{cnt['P3']}**. Total bruto: **{len(raw)}**. Mais 3 itens de infraestrutura (INF-001..003).
- Vira **CONDITIONAL GO** quando: `BG-101` e `ITG-101..ITG-106` estiverem DONE e `AUD-002` (reauditoria) passar. Detalhes em `11-RELEASE-GATE.md` e `10-REMEDIATION-BACKLOG.md`.

## Nota geral de maturidade: **{total:.1f} / 10** (pré-backend, sem contar Supabase: {pre:.1f})
{ctab}
Pesos são do auditor consolidador e podem ser contestados; as notas são julgamento sobre as evidências citadas, não medição. A soma ponderada é {total:.2f}.

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
""")
w("01-FUNCTIONAL-COVERAGE.md", f"""# 01 · Cobertura funcional

Auditor A1 (relatório integral abaixo; rascunho: `drafts/A1.md`). Evidência: `evidence/test-results/a1-*.json`, `evidence/logs/a1-*.txt`, `evidence/screenshots/a1-*.png`; specs `web/e2e/audit-a1-*.spec.ts` (29 testes, todos passando na última rodada).

**Veredito do consolidador:** cobertura funcional **alta** para o escopo pré-backend; 1 P1 (BG-101) e 5 P2 de revelação/papéis. Não se classificou como defeito a ausência de colaboração real, login e storage remoto (reservados à fase Supabase), mas os contratos para isso estão avaliados em `08`.

{A1}
""")
vis_tab = sec(A2, "| Verificação | Resultado |", "Lighthouse (produção")
w("02-VISUAL-COMPLIANCE.md", f"""# 02 · Conformidade visual com o MemoriesMT Design System v1

Auditor A2. Evidência: `evidence/screenshots/a2-*.png` (227 capturas; 4 larguras × 2 temas), `evidence/test-results/a2-crawl-*.json`, `a2-kit-compare.json`, `a2-focus.json`, `a2-overflow.json`. Medição por estilos computados, dimensões e tokens, não por impressão visual.

**Veredito:** **fiel ao kit.** As classes `mm-*` do app são idênticas às do kit; 48 classes com estilo computado idêntico nas prévias do kit e no app, nos dois temas. Desvios reais: tela de revelação clara na Noite (A2-001), seletor de evento do painel estoura com 60 caracteres (A2-002), dois links <44 px (A2-009), borda de chip abaixo de 3:1 que vem do CSS do próprio kit (A2-010).

{vis_tab}

## Achados desta frente
{flist(['A2-001','A2-002','A2-009','A2-010','A2-011','A2-012'])}

Itens do kit, não do app: o contraste da borda do chip (1,46 Dia / 1,54 Noite) vem de `componentes.css` do kit; o app o reproduz fielmente. Decisão a tomar com o dono do design system (BG-128).
""")
w("03-ARCHITECTURE-REVIEW.md", f"""# 03 · Revisão de arquitetura e qualidade

Auditor A3 (rascunho `drafts/A3.md`) com apoio do A4 sobre contratos. Evidência: `evidence/logs/a3-*`, `evidence/test-results/a3-*`.

**Veredito:** camadas bem separadas (domínio puro, repositórios, serviços, componentes do kit) e testáveis, mas **a regra de visibilidade vive na interface** e os contratos de repositório são locais. Todas as páginas são Client Components (A3-019), há 8 `catch` vazios (A3-015) e 7 asserções de tipo (A3-014). O frontend **não** poderá receber adaptadores Supabase sem retrabalho nos pontos de ITG-101..ITG-103.

## Achados de arquitetura e qualidade
{flist(['A3-001','A3-002','A3-003','A3-004','A3-006','A3-007','A3-008','A3-009','A3-013','A3-014','A3-015','A3-016','A3-018','A3-019','A3-020'])}

## Relatório do auditor A3 (integral)
{A3}
""")
w("04-SECURITY-REVIEW.md", f"""# 04 · Revisão de segurança

Auditor A3 + verificação do consolidador. Nada destrutivo; só local. Evidência: `evidence/logs/a3-*`, `evidence/test-results/a3-upload*.json`, `npm-audit-*.json`, `vercel-prod-headers.txt`.

**Veredito:** **sem segredos, sem XSS, sem requisição externa.** EXIF/GPS são descartados (reencode em canvas) e SVG com script é rasterizado sem executar. Riscos: upload sem limite de dimensão (PNG 20000×20000 aceito, A3-010), CSP com `unsafe-inline` (A3-011), autorização só de interface (inerente ao pré-backend, vira requisito de RLS em ITG-101/ITG-109), código de convite de ~39,6 bits (exige limite de tentativas e RPC no backend, ITG-107). `npm audit`: produção **0**; 5 altas em dependências de desenvolvimento (cadeia do eslint-config-next), inalcançáveis em runtime (BG-134). **Produção ainda serve o build antigo sem CSP/headers (INF-002).**

## Modelo de autorização futuro
`can()` é contrato de UI, não segurança. Faltam: serviços recebendo `Actor`, matriz de papéis × RLS por tabela, proteção de servidor para `/master` (claim `app_metadata.role`, nunca senha ou URL), proteção contra IDOR por id de evento e enumeração de código. Registrados em ITG-101 e ITG-109.

## Achados de segurança
{flist(['A3-001','A3-002','A3-005','A3-010','A3-011','A3-012','A3-017','A3-021','A1-003','A1-012','A1-015','A4-006','A4-012','A4-014'])}
""")
pwa_tab = sec(A2, "PWA:", "## Confirmado")
w("05-PWA-REVIEW.md", f"""# 05 · Revisão de PWA

Auditor A2. Evidência: `evidence/test-results/a2-pwa.json`, `a2-offline-post.json`, screenshots `a2-pwa-*` e `a2-idb-*`.

**Veredito:** manifest válido e instalável; **offline parcial.** Postar foto offline funciona e persiste; páginas já visitadas abrem offline; **rotas nunca visitadas caem em `/offline`** (A2-003) e **cada atualização do SW apaga as páginas guardadas**, recacheando só a casca (A2-004). Sem IndexedDB o app segue em memória e confirma ações que não persistem (A2-005). Não se declara suporte offline completo.

{pwa_tab}

## Achados
{flist(['A2-003','A2-004','A2-005','A2-008','A2-014'])}
""")
perf = sec(A2, "Lighthouse (produção", "PWA:")
w("06-PERFORMANCE-REPORT.md", f"""# 06 · Relatório de performance

Auditor A2. Ambiente: Apple M4, macOS, Chromium do Playwright 1.64, Lighthouse 13.5.0 (headless). Performance medida numa **cópia de produção sem relógio de teste** (porta 3312). Lighthouse mobile = simulado (4x CPU, 1,6 Mbps, 150 ms). Evidência: `evidence/test-results/a2-lighthouse-*.json`, `a2-perf-*.json`.

**Veredito:** boa. Lighthouse acessibilidade/boas práticas/SEO 100 em todas as rotas; performance mobile 93–95 (LCP 2,9–3,3 s simulado), desktop 100 (exceto CLS 0,322 no painel sem dados, estado "não achamos o evento" do perfil novo). Com dados: LCP mobile ≈2,2 s, CLS ≈0. 200 fotos: feed paginado, 200 imagens em 1,7 s, heap JS ≈10 MB. Pontos a melhorar: jszip carregado ao abrir Downloads (A2-007), fontes decorativas pré-carregadas em todas as rotas (A2-006), imagens sem lazy/decoding e /voce sem paginação (A2-013), nenhum `import()` dinâmico.

{perf}

## Achados
{flist(['A2-006','A2-007','A2-013'])}
""")
w("07-VERCEL-DEPLOYMENT.md", """# 07 · Vercel

Inspeção somente leitura pelo conector Vercel (consolidador) + smoke remoto. Evidência: `evidence/logs/vercel-supabase-inspection.md`, `vercel-prod-headers.txt`, `test-results/e2e-baseline.json`.

| Item | Estado |
|---|---|
| Projeto | `newmemocuiaba` (`prj_IpHyqsnnbrXS213AGrOmxizb0Kjl`), time `mzinhoww-gmailcoms-projects`; framework Next.js, Root Directory `web`, Node 24.x |
| Repositório | **Não vinculado** ao projeto: deploys criados pela API com `gitSource` (INF-003) |
| Variáveis de ambiente | **Nenhuma** (sem segredos no projeto) |
| Domínios | Só `*.vercel.app` |
| Deployments | `dpl_2vNJ…` **production** 3a8bf89 (primeiro build, READY); `dpl_7VdcB…` preview 7e0f9ec; `dpl_Cq1ot…` preview **5d8df4a** (READY, validado) |
| Runtime | Sem erros nas últimas 24 h |
| Preview vs produção | **Divergentes**: produção serve 3a8bf89 (sem CSP, sem X-Frame-Options, sem correções da auditoria anterior); só HSTS vindo da Vercel (INF-002) |
| Proteção do preview | SSO da Vercel (302); acesso por link temporário oficial; proteção **não** removida |
| Smoke remoto no preview 5d8df4a | 5/5 passaram: home, fontes, tema, manifest, SW; criar evento/entrar/postar/reagir; painel e rota inexistente offline; headers, 404 pt-BR e ausência do relógio de teste no bundle; revelação programada com relógio do navegador e sem rede |
| Promoção a produção | **Não feita** e **bloqueada** (REL-001): destino não confirmado pelo dono para promoção |

**Limite:** o smoke remoto cobre os fluxos testados, não o produto inteiro; a home funcional não prova o restante (por isso foram rodados fluxos de criação, convidado, painel e revelação).

## Achados de infraestrutura
- **INF-002 (P2):** produção com build antigo e sem headers/CSP. Resolver promovendo o preview validado, só com autorização.
- **INF-003 (P3):** projeto sem Git vinculado. Decidir entre vincular (Root Directory `web`) ou manter deploy manual documentado.
- **INF-001 (P1):** conector Supabase do Claude não enxerga o projeto de destino. Ver `08`.
""")
w("08-SUPABASE-READINESS.md", f"""# 08 · Prontidão para o Supabase

Auditor A4 (somente leitura; nenhum SQL, migration, MCP do Supabase ou deploy). Rascunho: `drafts/A4.md`. Evidência: `evidence/logs/a4-*.txt`.

## Bloqueio de infraestrutura (separado dos achados de produto)
**INF-001 (P1).** O usuário informou que o projeto `newmemocuiaba` (ref `asyaegeodyttttaubvxh`, organização `zpnbwkmukywzlkxdfeja`, us-west-2, PostgreSQL 17, ACTIVE_HEALTHY) **existe e está ativo**, confirmado pelo plugin Supabase do ChatGPT. O conector Supabase do Claude lista apenas 6 projetos de outra organização (`vercel_icfg_…`, sa-east-1) e **não enxerga** esse projeto. É **bloqueio de acesso do conector** (conta, organização ou permissões), não ausência de infraestrutura, e a auditoria não tem como confirmar nem negar o estado do projeto. Tarefa `INF-001`: reconectar o conector à organização correta, validar `list_projects`/`get_project` em leitura, sem escrever. `newmemocuiaba` também é o nome do projeto **Vercel**.

## Veredito do auditor A4
{A4}

## Pendências antes das migrations (consolidadas no backlog)
`ITG-101` leitura escopada por papel · `ITG-102` contratos v2 · `ITG-103` fotos por URL e upload em duas fases · `ITG-104` autoridade do servidor (revelação, rolo, limites, relógio) · `ITG-105` identidade e migração · `ITG-106` contradições do plano (autor lê a própria foto antes da revelação? `reveal_status` espelhado ou derivado? `participants` × `event_members`; `invitations`) · `ITG-107` convites · `ITG-108` env/CSP/suíte de contrato · `ITG-109` papéis × RLS · `ITG-110` tipos.
""")
w("11-RELEASE-GATE.md", f"""# 11 · Release gate

## Resultado: **NO-GO para a integração Supabase agora**
Motivo objetivo: P1 abertos que bloqueiam a integração (definição do próprio gate): `BG-101` (revelação acompanhar o fim do evento) e `ITG-101..ITG-106` (leitura escopada, contratos, fotos por URL, autoridade do servidor, identidade/migração, plano contraditório). **Não há P0.** Nenhum item exige reescrever o produto.

| Condição para GO / CONDITIONAL GO | Estado |
|---|---|
| Nenhum P0 aberto | ✔ (0) |
| Nenhum P1 que bloqueie integração | ✘ (7 itens) |
| Jornadas locais principais validadas | ✔ (46 E2E + 29 de auditoria) |
| Design system suficientemente aderente | ✔ |
| Contratos de dados definidos | ✘ parcial (ITG-102/103) |
| Testes críticos passando | ✔ (131 unitários, 46 E2E, 5 remotos) |
| Deploy Vercel verificado | ✔ preview 5d8df4a; ✘ produção desatualizada (INF-002) |
| Acesso do conector Supabase | ✘ INF-001 |

## O que leva a CONDITIONAL GO
1. `BG-101`, depois `BG-102` (semântica da revelação).
2. `ITG-106` (plano sem contradições e decisões de produto fechadas).
3. `ITG-101`, `ITG-102`, `ITG-104`, depois `ITG-103`, `ITG-105`.
4. `INF-001` resolvido em paralelo (acesso do conector, só leitura).
5. `AUD-002` (reauditoria dos P1). Só então liberar EP-09 (`FT-080…FT-089`).
Pendências **exclusivas da fase Supabase** ficam DEFERRED até o gate.

## Riscos aceitos pré-backend (documentados)
Qualquer pessoa altera IndexedDB/código local (meta.user com o `hostId` vira anfitrião: `BG-150`); a foto bloqueada existe no aparelho do próprio convidado; sem colaboração entre aparelhos; cada identidade local tem seu rolo.

## Sequência de execução
Ver `10-REMEDIATION-BACKLOG.md` (ondas e caminho crítico) e `../backlog/RELEASE-GATES.md`. Próximos itens READY: `BG-101` (P1), `INF-001` (P1), `ITG-106` (P1) e 10 P2.
""")
open(os.path.join(AUD, "evidence", "README.md"), "w", encoding="utf8").write("""# Evidências da AUD-001
- `logs/`: linha de base (typecheck, lint, 131 unitários, build, `npm audit`, E2E), inspeção Vercel/Supabase, cabeçalhos de produção, verificação do consolidador e logs dos auditores (a1-, a3-, a4-).
- `test-results/`: JSON do Playwright da linha de base (`e2e-baseline.json`) e dos specs de auditoria (a1-, a2- incluindo Lighthouse, a3-).
- `screenshots/`: 242 capturas (a1- e a2-; 4 larguras × 2 temas nas rotas e estados de revelação).
- Specs de auditoria: `web/e2e/audit-a*-*.spec.ts` (fora da suíte regular; rodam com `web/playwright.audit.config.ts`).
- Nenhum segredo nos artefatos. O link temporário de acesso ao preview não foi gravado.
""")
print("ok", f"{total:.2f}", f"{pre:.2f}")
