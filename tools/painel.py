#!/usr/bin/env python3
"""Painel ao vivo do MVP Memo Brasil (stdlib only).

Serve http://127.0.0.1:3300 (ou PAINEL_PORT) com visao geral do checklist,
PRs, agentes, testes, gasto e bloqueios. Atualiza a cada 10s.

Correcoes do QA:
- Host header validado (127.0.0.1 ou localhost + PORTA).
- Testes rodam por agendador interno, nao por requisicao.
- Nao expoe caminhos locais (apenas branches e nomes de agentes).
- Coleta de testes nao trava a thread de requisicoes.
"""
import html as H
import json
import os
import re
import subprocess
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

PORT = int(os.environ.get("PAINEL_PORT", "3300"))
ROOT = Path(__file__).resolve().parent.parent
CHECKLIST_PATH = ROOT / "docs" / "mvp-checklist.json"

# DNS rebinding: so respondemos a estes hosts.
ALLOWED_HOSTS = {f"127.0.0.1:{PORT}", f"localhost:{PORT}"}

# Lock para cache de estado HTTP.
_state_lock = threading.Lock()
_state_cache = {"value": None, "ts": 0.0}

# Testes rodam em thread propria para nao bloquear requisicoes.
_tests_lock = threading.Lock()
_tests_cache = {
    "value": {"rc": None, "tests": None, "pass": None, "fail": None, "tail": ""},
    "ts": 0.0,
}
_test_stop = threading.Event()
TEST_INTERVAL = 15


def _run(cmd, timeout=30, cwd=ROOT):
    try:
        p = subprocess.run(cmd, cwd=str(cwd), capture_output=True, text=True, timeout=timeout)
        return p.returncode, p.stdout or "", p.stderr or ""
    except Exception as e:  # noqa: BLE001
        return -1, "", str(e)


# --- Resumo de testes: nunca expor stack trace nem caminhos absolutos -------
_ANSI_RE = re.compile(r"\x1b\[[0-9;]*m")
_SUM_RE = re.compile(
    r"^\s*(?:#|\u2139)?\s*(tests|suites|pass|fail|cancelled|skipped|todo)\s+(\d+)\s*$",
    re.I,
)
_FAIL_MARK = "\u2716\u2717\u2718\u00d7\u2715"  # ✖ ✗ ✘ × ✕
_TAP_FAIL_RE = re.compile(r"^not ok\b\s*\d*\s*[-\u2013]?\s*(.+)$")
_LOC_RE = re.compile(r"(?i)^(?:test|file)\s+at\s+")
_ABS_PATH_RE = re.compile(r"(?<![\w~<>])/(?:[A-Za-z0-9._@+-]+/)+[A-Za-z0-9._@+-]*")


def sanitiza_caminhos(texto):
    """Troca caminhos absolutos por rotulos: home -> ~, /private/tmp -> <tmp>."""
    if not texto:
        return texto
    t = str(texto)
    t = t.replace(str(ROOT), "~")
    try:
        home = os.path.expanduser("~")
    except Exception:  # noqa: BLE001
        home = ""
    if home and home not in ("/", ""):
        t = t.replace(home, "~")
    t = t.replace("/private/tmp", "<tmp>")
    t = t.replace("/tmp", "<tmp>")
    return _ABS_PATH_RE.sub("<path>", t)


def _limpa_nome(nome):
    """Extrai o nome do teste, sem duracao, localizacao ou caminho."""
    n = nome.strip()
    n = re.sub(r"\s*\([\d.]+\s*m?s\)\s*$", "", n)          # (133.78ms)
    n = re.sub(r"\s*\([^()]*[/\\][^()]*\)\s*$", "", n)     # (caminho:linha)
    n = re.sub(r"\s+at\s+.*$", "", n)
    return sanitiza_caminhos(n).strip()


def _nomes_falhas(linhas):
    nomes = []
    for ln in linhas:
        s = ln.strip()
        m = re.match(r"^[" + re.escape(_FAIL_MARK) + r"]\s*(.+)$", s)
        if not m:
            m = _TAP_FAIL_RE.match(s)
        if not m:
            continue
        bruto = m.group(1).strip()
        if bruto.lower().rstrip(":") in ("failing tests", "falhas", "tests"):
            continue
        nome = _limpa_nome(bruto)
        if nome and nome not in nomes:
            nomes.append(nome)
    return nomes


