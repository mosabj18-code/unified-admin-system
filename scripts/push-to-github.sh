#!/usr/bin/env bash
# يربط المستودع المحلي بـGitHub ويرفعه. الاستعمال:
#   ./scripts/push-to-github.sh <اسم-المستخدم> [اسم-المستودع]
set -euo pipefail
cd "$(dirname "$0")/.."

USER="${1:?اكتب اسم مستخدمك على GitHub: ./scripts/push-to-github.sh <username> [repo]}"
REPO="${2:-unified-admin-system}"

git remote remove origin 2>/dev/null || true
git remote add origin "https://github.com/$USER/$REPO.git"
git branch -M main
git push -u origin main

echo
echo "✔ تم الرفع: https://github.com/$USER/$REPO"
echo "  الرابط المباشر بعد ما ينتهي الـAction: https://$USER.github.io/$REPO/"
