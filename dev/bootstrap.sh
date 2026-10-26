#!/usr/bin/env bash
# Run inside the bench container:
#   docker compose -f dev/compose.yaml exec bench bash /workspace/keynav/dev/bootstrap.sh
set -euo pipefail

BENCH_ROOT=/home/frappe/bench-data
BENCH_DIR=$BENCH_ROOT/frappe-bench
APP_DIR=/workspace/keynav
SITE=keynav.test

source <(grep -E '^[A-Z_]+=' "$APP_DIR/.github/versions.env")

sudo chown frappe:frappe "$BENCH_ROOT"
cd "$BENCH_ROOT"

if [ ! -d "$BENCH_DIR/apps/frappe" ]; then
  src=$(mktemp -d)
  git -C "$src" init -q
  git -C "$src" fetch -q --depth 1 https://github.com/frappe/frappe "$FRAPPE_COMMIT"
  git -C "$src" checkout -q -b "$FRAPPE_BRANCH" FETCH_HEAD
  bench init --frappe-branch "$FRAPPE_BRANCH" --frappe-path "$src" \
    --skip-redis-config-generation --skip-assets frappe-bench
  rm -rf "$src"
fi

cd "$BENCH_DIR"
bench set-config -g db_host db
bench set-config -g redis_cache redis://redis:6379
bench set-config -g redis_queue redis://redis:6379
bench set-config -g redis_socketio redis://redis:6379

[ -d apps/keynav ] || bench get-app --soft-link "$APP_DIR"

if [ ! -d "sites/$SITE" ]; then
  bench new-site "$SITE" --db-root-password 123 --admin-password admin --mariadb-user-host-login-scope=%
fi
bench --site "$SITE" list-apps | grep -qx keynav || bench --site "$SITE" install-app keynav
bench --site "$SITE" set-config developer_mode 1
bench use "$SITE"

bench build
(cd sites && ../env/bin/python "$APP_DIR/dev/seed_demo.py" "$SITE")
