#!/usr/bin/env bash

set -euo pipefail

MODE="${1:-test}"
shift || true

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

if [[ -f "${ROOT_DIR}/.env" ]]; then
  # shellcheck disable=SC1091
  set -a && source "${ROOT_DIR}/.env" && set +a
fi

if [[ -f "${ROOT_DIR}/.env.local" ]]; then
  # shellcheck disable=SC1091
  set -a && source "${ROOT_DIR}/.env.local" && set +a
fi

LOCAL_TUNNEL_PORT="${LOCAL_TUNNEL_PORT:-9223}"
PLAYWRIGHT_APP_URL="${PLAYWRIGHT_APP_URL:-http://localhost:5173}"

REMOTE_MODE="0"
PASSTHROUGH_ARGS=()

for arg in "$@"; do
  if [[ "$arg" == "-remote" ]]; then
    REMOTE_MODE="1"
    continue
  fi
  PASSTHROUGH_ARGS+=("$arg")
done

if [[ "${REMOTE_MODE}" == "1" ]]; then
  exec node "${ROOT_DIR}/scripts/run-remote-playwright.mjs" "${MODE}" "${PASSTHROUGH_ARGS[@]}"
fi

COMMAND=(playwright)

case "${MODE}" in
  test)
    COMMAND+=(test)
    ;;
  ui)
    COMMAND+=(test --ui)
    ;;
  debug)
    COMMAND+=(test --debug)
    ;;
  report)
    COMMAND+=(show-report)
    ;;
  *)
    echo "Modo invalido: ${MODE}. Use: test | ui | debug | report"
    exit 1
    ;;
esac

exec "${COMMAND[@]}" "${PASSTHROUGH_ARGS[@]}"
