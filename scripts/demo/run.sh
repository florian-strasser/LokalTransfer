#!/usr/bin/env bash
#
# One-command demo screenshots. Builds the app, spins up a throwaway seeded
# database and a server on a spare port (never :3000), and captures every page
# in each configured language into demo-screenshots/<lang>/, plus a browsable
# index.html.
#
#   bash scripts/demo/run.sh            # or: pnpm demo:screenshots
#
# Override anything via env:
#   DEMO_DB_HOST/USER/PASS/NAME   MySQL connection (default 127.0.0.1/root/root1234/lokaltransfer_demo)
#   DEMO_PORT                     server port (default 3100)
#   DEMO_LANGS                    space-separated locales (default "en de")
#   DEMO_OUT                      output dir (default demo-screenshots)
#   README_SHOT                   README screenshot written on each run
#                                 (default docs/readme-screenshot.webp)
#   README_SHOT_VIEW              which capture to use for it (default 04-download-list)
#   DEMO_BACKGROUND_SRC           a photo to use as the background (default: a generated gradient)
#   SKIP_BUILD=1                  reuse the existing .output build
#   KEEP_DB=1                     don't drop the demo database at the end
set -euo pipefail
cd "$(dirname "$0")/../.."

# Match the project's Node (the shell may default to an older version).
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && nvm use 22 >/dev/null 2>&1 || true

DEMO_DB_HOST="${DEMO_DB_HOST:-127.0.0.1}"
DEMO_DB_USER="${DEMO_DB_USER:-root}"
DEMO_DB_PASS="${DEMO_DB_PASS:-root1234}"
DEMO_DB_NAME="${DEMO_DB_NAME:-lokaltransfer_demo}"
DEMO_PORT="${DEMO_PORT:-3100}"
DEMO_LANGS="${DEMO_LANGS:-en de}"
DEMO_OUT="${DEMO_OUT:-demo-screenshots}"
DEMO_TOKEN="${DEMO_TOKEN:-demo-token-florian}"
DEMO_GUEST_TOKEN="${DEMO_GUEST_TOKEN:-demo-token-guest}"
DEMO_STORAGE="${DEMO_STORAGE:-.demo-storage}"
DEMO_TOKENS_FILE="${DEMO_TOKENS_FILE:-.demo-tokens.json}"

# The screenshot the README links to; refreshed on every run so it can never
# show a version of the interface that no longer exists.
README_SHOT="${README_SHOT:-docs/readme-screenshot.webp}"
# The download page — what a recipient actually lands on, and the thing the whole
# app exists to produce. The dashboard shows more state, but a stranger reading
# the repository wants to see the product, not its admin view.
README_SHOT_VIEW="${README_SHOT_VIEW:-04-download-list}"

export DEMO_DB_HOST DEMO_DB_USER DEMO_DB_PASS DEMO_DB_NAME
export DEMO_TOKEN DEMO_GUEST_TOKEN DEMO_STORAGE DEMO_TOKENS_FILE
export DEMO_BASE_URL="http://127.0.0.1:${DEMO_PORT}"
export DEMO_LANGS

LOG="$(mktemp)"
SERVER_PID=""
mysql_do() { MYSQL_PWD="$DEMO_DB_PASS" mysql -h"$DEMO_DB_HOST" -u"$DEMO_DB_USER" "$@"; }

stop_server() {
  if [ -n "$SERVER_PID" ]; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
    SERVER_PID=""
  fi
}
cleanup() {
  stop_server
  if [ "${KEEP_DB:-0}" != "1" ]; then
    mysql_do -e "DROP DATABASE IF EXISTS \`${DEMO_DB_NAME}\`;" 2>/dev/null || true
    rm -rf "$DEMO_STORAGE" "$DEMO_TOKENS_FILE"
  fi
  rm -f public/demo-background.png
  rm -f "$LOG"
}
trap cleanup EXIT

