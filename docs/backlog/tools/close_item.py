#!/usr/bin/env python3
"""Fecha/atualiza itens do backlog preservando IDs: python3 close_item.py ID [ID...] --status DONE --commit SHA [--test T]... [--evidence E]... [--env AMBIENTE]
Regenera as visões (BACKLOG.md etc.) rodando backlog.py ao final."""
import argparse, json, os, subprocess, sys
H = os.path.dirname(os.path.abspath(__file__)); J = os.path.join(H, "..", "backlog.json")
ap = argparse.ArgumentParser(); ap.add_argument("ids", nargs="+"); ap.add_argument("--status", default="DONE"); ap.add_argument("--commit"); ap.add_argument("--test", action="append", default=[]); ap.add_argument("--evidence", action="append", default=[]); ap.add_argument("--env")
a = ap.parse_args(); d = json.load(open(J, encoding="utf8")); by = {i["id"]: i for i in d["items"]}
for i in a.ids:
    it = by[i]; it["status"] = a.status
    if a.commit: it["commit"] = a.commit
    it["tests"] = sorted(set(it["tests"] + a.test)); it["evidence"] = sorted(set(it["evidence"] + a.evidence))
    if a.env: it["environment"] = a.env
json.dump(d, open(J, "w", encoding="utf8"), ensure_ascii=False, indent=1)
sys.exit(subprocess.call([sys.executable, os.path.join(H, "backlog.py")]))
