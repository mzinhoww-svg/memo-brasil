#!/usr/bin/env bash
# Roda localmente o scan de segredos do CI (o app web tem o próprio pipeline em .github/workflows/ci.yml) e grava a evidência.
# Gate local enquanto o GitHub Actions está bloqueado por cobrança.
set -uo pipefail

OUT="${1:-scripts/ci-output.txt}"
mkdir -p "$(dirname "$OUT")"
echo "Gravando evidência em: $OUT"

echo "=== memo-brasil CI local ===" > "$OUT"
echo "data: $(date -Iseconds)" >> "$OUT"
echo "" >> "$OUT"

echo ">>> gitleaks detect --verbose" >> "$OUT"
# Escaneia os commits desta branch (o mesmo recorte que o gitleaks-action faz no PR).
# Sem isso, o scan pega fixtures de outras branches abertas e esconde o sinal.
BASE="$(git merge-base origin/main HEAD 2>/dev/null || true)"
if [ -n "$BASE" ]; then gitleaks detect --verbose --log-opts="$BASE..HEAD" >> "$OUT" 2>&1
else gitleaks detect --verbose >> "$OUT" 2>&1; fi
E3=$?
echo "gitleaks exit code: $E3" >> "$OUT"
echo "" >> "$OUT"

echo "=== RESUMO ===" >> "$OUT"
echo "gitleaks: $E3" >> "$OUT"

if [ "$E3" -ne 0 ]; then TOTAL=1; else TOTAL=0; fi
echo "exit code final: $TOTAL" >> "$OUT"

cat "$OUT"
exit "$TOTAL"
