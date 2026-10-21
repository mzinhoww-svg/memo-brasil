"""Consolida os achados brutos dos 4 auditores (evidence/logs/auditor-findings-raw.json) no backlog e gera 09/10.
Roda uma vez (idempotente: não recria itens existentes). Severidades dos auditores preservadas; agrupamentos documentados aqui."""
import json, os, collections
HERE = os.path.dirname(os.path.abspath(__file__)); AUD = os.path.join(HERE, ".."); BL = os.path.join(AUD, "..", "backlog", "backlog.json")
raw = json.load(open(os.path.join(AUD, "evidence", "logs", "auditor-findings-raw.json"), encoding="utf8")); R = {a["tid"]: a for a in raw}
d = json.load(open(BL, encoding="utf8")); by = {i["id"]: i for i in d["items"]}

# id: (tipo, natureza, epic, prio, status, deps, fontes, título)
G = {
 "BG-101": ("BUG","produto","EP-03","P1","READY",[],["A1-001"],"Revelação 'ao terminar' e 'N dias depois' não acompanha o fim do evento (estender/encerrar agora)"),
 "BG-102": ("BUG","produto","EP-03","P2","BACKLOG",["BG-101"],["A1-002"],"Estado 'revelada' não é monotônico: relógio atrasado reesconde fotos e destrava a edição"),
 "BG-103": ("BUG","produto","EP-01","P2","READY",[],["A1-003"],"'Remover da festa' não impede a reentrada com o mesmo código"),
 "BG-104": ("BUG","produto","EP-03","P2","READY",[],["A1-006","A1-014"],"Diálogo de revelação: foco, Escape, landmark e não bloquear a postagem"),
 "BG-105": ("BUG","produto","EP-04","P2","READY",[],["A3-008"],"Foco do Sheet volta ao primeiro controle a cada tick do relógio; fundo não inerte"),
 "BG-106": ("BUG","produto","EP-07","P2","READY",[],["A3-006"],"Falha de escrita deixa botões presos em 'ocupado' (wizard, entrar, ZIP)"),
 "BG-107": ("BUG","produto","EP-07","P2","READY",[],["A3-007"],"Falha de leitura vira 'Carregando a festa…' eterno"),
 "BG-108": ("BUG","produto","EP-05","P2","READY",[],["A2-005"],"Sem IndexedDB o app confirma ações que não persistem e o aviso global não aparece"),
 "BG-109": ("BUG","produto","EP-04","P2","READY",[],["A2-001"],"Tela de revelação inverte no tema Noite"),
 "BG-110": ("BUG","produto","EP-04","P2","READY",[],["A2-002"],"Seletor de evento do painel estoura com nome de 60 caracteres"),
 "BG-111": ("BUG","produto","EP-05","P2","BACKLOG",["BG-040"],["A2-004"],"Atualização do service worker apaga as páginas guardadas; pré-cache só de HTML"),
 "BG-112": ("BUG","produto","EP-06","P2","READY",[],["A3-009"],"Limites de campos só em maxLength; domínio e serviços não validam"),
 "BG-113": ("BUG","produto","EP-08","P2","BACKLOG",[],["A3-004","A1-011"],"Read-modify-write sem versão: lost update e ressurreição de evento"),
 "BG-120": ("BUG","produto","EP-02","P3","BACKLOG",[],["A1-007"],"react() e reportPhoto() aceitam foto ainda bloqueada"),
 "BG-121": ("BUG","produto","EP-03","P3","BACKLOG",[],["A1-008"],"Contagem zera enquanto a tela segue 'Aguardando' por até 15 s"),
 "BG-122": ("BUG","produto","EP-03","P3","BACKLOG",[],["A1-009","A1-010"],"Sem limite superior para a data da revelação; troca de fuso com erro genérico e prévia da versão salva"),
 "BG-123": ("BUG","produto","EP-02","P3","BACKLOG",[],["A1-012"],"Denúncia não é única por pessoa"),
 "BG-124": ("BUG","produto","EP-04","P3","BACKLOG",[],["A1-013"],"Textos inexatos na interface"),
 "BG-125": ("BUG","produto","EP-04","P3","BACKLOG",[],["A2-006"],"Fontes decorativas pré-carregadas em todas as rotas; fonte da interface sem preload"),
 "BG-126": ("BUG","produto","EP-07","P3","BACKLOG",[],["A2-007"],"jszip carregado ao abrir Downloads; sem import dinâmico"),
 "BG-127": ("BUG","produto","EP-04","P3","BACKLOG",[],["A2-009"],"Links abaixo de 44 px: 'Guia de componentes' e skip link"),
 "BG-128": ("BUG","produto","EP-04","P3","BACKLOG",[],["A2-010"],"Borda de chip abaixo de 3:1 (vem do CSS do kit) e tamanhos fixos fora dos tokens"),
 "BG-129": ("BUG","produto","EP-04","P3","BACKLOG",[],["A2-011"],"Faixa de abas do painel no mobile corta itens sem indício; CLS e h1 duplicado"),
 "BG-130": ("BUG","produto","EP-03","P3","BACKLOG",[],["A2-012"],"Exemplo com revelação em 2 minutos não mostra a espera ao anfitrião"),
 "BG-131": ("BUG","produto","EP-02","P3","BACKLOG",[],["A2-013"],"Imagens do feed sem lazy/decoding e /voce sem paginação"),
 "BG-132": ("BUG","produto","EP-06","P3","BACKLOG",[],["A3-010"],"Sem limite de dimensão/bytes de entrada no upload (PNG 20000×20000 aceito)"),
 "BG-133": ("BUG","produto","EP-06","P3","BACKLOG",[],["A3-011"],"CSP com 'unsafe-inline', sem COOP/CORP"),
 "BG-134": ("BUG","produto","EP-06","P3","BACKLOG",[],["A3-012"],"npm audit: 5 altas em dependências de desenvolvimento (cadeia do eslint-config-next)"),
 "BG-135": ("BUG","produto","EP-07","P3","BACKLOG",[],["A3-013"],"Dependências e exports não usados; contratos especulativos"),
 "BG-136": ("BUG","produto","EP-07","P3","BACKLOG",[],["A3-014"],"Escapes de tipo (7 asserções): revisar"),
 "BG-137": ("BUG","produto","EP-07","P3","BACKLOG",[],["A3-015"],"8 catch vazios; câmera não distingue a causa da falha"),
 "BG-138": ("BUG","produto","EP-07","P3","BACKLOG",[],["A3-016"],"URLs de objeto sem revogação no editor e no feed"),
 "BG-139": ("BUG","produto","EP-02","P3","BACKLOG",[],["A3-017"],"CSV separado por vírgula; Excel pt-BR espera ponto e vírgula"),
 "BG-140": ("BUG","produto","EP-03","P3","BACKLOG",[],["A3-018"],"Datas no fuso do aparelho, não do evento; formatação manual"),
 "BG-141": ("BUG","produto","EP-06","P3","BACKLOG",[],["A3-019"],"Todas as páginas são Client Components; /design e /master públicos em produção"),
 "BG-142": ("BUG","produto","EP-07","P3","BACKLOG",[],["A3-020"],"tsconfig inclui e2e/: erro de tipo em spec quebra next build (reproduzido nesta auditoria)"),
 "BG-143": ("BUG","produto","EP-06","P3","BACKLOG",[],["A3-021"],"Nome e fotos persistem localmente depois de 'sair'"),
 "BG-150": ("TASK","produto","EP-06","P3","DEFERRED",[],["A1-015"],"Risco aceito pré-backend: alterar meta.user para o hostId vira anfitrião"),
 "ITG-101": ("FEATURE","integração","EP-08","P1","BACKLOG",["BG-101","BG-102","ITG-106"],["A3-001","A1-005","A1-004","A4-006"],"Leitura escopada por papel: serviços recebem Actor; fotos bloqueadas nunca chegam ao cliente; convite sem expor evento"),
 "ITG-102": ("FEATURE","integração","EP-08","P1","BACKLOG",["ITG-106","BG-113"],["A3-003","A4-002","A4-003"],"Contratos de repositório v2: paginação, contagem, erros tipados, versão e idempotência"),
 "ITG-103": ("FEATURE","integração","EP-08","P1","BACKLOG",["ITG-102"],["A4-001","A4-009"],"Fotos por URL/miniatura e upload em duas fases com created_at do servidor"),
 "ITG-104": ("FEATURE","integração","EP-08","P1","BACKLOG",["BG-101","BG-102","ITG-106"],["A4-004","A4-005","A4-010","A4-011"],"Autoridade do servidor: revelação, rolo, limites e relógio"),
 "ITG-105": ("FEATURE","integração","EP-08","P1","BACKLOG",["ITG-102"],["A4-007","A4-008"],"Identidade (auth.uid) e migração local→nuvem compatíveis com o esquema"),
 "ITG-106": ("TASK","integração","EP-08","P1","READY",[],["A4-005","A4-008"],"Corrigir contradições do INTEGRATION-PLAN e fechar decisões de produto pendentes"),
 "ITG-107": ("FEATURE","integração","EP-08","P2","BACKLOG",["ITG-106"],["A4-014","A3-005"],"Convites: id, rotação, expiração, ?mesa= confiável e limite de tentativas (código ~39,6 bits)"),
 "ITG-108": ("TASK","integração","EP-08","P2","BACKLOG",["ITG-106"],["A4-013"],"Ambiente (env), CSP para o Supabase e suíte de contrato reutilizável"),
 "ITG-109": ("TASK","integração","EP-08","P2","BACKLOG",["ITG-106"],["A3-002","A4-012"],"Matriz de papéis × RLS e proteção de servidor para /master"),
 "ITG-110": ("TASK","integração","EP-08","P3","BACKLOG",["ITG-102"],["A4-015"],"Tipos TypeScript × Postgres (datas, enums, opcionais)"),
}
INFRA = [
 ("INF-002","TASK","EP-10","P2","BLOCKED",["REL-001"],[],"Produção serve o build antigo (3a8bf89): sem headers/CSP e sem correções da auditoria anterior","O alias de produção aponta para o primeiro deploy. Resolver promovendo o preview validado, só com autorização (REL-001)."),
 ("INF-003","TASK","EP-10","P3","BACKLOG",[],[],"Projeto Vercel sem repositório vinculado: deploys foram criados por API com gitSource","Sem integração Git automática. Decidir se vincula o repositório (Root Directory web) ou mantém deploy manual documentado."),
 ("AUD-002","TASK","EP-10","P1","BACKLOG",["BG-101","ITG-101","ITG-102","ITG-103","ITG-104","ITG-105","ITG-106"],[],"Reauditoria dos P1 após as correções (gate para iniciar a fase Supabase)","Reexecutar as frentes A1 e A4 e os testes de exposição sobre as correções; só então liberar EP-09."),
]
SEV = {"P0":0,"P1":1,"P2":2,"P3":3}
def mk(id, typ, kind, epic, prio, status, deps, src, title):
    fs = [R[s] for s in src]
    acc = []
    for f in fs:
        if f.get("fix"): acc.append(f"[{f['tid']}] Corrigir: {f['fix']}")
    for f in fs:
        if f.get("regression_test"): acc.append(f"[{f['tid']}] Teste de regressão: {f['regression_test']}")
    files = sorted({x for f in fs for x in f.get("files", [])})
    ev = ["docs/audit/drafts/" + ("A%s.md" % src[0][1]) if src else ""] + [f["evidence"] for f in fs if f.get("evidence")]
    desc = (" ".join(f["description"] for f in fs) if fs else title)[:1800]
    return dict(id=id, type=typ, title=title, description=desc, epic=epic, parent=None, priority=prio, status=status, dependencies=deps,
        origin="auditoria AUD-001 · " + ", ".join(src) + f" · natureza: {kind}", acceptance=acc[:8] or ["Definir critérios"], files=files, tests=[], evidence=[e for e in ev if e][:4],
        commit=None, environment=None, effort=max([f.get("effort","S") for f in fs], key=lambda e: "SML".index(e)) if fs else "S", sources=src, severity_audit=[f["severity"] for f in fs])