def _ultima_linha_util(linhas):
    for ln in reversed(linhas):
        s = ln.strip()
        if not s or _LOC_RE.match(s) or s.startswith("at "):
            continue
        return sanitiza_caminhos(s)[:200]
    return ""


def resumo_testes(saida, limite_falhas=20, limite_linha=200):
    """Resumo seguro da saida do `npm test`: contagem + nomes das falhas.

    Nao devolve stack trace nem caminhos absolutos (home -> ~, /private/tmp -> <tmp>).
    """
    texto = _ANSI_RE.sub("", saida or "")
    linhas = texto.splitlines()

    contagem = {}
    for ln in linhas:
        m = _SUM_RE.match(ln.strip())
        if m:
            try:
                contagem[m.group(1).lower()] = int(m.group(2))
            except ValueError:
                pass

    partes = []
    if any(k in contagem for k in ("tests", "pass", "fail")):
        resumo = []
        if "tests" in contagem:
            resumo.append("%d testes" % contagem["tests"])
        if "pass" in contagem:
            resumo.append("%d passou" % contagem["pass"])
        if "fail" in contagem:
            resumo.append("%d falhou" % contagem["fail"])
        partes.append("resumo: " + " \u00b7 ".join(resumo))
    else:
        partes.append("resumo: indisponivel (node:test sem resumo)")
        ultima = _ultima_linha_util(linhas)
        if ultima:
            partes.append("ultima linha: " + ultima)

    falhas = _nomes_falhas(linhas)
    if falhas:
        partes.append("falhas:")
        for nome in falhas[:limite_falhas]:
            partes.append("- " + nome[:limite_linha])
        if len(falhas) > limite_falhas:
            partes.append("(+%d omitidos)" % (len(falhas) - limite_falhas))
    elif contagem.get("fail"):
        partes.append("falhas: (nomes nao capturados na saida)")

    return "\n".join(partes)


def _pct_status(status):
    s = (status or "").strip().lower()
    if s in ("concluido", "concluído", "done", "ok", "concluida", "concluída"):
        return 100
    if s in ("em_andamento", "em andamento", "in_progress", "andamento"):
        return 50
    return 0


def _run_npm_test():
    rc, out, err = _run(["npm", "test"], timeout=90)
    combined = out + "\n" + err

    def grab(key):
        m = re.search(re.escape(key) + r"\s+(\d+)", combined, re.I)
        return int(m.group(1)) if m else None

    return {
        "rc": rc,
        "tests": grab("tests"),
        "pass": grab("pass"),
        "fail": grab("fail"),
        "tail": resumo_testes(combined),
    }


def _test_loop():
    """Executa npm test periodicamente em thread daemon."""
    while not _test_stop.is_set():
        start = time.time()
        result = _run_npm_test()
        with _tests_lock:
            _tests_cache["value"] = result
            _tests_cache["ts"] = time.time()
        elapsed = time.time() - start
        _test_stop.wait(max(0.0, TEST_INTERVAL - elapsed))


def start_test_runner():
    t = threading.Thread(target=_test_loop, daemon=True)
    t.start()


def get_tests():
    with _tests_lock:
        return dict(_tests_cache["value"])


def get_checklist():
    try:
        data = json.loads(CHECKLIST_PATH.read_text(encoding="utf-8"))
    except Exception:
        return []
    if not isinstance(data, list):
        return []
    return data


def get_prs():
    rc, out, err = _run(
        ["gh", "pr", "list", "--json", "number,title,state,author,url", "--limit", "20"]
    )
    if rc != 0:
        return []
    try:
        items = json.loads(out or "[]")
    except json.JSONDecodeError:
        return []
    prs = []
    for it in items:
        author = it.get("author")
        login = author.get("login") if isinstance(author, dict) else str(author or "")
        prs.append(
            {
                "number": it.get("number"),
                "title": it.get("title", ""),
                "state": it.get("state", ""),
                "author": login,
                "url": it.get("url", ""),
            }
        )
    return prs


