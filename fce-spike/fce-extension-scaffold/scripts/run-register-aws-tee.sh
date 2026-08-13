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

AWS_EXT_PROXY_URL="https://100-63-86-147.sslip.io"

cd tools
go run ./cmd/register-tee \
  -a "../${ADDRESSES_FILE#./}" \
  -c "$CHAIN_URL" \
  -p "$AWS_EXT_PROXY_URL" \
  -h "$AWS_EXT_PROXY_URL" \
  -ep "${NORMAL_PROXY_URL:-http://localhost:6662}" \
  -state "../config/register-tee-aws.state" \
  -command "rRap"
