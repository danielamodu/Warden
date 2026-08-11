#!/bin/bash
set -x
cd "$(dirname "$0")/.."
export PATH="$HOME/.foundry/bin:$HOME/sdk/go/bin:$PATH"
bash ./scripts/use-chain.sh coston2
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi
export SIMULATED_TEE="${SIMULATED_TEE:-true}"
cd tools
go run ./cmd/register-tee \
  -a "../${ADDRESSES_FILE#./}" \
  -c "$CHAIN_URL" \
  -p "$EXT_PROXY_URL" \
  -h "${EXT_PROXY_HOST_URL:-$EXT_PROXY_URL}" \
  -ep "${NORMAL_PROXY_URL:-http://localhost:6662}" \
  -state "../config/register-tee.state" \
  -command "rRap"
