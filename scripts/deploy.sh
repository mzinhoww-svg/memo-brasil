#!/usr/bin/env bash
#
# deploy.sh — publica o Lume (Memo Brasil) de forma IDEMPOTENTE.
#
# Seguro por padrão: sem argumentos ele NÃO muda nada, apenas mostra o plano (DRY-RUN).
# Para publicar de verdade:  bash scripts/deploy.sh --apply
#
# Não imprime segredos e NÃO faz `source` do .env (lê só as chaves que precisa).
# Não conecta em nenhum host: rodar na própria VPS, dentro do repositório.
# Uso:
#   bash scripts/deploy.sh                          # dry-run (padrão)
#   bash scripts/deploy.sh --apply                  # backup, build, up e healthcheck
#   bash scripts/deploy.sh --apply --skip-backup    # só se souber o risco
#   bash scripts/deploy.sh --rollback               # volta para a imagem anterior registrada
#   bash scripts/deploy.sh --help
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE_BASE="memo-brasil"
ENV_FILE="${DEPLOY_ENV_FILE:-$ROOT/.env}"
STATE_DIR="$ROOT/.deploy"
HEALTH_PATH="/api/config"
HEALTH_RETRIES="${HEALTH_RETRIES:-30}"
HEALTH_SLEEP="${HEALTH_SLEEP:-2}"
COMPOSE="docker compose"
CURRENT_TAG_OVERRIDE=""
FAZER_BACKUP="sim"

MODO="dry-run"
NO_CACHE=""
ACAO="deploy"

uso() {
  cat <<'TXT'
deploy.sh — publica o Lume (Memo Brasil) com Docker Compose + Caddy (HTTPS automático).

Opções:
  --dry-run          Mostra o plano e não muda nada (PADRÃO).
  --apply            Executa o plano de verdade (backup, build, up, healthcheck).
  --rollback         Volta para a imagem anterior registrada em .deploy/previous-tag.
  --skip-backup      Não roda scripts/backup.sh antes de subir (perigoso).
  --no-cache         Reconstrói a imagem ignorando o cache do Docker.
  --env-file ARQ     Arquivo de variáveis (padrão: ./.env; env DEPLOY_ENV_FILE).
  --state-dir DIR    Onde guardar o previous-tag (padrão: ./.deploy).
  --current-tag TAG  Simula a versão em execução no dry-run (teste da lógica de rollback).
  -h, --help         Esta ajuda.

Como testar/publicar:
  1) cp .env.example .env  e preencha DOMINIO, PUBLIC_URL, MASTER_TOKEN, etc.
  2) bash scripts/deploy.sh            # confira o plano
  3) bash scripts/deploy.sh --apply    # publica (faz backup antes de subir)
  4) Se algo falhar: bash scripts/deploy.sh --rollback
TXT
}

log()  { printf '%s\n' "$*"; }
warn() { printf 'AVISO: %s\n' "$*" >&2; }
die()  { printf 'ERRO: %s\n' "$*" >&2; exit 1; }

# Executa um comando só quando --apply; em dry-run apenas mostra a linha (determinística).
run() {
  if [[ "$MODO" == "apply" ]]; then
    log "+ $*"
    "$@"
  else
    log "  $*"
  fi
}

# Lê uma chave do .env SEM fazer source (não executa o arquivo, não exporta o resto).
ler_env() {
  local chave="$1" arquivo="$2" linha valor
  [[ -f "$arquivo" ]] || return 0
  linha="$(grep -E "^[[:space:]]*${chave}=" "$arquivo" 2>/dev/null | tail -1 || true)"
  [[ -z "$linha" ]] && return 0
  valor="${linha#*=}"
  valor="${valor%$'\r'}"
  case "$valor" in
    \"*\") valor="${valor#\"}"; valor="${valor%\"}" ;;
    \'*\') valor="${valor#\'}"; valor="${valor%\'}" ;;
  esac
  printf '%s' "$valor"
}

# ── Argumentos ─────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --apply)        MODO="apply" ;;
    --dry-run)      MODO="dry-run" ;;
    --rollback)     ACAO="rollback" ;;
    --skip-backup)  FAZER_BACKUP="nao" ;;
    --no-cache)     NO_CACHE="--no-cache" ;;
    --env-file)     shift; ENV_FILE="${1:-}" ;;
    --state-dir)    shift; STATE_DIR="${1:-}" ;;
    --current-tag)  shift; CURRENT_TAG_OVERRIDE="${1:-}" ;;
    -h|--help)      uso; exit 0 ;;
    *)              die "opção desconhecida: $1 (use --help)" ;;
  esac
  shift
