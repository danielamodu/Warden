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
cd tools
go run ./cmd/deploy-contract \
  -a "../${ADDRESSES_FILE#./}" \
  -c "$CHAIN_URL" \
  -o "../new-instruction-sender.txt"
