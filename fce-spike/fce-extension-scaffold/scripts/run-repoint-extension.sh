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
EXT_ID=66120
NEW_SENDER=0x01269cc5498679ac790Af12cd803a1108a0aA235
RPC="${CHAIN_URL:-https://coston2-api.flare.network/ext/C/rpc}"

cast send "$FTM" "setExtensionContracts(uint256,address,address)" "$EXT_ID" "0x0000000000000000000000000000000000000000" "$NEW_SENDER" \
  --rpc-url "$RPC" --private-key "$DEPLOYMENT_PRIVATE_KEY"

cast send "$NEW_SENDER" "setExtensionId()" --rpc-url "$RPC" --private-key "$DEPLOYMENT_PRIVATE_KEY"