new = []
for id,(typ,kind,epic,prio,status,deps,src,title) in G.items():
    if id not in by: new.append(mk(id,typ,kind,epic,prio,status,deps,src,title))
for id,typ,epic,prio,status,deps,src,title,desc in INFRA:
    if id not in by: new.append(dict(id=id,type=typ,title=title,description=desc,epic=epic,parent=None,priority=prio,status=status,dependencies=deps,origin="auditoria AUD-001 · infraestrutura",acceptance=[desc],files=[],tests=[],evidence=["docs/audit/07-VERCEL-DEPLOYMENT.md"],commit=None,environment=None,effort="S",sources=[],severity_audit=[]))
d["items"] += new; by = {i["id"]: i for i in d["items"]}
# itens existentes: vínculos e duplicidades
def link(i, tids, note):
    by[i]["origin"] += " · auditoria: " + ", ".join(tids); by[i].setdefault("sources", []).extend(tids)
    by[i]["description"] += f" [{note}]"
link("BG-040", ["A2-003"], "A2-003 confirmou: só URLs já visitadas abrem offline; /retrospectiva, /painel/ID/qr e outros códigos caem em /offline")
link("BG-042", ["A2-014"], "A2-014: chaves com código do convite/UUID, evicção e troca silenciosa")
link("BG-020", ["A2-008"], "A2-008: manifest sem variante escura e com orientação travada")
link("BG-062", ["A2-013"], "A2-013: /voce sem paginação; 200 fotos medidas: 1,7 s e heap ≈10 MB")
by["BG-021"]["status"] = "CANCELLED"; by["BG-021"]["description"] += " [Consolidado em BG-110 (A2-002): a auditoria mediu o estouro]"
by["BG-051"]["status"] = "BACKLOG"; by["BG-051"]["description"] += " [A3-012: produção 0 vulnerabilidades; 5 altas só em desenvolvimento; ver BG-134]"
by["BG-051"]["acceptance"] = ["Produção sem alta/crítica (confirmado: 0)", "Exceção das 5 altas de desenvolvimento documentada em BG-134"]
by["BG-051"]["status"] = "CANCELLED"; by["BG-051"]["description"] += " [Substituído por BG-134]"
by["BG-071"]["dependencies"] = sorted(set(by["BG-071"]["dependencies"] + ["ITG-102"]))
# EP-09: trocar AUD-001 por AUD-002 e ligar às correções de integração
extra = {"FT-080":["ITG-105"],"FT-082":["ITG-104","ITG-109","ITG-106"],"FT-083":["ITG-104"],"FT-084":["ITG-102"],"FT-085":["ITG-103"],"FT-087":["ITG-101"],"FT-088":["ITG-109"],"FT-089":["ITG-105"]}
for k, v in by.items():
    if v["epic"] == "EP-09":
        v["dependencies"] = [x for x in v["dependencies"] if x != "AUD-001"]
        for x in ["AUD-002"] + extra.get(k, []):
            if x not in v["dependencies"]: v["dependencies"].append(x)
