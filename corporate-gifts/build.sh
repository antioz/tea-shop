#!/bin/bash
# Собирает две версии презентации из deck.html и печатает их в PDF через headless Chrome.
set -euo pipefail
cd "$(dirname "$0")"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

python3 - <<'EOF'
import re
src = open('deck.html', encoding='utf-8').read()
def strip(variant):
    # убираем секцию с data-variant="<variant>" целиком
    return re.sub(r'<section class="slide" data-variant="%s".*?</section>\s*' % variant, '', src, flags=re.S)
open('deck-with-jars.html', 'w', encoding='utf-8').write(strip('nojars'))
open('deck-no-jars.html', 'w', encoding='utf-8').write(strip('jars'))
EOF

for v in with-jars no-jars; do
  "$CHROME" --headless=new --disable-gpu --no-pdf-header-footer \
    --virtual-time-budget=8000 --run-all-compositor-stages-before-draw \
    --print-to-pdf="$PWD/Корпоративные подарки — $v.pdf" \
    "file://$PWD/deck-$v.html" 2>/dev/null
done
ls -la *.pdf
