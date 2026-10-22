#!/usr/bin/env python3
"""Valida docs/backlog/backlog.json e regera BACKLOG.md, DEPENDENCY-GRAPH.md, TRACEABILITY-MATRIX.md e RELEASE-GATES.md.
Uso: python3 docs/backlog/tools/backlog.py [--next]   (--next lista só os próximos itens READY)
Regras: IDs únicos e persistentes; dependências existem e não formam ciclo; DONE exige testes ou evidência E commit;
todo requisito tem cobertura ou justificativa de exclusão; item não-DONE precisa de critérios de aceitação."""
import json, os, sys, collections
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, ".."); J = os.path.join(ROOT, "backlog.json")
data = json.load(open(J, encoding="utf8")); items = data["items"]; by = {i["id"]: i for i in items}
STATUS = data["meta"]["workflow"] + data["meta"]["extra"]; PR = {"P0": 0, "P1": 1, "P2": 2, "P3": 3}
err = []
if len(by) != len(items): err.append("IDs duplicados: " + ", ".join(k for k, v in collections.Counter(i["id"] for i in items).items() if v > 1))
for i in items:
    if i["status"] not in STATUS: err.append(f"{i['id']}: status inválido {i['status']}")
    if i["priority"] not in PR: err.append(f"{i['id']}: prioridade inválida")
    for d in i["dependencies"]:
        if d not in by: err.append(f"{i['id']}: dependência inexistente {d}")
    if i["parent"] and i["parent"] not in by: err.append(f"{i['id']}: pai inexistente {i['parent']}")
    if i["type"] != "EPIC":
        if i["status"] == "DONE" and not (i["tests"] or i["evidence"]): err.append(f"{i['id']}: DONE sem testes nem evidência")
        if i["status"] == "DONE" and not i["commit"]: err.append(f"{i['id']}: DONE sem commit")
        if i["status"] in ("READY", "IN_PROGRESS", "IN_REVIEW", "TESTING", "BLOCKED") and not i["acceptance"]: err.append(f"{i['id']}: sem critérios de aceitação")
        if i["status"] == "READY":
            for d in i["dependencies"]:
                if by[d]["status"] != "DONE": err.append(f"{i['id']}: READY com dependência não concluída {d}")
        if i["status"] == "DONE":
            for d in i["dependencies"]:
                if by[d]["status"] not in ("DONE", "CANCELLED"): err.append(f"{i['id']}: DONE com dependência aberta {d}")
# ciclos
state = {}
def dfs(n, path):
    state[n] = 1
    for d in by[n]["dependencies"]:
        if d not in by: continue
        if state.get(d) == 1: err.append("ciclo: " + " -> ".join(path + [n, d]))
        elif d not in state: dfs(d, path + [n])
    state[n] = 2
for n in by:
    if n not in state: dfs(n, [])
for r in data["requirements"]:
    if not r["covers"] and not r["exclusion"]: err.append(f"requisito {r['id']} sem cobertura nem exclusão")
    for c in r["covers"]:
        if c not in by: err.append(f"requisito {r['id']}: item inexistente {c}")
if err:
    print("BACKLOG INVÁLIDO:"); [print(" -", e) for e in err]; sys.exit(1)

def ready():
    return sorted([i for i in items if i["status"] == "READY" and i["type"] != "EPIC"], key=lambda i: (PR[i["priority"]], i["id"]))
if "--next" in sys.argv:
    for i in ready(): print(i["priority"], i["id"], i["title"])
    sys.exit(0)

