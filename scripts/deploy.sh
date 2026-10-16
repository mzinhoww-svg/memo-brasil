#!/usr/bin/env bash
#
# deploy.sh — publica o Lume (Memo Brasil) de forma IDEMPOTENTE.
#
# Seguro por padrão: sem argumentos ele NÃO muda nada, apenas mostra o plano (DRY-RUN).
# Para publicar de verdade:  bash scripts/deploy.sh --apply
#
# Não imprime segredos. Não conecta em nenhum host: rodar na própria VPS, no repositório.
# Uso:
#   bash scripts/deploy.sh                 # dry-run (padrão)
#   bash scripts/deploy.sh --apply         # constrói a imagem, sobe e verifica a saúde
#   bash scripts/deploy.sh --apply --no-cache
#   bash scripts/deploy.sh --rollback      # volta para a imagem anterior registrada
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

MODO="dry-run"
NO_CACHE=""
ACAO="deploy"

uso() {
  cat <<'TXT'
deploy.sh — publica o Lume (Memo Brasil) com Docker Compose + Caddy (HTTPS automático).

Opções:
  --dry-run        Mostra o plano e não muda nada (PADRÃO).
  --apply          Executa o plano de verdade (build, up, healthcheck).
  --rollback       Volta para a imagem anterior registrada em .deploy/previous-tag.
  --no-cache       Reconstrói a imagem ignorando o cache do Docker.
  --env-file ARQ   Arquivo de variáveis (padrão: ./.env; env DEPLOY_ENV_FILE).
  -h, --help       Esta ajuda.

Como testar/deployar:
  1) cp .env.example .env  e preencha DOMINIO, PUBLIC_URL, MASTER_TOKEN, etc.
  2) bash scripts/deploy.sh            # confira o plano
  3) bash scripts/deploy.sh --apply    # publica
  4) Se algo falhar: bash scripts/deploy.sh --rollback

Rollback manual: docker compose up -d com IMAGE_TAG definido para a etiqueta anterior.
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

# ── Argumentos ─────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --apply)     MODO="apply" ;;
    --dry-run)   MODO="dry-run" ;;
    --rollback)  ACAO="rollback" ;;
    --no-cache)  NO_CACHE="--no-cache" ;;
    --env-file)  shift; ENV_FILE="${1:-}" ;;
    -h|--help)   uso; exit 0 ;;
    *)           die "opção desconhecida: $1 (use --help)" ;;
  esac
  shift
done

# ── Variáveis de ambiente do app ─────────────────────────────────────────────
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  set -a; . "$ENV_FILE"; set +a
  log "Variáveis carregadas de: $ENV_FILE"
else
  warn "arquivo de variáveis não encontrado: $ENV_FILE (usando o ambiente atual)"
fi

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
log "Healthcheck   : ${PUBLIC_URL:-<PUBLIC_URL>}${HEALTH_PATH}"
log "===================================================="
log ""

mkdir_estado() { mkdir -p "$STATE_DIR"; }

if [[ "$ACAO" == "rollback" ]]; then
  if [[ ! -f "$STATE_DIR/previous-tag" ]]; then
    die "sem imagem anterior registrada em $STATE_DIR/previous-tag — nada para reverter."
  fi
  TAG="$(cat "$STATE_DIR/previous-tag")"
  log "Revertendo para a imagem ${IMAGE_BASE}:${TAG}"
  export IMAGE_TAG="$TAG"
  run $COMPOSE up -d --remove-orphans
  run $COMPOSE ps
  exit 0
fi

# ── Passos ───────────────────────────────────────────────────────────────────
log "[1/6] Registrar a imagem em execução (para rollback)"
if [[ "$MODO" == "apply" ]]; then
  mkdir_estado
  ATUAL="$(docker inspect -f '{{.Config.Image}}' "$( $COMPOSE ps -q lume 2>/dev/null || true )" 2>/dev/null || true)"
  if [[ -n "$ATUAL" ]]; then
    printf '%s\n' "${ATUAL##*:}" > "$STATE_DIR/previous-tag"
    log "+ imagem atual registrada como: ${ATUAL##*:}"
  else
    log "  (nenhuma imagem em execução; primeira publicação)"
  fi
else
  log "  (dry-run) registraria a imagem atual em $STATE_DIR/previous-tag"
fi

log "[2/6] Construir a imagem ${IMAGE_BASE}:${TAG}"
export IMAGE_TAG="$TAG"
run $COMPOSE build ${NO_CACHE:+$NO_CACHE}

log "[3/6] Publicar/atualizar os serviços (idempotente)"
run $COMPOSE up -d --remove-orphans

log "[4/6] Reetiquetar como 'latest'"
run docker tag "${IMAGE_BASE}:${TAG}" "${IMAGE_BASE}:latest"

log "[5/6] Verificar a saúde de ${PUBLIC_URL:-<PUBLIC_URL>}${HEALTH_PATH}"
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

log "[6/6] Limpar imagens antigas sem uso"
run docker image prune -f

log ""
if [[ "$MODO" == apply ]]; then
  log "Publicado. ${PUBLIC_URL}"
else
  log "DRY-RUN concluído. Para aplicar de verdade: bash scripts/deploy.sh --apply"
fi
