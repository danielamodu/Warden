#!/bin/bash
# Sends a RULE_ON_EVIDENCE instruction through the live TEE with two
# conflicting evidence claims and polls for the signed verdict, writing it
# to dispute-verdict.json for scripts/phase3/05-submit-verdict.mjs to pick
# up. Window is anchored to the current real wall-clock time (queried live
# at run time, not hardcoded) — evidence A's claimed timestamp is set inside
# it, evidence B's well outside it, so the deterministic rule has exactly
# one unambiguous winner.
set -x
cd "$(dirname "$0")/.."
export PATH="$HOME/.foundry/bin:$HOME/sdk/go/bin:$PATH"
bash ./scripts/use-chain.sh coston2
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi
# INSTRUCTION_SENDER comes from config/extension.env (written by pre-build.sh),
# same as scripts/test.sh sources it.
if [ -f config/extension.env ]; then
  set -a
  source config/extension.env
  set +a
fi

NOW=$(date +%s)
WINDOW_START=$((NOW - 300))
WINDOW_END=$((NOW + 300))
EVIDENCE_A=$NOW              # inside the window -> favors release
EVIDENCE_B=$((NOW - 7200))   # two hours outside the window -> favors holding funds

cd tools
go run ./cmd/dispute-demo \
  -a "../${ADDRESSES_FILE#./}" \
  -c "${CHAIN_URL}" \
  -p "${EXT_PROXY_URL}" \
  -escrowId "${ESCROW_ID:-0}" \
  -evidenceA "$EVIDENCE_A" \
  -evidenceB "$EVIDENCE_B" \
  -windowStart "$WINDOW_START" \
  -windowEnd "$WINDOW_END" \
  -instructionSender "${INSTRUCTION_SENDER}" \
  -out "../dispute-verdict.json"
