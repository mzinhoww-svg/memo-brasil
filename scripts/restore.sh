#!/usr/bin/env bash
#
# restore.sh — restaura um backup do Lume (Memo Brasil) para o DATA_DIR.
#
# Seguro por padrão: DRY-RUN. Só altera dados com --apply.
# Aceita backups do scripts/backup.sh (contém memo.db SQLite, photos/, audit.log,
# settings.json, vapid.json) e também o formato antigo (db.json).
# Se o arquivo for .gpg, decifra antes (BACKUP_PASSPHRASE ou BACKUP_GPG_KEY).
#
# Reaplica as exclusões do backup: não traz a pasta backups/, nem arquivos
# temporários do SQLite (*.wal, *.shm, *.journal, *.tmp) e não mexe no
# master.token do host (que o backup nunca inclui).
#
# Uso:
#   bash scripts/restore.sh --backup /data/backups/memo-2026-10-16.tar.gz          # dry-run
#   bash scripts/restore.sh --backup /data/backups/memo-2026-10-16.tar.gz.gpg --apply
#   DATA_DIR=/data bash scripts/restore.sh --backup ... --apply --yes --no-restart
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODO="dry-run"
BACKUP=""
DATA_DIR="${DATA_DIR:-/data}"
ASSUMIR=""
REINICIAR="sim"

uso() {
  cat <<'TXT' >&2
restore.sh — restaura um backup do DATA_DIR do Lume.

Uso:
  bash scripts/restore.sh --backup ARQUIVO[.tar.gz|.tar.gz.gpg] [--data-dir DIR] [--apply] [--yes]

Opções:
  --backup ARQ     Backup a restaurar (obrigatório).
  --data-dir DIR   Destino dos dados (padrão: $DATA_DIR ou /data).
  --apply          Executa a restauração (padrão: DRY-RUN).
  --yes            Não pedir confirmação.
  --no-restart     Não reiniciar o serviço ao final.
  -h, --help       Esta ajuda.

Backup cifrado (.gpg): defina BACKUP_PASSPHRASE (simétrico) ou BACKUP_GPG_KEY (destinatário).

Antes de aplicar: pare o serviço (docker compose stop lume) para não escrever no meio.
O db.json/memo.db atuais são preservados como *.pre-restore.<timestamp>.
TXT
}

log()  { printf '%s\n' "$*"; }
die()  { printf 'ERRO: %s\n' "$*" >&2; exit 2; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --backup)     shift; BACKUP="${1:-}" ;;
    --data-dir)   shift; DATA_DIR="${1:-}" ;;
    --apply)      MODO="apply" ;;
    --dry-run)    MODO="dry-run" ;;
    --yes)        ASSUMIR="sim" ;;
    --no-restart) REINICIAR="nao" ;;
    -h|--help)    uso; exit 0 ;;
    *)            uso; die "opção desconhecida: $1" ;;
  esac
  shift
done

[[ -n "$BACKUP" ]] || { uso; die "informe --backup ARQUIVO"; }
[[ -f "$BACKUP" ]] || die "backup não encontrado: $BACKUP"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/arquivo" "$TMP/extraido"

# ── Decifra se for .gpg ──────────────────────────────────────────────────────
ARQUIVO_TAR="$BACKUP"
if [[ "$BACKUP" == *.gpg ]]; then
  command -v gpg >/dev/null 2>&1 || die "backup .gpg exige o gpg instalado."
  if [[ -n "${BACKUP_PASSPHRASE:-}" ]]; then
    gpg --batch --yes --quiet --passphrase "$BACKUP_PASSPHRASE" --decrypt "$BACKUP" > "$TMP/arquivo/backup.tar.gz" \
      || die "falha ao decifrar com BACKUP_PASSPHRASE."
  elif [[ -n "${BACKUP_GPG_KEY:-}" ]]; then
    gpg --batch --yes --quiet --decrypt "$BACKUP" > "$TMP/arquivo/backup.tar.gz" \
      || die "falha ao decifrar com BACKUP_GPG_KEY."
  else
    die "backup .gpg exige BACKUP_PASSPHRASE ou BACKUP_GPG_KEY para decifrar."
  fi
  ARQUIVO_TAR="$TMP/arquivo/backup.tar.gz"
fi

tar -tzf "$ARQUIVO_TAR" >/dev/null 2>&1 || die "arquivo não é um tar.gz válido: $BACKUP"