by["AUD-001"]["status"] = "DONE"; by["AUD-001"]["tests"] = ["web/e2e/audit-a1-*.spec.ts (29 testes)", "web/e2e/audit-a2-*.spec.ts", "web/e2e/audit-a3-*.spec.ts", "linha de base: 131 unit + 46 E2E"]
by["AUD-001"]["evidence"] = ["docs/audit/00-EXECUTIVE-REPORT.md", "docs/audit/09-FINDINGS-REGISTER.md", "docs/audit/11-RELEASE-GATE.md", "docs/audit/evidence/"]
by["AUD-001"]["environment"] = "local (build de produção/teste, Chromium) + inspeção Vercel/Supabase somente leitura"
json.dump(d, open(BL, "w", encoding="utf8"), ensure_ascii=False, indent=1)

# ---------- 09 registro ----------
disp = {}
for id,(typ,kind,epic,prio,status,deps,src,title) in G.items():
    for s in src: disp.setdefault(s, []).append(id)
disp.update({"A2-003":["BG-040"],"A2-008":["BG-020"],"A2-014":["BG-042"]})
sec = {"P0":[], "P1":[], "P2":[], "P3":[]}
for a in raw: sec[a["severity"]].append(a)
cnt = {k: len(v) for k, v in sec.items()}
VER = {"A1-001","A1-002","A1-003","A4-004","A3-006","A3-007","A3-008","A2-001"}
out = ["# 09 · Registro de achados", "", f"Achados brutos dos 4 auditores independentes: **{len(raw)}** (P0 {cnt['P0']}, P1 {cnt['P1']}, P2 {cnt['P2']}, P3 {cnt['P3']}). Itens de infraestrutura registrados à parte (INF-*). Severidades são as dos auditores; o consolidador agrupou duplicidades em itens de backlog (coluna Backlog) e conferiu no código as marcadas com ✔ (`evidence/logs/consolidator-verification.txt`).", "",
 "## Produto × integração × infraestrutura", "- **Produto**: defeito ou lacuna do app como está (itens BG-*).", "- **Integração**: lacuna que o app pré-backend tem para receber o Supabase (itens ITG-*); não é defeito do uso local.", "- **Infraestrutura**: ambiente e acesso, fora do código (INF-001 conector Supabase do Claude; INF-002 produção com build antigo; INF-003 projeto Vercel sem Git).", "",
 "| ID | Sev. | Fonte | Área | Título | Backlog | Verif. |", "|---|---|---|---|---|---|---|"]