def get_worktree_branches():
    """Retorna apenas os nomes das branches dos worktrees (sem caminhos)."""
    rc, out, _ = _run(["git", "worktree", "list", "--porcelain"])
    branches = []
    for line in (out or "").splitlines():
        if line.startswith("branch "):
            branch = line[len("branch "):].replace("refs/heads/", "")
            if branch:
                branches.append(branch)
    return branches


def get_agentes():
    """Extrai nome e papel dos agentes Maestri (sem caminhos locais)."""
    rc, out, _ = _run(["maestri", "list"], timeout=15)
    agentes = []
    for line in (out or "").splitlines():
        m = re.search(r'- name:\s*"([^"]+)"(?:.*role:\s*"([^"]+)")?', line)
        if m:
            agentes.append({"nome": m.group(1), "role": m.group(2) or ""})
    return agentes


def get_issues():
    rc, out, _ = _run(
        ["gh", "issue", "list", "--state", "open", "--json", "number,title", "--limit", "10"]
    )
    if rc != 0:
        return []
    try:
        return json.loads(out or "[]")
    except json.JSONDecodeError:
        return []


def read_status_blockers():
    candidates = [ROOT / "STATUS.md", ROOT / "docs" / "STATUS.md"]
    for p in candidates:
        if p.exists():
            text = p.read_text(encoding="utf-8", errors="replace")
            m = re.search(r"(?is)bloqueio[s]?\s*:?\s*\n(.*?)(?:\n##|\n#|\Z)", text)
            chunk = m.group(1).strip() if m else ""
            lines = [ln.strip("- ").strip() for ln in chunk.splitlines() if ln.strip()]
            if lines:
                return lines
    issues = get_issues()
    return [("#%s %s" % (i.get("number"), i.get("title", ""))).strip() for i in issues]


def collect_state():
    with _state_lock:
        now = time.time()
        if _state_cache["value"] is not None and now - _state_cache["ts"] < 5:
            return _state_cache["value"]
    checklist = get_checklist()
    total = len(checklist)
    done = sum(1 for it in checklist if _pct_status(it.get("status")) == 100)
    in_progress = sum(1 for it in checklist if _pct_status(it.get("status")) == 50)
    pending = total - done - in_progress
    geral = round(100.0 * done / total, 1) if total else 0.0
    state = {
        "gerado_em": time.strftime("%Y-%m-%d %H:%M:%S"),
        "checklist": checklist,
        "total": total,
        "feitos": done,
        "em_andamento": in_progress,
        "pendentes": pending,
        "percentual_geral": geral,
        "prs": get_prs(),
        "worktrees": get_worktree_branches(),
        "agentes": get_agentes(),
        "testes": get_tests(),
        "gasto_reais": os.environ.get("GASTO_REAIS", "0,00"),
        "teto_reais": os.environ.get("TETO_REAIS", "100,00"),
        "bloqueios": read_status_blockers(),
    }
    with _state_lock:
        _state_cache["value"] = state
        _state_cache["ts"] = time.time()
    return state


def esc(s):
    return H.escape(str(s) if s is not None else "")