# ── Localiza o banco dentro do arquivo (db.json antigo ou memo.db SQLite) ────
LISTA="$(tar -tzf "$ARQUIVO_TAR")"
ENTRADA_DB="$(printf '%s\n' "$LISTA" | grep -E '(^|/)(memo\.db|db\.json)$' | head -1 || true)"
[[ -n "$ENTRADA_DB" ]] || die "backup não contém memo.db nem db.json (não parece ser um backup do Lume)"

# Pasta raiz dentro do tar ("" quando o banco está na raiz).
PASTA="${ENTRADA_DB%/*}"
[[ "$PASTA" == "$ENTRADA_DB" ]] && PASTA=""
if [[ -z "$PASTA" || "$PASTA" == "." ]]; then
  STRIP=0
else
  STRIP="$(awk -F/ '{print NF}' <<<"$PASTA")"
fi

log "==================== RESTORE LUME ===================="
log "Modo           : $([[ "$MODO" == apply ]] && echo APLICAR || echo "DRY-RUN")"
log "Backup         : $BACKUP"
log "Cifrado        : $([[ "$BACKUP" == *.gpg ]] && echo sim || echo nao)"
log "Destino        : $DATA_DIR"
log "Banco no tar   : $ENTRADA_DB"
log "Sem restaurar  : backups/, *.wal, *.shm, *.journal, *.tmp (exclusões do backup)"
log "======================================================"

# Exclusões reaplicadas na extração (mesmas regras do backup.sh).
# Portável entre bsdtar (macOS) e GNU tar: extrai e depois poda.
podar_extracao() {
  rm -rf "$TMP/extraido/backups"
  # Sidecars do SQLite: um -wal antigo junto de um banco novo corrompe.
  rm -f "$TMP/extraido/memo.db-wal" "$TMP/extraido/memo.db-shm" "$TMP/extraido/memo.db-journal"
  for sufixo in wal shm journal tmp; do
    rm -f "$TMP/extraido"/*."$sufixo"
  done
  rm -f "$TMP/extraido"/*.tar.gz "$TMP/extraido"/*.gpg
}

if [[ "$MODO" != "apply" ]]; then
  log "DRY-RUN: nada foi alterado."
  log "Aplicaria: tar -xzf \"$ARQUIVO_TAR\" -C \"$DATA_DIR\" --strip-components=$STRIP"
  log "Depois podaria backups/ e *.wal/*.shm/*.journal/*.tmp (exclusões do backup)."
  log "Para aplicar de verdade: bash scripts/restore.sh --backup \"$BACKUP\" --data-dir \"$DATA_DIR\" --apply"
  exit 0
fi

[[ -d "$DATA_DIR" ]] || die "destino não é um diretório: $DATA_DIR"

if [[ -z "$ASSUMIR" ]]; then
  printf 'Confirma restaurar %s em %s? [s/N] ' "$BACKUP" "$DATA_DIR" >&2
  read -r resp || true
  [[ "$resp" == "s" || "$resp" == "S" || "$resp" == "sim" ]] || die "cancelado."
fi

tar -xzf "$ARQUIVO_TAR" -C "$TMP/extraido" --strip-components="$STRIP"
podar_extracao

STAMP="$(date +%Y%m%d%H%M%S)"
# Preserva os bancos atuais antes de sobrescrever.
[[ -f "$DATA_DIR/db.json" ]] && cp -p "$DATA_DIR/db.json" "$DATA_DIR/db.json.pre-restore.$STAMP"
[[ -f "$DATA_DIR/memo.db" ]] && cp -p "$DATA_DIR/memo.db" "$DATA_DIR/memo.db.pre-restore.$STAMP"

# SQLite: WAL/SHM obsoletos junto de um banco novo corrompem. Remove antes de copiar.
if [[ -f "$TMP/extraido/memo.db" ]]; then
  rm -f "$DATA_DIR/memo.db-wal" "$DATA_DIR/memo.db-shm" "$DATA_DIR/memo.db-journal"
fi

cp -a "$TMP/extraido"/. "$DATA_DIR"/

# Ajusta dono quando pedido (ex.: RESTORE_UID_GID=10001:10001) sem falhar se não for root.
if [[ -n "${RESTORE_UID_GID:-}" ]]; then
  chown -R "$RESTORE_UID_GID" "$DATA_DIR" 2>/dev/null || true
fi

log "Restauração concluída em $DATA_DIR."

if [[ "$REINICIAR" == "sim" ]]; then
  if command -v docker >/dev/null 2>&1 && (cd "$ROOT" && docker compose version >/dev/null 2>&1); then
    log "Reiniciando o serviço..."
    (cd "$ROOT" && docker compose up -d --remove-orphans)
  else
    log "Reinicie o serviço manualmente (systemctl restart lume)."
  fi
fi
