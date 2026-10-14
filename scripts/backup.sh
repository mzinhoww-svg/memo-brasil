#!/usr/bin/env bash
set -euo pipefail

DATA_DIR="${DATA_DIR:-./data}"
DB="${DATA_DIR}/memo.db"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="${DATA_DIR}/backups/${STAMP}"

mkdir -p "${BACKUP_DIR}"

if [ -f "${DB}" ]; then
  sqlite3 "${DB}" ".backup '${BACKUP_DIR}/memo.db'"
  echo "Banco copiado: ${BACKUP_DIR}/memo.db"
else
  echo "Banco SQLite não encontrado em ${DB}; ignorando backup do banco."
fi

if [ -d "${DATA_DIR}/photos" ]; then
  cp -R "${DATA_DIR}/photos" "${BACKUP_DIR}/photos"
fi
[ -f "${DATA_DIR}/audit.log" ] && cp "${DATA_DIR}/audit.log" "${BACKUP_DIR}/audit.log" || true
[ -f "${DATA_DIR}/settings.json" ] && cp "${DATA_DIR}/settings.json" "${BACKUP_DIR}/settings.json" || true

tar -czf "${BACKUP_DIR}.tar.gz" -C "${DATA_DIR}/backups" "${STAMP}"
echo "Backup completo: ${BACKUP_DIR}.tar.gz"