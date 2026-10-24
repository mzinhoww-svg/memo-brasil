#!/bin/sh
# Teste do backup_and_rotate.sh com um `supabase` falso e pastas descartáveis (nunca toca ~/Backups nem o remoto).
set -eu
HERE=$(cd "$(dirname "$0")" && pwd)
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
mkdir -p "$T/bin" "$T/root" "$T/ops/.temp"
cp "$HERE/backup_and_rotate.sh" "$HERE/rotate_local_backups.sh" "$T/ops/"
mkdir -p "$T/.temp" && echo "asyaegeodyttttaubvxh" > "$T/.temp/project-ref"
# supabase falso: grava um arquivo no destino pedido (-f ou segundo argumento do storage cp)
cat > "$T/bin/supabase" <<'STUB'
#!/bin/sh
case "$1 $2" in
  "db dump") ORIG="$*"; while [ $# -gt 0 ]; do [ "$1" = "-f" ] && { case "$ORIG" in *--data-only*) [ -n "${STUB_EMPTY:-}" ] && echo "-- vazio" > "$2" || { echo "INSERT INTO t VALUES (1);"; i=0; while [ $i -lt 40 ]; do echo "INSERT INTO t VALUES ($i); -- preenchimento para passar de 500 bytes de conteúdo realista"; i=$((i+1)); done; } > "$2" ;; *) { echo "CREATE TABLE t (id int);"; i=0; while [ $i -lt 200 ]; do echo "CREATE INDEX i$i ON t (id); -- preenchimento para passar de 5000 bytes"; i=$((i+1)); done; } > "$2" ;; esac; }; shift; done ;;
  "storage cp") mkdir -p "$5"; case "$4" in *event-branding*) echo logo > "$5/b.png" ;; *) echo foto > "$5/x.jpg" ;; esac ;;
esac
STUB
chmod +x "$T/bin/supabase"
fail() { echo "FALHOU: $1" >&2; exit 1; }
old=$(date -v-45d +%Y%m%d 2>/dev/null || date -d "-45 days" +%Y%m%d)
mkdir -p "$T/root/${old}-0100"
# 1) projeto errado é recusado
echo "outroprojeto" > "$T/.temp/project-ref"
PATH="$T/bin:$PATH" BACKUP_ROOT="$T/root" sh "$T/ops/backup_and_rotate.sh" 2>/dev/null && fail "aceitou projeto errado" || true
echo "asyaegeodyttttaubvxh" > "$T/.temp/project-ref"
# o script lê ../.temp relativo a ops/: espelha a estrutura real (supabase/ops e supabase/.temp)
mkdir -p "$T/supabase/ops" "$T/supabase/.temp"; cp "$T/ops/"*.sh "$T/supabase/ops/"; cp "$T/.temp/project-ref" "$T/supabase/.temp/"
# 2) dry-run: cria o backup e NÃO remove o antigo
out=$(PATH="$T/bin:$PATH" BACKUP_ROOT="$T/root" sh "$T/supabase/ops/backup_and_rotate.sh")
echo "$out" | grep -q "backup concluído" || fail "sem backup"
[ -d "$T/root/${old}-0100" ] || fail "dry-run removeu o antigo"
new=$(ls "$T/root" | grep -v "^${old}" | head -1)
[ -s "$T/root/$new/schema.sql" ] && [ -s "$T/root/$new/data.sql" ] && [ -s "$T/root/$new/SHA256SUMS.txt" ] && [ -f "$T/root/$new/storage/event-photos/x.jpg" -o -f "$T/root/$new/storage/x.jpg" ] || fail "backup incompleto"
# 3) --apply: remove só o vencido, mantém o novo
PATH="$T/bin:$PATH" BACKUP_ROOT="$T/root" sh "$T/supabase/ops/backup_and_rotate.sh" --apply >/dev/null
[ ! -d "$T/root/${old}-0100" ] || fail "--apply não removeu o vencido"
[ -d "$T/root/$new" ] || fail "removeu o backup novo"
[ -f "$T/root/$new/storage/b.png" ] || fail "event-branding não copiado"
# dump de dados vazio (erro silencioso da CLI) aborta e NÃO roda a rotação
STUB_EMPTY=1 PATH="$T/bin:$PATH" BACKUP_ROOT="$T/root" sh "$T/supabase/ops/backup_and_rotate.sh" --apply >/dev/null 2>&1 && fail "aceitou data.sql vazio" || true
[ -d "$T/root/$new" ] || fail "a rotação rodou depois de um backup inválido"
echo "OK: backup_and_rotate testado com supabase falso e pastas descartáveis"