def tab(rows, head): return "| " + " | ".join(head) + " |\n|" + "---|" * len(head) + "\n" + "\n".join("| " + " | ".join(str(c) for c in r) + " |" for r in rows)
w = lambda n, t: open(os.path.join(ROOT, n), "w", encoding="utf8").write(t)
leaf = [i for i in items if i["type"] != "EPIC"]
cnt_p = collections.Counter(i["priority"] for i in leaf); cnt_s = collections.Counter(i["status"] for i in leaf)
# BACKLOG.md
out = ["# Backlog do MemoriesMT", "", "> Fonte de verdade: `backlog.json` (editar lá). Este arquivo é gerado por `tools/backlog.py`. Fluxo: BACKLOG → READY → IN_PROGRESS → IN_REVIEW → TESTING → DONE (+ BLOCKED, DEFERRED, CANCELLED). **DONE exige implementação, testes, evidência e documentação atualizada.**", "",
       f"Total: **{len(leaf)}** itens (sem contar {len(items)-len(leaf)} épicos). Prioridade: " + ", ".join(f"{k} {cnt_p.get(k,0)}" for k in PR) + ". Status: " + ", ".join(f"{k} {v}" for k, v in sorted(cnt_s.items())) + ".", "",
       "## Como retomar numa nova sessão", "1. Rode `python3 docs/backlog/tools/backlog.py` (valida e regenera). 2. `... --next` mostra o próximo item READY por prioridade. 3. Preserve os IDs; não recrie o que está DONE. 4. Ao concluir, preencha `tests`, `evidence`, `commit`, `environment` e mude o status. 5. Registre decisões em `docs/architecture/ARCHITECTURE.md`.", ""]
for eid, et in data["epics"].items():
    ep = by[eid]; mine = [i for i in leaf if i["epic"] == eid]
    out += [f"## {eid} · {et} ({ep['status']})", ""]
    out.append(tab([(i["id"], i["type"], i["title"], i["priority"], i["status"], ", ".join(i["dependencies"]) or "-", i["origin"], (i["commit"] or "-"), (i["environment"] or "-")) for i in sorted(mine, key=lambda x: (x["id"]))], ["ID", "Tipo", "Título", "Prio", "Status", "Depende de", "Origem", "Commit", "Ambiente"]))
    out.append("")
    for i in mine:
        if i["status"] != "DONE" and i["acceptance"]:
            out += [f"**{i['id']}** critérios: " + "; ".join(i["acceptance"]) + (f" · testes: {', '.join(i['tests'])}" if i["tests"] else ""), ""]
w("BACKLOG.md", "\n".join(out))
# TRACEABILITY
rows = []
for r in data["requirements"]:
    sts = [by[c]["status"] for c in r["covers"]]
    st = "EXCLUÍDO" if r["exclusion"] and not r["covers"] else ("DONE" if all(s == "DONE" for s in sts) else ("DEFERRED (backend)" if all(s == "DEFERRED" for s in sts) else "PARCIAL/ABERTO"))
    ev = sorted({e for c in r["covers"] for e in by[c]["tests"][:2]})[:3]
    rows.append((r["id"], r["source"], r["text"], ", ".join(r["covers"]) or "-", "; ".join(ev) or "-", st, r["exclusion"] or ""))
cnt = collections.Counter(r[5] for r in rows)
w("TRACEABILITY-MATRIX.md", "# Rastreabilidade: requisito → item do backlog → teste → status\n\nREQUISITO (REA/DS/pedido) → FEATURE → TASK → CÓDIGO → TESTE → EVIDÊNCIA → STATUS. Código, testes e evidências estão nos próprios itens (`backlog.json`).\n\nCobertura: " + ", ".join(f"{k} {v}" for k, v in cnt.items()) + f" de {len(rows)} requisitos; nenhum sem cobertura ou justificativa.\n\n" + tab(rows, ["Requisito", "Fonte", "Descrição", "Itens", "Testes (amostra)", "Status", "Justificativa de exclusão"]) + "\n")
# DEPENDENCY GRAPH
g = ["# Grafo de dependências", "", "```mermaid", "flowchart LR"]
col = {"DONE": "done", "READY": "ready", "TESTING": "test", "BLOCKED": "block", "DEFERRED": "defer", "BACKLOG": "back", "IN_PROGRESS": "prog"}
for i in leaf:
    if i["dependencies"] or any(i["id"] in j["dependencies"] for j in leaf): g.append(f'  {i["id"].replace("-","_")}["{i["id"]}<br/>{i["status"]}"]:::{col.get(i["status"],"back")}')
