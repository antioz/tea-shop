#!/bin/bash
# Деплой shop-api в каталог tea-shop (облако клиента): npm ci + zip (с node_modules) + новая версия функции.
# Env из .deploy.env (не в git). Профиль yc — строго tea-shop, не default.
set -euo pipefail
cd "$(dirname "$0")"
YC=~/yandex-cloud/bin/yc
PROFILE=tea-shop
npm ci --omit=dev --no-audit --no-fund
rm -f shop-api.zip
zip -qr shop-api.zip index.js package.json node_modules
while IFS= read -r line || [[ -n "$line" ]]; do
  if [[ "$line" =~ ^[A-Z][A-Z0-9_]*= ]] && [[ "$line" == *,* || "$line" == *'"'* ]]; then
    echo 'env value contains , or " — not supported by yc --environment' >&2
    exit 1
  fi
done < .deploy.env
ARGS=()
while IFS= read -r line || [[ -n "$line" ]]; do [[ "$line" =~ ^[A-Z][A-Z0-9_]*= ]] && ARGS+=(--environment "$line"); done < .deploy.env
$YC --profile "$PROFILE" serverless function version create \
  --function-name shop-api --runtime nodejs18 --entrypoint index.handler \
  --memory 256m --execution-timeout 20s --service-account-id "$(grep '^SA_ID=' .deploy.env | cut -d= -f2)" \
  --source-path shop-api.zip "${ARGS[@]}"
echo "deployed: $($YC --profile "$PROFILE" serverless function get shop-api --format json | python3 -c 'import json,sys;print(json.load(sys.stdin)["http_invoke_url"])')"
