#!/bin/sh
# Deploy without npm install: preserve the server's Linux Prisma engine and
# replace only the generated client metadata from this release.
set -eu

ROOT=/home/frog/giftvault
ARCHIVE=${1:-/home/frog/julka-mikrus-release-v4.zip}
STAMP=$(date +%Y%m%d-%H%M%S)
STAGE=/tmp/gift-vault-release-$STAMP
BACKUP=$ROOT/data/backups/pre-deploy-$STAMP
APP_STOPPED=0
BACKUP_READY=0
DB_MAY_HAVE_CHANGED=0

fail() { echo "DEPLOY STOP: $*" >&2; exit 1; }
start_available_app() {
  cd "$ROOT"
  nohup env NODE_PATH=/home/frog/giftvault-runtime-bundle/node_modules NODE_ENV=production \
    node "$ROOT/dist/server/index.js" </dev/null >/tmp/gift-vault.log 2>&1 &
}
on_exit() {
  rc=$?
  trap - EXIT
  if [ "$rc" -ne 0 ] && [ "$APP_STOPPED" -eq 1 ]; then
    if [ "$BACKUP_READY" -eq 1 ]; then
      echo "Deployment failed; restoring the previous app files." >&2
      tar -xzf "$BACKUP/app-files.tar.gz" -C "$ROOT" || true
      if [ "$DB_MAY_HAVE_CHANGED" -eq 1 ]; then
        cp -f "$BACKUP/gift-vault.db" "$ROOT/data/gift-vault.db" || true
        for suffix in -wal -shm; do
          if [ -f "$BACKUP/gift-vault.db$suffix" ]; then
            cp -f "$BACKUP/gift-vault.db$suffix" "$ROOT/data/"
          else
            rm -f "$ROOT/data/gift-vault.db$suffix"
          fi
        done
      fi
    fi
    start_available_app || true
    echo "Previous app restart requested. Log: /tmp/gift-vault.log. Backup: $BACKUP" >&2
  fi
  rm -rf "$STAGE"
  exit "$rc"
}
trap on_exit EXIT

[ -d "$ROOT" ] || fail "project directory not found"
[ -f "$ROOT/.env" ] || fail "server .env is missing"
[ -f "$ROOT/data/gift-vault.db" ] || fail "database not found"
[ -f "$ARCHIVE" ] || fail "release ZIP is missing: $ARCHIVE"
command -v node >/dev/null 2>&1 || fail "node is not installed"
command -v python3 >/dev/null 2>&1 || fail "python3 is not installed"
command -v unzip >/dev/null 2>&1 || fail "unzip is not installed"
command -v tar >/dev/null 2>&1 || fail "tar is not installed"
curl -fsS --max-time 5 http://127.0.0.1:31825/api/health >/dev/null || fail "the current app is not healthy"

CLIENT_PACKAGE=$(cd "$ROOT" && NODE_PATH=/home/frog/giftvault-runtime-bundle/node_modules node -p "require.resolve('@prisma/client/package.json')")
MODULE_ROOT=$(dirname "$(dirname "$(dirname "$CLIENT_PACKAGE")")")
CLIENT_DIR=$MODULE_ROOT/.prisma/client
ENGINE=$(find "$CLIENT_DIR" -maxdepth 1 -type f -name 'libquery_engine-*.so.node' | head -1)
[ -n "$ENGINE" ] || fail "the existing Linux Prisma engine was not found"

mkdir -p "$STAGE"
unzip -t "$ARCHIVE" >/dev/null || fail "release ZIP is invalid"
unzip -oq "$ARCHIVE" -d "$STAGE"
for required in server dist/server client/dist prisma/schema.prisma prisma/migrate-sqlite.py prisma/migrate-tenancy.js generated-prisma-client/index.js package.json package-lock.json; do
  [ -e "$STAGE/$required" ] || fail "release is missing $required"
done

mkdir -p "$BACKUP"
PIDS=$(ps w | awk '/node .*dist\/server\/index\.js/ && $0 !~ /awk/ {print $1}')
for pid in $PIDS; do kill -TERM "$pid" 2>/dev/null || true; done
if [ -n "$PIDS" ]; then
  n=0
  while [ "$n" -lt 20 ]; do
    alive=0
    for pid in $PIDS; do kill -0 "$pid" 2>/dev/null && alive=1 || true; done
    [ "$alive" -eq 0 ] && break
    sleep 1
    n=$((n + 1))
  done
  [ "$alive" -eq 0 ] || fail "existing app did not stop"
fi
APP_STOPPED=1

cp -p "$ROOT/data/gift-vault.db" "$BACKUP/gift-vault.db"
for suffix in -wal -shm; do
  [ ! -f "$ROOT/data/gift-vault.db$suffix" ] || cp -p "$ROOT/data/gift-vault.db$suffix" "$BACKUP/"
done
tar -czf "$BACKUP/uploads.tar.gz" -C "$ROOT/data" uploads
tar -czf "$BACKUP/app-files.tar.gz" -C "$ROOT" server dist/server client/dist prisma package.json package-lock.json
BACKUP_READY=1

cp -R "$STAGE/server" "$ROOT/"
mkdir -p "$ROOT/dist" "$ROOT/client" "$CLIENT_DIR"
cp -R "$STAGE/dist/server" "$ROOT/dist/"
cp -R "$STAGE/client/dist" "$ROOT/client/"
cp -R "$STAGE/prisma" "$ROOT/"
cp -f "$STAGE/package.json" "$STAGE/package-lock.json" "$ROOT/"
cp -R "$STAGE/generated-prisma-client/." "$CLIENT_DIR/"

cd "$ROOT"
set -a
. "$ROOT/.env"
set +a
DB_MAY_HAVE_CHANGED=1
python3 "$ROOT/prisma/migrate-sqlite.py"
NODE_PATH=/home/frog/giftvault-runtime-bundle/node_modules NODE_ENV=production PRISMA_QUERY_ENGINE_LIBRARY="$ENGINE" \
  node "$ROOT/prisma/migrate-tenancy.js"

nohup env NODE_PATH=/home/frog/giftvault-runtime-bundle/node_modules NODE_ENV=production PRISMA_QUERY_ENGINE_LIBRARY="$ENGINE" \
  node "$ROOT/dist/server/index.js" </dev/null >/tmp/gift-vault.log 2>&1 &
NEW_PID=$!
n=0
while [ "$n" -lt 15 ]; do
  if curl -fsS --max-time 3 http://127.0.0.1:31825/api/health >/dev/null 2>&1; then
    APP_STOPPED=0
    echo "Release is healthy (PID $NEW_PID). Backup: $BACKUP"
    exit 0
  fi
  sleep 1
  n=$((n + 1))
done
fail "new app did not pass its health check; inspect /tmp/gift-vault.log; backup: $BACKUP"
