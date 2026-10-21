#!/usr/bin/env bash
# Aplica as migrations do MemoriesMT no projeto Supabase REMOTO correto. Recusa qualquer outro Project Ref.
# Pré-requisito: `supabase login` (ou SUPABASE_ACCESS_TOKEN no ambiente). Não imprime nem grava segredos.
set -euo pipefail
EXPECTED_REF="asyaegeodyttttaubvxh"
EXPECTED_ORG="zpnbwkmukywzlkxdfeja"
cd "$(dirname "$0")/.."

supabase link --project-ref "$EXPECTED_REF" >/dev/null
LINKED="$(cat supabase/.temp/project-ref)"
[ "$LINKED" = "$EXPECTED_REF" ] || { echo "recusado: projeto vinculado ($LINKED) != $EXPECTED_REF" >&2; exit 2; }

ORG="$(supabase projects list -o json | python3 -I -c "import sys,json; d=json.load(sys.stdin); print(next((p['organization_id'] for p in d if p['ref']=='$EXPECTED_REF'),''))")"
[ "$ORG" = "$EXPECTED_ORG" ] || { echo "recusado: organização do projeto ($ORG) != $EXPECTED_ORG" >&2; exit 2; }

echo "== estado atual do remoto (somente leitura) =="
supabase db query --linked -o json "select (select count(*) from information_schema.tables where table_schema='public') public_tables, (select count(*) from auth.users) users" | grep -E '"(public_tables|users)"'
echo "== migrations pendentes =="
supabase db push --linked --dry-run | sed -n '1,12p'
[ "${1:-}" = "--apply" ] || { echo "dry-run apenas. Reexecute com --apply para aplicar."; exit 0; }
supabase db push --linked --yes
echo "== verificação pós-aplicação =="
supabase db advisors --linked --type all
supabase db query --linked -o json "select count(*) as tabelas_com_rls from pg_tables where schemaname='public' and rowsecurity" | grep tabelas_com_rls