for i in leaf:
    for d in i["dependencies"]: g.append(f'  {d.replace("-","_")} --> {i["id"].replace("-","_")}')
g += ["  classDef done fill:#E8ECE4,stroke:#1C1917;", "  classDef ready fill:#FFFFFF,stroke:#1C1917,stroke-width:3px;", "  classDef test fill:#F4F2EF,stroke:#1C1917;", "  classDef block fill:#FFFFFF,stroke:#C41E14,stroke-width:3px;", "  classDef defer fill:#F4F2EF,stroke:#6B645F,stroke-dasharray: 4 3;", "  classDef back fill:#FFFFFF,stroke:#6B645F;", "  classDef prog fill:#F4F2EF,stroke:#1C1917;", "```", "",
      "## Caminho crítico até a integração com o Supabase", "1. `FT-037` (revelação validada no preview) → 2. **`AUD-001`** (auditoria independente, P0) → 3. `REL-001` (confirmar/promover destino; não bloqueia o Supabase, bloqueia produção) → 4. `BG-071` (outbox) → 5. `FT-080` Auth e `FT-082` Esquema/RLS → 6. `FT-085` Storage e URLs assinadas → 7. `FT-083` revelação no servidor e `FT-084` realtime → 8. `FT-089` migração local → nuvem.", "",
      "Tudo em EP-09 está DEFERRED até o release gate passar."]
w("DEPENDENCY-GRAPH.md", "\n".join(g) + "\n")
# RELEASE GATES
nxt = ready(); open_p01 = [i for i in leaf if i["priority"] in ("P0", "P1") and i["status"] not in ("DONE", "DEFERRED", "CANCELLED")]
gates = [('G1', 'Jornadas locais e E2E', 'PARCIAL: 266 unitários; E2E alternativo 1 falhou/15 não executados', 'docs/supabase/A5-HOMOLOGATION-REPORT.md'), ('G2', 'Design system v1 e acessibilidade', 'HISTÓRICO; sem novo aceite físico nesta A5', 'docs/audit/02-VISUAL-COMPLIANCE.md; docs/supabase/A5-HOMOLOGATION-REPORT.md'), ('G3', 'Segurança cliente/backend', 'PARCIAL: 30 probes e RLS; INF-004 aberto', 'docs/supabase/A5-HOMOLOGATION-REPORT.md'), ('G4', 'Revelação programada no servidor', 'Agenda ativa/zero atraso; nova jornada E2E pendente', 'docs/supabase/A5-HOMOLOGATION-REPORT.md'), ('G5', 'Auditoria/revisão independente', 'Revisão do diff A5 concluída; parecer NO-GO', 'docs/supabase/A5-REVIEW.md'), ('G6', 'Google OAuth e sessão', 'PARCIAL: Master confirmado; refresh/expiração pendentes', 'docs/supabase/A5-HOMOLOGATION-REPORT.md'), ('G7', 'Convidado: upload, Storage, quotas, galeria e revelação', 'PARCIAL; E2E autenticado/físicos pendentes', 'docs/supabase/A5-HOMOLOGATION-REPORT.md'), ('G8', 'Production pronta para promoção', 'BLOQUEADO: INF-004; promoção não autorizada', 'docs/supabase/A5-HOMOLOGATION-REPORT.md'), ('G9', 'Backend V2 local: pgTAP/integração', 'NÃO REEXECUTADO: stack local indisponível; histórico nos anexos', 'docs/supabase/A5-HOMOLOGATION-REPORT.md'), ('G10', 'Aceite completo V2', 'BLOQUEADO; A não concluída', 'docs/supabase/A5-HOMOLOGATION-REPORT.md'), ('G12', 'Migrations V2 e Edge Functions remotas', 'PASSA no inventário: 16 migrations e duas Functions ativas', 'docs/supabase/evidence/a5-20261021/backend-readonly.json; docs/supabase/A5-HOMOLOGATION-REPORT.md'), ('G11', 'Conector Supabase acessa o projeto correto', 'PASSA: consultas remotas de leitura', 'docs/supabase/evidence/a5-20261021/backend-readonly.json')]
rg = ["# Release gates", "", tab(gates, ["Gate", "Critério", "Estado", "Evidência"]), "", f"## Itens P0/P1 em aberto ({len(open_p01)})", tab([(i["id"], i["title"], i["priority"], i["status"]) for i in open_p01], ["ID", "Título", "Prio", "Status"]), "",
      "## Decisão atual", "**NO-GO para produção; A não concluída.** Checkpoint A5 em docs/supabase/A5-HOMOLOGATION-REPORT.md. Testes unitários/probes não substituem E2E autenticado, sessões e aparelhos físicos. Nenhuma promoção autorizada. Ordem A → B → Codex → C preservada; proposta paralela de backlog não integrada.", "",
      "## Próximos itens READY", tab([(i["priority"], i["id"], i["title"]) for i in nxt], ["Prio", "ID", "Título"])]