done

# ── Variáveis do app (sem source; só as chaves usadas aqui) ─────────────────
if [[ -f "$ENV_FILE" ]]; then
  log "Variáveis lidas de: $ENV_FILE"
else
  warn "arquivo de variáveis não encontrado: $ENV_FILE (usando o ambiente atual)"
fi
[[ -n "${DOMINIO:-}" ]]    || DOMINIO="$(ler_env DOMINIO "$ENV_FILE")"
[[ -n "${PUBLIC_URL:-}" ]] || PUBLIC_URL="$(ler_env PUBLIC_URL "$ENV_FILE")"
export DOMINIO PUBLIC_URL

# Repassa o mesmo .env ao compose (que também lê ./.env por padrão).
COMPOSE_ENV=""
[[ -f "$ENV_FILE" ]] && COMPOSE_ENV="--env-file $ENV_FILE"

faltando=()
[[ -n "${DOMINIO:-}"    ]] || faltando+=(DOMINIO)
[[ -n "${PUBLIC_URL:-}" ]] || faltando+=(PUBLIC_URL)

if [[ "$MODO" == "apply" && ${#faltando[@]} -gt 0 ]]; then
  die "variáveis obrigatórias ausentes: ${faltando[*]}. Preencha o .env (veja .env.example)."
fi
if [[ ${#faltando[@]} -gt 0 ]]; then
  warn "no --apply estas variáveis serão exigidas: ${faltando[*]}"
fi

# ── Ferramentas ──────────────────────────────────────────────────────────────
if ! command -v docker >/dev/null 2>&1; then
  [[ "$MODO" == "apply" ]] && die "docker não encontrado no PATH."
  warn "docker não encontrado (só importa no --apply)."
fi
if command -v docker >/dev/null 2>&1 && ! docker compose version >/dev/null 2>&1; then
  [[ "$MODO" == "apply" ]] && die "plugin 'docker compose' indisponível."
  warn "plugin 'docker compose' indisponível (só importa no --apply)."
fi

TAG="$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo local)"

log ""
log "==================== DEPLOY LUME ===================="
log "Modo          : $([[ "$MODO" == apply ]] && echo APLICAR || echo "DRY-RUN (nada será alterado)")"
log "Ação          : $ACAO"
log "Repositório   : $ROOT"
log "Imagem        : ${IMAGE_BASE}:${TAG}"
log "Compose       : $COMPOSE"
log "Variáveis     : $ENV_FILE"
log "Estado        : $STATE_DIR"
log "Healthcheck   : ${PUBLIC_URL:-<PUBLIC_URL>}${HEALTH_PATH}"
log "===================================================="
log ""

# Registra a imagem anterior para rollback. Nunca sobrescreve com a MESMA versão:
# um redeploy da versão em execução (ou de uma quebrada) mantém o último bom.
registrar_rollback() {
  local atual="$1" existente=""
  [[ -f "$STATE_DIR/previous-tag" ]] && existente="$(cat "$STATE_DIR/previous-tag" 2>/dev/null || true)"
  if [[ -z "$atual" ]]; then
    log "  (nenhuma imagem em execução; previous-tag mantido: ${existente:-<vazio>})"
    return 0
  fi
  if [[ "$atual" == "$TAG" ]]; then
    log "  (mesma versão em execução; previous-tag preservado: ${existente:-<vazio>})"
    return 0
  fi
  if [[ "$MODO" == "apply" ]]; then
    mkdir -p "$STATE_DIR"
    printf '%s\n' "$atual" > "$STATE_DIR/previous-tag"
    log "  previous-tag registrado: $atual"
  else
    log "  (dry-run) previous-tag seria registrado: $atual"
  fi
}

if [[ "$ACAO" == "rollback" ]]; then
  if [[ ! -f "$STATE_DIR/previous-tag" ]]; then
    die "sem imagem anterior registrada em $STATE_DIR/previous-tag — nada para reverter."
  fi
  TAG="$(cat "$STATE_DIR/previous-tag")"
  log "Revertendo para a imagem ${IMAGE_BASE}:${TAG} (previous-tag preservado)"
  export IMAGE_TAG="$TAG"
  run $COMPOSE $COMPOSE_ENV up -d --remove-orphans
  run $COMPOSE $COMPOSE_ENV ps
  exit 0
fi

# ── Passos ───────────────────────────────────────────────────────────────────
log "[1/7] Registrar a imagem em execução (para rollback)"
if [[ "$MODO" == "apply" ]]; then
  ATUAL="$(docker inspect -f '{{.Config.Image}}' "$( $COMPOSE ps -q lume 2>/dev/null || true )" 2>/dev/null || true)"
  registrar_rollback "${ATUAL##*:}"
else
  registrar_rollback "$CURRENT_TAG_OVERRIDE"
fi

log "[2/7] Backup dos dados antes de subir"
if [[ "$FAZER_BACKUP" == "sim" ]]; then
  if [[ "$MODO" == "apply" ]]; then
    if [[ -n "$( $COMPOSE ps -q lume 2>/dev/null || true )" ]]; then
      log "+ $COMPOSE exec -T lume bash scripts/backup.sh"
      $COMPOSE $COMPOSE_ENV exec -T lume bash scripts/backup.sh \
        || die "backup falhou; deploy abortado para não subir sem cópia. Resolva ou use --skip-backup."
      log "  ok: backup criado em DATA_DIR/backups"
    else
      log "  (sem container em execução: primeira publicação, nada para backupear)"
    fi
  else
    log "  $COMPOSE exec -T lume bash scripts/backup.sh   (backup dos dados antes de subir)"
  fi
else
  warn "backup ANTES do deploy desativado (--skip-backup)."
fi

log "[3/7] Construir a imagem ${IMAGE_BASE}:${TAG}"
export IMAGE_TAG="$TAG"
run $COMPOSE $COMPOSE_ENV build ${NO_CACHE:+$NO_CACHE}

log "[4/7] Publicar/atualizar os serviços (idempotente)"
run $COMPOSE $COMPOSE_ENV up -d --remove-orphans

log "[5/7] Reetiquetar como 'latest'"
run docker tag "${IMAGE_BASE}:${TAG}" "${IMAGE_BASE}:latest"

log "[6/7] Verificar a saúde de ${PUBLIC_URL:-<PUBLIC_URL>}${HEALTH_PATH}"
if [[ "$MODO" == "apply" ]]; then
  ok=""
  for i in $(seq 1 "$HEALTH_RETRIES"); do
    if curl -fsS --max-time 5 "${PUBLIC_URL}${HEALTH_PATH}" >/dev/null 2>&1; then ok="sim"; break; fi
    log "  ... aguardando (${i}/${HEALTH_RETRIES})"
    sleep "$HEALTH_SLEEP"
  done
  if [[ -z "$ok" ]]; then
    warn "healthcheck não respondeu a tempo em ${PUBLIC_URL}${HEALTH_PATH}."
    warn "Reveja os logs: $COMPOSE logs --tail=100 lume caddy"
    warn "Para reverter: bash scripts/deploy.sh --rollback"
    exit 1
  fi
  log "  ok: app respondendo"
else
  run curl -fsS "${PUBLIC_URL:-<PUBLIC_URL>}${HEALTH_PATH}"
fi

log "[7/7] Limpar imagens antigas sem uso"
run docker image prune -f

log ""
if [[ "$MODO" == apply ]]; then
  log "Publicado. ${PUBLIC_URL}"
else
  log "DRY-RUN concluído. Para aplicar de verdade: bash scripts/deploy.sh --apply"
fi
