#!/bin/bash
set -x
cd "$(dirname "$0")/.."
export PATH="$HOME/.foundry/bin:$HOME/sdk/go/bin:$PATH"
FTM=0x1a9C4A0f9D76c0b1D91d22E24E573a9b377618aE
EXT_ID=66120
RPC=https://coston2-api.flare.network/ext/C/rpc

echo "--- getTeeExtensionInstructionsSender ---"
cast call "$FTM" "getTeeExtensionInstructionsSender(uint256)(address)" "$EXT_ID" --rpc-url "$RPC"
echo "--- getTeeExtensionStateVerifier ---"
cast call "$FTM" "getTeeExtensionStateVerifier(uint256)(address)" "$EXT_ID" --rpc-url "$RPC"
echo "--- getExtensionOwner ---"
cast call "$FTM" "getExtensionOwner(uint256)(address)" "$EXT_ID" --rpc-url "$RPC"