w("RELEASE-GATES.md", "\n".join(rg) + "\n")
print(f"OK: {len(leaf)} itens; prioridade {dict(cnt_p)}; status {dict(cnt_s)}; requisitos {dict(cnt)}")
print("Próximos READY:", ", ".join(f"{i['id']}({i['priority']})" for i in nxt))

# ROADMAP.md: releases incrementais (campo `release` em cada item; definições em meta.releases) e caminho crítico
rel = data["meta"].get("releases", {})
if rel:
    openi = [i for i in leaf if i["status"] not in ("DONE", "CANCELLED")]
    memo = {}
    def chain(n):
        if n in memo: return memo[n]
        ds = [chain(d) for d in by[n]["dependencies"] if by[d]["status"] not in ("DONE", "CANCELLED")]
        best = max(ds, key=len, default=[]); memo[n] = best + [n]; return memo[n]
    def crit(prefix_ok):
        c = [chain(i["id"]) for i in openi if prefix_ok(i)]
        return max(c, key=len, default=[])
    r_out = ["# Roadmap por releases (gerado de backlog.json)", "", "> Não editar: altere `release` nos itens de `backlog.json` e rode `tools/backlog.py`.", ""]
    for rid, rd in rel.items():
        mine = sorted([i for i in openi if i.get("release") == rid], key=lambda i: (PR[i["priority"]], i["id"]))
        cp = collections.Counter(i["priority"] for i in mine); cs = collections.Counter(i["status"] for i in mine)
        r_out += [f"## {rid} · {rd['nome']} ({rd['janela']})", "", rd["objetivo"], "", f"Itens abertos: **{len(mine)}** · " + ", ".join(f"{k} {cp.get(k,0)}" for k in PR) + " · " + ", ".join(f"{k} {v}" for k, v in sorted(cs.items())), ""]
        r_out.append(tab([(i["id"], i["priority"], i["status"], i["title"][:90], ", ".join(i["dependencies"]) or "-") for i in mine], ["ID", "Prio", "Status", "Título", "Depende de"]) if mine else "_Sem itens abertos._")
        r_out.append("")
    mon = crit(lambda i: i["id"] == "COM-006")
    scale = crit(lambda i: i["id"] in ("COM-008", "COM-010", "COM-012", "COM-013"))
    r_out += ["## Caminho crítico", "", "Monetização: " + " → ".join(mon), "", "Escala: " + " → ".join(scale), ""]
    w("ROADMAP.md", "\n".join(r_out))