for a in raw: out.append(f"| {a['tid']} | {a['severity']} | {a['_src']} | {a['area']} | {a['title'][:90]} | {', '.join(disp.get(a['tid'], ['-']))} | {'✔' if a['tid'] in VER else ''} |")
out += ["", "## Infraestrutura (fora do código)", "| ID | Sev. | Título | Status |", "|---|---|---|---|",
 "| INF-001 | P1 | Conector Supabase do Claude não enxerga o projeto asyaegeodyttttaubvxh (organização/conta divergente; o projeto existe, segundo o usuário) | READY |",
 "| INF-002 | P2 | Produção serve o build antigo 3a8bf89 | BLOCKED (REL-001) |", "| INF-003 | P3 | Projeto Vercel sem repositório vinculado | BACKLOG |", ""]
for sev in ("P0","P1","P2","P3"):
    out.append(f"## {sev} ({len(sec[sev])})"); out.append("")
    if not sec[sev]: out += ["Nenhum achado.", ""]
    for a in sec[sev]:
        out += [f"### {a['tid']} · {a['title']}", f"- **Severidade:** {a['severity']} · **Área:** {a['area']} · **Esforço:** {a.get('effort','?')} · **Backlog:** {', '.join(disp.get(a['tid'], ['-']))}" + (" · **Verificado pelo consolidador**" if a['tid'] in VER else ""),
                f"- **Descrição:** {a['description']}", f"- **Evidência:** {a.get('evidence','')}", f"- **Arquivos:** {', '.join(a.get('files', [])) or '-'}", f"- **Reprodução:** {a.get('repro','')}",
                f"- **Impacto:** {a.get('impact','')}", f"- **Causa provável:** {a.get('cause','')}", f"- **Correção recomendada:** {a.get('fix','')}", f"- **Teste de regressão:** {a.get('regression_test','')}",
                f"- **Dependências:** {', '.join(a.get('depends_on', [])) or '-'}", ""]
