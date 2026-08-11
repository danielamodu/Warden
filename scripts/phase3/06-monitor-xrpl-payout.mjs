// Polls the beneficiary XRPL address for the actual incoming redemption
// payment — same pattern as Phase 2's 08-monitor-xrpl-payout.mjs, including
// the meta.delivered_amount fix (not tx.Amount/DeliverMax).
import { Client, dropsToXrp } from "xrpl";
import { env, sleep, loadPhase3State, savePhase3State } from "./config.mjs";

const XRPL_TESTNET_WS = "wss://s.altnet.rippletest.net:51233";
const POLL_INTERVAL_MS = 15000;
const MAX_ATTEMPTS = 80; // up to ~20 minutes

async function main() {
  const state = await loadPhase3State();
  if (state.outcome !== true) {
    throw new Error(
      `Verdict outcome was ${state.outcome} (not true) — nothing to monitor. A false verdict means the dispute ` +
        `resolved against release, and the escrow's funds correctly stay put, same as WardenEscrow's Phase 2 semantics.`
    );
  }
  const { XRPL_RECEIVER_ADDRESS } = env;

  const client = new Client(XRPL_TESTNET_WS);
  await client.connect();

  console.log(`Watching ${XRPL_RECEIVER_ADDRESS} for an incoming payment after the verdict tx...`);
  console.log(`(Verdict tx on Coston2: https://coston2-explorer.flare.network/tx/${state.verdictTxHash})`);

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
        "agent-fulfilled redemptions on testnet can take longer than others did in earlier phases. Re-run this " +
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

  await savePhase3State({
    payoutXrplTxHash: found.hash,
    payoutAmountXrp: dropsToXrp(found.amountDrops),
    seenPayoutHashes: [...(state.seenPayoutHashes ?? []), found.hash],
  });
  console.log("\nSaved to state.phase3.json — full dispute-path round trip confirmed end to end.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
