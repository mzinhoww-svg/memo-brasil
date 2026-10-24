#!/bin/sh
# Inspeciona PDFs de convite: caixas (pdfinfo), fontes embutidas (pdffonts) e render a 300 dpi (pdftoppm). Uso: sh inspect-invite-pdfs.sh <pasta>
set -eu
cd "$1"
for f in *.pdf; do
  echo "== $f"
  pdfinfo -box "$f" | grep -E "Pages|Page size|MediaBox|TrimBox|BleedBox|ArtBox|PDF version|Title"
  pdffonts "$f" | tail -n +3
  pdftoppm -r 300 -png "$f" "${f%.pdf}"
done
