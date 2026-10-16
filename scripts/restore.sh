#!/usr/bin/env bash
#
# restore.sh — restaura um backup do Lume (Memo Brasil) para o DATA_DIR.
#
# Seguro por padrão: DRY-RUN. Só altera dados com --apply.
# O backup é um tar.gz do conteúdo do DATA_DIR (db.json, photos/, tokens, chaves VAPID).
# Formato esperado: o arquivo deve conter um db.json (na raiz ou dentro de uma pasta).
#
# Uso:
#   bash scripts/restore.sh --backup /backups/lume-2026-10-16.tar.gz            # dry-run
#   bash scripts/restore.sh --backup ... --data-dir /var/lib/lume --apply
#   DATA_DIR=/data bash scripts/restore.sh --backup ... --apply --yes
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
  bash scripts/restore.sh --backup ARQUIVO.tar.gz [--data-dir DIR] [--apply] [--yes]

Opções:
  --backup ARQ     Backup .tar.gz a restaurar (obrigatório).
  --data-dir DIR   Destino dos dados (padrão: $DATA_DIR ou /data).
  --apply          Executa a restauração (padrão: DRY-RUN).
  --yes            Não pedir confirmação.
  --no-restart     Não reiniciar o serviço ao final.
  -h, --help       Esta ajuda.

Antes de aplicar: pare o serviço (docker compose stop lume) para não escrever no meio.
O db.json atual é preservado como db.json.pre-restore.<timestamp>.
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

[[ -n "$BACKUP" ]] || { uso; die "informe --backup ARQUIVO.tar.gz"; }
[[ -f "$BACKUP" ]] || die "backup não encontrado: $BACKUP"

tar -tzf "$BACKUP" >/dev/null 2>&1 || die "arquivo não é um tar.gz válido: $BACKUP"

# Localiza o db.json dentro do arquivo (raiz ou subpasta).
ENTRADA_DB="$(tar -tzf "$BACKUP" | grep -E '(^|/)db\.json$' | head -1 || true)"
[[ -n "$ENTRADA_DB" ]] || die "backup não contém db.json (não parece ser um backup do Lume)"

# Pasta raiz dentro do tar ("" quando o db.json está na raiz).
PASTA="${ENTRADA_DB%/db.json}"
if [[ -z "$PASTA" ]]; then
  STRIP=0
else
  STRIP="$(awk -F/ '{print NF}' <<<"$PASTA")"
fi

log "==================== RESTORE LUME ===================="
log "Modo        : $([[ "$MODO" == apply ]] && echo APLICAR || echo "DRY-RUN")"
log "Backup      : $BACKUP"
log "Destino     : $DATA_DIR"
log "db.json no tar: $ENTRADA_DB"
log "======================================================"

if [[ "$MODO" != "apply" ]]; then
  log "DRY-RUN: nada foi alterado."
  log "Aplicaria: tar -xzf \"$BACKUP\" -C \"$DATA_DIR\" --strip-components=$STRIP"
  log "Para aplicar de verdade: bash scripts/restore.sh --backup \"$BACKUP\" --data-dir \"$DATA_DIR\" --apply"
  exit 0
fi

[[ -d "$DATA_DIR" ]] || die "destino não é um diretório: $DATA_DIR"

if [[ -z "$ASSUMIR" ]]; then
  printf 'Confirma restaurar %s em %s? [s/N] ' "$BACKUP" "$DATA_DIR" >&2
  read -r resp || true
  [[ "$resp" == "s" || "$resp" == "S" || "$resp" == "sim" ]] || die "cancelado."
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
tar -xzf "$BACKUP" -C "$TMP" --strip-components="$STRIP"

# Preserva o db.json atual antes de sobrescrever.
if [[ -f "$DATA_DIR/db.json" ]]; then
  SEGURO="$DATA_DIR/db.json.pre-restore.$(date +%Y%m%d%H%M%S)"
  cp -p "$DATA_DIR/db.json" "$SEGURO"
  log "db.json atual preservado em: $SEGURO"
fi

# Copia o conteúdo restaurado por cima dos dados atuais.
cp -a "$TMP"/. "$DATA_DIR"/

# Ajusta dono quando possível (systemd) sem falhar se não for root.
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
