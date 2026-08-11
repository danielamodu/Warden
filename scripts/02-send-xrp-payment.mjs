// Sends a small XRP payment from the sender to the receiver on XRPL testnet,
// waits for validation, and records the transaction hash for the FDC attestation step.
import { Client, Wallet, xrpToDrops } from "xrpl";
import { env, saveState } from "./config.mjs";

const XRPL_TESTNET_WS = "wss://s.altnet.rippletest.net:51233";
const PAYMENT_AMOUNT_XRP = "5";

async function main() {
  const { XRPL_SENDER_SEED, XRPL_RECEIVER_ADDRESS } = env;
  if (!XRPL_SENDER_SEED || !XRPL_RECEIVER_ADDRESS) {
    throw new Error("Missing XRPL_SENDER_SEED / XRPL_RECEIVER_ADDRESS — run 01-generate-accounts.mjs first.");
  }

  const client = new Client(XRPL_TESTNET_WS);
  await client.connect();

  const sender = Wallet.fromSeed(XRPL_SENDER_SEED);

  const prepared = await client.autofill({
    TransactionType: "Payment",
    Account: sender.address,
    Amount: xrpToDrops(PAYMENT_AMOUNT_XRP),
    Destination: XRPL_RECEIVER_ADDRESS,
  });

  const signed = sender.sign(prepared);
  console.log(`Submitting payment of ${PAYMENT_AMOUNT_XRP} XRP: ${sender.address} -> ${XRPL_RECEIVER_ADDRESS}`);
  const result = await client.submitAndWait(signed.tx_blob);

  const txHash = result.result.hash;
  const engineResult = result.result.meta.TransactionResult;
  console.log(`Transaction hash: ${txHash}`);
  console.log(`Engine result: ${engineResult}`);
  console.log(`Explorer: https://testnet.xrpl.org/transactions/${txHash}`);

  if (engineResult !== "tesSUCCESS") {
    throw new Error(`Payment did not succeed: ${engineResult}`);
  }

  await client.disconnect();

  await saveState({ xrplTxHash: txHash, xrplTxHashUpper: txHash.toUpperCase() });
  console.log("\nSaved xrplTxHash to state.json");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
