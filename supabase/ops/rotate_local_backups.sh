#!/bin/sh
# Rotação das cópias de segurança MANUAIS do MemoriesMT (política 2026-10-22-v1: backups eliminam fotos excluídas em até 30 dias adicionais).
# Regra: remove diretórios de backup com mais de 30 dias. Um backup feito no dia T some em T+30, logo qualquer foto excluída do armazenamento
# ativo depois de T sai das cópias em, no máximo, 30 dias da exclusão.
#
# SEGURO POR PADRÃO: sem --apply apenas LISTA o que seria removido. Nunca toca fora de BACKUP_ROOT. Não é executado automaticamente.
# Uso:  sh rotate_local_backups.sh [BACKUP_ROOT]            (dry-run)
#       sh rotate_local_backups.sh [BACKUP_ROOT] --apply    (remove)
# Padrão de BACKUP_ROOT: ~/Backups/memoriesmt. Cada backup é um diretório AAAAMMDD-HHMM.
# Observação: se houver RESTAURAÇÃO a partir de um backup, reaplicar as exclusões já determinadas (Política de Privacidade, seção 7).
set -eu
ROOT="${1:-$HOME/Backups/memoriesmt}"
APPLY="no"; [ "${2:-}" = "--apply" ] && APPLY="yes"
MAX_AGE_DAYS="${MAX_AGE_DAYS:-30}"
[ -d "$ROOT" ] || { echo "BACKUP_ROOT inexistente: $ROOT" >&2; exit 2; }
# só diretórios no padrão AAAAMMDD-HHMM, diretamente dentro de ROOT (nada de seguir links nem de nomes arbitrários)
CUT=$(date -v-"$MAX_AGE_DAYS"d +%Y%m%d 2>/dev/null || date -d "-$MAX_AGE_DAYS days" +%Y%m%d)
found=0
for d in "$ROOT"/*/; do
  [ -d "$d" ] && [ ! -L "${d%/}" ] || continue
  name=$(basename "$d")
  case "$name" in [0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]-[0-9][0-9][0-9][0-9]) ;; *) continue;; esac
  day=${name%%-*}
  if [ "$day" -lt "$CUT" ]; then
    found=$((found+1))
    if [ "$APPLY" = "yes" ]; then rm -rf -- "${d%/}"; echo "removido: $name"; else echo "removeria: $name (dry-run)"; fi
  fi
done
echo "backups com mais de $MAX_AGE_DAYS dias: $found ($([ "$APPLY" = yes ] && echo aplicado || echo dry-run))"
