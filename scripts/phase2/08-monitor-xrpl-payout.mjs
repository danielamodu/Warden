// Polls the beneficiary XRPL address for the actual incoming redemption
// payment. This is the last, genuinely asynchronous leg of the round trip:
// redeem() only *submits* the redemption request on Coston2 — the real XRP
// movement on XRPL happens when the agent (or Flare's redemption executor,
// mirroring the direct-minting executor bot Phase 1 observed) fulfils it.
// Confirms the full "fund -> attest -> release -> real payout" loop with a
// real, independently-checkable XRPL transaction, not just an on-chain
// redemption request.
import { Client, dropsToXrp } from "xrpl";
import { env, sleep, loadPhase2State, savePhase2State } from "./config.mjs";

const XRPL_TESTNET_WS = "wss://s.altnet.rippletest.net:51233";
const POLL_INTERVAL_MS = 15000;
const MAX_ATTEMPTS = 80; // up to ~20 minutes

async function main() {
  const state = await loadPhase2State();
  if (!state.outcome) {
    throw new Error("Escrow did not release (outcome=false or missing) — nothing to monitor. Check 07-trigger-release.mjs output.");
  }
  const { XRPL_RECEIVER_ADDRESS } = env;

  const client = new Client(XRPL_TESTNET_WS);
  await client.connect();

  console.log(`Watching ${XRPL_RECEIVER_ADDRESS} for an incoming payment after the release tx...`);
  console.log(`(Redemption tx on Coston2: https://coston2-explorer.flare.network/tx/${state.releaseTxHash})`);

  const startBalance = await client.getXrpBalance(XRPL_RECEIVER_ADDRESS);
  console.log(`Starting XRPL balance: ${startBalance} XRP`);

  let found = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const response = await client.request({
      command: "account_tx",
      account: XRPL_RECEIVER_ADDRESS,
      limit: 5,
    });

    for (const entry of response.result.transactions) {
      const tx = entry.tx_json ?? entry.tx;
      if (
        tx?.TransactionType === "Payment" &&
        tx.Destination === XRPL_RECEIVER_ADDRESS &&
        entry.meta?.TransactionResult === "tesSUCCESS" &&
        !state.seenPayoutHashes?.includes(tx.hash ?? entry.hash ?? tx.ctid)
      ) {
        // Use meta.delivered_amount, not tx.Amount/DeliverMax — a recent
        // rippled amendment renamed the request field to DeliverMax, and
        // relying on the request field instead of the actual settled amount
        // is a known footgun for partial-payment edge cases anyway.
        found = {
          hash: tx.hash ?? entry.hash,
          amountDrops: entry.meta.delivered_amount,
          account: tx.Account,
        };
        break;
      }
    }
    if (found) break;

    process.stdout.write(".");
    await sleep(POLL_INTERVAL_MS);
  }

  if (!found) {
    console.log(
      "\n\nNo incoming payment observed within the polling window. This does not necessarily mean it failed — " +
        "agent-fulfilled redemptions on testnet can take longer than direct minting did in Phase 1. Re-run this " +
        "script to keep watching, or check the redemption request directly via AssetManager.redemptionRequestInfo()."
    );
    await client.disconnect();
    return;
  }

  const endBalance = await client.getXrpBalance(XRPL_RECEIVER_ADDRESS);
  console.log("\n\nPayout received!");
  console.log(`  XRPL tx hash: ${found.hash}`);
  console.log(`  From (agent underlying address): ${found.account}`);
  console.log(`  Amount: ${dropsToXrp(found.amountDrops)} XRP`);
  console.log(`  Explorer: https://testnet.xrpl.org/transactions/${found.hash}`);
  console.log(`  Balance: ${startBalance} -> ${endBalance} XRP`);

  await client.disconnect();

  await savePhase2State({
    payoutXrplTxHash: found.hash,
    payoutAmountXrp: dropsToXrp(found.amountDrops),
    seenPayoutHashes: [...(state.seenPayoutHashes ?? []), found.hash],
  });
  console.log("\nSaved to state.phase2.json — full round trip confirmed end to end.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
