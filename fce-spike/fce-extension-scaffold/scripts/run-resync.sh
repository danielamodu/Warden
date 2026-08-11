#!/bin/bash
set -x
cd "$(dirname "$0")/.."
export PATH="$HOME/.foundry/bin:$HOME/sdk/go/bin:$PATH"
bash ./scripts/use-chain.sh coston2
docker compose -f docker-compose.yaml -f docker-compose.coston2.yaml up -d --force-recreate ext-proxy extension-tee