start_server() { # $1 = language
  # Every NUXT_* variable the app reads is set explicitly. The repo's own .env
  # describes a developer's machine — and currently points at production — so
  # inheriting from it would either fail to connect or, far worse, succeed.
  NUXT_MYSQL_HOST="$DEMO_DB_HOST" NUXT_MYSQL_USER="$DEMO_DB_USER" NUXT_MYSQL_PASSWORD="$DEMO_DB_PASS" \
  NUXT_MYSQL_DATABASE="$DEMO_DB_NAME" NUXT_MYSQL_SSL=false \
  NUXT_STORAGE_PATH="$DEMO_STORAGE" \
  NUXT_APP_URL="$DEMO_BASE_URL" NUXT_LANGUAGE="$1" NUXT_TIMEZONE=Europe/Berlin \
  NUXT_PUBLIC_BACKGROUND_IMAGE="${NUXT_PUBLIC_BACKGROUND_IMAGE:-}" \
  NUXT_EMAIL_TRANSPORT=json \
  NUXT_ADMIN_EMAIL= NUXT_ADMIN_PASSWORD= \
  PORT="$DEMO_PORT" NITRO_PORT="$DEMO_PORT" \
    node .output/server/index.mjs >"$LOG" 2>&1 &
  SERVER_PID=$!
  for _ in $(seq 1 60); do
    code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "$DEMO_BASE_URL/" || true)"
    case "$code" in 200|302) return 0 ;; esac
    if ! kill -0 "$SERVER_PID" 2>/dev/null; then echo "server exited early:"; cat "$LOG"; exit 1; fi
    sleep 1
  done
  echo "server did not become ready on :$DEMO_PORT"; cat "$LOG"; exit 1
}

# The download page puts its card on the left specifically to leave room for a
# background image, so the demo ships one — a run without it shows the layout
# with nothing to justify it.
#
# It has to exist *before* the build: Nitro serves public assets from a manifest
# baked in at build time, not by scanning the directory, so a file dropped into
# `.output/public` afterwards is simply invisible and 404s. Generated into the
# repo's `public/` (gitignored) and removed again on exit.
# DEMO_BACKGROUND_SRC points at a real photograph; without it a gradient is
# generated, so the script still runs anywhere with no assets to check in.
DEMO_BACKGROUND_FILE="public/demo-background.png"
if [ -n "${DEMO_BACKGROUND_SRC:-}" ] && [ -f "${DEMO_BACKGROUND_SRC}" ]; then
  echo "==> using the supplied background: $DEMO_BACKGROUND_SRC"
  cp "$DEMO_BACKGROUND_SRC" "$DEMO_BACKGROUND_FILE"
else
  echo "==> generating the demo background (set DEMO_BACKGROUND_SRC to use a photo)"
  node scripts/demo/images.mjs "$DEMO_BACKGROUND_FILE" >/dev/null
fi

if [ "${SKIP_BUILD:-0}" != "1" ]; then
  echo "==> building app (SKIP_BUILD=1 to reuse the existing build)"
  pnpm run build
fi

# Only advertise it if the build actually carries it — with SKIP_BUILD=1 the
# existing build may predate it, and a background that 404s renders as a broken
# image, which is worse than no background at all.
if [ -f ".output/public/demo-background.png" ]; then
  export NUXT_PUBLIC_BACKGROUND_IMAGE="/demo-background.png"
else
  echo "==> no background in this build (SKIP_BUILD with an older build?); continuing without one"
fi

echo "==> resetting demo database '$DEMO_DB_NAME' and storage '$DEMO_STORAGE'"
mysql_do -e "DROP DATABASE IF EXISTS \`${DEMO_DB_NAME}\`; CREATE DATABASE \`${DEMO_DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;"
rm -rf "$DEMO_STORAGE"

first=1
hero_done=0
for lang in $DEMO_LANGS; do
  echo "==> starting server (NUXT_LANGUAGE=$lang) on :$DEMO_PORT"
  start_server "$lang"

  if [ "$first" = "1" ]; then
    # Seeded after the first boot, which is what creates the schema.
    echo "==> seeding demo data"
    node scripts/demo/seed.mjs >"$DEMO_TOKENS_FILE"
    first=0
  fi

  echo "==> capturing screenshots -> $DEMO_OUT/$lang"
  mkdir -p "$DEMO_OUT/$lang"
  node scripts/demo/screenshots.mjs "$DEMO_OUT/$lang"

  # The README's screenshot is one of these captures, so it cannot go stale:
  # every run refreshes it from the first language's.
  if [ "$hero_done" != "1" ] && [ -f "$DEMO_OUT/$lang/$README_SHOT_VIEW.png" ]; then
    if command -v cwebp >/dev/null 2>&1; then
      echo "==> refreshing README screenshot -> $README_SHOT"
      mkdir -p "$(dirname "$README_SHOT")"
      cwebp -quiet -q 82 -resize 1440 0 "$DEMO_OUT/$lang/$README_SHOT_VIEW.png" -o "$README_SHOT"
      hero_done=1
    else
      echo "==> skipping README screenshot refresh: cwebp not installed (brew install webp)"
    fi
  fi

  stop_server
done

node scripts/demo/gallery.mjs "$DEMO_OUT"
echo "==> done. open $DEMO_OUT/index.html"
