#!/bin/sh
# Teste do rotate_local_backups.sh em pasta descartável (nunca usa ~/Backups). Uso: sh rotate_local_backups.test.sh
set -eu
HERE=$(cd "$(dirname "$0")" && pwd)
T=$(mktemp -d)
trap 'rm -rf "$T"' EXIT
old=$(date -v-45d +%Y%m%d 2>/dev/null || date -d "-45 days" +%Y%m%d)
edge=$(date -v-29d +%Y%m%d 2>/dev/null || date -d "-29 days" +%Y%m%d)
new=$(date +%Y%m%d)
mkdir -p "$T/${old}-0100" "$T/${edge}-0100" "$T/${new}-0100" "$T/qualquer-coisa" "$T/outro"
touch "$T/${old}-0100/x" "$T/qualquer-coisa/y"
fail() { echo "FALHOU: $1" >&2; exit 1; }
out=$(sh "$HERE/rotate_local_backups.sh" "$T")
echo "$out" | grep -q "removeria: ${old}-0100" || fail "dry-run não listou o backup antigo"
[ -d "$T/${old}-0100" ] || fail "dry-run removeu algo"
sh "$HERE/rotate_local_backups.sh" "$T" --apply >/dev/null
[ ! -d "$T/${old}-0100" ] || fail "--apply não removeu o antigo"
[ -d "$T/${edge}-0100" ] || fail "removeu backup dentro do prazo"
[ -d "$T/${new}-0100" ] || fail "removeu backup de hoje"
[ -d "$T/qualquer-coisa" ] && [ -d "$T/outro" ] || fail "tocou diretório fora do padrão"
sh "$HERE/rotate_local_backups.sh" "/caminho/que/nao/existe" 2>/dev/null && fail "aceitou raiz inexistente" || true
echo "OK: rotação testada em pasta descartável"
