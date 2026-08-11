// Calls Flare's testnet verifier server to turn our XRPL transaction into an
// abiEncodedRequest the FDC smart contracts understand.
import {
  env,
  ATTESTATION_TYPE,
  SOURCE_ID,
  VERIFIER_URL_TYPE,
  toUtf8HexString,
  loadState,
  saveState,
} from "./config.mjs";

async function main() {
  const state = await loadState();
  const transactionId = state.xrplTxHashUpper || state.xrplTxHash;
  if (!transactionId) {
    throw new Error("Missing xrplTxHash in state.json — run 02-send-xrp-payment.mjs first.");
  }

  const { VERIFIER_URL_TESTNET, VERIFIER_API_KEY_TESTNET } = env;
  const url = `${VERIFIER_URL_TESTNET}/verifier/${VERIFIER_URL_TYPE}/${ATTESTATION_TYPE}/prepareRequest`;

  const requestBody = {
    transactionId,
    inUtxo: "0",
    utxo: "0",
  };

  const request = {
    attestationType: toUtf8HexString(ATTESTATION_TYPE),
    sourceId: toUtf8HexString(SOURCE_ID),
    requestBody,
  };

  console.log("POST", url);
  console.log("Request:", JSON.stringify(request, null, 2));

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "X-API-KEY": VERIFIER_API_KEY_TESTNET,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (response.status !== 200) {
    const text = await response.text();
    throw new Error(`Verifier returned ${response.status}: ${text}`);
  }

  const data = await response.json();
  console.log("Response:", JSON.stringify(data, null, 2));

  if (data.status !== "VALID") {
    throw new Error(`Verifier status was not VALID: ${data.status}`);
  }

  await saveState({ abiEncodedRequest: data.abiEncodedRequest });
  console.log("\nSaved abiEncodedRequest to state.json");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
