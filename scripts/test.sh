#!/usr/bin/env bash
# يبني النسخة، يخدم dist، ويشغّل كل مجموعات الفحص عليها.
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION="${1:-$(grep -oP "APP_VERSION = '\K[0-9.]+" src/shell.js)}"
echo "▶ البناء $VERSION"
python3 build.py "$VERSION"

rm -rf .testsrv && mkdir -p .testsrv && cp -r dist .testsrv/unified-admin
python3 -m http.server 8765 --directory .testsrv >/dev/null 2>&1 &
SRV=$!
trap 'kill $SRV 2>/dev/null || true; rm -rf .testsrv' EXIT
sleep 2

FAILED=0
for t in tests/test*.js; do
  printf '\n▶ %s\n' "$t"
  node "$t" || FAILED=1
done

if [ "$FAILED" -ne 0 ]; then echo "✘ في مجموعات فاشلة"; exit 1; fi
echo "✔ كل المجموعات نجحت"