PAGE = """<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Painel MVP — Memo Brasil</title>
<style>
*{box-sizing:border-box}
body{margin:0;background:#ffffff;color:#111827;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
.wrap{max-width:1280px;margin:0 auto;padding:24px}
h1{margin:0 0 4px;font-size:28px;font-weight:700}
.sub{color:#6b7280;font-size:14px;margin-bottom:20px}
.grid{display:grid;grid-template-columns:repeat(12,1fr);gap:16px}
.card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:16px;box-shadow:0 1px 2px rgba(0,0,0,.04)}
.col4{grid-column:span 4} .col6{grid-column:span 6} .col8{grid-column:span 8} .col12{grid-column:span 12}
@media(max-width:900px){.col4,.col6,.col8{grid-column:span 12}}
.kpi{font-size:44px;font-weight:800;line-height:1}
.kpi small{font-size:16px;font-weight:500;color:#6b7280}
.label{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;margin-bottom:8px}
.bar{height:10px;background:#f3f4f6;border-radius:999px;overflow:hidden;margin-top:8px}
.bar>span{display:block;height:100%;background:#111827;width:0%;transition:width .3s}
.row{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 0;border-bottom:1px solid #f3f4f6}
.row:last-child{border-bottom:none}
.badge{font-size:11px;padding:2px 8px;border-radius:999px;font-weight:600}
.done{background:#dcfce7;color:#166534}
.doing{background:#fef9c3;color:#854d0e}
.pend{background:#f3f4f6;color:#4b5563}
.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px}
ul{margin:0;padding-left:18px}
li{margin:4px 0;font-size:14px}
table{width:100%;border-collapse:collapse;font-size:14px}
th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #f3f4f6}
th{color:#6b7280;font-weight:600;font-size:12px;text-transform:uppercase}
a{color:#2563eb;text-decoration:none}
a:hover{text-decoration:underline}
.pre{background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:8px;font-size:11px;max-height:160px;overflow:auto;white-space:pre-wrap}
.muted{color:#6b7280;font-size:13px}
</style>
</head>
<body>
<div class="wrap">
  <h1>Painel MVP — Memo Brasil</h1>
  <div class="sub">Atualizacao automatica a cada 10s · <span id="ts"></span></div>
  <div class="grid">
    <div class="card col4">
      <div class="label">Percentual geral</div>
      <div class="kpi"><span id="geral">0</span><small>%</small></div>
      <div class="bar"><span id="geralbar"></span></div>
      <div class="muted" style="margin-top:8px"><span id="feitos">0</span> feitos · <span id="andamento">0</span> em andamento · <span id="pendentes">0</span> pendentes</div>
    </div>
    <div class="card col4">
      <div class="label">Testes (node:test)</div>
      <div class="kpi"><span id="testpass">-</span><small> pass</small></div>
      <div class="muted" style="margin-top:8px">total <span id="testtotal">-</span> · falhas <span id="testfail">-</span> · rc <span id="testrc">-</span></div>
      <div class="muted" style="margin-top:8px">atualizado a cada ~15s</div>
    </div>
    <div class="card col4">
      <div class="label">Gasto (teto R$ <span id="teto"></span>/mes)</div>
      <div class="kpi"><small>R$ </small><span id="gasto">0,00</span></div>
      <div class="muted" style="margin-top:8px">VPS existente; sem novos servicos pagos</div>
    </div>

    <div class="card col8">
      <div class="label">Checklist (por item)</div>
      <div id="checklist"></div>
    </div>
    <div class="card col4">
      <div class="label">Agentes / worktrees</div>
      <div id="worktrees"></div>
      <div class="label" style="margin-top:12px">Agentes Maestri</div>
      <div id="agentes"></div>
    </div>

    <div class="card col6">
      <div class="label">PRs abertos</div>
      <div id="prs"></div>
    </div>
    <div class="card col6">
      <div class="label">Bloqueios</div>
      <div id="bloqueios"></div>
    </div>

    <div class="card col12">
      <div class="label">Saida dos testes (tail)</div>
      <div class="pre" id="testtail"></div>
    </div>
  </div>
</div>
<script>
function pctFromStatus(s){
  s=(s||'').toLowerCase();
  if(s.indexOf('conclu')>=0) return 100;
  if(s.indexOf('andamento')>=0) return 50;
  return 0;
}
function statusClass(s){
  s=(s||'').toLowerCase();
  if(s.indexOf('conclu')>=0) return 'done';
  if(s.indexOf('andamento')>=0) return 'doing';
  return 'pend';
}
function statusLabel(s){
  s=(s||'').toLowerCase();
  if(s.indexOf('conclu')>=0) return 'Concluido';
  if(s.indexOf('andamento')>=0) return 'Em andamento';
  return 'Pendente';
}
async function refresh(){
  try{
    const r=await fetch('/api/state',{cache:'no-store'});
    const d=await r.json();
    document.getElementById('ts').textContent=d.gerado_em;
    document.getElementById('geral').textContent=d.percentual_geral;
    document.getElementById('geralbar').style.width=d.percentual_geral+'%';
    document.getElementById('feitos').textContent=d.feitos;
    document.getElementById('andamento').textContent=d.em_andamento;
    document.getElementById('pendentes').textContent=d.pendentes;
    const t=d.testes||{};
    document.getElementById('testpass').textContent=(t.pass!=null?t.pass:'-');
    document.getElementById('testtotal').textContent=(t.tests!=null?t.tests:'-');
    document.getElementById('testfail').textContent=(t.fail!=null?t.fail:'-');
    document.getElementById('testrc').textContent=(t.rc!=null?t.rc:'-');
    document.getElementById('testtail').textContent=t.tail||'';
    document.getElementById('teto').textContent=d.teto_reais;
    document.getElementById('gasto').textContent=d.gasto_reais;

    const cl=document.getElementById('checklist');
    cl.innerHTML='';
    (d.checklist||[]).forEach(function(it){
      const pct = pctFromStatus(it.status);
      const row=document.createElement('div');
      row.className='row';
      row.innerHTML='<div style="flex:1"><strong>'+esc(it.id)+'</strong> · '+esc(it.titulo)+ (it.evidencia? ' <span class="muted">('+esc(it.evidencia)+')</span>':'') +'</div>'+
        '<div style="display:flex;align-items:center;gap:8px"><div style="width:80px"><div class="bar"><span style="width:'+pct+'%"></span></div></div>'+
        '<span class="badge '+statusClass(it.status)+'">'+statusLabel(it.status)+'</span></div>';
      cl.appendChild(row);
    });

    const wt=document.getElementById('worktrees');
    wt.innerHTML='';
    (d.worktrees||[]).forEach(function(branch){
      const p=document.createElement('div');
      p.className='row';
      p.innerHTML='<div class="mono">'+esc(branch)+'</div>';
      wt.appendChild(p);
    });
    if(!(d.worktrees||[]).length){ wt.innerHTML='<div class="muted">sem worktrees listados</div>'; }

    const ag=document.getElementById('agentes');
    ag.innerHTML='';
    (d.agentes||[]).forEach(function(a){
      const p=document.createElement('div');
      p.className='row';
      p.innerHTML='<div style="flex:1">'+esc(a.nome)+'</div><div class="muted">'+esc(a.role)+'</div>';
      ag.appendChild(p);
    });
    if(!(d.agentes||[]).length){ ag.innerHTML='<div class="muted">nenhum agente conectado</div>'; }

    const prs=document.getElementById('prs');
    prs.innerHTML='';
    if(!(d.prs||[]).length){ prs.innerHTML='<div class="muted">nenhum PR aberto</div>'; }
    (d.prs||[]).forEach(function(pr){
      const p=document.createElement('div');
      p.className='row';
      const url=pr.url?' <a href="'+esc(pr.url)+'" target="_blank">abrir</a>':'';
      p.innerHTML='<div style="flex:1"><strong>#'+esc(pr.number)+'</strong> '+esc(pr.title)+'</div><div class="muted">'+esc(pr.state)+' · '+esc(pr.author)+url+'</div>';
      prs.appendChild(p);
    });

    const bl=document.getElementById('bloqueios');
    bl.innerHTML='';
    if(!(d.bloqueios||[]).length){ bl.innerHTML='<div class="muted">nenhum bloqueio registrado</div>'; }
    (d.bloqueios||[]).forEach(function(b){
      const p=document.createElement('div');
      p.className='row';
      p.innerHTML='<div>'+esc(b)+'</div>';
      bl.appendChild(p);
    });
  }catch(e){
    console.error(e);
  }
}
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
refresh();
setInterval(refresh,10000);
</script>
</body>
</html>
"""


class Handler(BaseHTTPRequestHandler):
    def _host_ok(self):
        host = self.headers.get("Host", "")
        return host in ALLOWED_HOSTS

    def _send_403(self):
        self.send_response(403)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.end_headers()
        self.wfile.write(b"Host nao autorizado")

    def do_GET(self):
        if not self._host_ok():
            self._send_403()
            return
        if self.path == "/" or self.path.startswith("/?"):
            body = PAGE.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        elif self.path.startswith("/api/state"):
            st = collect_state()
            body = json.dumps(st, ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, fmt, *args):
        pass


def main():
    start_test_runner()
    httpd = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print("Painel MVP: http://127.0.0.1:%d/" % PORT, flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        _test_stop.set()
        httpd.server_close()


if __name__ == "__main__":
    main()
