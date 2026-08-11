// Calls Flare's testnet verifier server to turn the XRPL direct-mint payment
// into an abiEncodedRequest for the FDC "XRPPayment" attestation type
// (id 0x08) — distinct from the generic "Payment" type used in Task 1.
// AssetManagerFXRP.executeDirectMinting requires an IXRPPayment.Proof, which
// only the XRPPayment attestation type produces.
import {
  env,
  XRP_PAYMENT_ATTESTATION_TYPE,
  XRP_SOURCE_ID,
  VERIFIER_URL_TYPE,
  toUtf8HexString,
  loadEscrowState,
  saveEscrowState,
} from "./config.mjs";

async function main() {
  const state = await loadEscrowState();
  const transactionId = state.mintXrplTxHashUpper || state.mintXrplTxHash;
  if (!transactionId) {
    throw new Error("Missing mintXrplTxHash in state.escrow.json — run 02-send-mint-payment.mjs first.");
  }

  const { VERIFIER_URL_TESTNET, VERIFIER_API_KEY_TESTNET, ESCROW_DEPLOYER_ADDRESS } = env;
  const url = `${VERIFIER_URL_TESTNET}/verifier/${VERIFIER_URL_TYPE}/${XRP_PAYMENT_ATTESTATION_TYPE}/prepareRequest`;

  // proofOwner: address authorized to use the proof. AssetManagerFXRP checks
  // this is either the zero address (anyone can use it) or the caller of
  // executeDirectMinting. We bind it to ESCROW_DEPLOYER_ADDRESS since that's
  // the wallet that will call executeDirectMinting in the next step.
  const requestBody = {
    transactionId,
    proofOwner: ESCROW_DEPLOYER_ADDRESS,
  };

  const request = {
    attestationType: toUtf8HexString(XRP_PAYMENT_ATTESTATION_TYPE),
    sourceId: toUtf8HexString(XRP_SOURCE_ID),
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

  await saveEscrowState({ abiEncodedRequest: data.abiEncodedRequest });
  console.log("\nSaved abiEncodedRequest to state.escrow.json");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
