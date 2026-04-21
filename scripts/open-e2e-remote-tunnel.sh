#!/usr/bin/env bash

set -euo pipefail

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

TABLET_USER="${TABLET_USER:-user}"
TABLET_HOST="${TABLET_HOST:-127.0.0.1}"
TABLET_CDP_PORT="${TABLET_CDP_PORT:-9222}"
LOCAL_TUNNEL_PORT="${LOCAL_TUNNEL_PORT:-9223}"
TABLET_SSH_CONNECT_TIMEOUT="${TABLET_SSH_CONNECT_TIMEOUT:-8}"
TABLET_SSH_STRICT_HOST_KEY_CHECKING="${TABLET_SSH_STRICT_HOST_KEY_CHECKING:-accept-new}"

SSH_BASE_COMMAND=(
  ssh
  -o ExitOnForwardFailure=yes
  -o ServerAliveInterval=30
  -o ConnectTimeout="${TABLET_SSH_CONNECT_TIMEOUT}"
  -o StrictHostKeyChecking="${TABLET_SSH_STRICT_HOST_KEY_CHECKING}"
  -o BatchMode=yes
)

echo "Validando CDP no tablet (${TABLET_HOST}:${TABLET_CDP_PORT})..."
"${SSH_BASE_COMMAND[@]}" \
  "${TABLET_USER}@${TABLET_HOST}" \
  "curl --silent --fail --max-time 2 http://127.0.0.1:${TABLET_CDP_PORT}/json/version >/dev/null"

echo "Abrindo tunel SSH ${LOCAL_TUNNEL_PORT} -> ${TABLET_HOST}:${TABLET_CDP_PORT}"
echo "Deixe este terminal aberto enquanto roda os testes remotos."
echo "Para encerrar o tunel: Ctrl+C"

exec "${SSH_BASE_COMMAND[@]}" \
  -N \
  -L "${LOCAL_TUNNEL_PORT}:127.0.0.1:${TABLET_CDP_PORT}" \
  "${TABLET_USER}@${TABLET_HOST}"
