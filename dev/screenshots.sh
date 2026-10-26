#!/usr/bin/env bash
# Regenerates docs/screenshots. Run bootstrap.sh once before.
set -euo pipefail

cd "$(dirname "$0")/.."
compose=(docker compose -f dev/compose.yaml)
"${compose[@]}" up -d bench
ping() { "${compose[@]}" exec -T bench curl -sf -o /dev/null http://localhost:8000/api/method/ping; }
ping || "${compose[@]}" exec -d bench bash /workspace/keynav/dev/serve.sh
until ping; do sleep 1; done
"${compose[@]}" run --rm screenshots
