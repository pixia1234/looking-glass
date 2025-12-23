#!/bin/sh
set -e

API_BASE_VALUE="${LG_API_BASE:-}"

cat <<CONFIG > /usr/share/nginx/html/config.js
window.LG_API_BASE = "${API_BASE_VALUE}";
CONFIG

exec nginx -g "daemon off;"
