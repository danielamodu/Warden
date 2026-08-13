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
if [ -f config/extension.env ]; then
  set -a
  source config/extension.env
  set +a
fi

AWS_EXT_PROXY_URL="https://100-63-86-147.sslip.io"

NOW=$(date +%s)
WINDOW_START=$((NOW - 300))
WINDOW_END=$((NOW + 300))
EVIDENCE_A=$NOW
EVIDENCE_B=$((NOW - 7200))

cd tools
go run ./cmd/dispute-demo \
  -a "../${ADDRESSES_FILE#./}" \
  -c "${CHAIN_URL}" \
  -p "$AWS_EXT_PROXY_URL" \
  -escrowId "${ESCROW_ID:-0}" \
  -evidenceA "$EVIDENCE_A" \
  -evidenceB "$EVIDENCE_B" \
  -windowStart "$WINDOW_START" \
  -windowEnd "$WINDOW_END" \
  -instructionSender "${INSTRUCTION_SENDER}" \
  -out "../dispute-verdict-aws.json"
