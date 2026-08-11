#!/bin/bash
set -x
cd "$(dirname "$0")/.."
export PATH="$HOME/.foundry/bin:$HOME/sdk/go/bin:$PATH"
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi
FTM=0x1a9C4A0f9D76c0b1D91d22E24E573a9b377618aE
STALE_TEE_ID=0x43D847e15C46A93587a3f90E8C32c035Bec4f9cE
RPC="${CHAIN_URL:-https://coston2-api.flare.network/ext/C/rpc}"

cast send "$FTM" "pause(address)" "$STALE_TEE_ID" --rpc-url "$RPC" --private-key "$DEPLOYMENT_PRIVATE_KEY"
