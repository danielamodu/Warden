#!/bin/bash
set -x
cd "$(dirname "$0")/.."
export PATH="$HOME/.foundry/bin:$HOME/sdk/go/bin:$PATH"
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi
if [ -f config/extension.env ]; then
  set -a
  source config/extension.env
  set +a
fi

FTM=0x1a9C4A0f9D76c0b1D91d22E24E573a9b377618aE
TEE_ID=0x43D847e15C46A93587a3f90E8C32c035Bec4f9cE
TEE_PROXY_ID=0x43819337A798C9CC0c6E2165980c7F77Ac395ff9
NEW_URL=https://exciting-acre-intersection-tvs.trycloudflare.com
RPC="${CHAIN_URL:-https://coston2-api.flare.network/ext/C/rpc}"

cast send "$FTM" "updateTeeMachineSettings(address,address,string)" "$TEE_ID" "$TEE_PROXY_ID" "$NEW_URL" \
  --rpc-url "$RPC" --private-key "$DEPLOYMENT_PRIVATE_KEY"
