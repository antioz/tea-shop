#!/bin/bash
# Деплой sklad-api: zip + новая версия функции. Env из .deploy.env (не в git).
set -euo pipefail
cd "$(dirname "$0")"
YC=~/yandex-cloud/bin/yc
PROFILE=tea-shop
rm -f sklad-api.zip
zip -qr sklad-api.zip index.js specs.js package.json
while IFS= read -r line || [[ -n "$line" ]]; do
  if [[ "$line" =~ ^[A-Z][A-Z0-9_]*= ]] && [[ "$line" == *,* || "$line" == *'"'* ]]; then
    echo 'env value contains , or " — not supported by yc --environment' >&2
    exit 1
  fi
done < .deploy.env
ARGS=()
while IFS= read -r line || [[ -n "$line" ]]; do [[ "$line" =~ ^[A-Z][A-Z0-9_]*= ]] && ARGS+=(--environment "$line"); done < .deploy.env
$YC --profile "$PROFILE" serverless function version create \
  --function-name sklad-api --runtime nodejs18 --entrypoint index.handler \
  --memory 128m --execution-timeout 20s --service-account-id "$(grep '^SA_ID=' .deploy.env | cut -d= -f2)" \
  --source-path sklad-api.zip "${ARGS[@]}"
echo "deployed: $($YC --profile "$PROFILE" serverless function get sklad-api --format json | python3 -c 'import json,sys;print(json.load(sys.stdin)["http_invoke_url"])')"
