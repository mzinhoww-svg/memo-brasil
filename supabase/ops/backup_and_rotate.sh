#!/bin/sh
# Backup manual completo do MemoriesMT (banco + Storage) e rotação de 30 dias, em um passo.
# Política 2026-10-22-v1: cópias de segurança eliminam fotos excluídas em até 30 dias adicionais.
#
# NÃO é automação por si só: precisa ser executado (à mão ou por um agendador SEU, ver com.memoriesmt.backup.plist.example).
# Pré-requisitos: Supabase CLI logado e projeto vinculado ao ref abaixo (a checagem recusa outro projeto).
# Saída: ~/Backups/memoriesmt/AAAAMMDD-HHMM/{schema.sql,data.sql,storage/,SHA256SUMS.txt} (modo 700/600). Nunca publicar.
# Uso:  sh backup_and_rotate.sh              (backup + rotação em dry-run)
#       sh backup_and_rotate.sh --apply      (backup + rotação aplicada)
set -eu
HERE=$(cd "$(dirname "$0")" && pwd)
REF="asyaegeodyttttaubvxh"
ROOT="${BACKUP_ROOT:-$HOME/Backups/memoriesmt}"
APPLY=""; [ "${1:-}" = "--apply" ] && APPLY="--apply"
LINKED=$(cat "$HERE/../.temp/project-ref" 2>/dev/null || true)
[ "$LINKED" = "$REF" ] || { echo "projeto vinculado ($LINKED) não é $REF: abortando" >&2; exit 2; }
umask 077
STAMP=$(date +%Y%m%d-%H%M)
D="$ROOT/$STAMP"
mkdir -p "$D/storage"; chmod 700 "$ROOT" "$D"
supabase db dump --linked -f "$D/schema.sql"
supabase db dump --linked --data-only -f "$D/data.sql"
supabase storage cp -r ss:///event-photos/ "$D/storage/" --linked --experimental
# identidade visual dos eventos (pode estar vazio): não derruba o backup se não houver objetos
supabase storage cp -r ss:///event-branding/ "$D/storage/" --linked --experimental || echo "aviso: event-branding sem objetos ou inacessível (seguindo)" >&2
chmod 600 "$D/schema.sql" "$D/data.sql"
# conferência de conteúdo: a CLI pode imprimir erro numa tentativa e refazer; só vale se os dumps têm o que esperamos
[ "$(wc -c < "$D/schema.sql")" -gt 5000 ] && grep -q '^CREATE TABLE' "$D/schema.sql" || { echo "schema.sql vazio ou inválido: abortando (sem rotação)" >&2; exit 4; }
[ "$(wc -c < "$D/data.sql")" -gt 500 ] && grep -qE '^(COPY |INSERT INTO)' "$D/data.sql" || { echo "data.sql vazio ou inválido: abortando (sem rotação)" >&2; exit 4; }
(cd "$D" && find . -type f ! -name SHA256SUMS.txt -print0 | xargs -0 shasum -a 256 > SHA256SUMS.txt && chmod 600 SHA256SUMS.txt)
echo "backup concluído: $D ($(find "$D" -type f | wc -l | tr -d ' ') arquivos)"
# rotação só depois de o backup novo existir e ter checksum
[ -s "$D/SHA256SUMS.txt" ] || { echo "backup sem checksum: rotação NÃO executada" >&2; exit 3; }
sh "$HERE/rotate_local_backups.sh" "$ROOT" $APPLY
