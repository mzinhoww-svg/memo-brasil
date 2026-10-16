#!/usr/bin/env bash
set -euo pipefail

DATA_DIR="${DATA_DIR:-./data}"
DB="${DATA_DIR}/memo.db"
RETENTION_DIAS="${BACKUP_RETENTION_DIAS:-30}"
STAMP="$(date +%Y%m%d-%H%M%S)"
TMP_DIR="$(mktemp -d)"
BACKUP_BASE="${DATA_DIR}/backups"

# Em produção (NODE_ENV=production ou PUBLIC_URL https) o backup contém dados
# pessoais e por isso exige cifra. Falha cedo, sem gerar cópia em claro.
is_producao() {
  case "${NODE_ENV:-}" in
    production|prod) return 0 ;;
  esac
  case "${PUBLIC_URL:-}" in
    https://*) return 0 ;;
  esac
  return 1
}

if is_producao; then
  if [ -z "${BACKUP_GPG_KEY:-}" ] && [ -z "${BACKUP_PASSPHRASE:-}" ]; then
    echo "Erro: em produção o backup deve ser cifrado. Defina BACKUP_GPG_KEY ou BACKUP_PASSPHRASE." >&2
    echo "Backup abortado para não gravar dados pessoais sem cifra (LGPD)." >&2
    exit 1
  fi
  if ! command -v gpg >/dev/null 2>&1; then
    echo "Erro: gpg não encontrado e é obrigatório em produção (BACKUP_GPG_KEY/BACKUP_PASSPHRASE definidos)." >&2
    exit 1
  fi
fi

mkdir -p "${BACKUP_BASE}"

cleanup() { rm -rf "${TMP_DIR}"; }
trap cleanup EXIT

if [ -f "${DB}" ]; then
  if ! command -v sqlite3 >/dev/null 2>&1; then
    echo "Erro: sqlite3 CLI não encontrado. Instale ou ajuste o PATH." >&2
    exit 1
  fi
  sqlite3 "${DB}" ".backup '${TMP_DIR}/memo.db'"
  chmod 600 "${TMP_DIR}/memo.db"
else
  echo "Banco SQLite não encontrado em ${DB}; backup do banco ignorado." >&2
fi

if [ -d "${DATA_DIR}/photos" ]; then
  cp -R "${DATA_DIR}/photos" "${TMP_DIR}/photos"
fi
[ -f "${DATA_DIR}/audit.log" ] && cp "${DATA_DIR}/audit.log" "${TMP_DIR}/audit.log" || true
[ -f "${DATA_DIR}/settings.json" ] && cp "${DATA_DIR}/settings.json" "${TMP_DIR}/settings.json" || true
[ -f "${DATA_DIR}/vapid.json" ] && cp "${DATA_DIR}/vapid.json" "${TMP_DIR}/vapid.json" || true

OUT="${BACKUP_BASE}/memo-${STAMP}.tar.gz"
tar -czf "${OUT}" -C "${TMP_DIR}" .

echo "Backup criado: ${OUT}"

# Criptografia simétrica opcional (gpg); chave simétrica ou passphrase por ambiente.
if [ -n "${BACKUP_GPG_KEY:-}" ] || [ -n "${BACKUP_PASSPHRASE:-}" ]; then
  if ! command -v gpg >/dev/null 2>&1; then
    echo "Aviso: gpg não encontrado; backup permanece sem criptografia." >&2
  else
    if [ -n "${BACKUP_GPG_KEY:-}" ]; then
      gpg --batch --yes --recipient "${BACKUP_GPG_KEY}" --trust-model always --encrypt "${OUT}"
    else
      gpg --batch --yes --passphrase "${BACKUP_PASSPHRASE}" --symmetric --cipher-algo AES256 "${OUT}"
    fi
    rm -f "${OUT}"
    OUT="${OUT}.gpg"
    echo "Backup cifrado: ${OUT}"
  fi
fi

# Retenção local
find "${BACKUP_BASE}" -maxdepth 1 -type f \( -name 'memo-*.tar.gz' -o -name 'memo-*.tar.gz.gpg' \) -mtime +"${RETENTION_DIAS}" -delete

echo "Backups locais com retenção de ${RETENTION_DIAS} dias."
echo "IMPORTANTE: copie o arquivo para fora do host (offsite). O diretório descomprimido é removido automaticamente."