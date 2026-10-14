#!/usr/bin/env bash
# Roda o mesmo pipeline do CI localmente e grava a evidência em arquivo.
set -euo pipefail

OUT="${1:-scripts/ci-output.txt}"
mkdir -p "$(dirname "$OUT")"
echo "Gravando evidência em: $OUT"

echo "=== memo-brasil CI local ===" > "$OUT"
echo "data: $(date -Iseconds)" >> "$OUT"
echo "" >> "$OUT"
echo ">>> npm ci" >> "$OUT"
npm ci >> "$OUT" 2>&1
E1=$?
echo "npm ci exit code: $E1" >> "$OUT"
echo "" >> "$OUT"

echo ">>> npm test" >> "$OUT"
npm test >> "$OUT" 2>&1
E2=$?
echo "npm test exit code: $E2" >> "$OUT"
echo "" >> "$OUT"

echo ">>> gitleaks detect --verbose" >> "$OUT"
gitleaks detect --verbose >> "$OUT" 2>&1
E3=$?
echo "gitleaks exit code: $E3" >> "$OUT"
echo "" >> "$OUT"

echo "=== RESUMO ===" >> "$OUT"
echo "npm ci: $E1" >> "$OUT"
echo "npm test: $E2" >> "$OUT"
echo "gitleaks: $E3" >> "$OUT"

TOTAL=$(( E1 || E2 || E3 ))
echo "exit code final: $TOTAL" >> "$OUT"

cat "$OUT"
exit "$TOTAL"
