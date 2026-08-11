// Waits for the FDC voting round to finalize, then polls the Data
// Availability Layer for the Merkle proof + abi-encoded IXRPPayment.Response.
import { ethers } from "ethers";
import {
  env,
  CONTRACT_REGISTRY_ADDRESS,
  CONTRACT_REGISTRY_ABI,
  FDC_VERIFICATION_XRP_ABI,
  RELAY_ABI,
  sleep,
  loadEscrowState,
  saveEscrowState,
} from "./config.mjs";

async function main() {
  const state = await loadEscrowState();
  if (!state.abiEncodedRequest || state.votingRoundId === undefined) {
    throw new Error("Missing abiEncodedRequest/votingRoundId in state.escrow.json — run 04-submit-attestation.mjs first.");
  }

  const { COSTON2_RPC_URL, COSTON2_DA_LAYER_URL, VERIFIER_API_KEY_TESTNET } = env;
  const provider = new ethers.JsonRpcProvider(COSTON2_RPC_URL);
  const registry = new ethers.Contract(CONTRACT_REGISTRY_ADDRESS, CONTRACT_REGISTRY_ABI, provider);

  const fdcVerificationAddress = await registry.getContractAddressByName("FdcVerification");
  const relayAddress = await registry.getContractAddressByName("Relay");
  const fdcVerification = new ethers.Contract(fdcVerificationAddress, FDC_VERIFICATION_XRP_ABI, provider);
  const relay = new ethers.Contract(relayAddress, RELAY_ABI, provider);

  const protocolId = await fdcVerification.fdcProtocolId();
  console.log(`FDC protocol id: ${protocolId}`);
  console.log(`Waiting for voting round ${state.votingRoundId} to finalize...`);

  let finalized = false;
  while (!finalized) {
    try {
      finalized = await relay.isFinalized(protocolId, state.votingRoundId);
    } catch (err) {
      process.stdout.write("x");
      await sleep(5000);
      continue;
    }
    if (!finalized) {
      process.stdout.write(".");
      await sleep(10000);
    }
  }
  console.log("\nRound finalized!");

  const url = `${COSTON2_DA_LAYER_URL}/api/v1/fdc/proof-by-request-round-raw`;
  const requestBody = {
    votingRoundId: state.votingRoundId,
    requestBytes: state.abiEncodedRequest,
  };

  console.log("Requesting proof from DA Layer...");
  let proof;
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "X-API-KEY": VERIFIER_API_KEY_TESTNET,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (response.status === 200) {
        const data = await response.json();
        if (data.response_hex) {
          proof = data;
          break;
        }
      }
    } catch {
      // transient network error, keep polling
    }
    process.stdout.write(".");
    await sleep(5000);
  }

  if (!proof) {
    throw new Error("Timed out waiting for DA Layer proof.");
  }

  console.log("\nProof received:");
  console.log(JSON.stringify(proof, null, 2));

  await saveEscrowState({ proof });
  console.log("\nSaved proof to state.escrow.json");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