open(os.path.join(AUD, "09-FINDINGS-REGISTER.md"), "w", encoding="utf8").write("\n".join(out))

# ---------- 10 backlog de correção ----------
items = {i["id"]: i for i in d["items"]}
def row(i): return f"| {i['id']} | {i['priority']} | {i['title'][:100]} | {i['status']} | {', '.join(i['dependencies']) or '-'} | {i.get('effort','-')} |"
waves = [("Onda 1 · P1 de produto e destravamento de acesso", ["BG-101","INF-001","ITG-106"]),
 ("Onda 2 · robustez e experiência (P2 prontos, sem dependência)", ["BG-103","BG-104","BG-105","BG-106","BG-107","BG-108","BG-109","BG-110","BG-112"]),
 ("Onda 3 · semântica da revelação e contratos (P1 de integração)", ["BG-102","BG-113","ITG-101","ITG-102","ITG-104"]),
 ("Onda 4 · fotos, identidade e convites", ["ITG-103","ITG-105","ITG-107","ITG-108","ITG-109","BG-040","BG-111"]),
 ("Onda 5 · reauditoria e gate", ["AUD-002"]),
 ("Onda 6 · P3 (fila de melhorias)", sorted([k for k in items if k.startswith("BG-1") and items[k]["priority"]=="P3"]) + ["ITG-110","INF-003"]),
 ("Bloqueado por decisão do dono", ["REL-001","INF-002"])]
o = ["# 10 · Backlog de correção (priorizado)", "", "Fonte de verdade: `docs/backlog/backlog.json` (IDs preservados). Esta é a visão por ondas; dependências e critérios de aceitação estão no JSON e em `docs/backlog/BACKLOG.md`. Nenhuma correção foi feita durante a auditoria.", "",
 "**Caminho crítico até o Supabase:** `BG-101` (revelação acompanha o fim) → `BG-102` (monotônica) ∥ `ITG-106` (plano sem contradições) → `ITG-101`/`ITG-104` (leitura escopada e autoridade do servidor) e `ITG-102` (contratos v2) → `ITG-103`/`ITG-105` → `AUD-002` (reauditoria) → EP-09 (`FT-080…FT-089`). `INF-001` (acesso do conector) corre em paralelo e bloqueia só a execução no banco.", ""]
for t, ids in waves:
    o += [f"## {t}", "| ID | Prio | Título | Status | Depende de | Esforço |", "|---|---|---|---|---|---|"] + [row(items[i]) for i in ids if i in items] + [""]
open(os.path.join(AUD, "10-REMEDIATION-BACKLOG.md"), "w", encoding="utf8").write("\n".join(o))
print("novos itens:", len(new), "| brutos:", cnt)
