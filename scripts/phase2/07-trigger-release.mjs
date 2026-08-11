// Decodes the DA Layer's raw proof into an IWeb2Json.Proof struct and calls
// WardenWeatherResolver.checkAndRelease — this is the step where the
// generic escrow's condition actually resolves and, if true, redemption
// fires automatically. No manual intervention beyond running this script.
import { ethers } from "ethers";
import { env, WEB2JSON_RESPONSE_TUPLE, loadPhase2State, savePhase2State } from "./config.mjs";

async function main() {
  const state = await loadPhase2State();
  if (!state.proof) {
    throw new Error("Missing proof in state.phase2.json — run 06-retrieve-proof.mjs first.");
  }
  if (!state.resolverAddress || !state.resolverAbi || !state.escrowId) {
    throw new Error("Missing resolver/escrow info in state.phase2.json.");
  }

  const { COSTON2_RPC_URL, ESCROW_DEPLOYER_PRIVATE_KEY } = env;
  const provider = new ethers.JsonRpcProvider(COSTON2_RPC_URL);
  const wallet = new ethers.Wallet(ESCROW_DEPLOYER_PRIVATE_KEY, provider);

  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  const decoded = abiCoder.decode([WEB2JSON_RESPONSE_TUPLE], state.proof.response_hex);
  // ethers v6 gotcha (same one hit in Task 1): a decoded Result is
  // read-only/frozen and can't be passed straight back into a contract call
  // as a nested struct argument — .toObject(true) first.
  const responseData = decoded[0].toObject(true);

  const attestedTempCx100 = abiCoder.decode(["int256"], responseData.responseBody.abiEncodedData)[0];
  console.log(`Attested temperature (from proof): ${Number(attestedTempCx100) / 100}°C`);
  console.log(`Condition threshold: temperature > ${state.thresholdTemperatureCx100 / 100}°C`);
  console.log(`Expected outcome: ${attestedTempCx100 > BigInt(state.thresholdTemperatureCx100)}`);

  const proofStruct = {
    merkleProof: state.proof.proof,
    data: responseData,
  };

  const resolver = new ethers.Contract(state.resolverAddress, state.resolverAbi, wallet);

  console.log(`\nCalling checkAndRelease(escrowId=${state.escrowId}, proof)...`);
  const tx = await resolver.checkAndRelease(state.escrowId, proofStruct);
  console.log(`Tx: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`Confirmed in block ${receipt.blockNumber}, status: ${receipt.status === 1 ? "SUCCESS" : "FAILED"}`);
  console.log(`Explorer: https://coston2-explorer.flare.network/tx/${tx.hash}`);

  const resolverIface = new ethers.Interface(state.resolverAbi);
  const escrowIface = new ethers.Interface(state.escrowAbi);
  let outcome, redeemedAmountUBA;
  for (const log of receipt.logs) {
    try {
      const parsed = resolverIface.parseLog(log);
      if (parsed?.name === "ConditionChecked") {
        outcome = parsed.args.outcome;
        console.log(`\nConditionChecked event: attestedTemperatureCx100=${parsed.args.attestedTemperatureCx100}, outcome=${outcome}`);
      }
    } catch {}
    try {
      const parsed = escrowIface.parseLog(log);
      if (parsed?.name === "EscrowReleased") {
        redeemedAmountUBA = parsed.args.redeemedAmountUBA;
        console.log(`EscrowReleased event: beneficiaryXrplAddress=${parsed.args.beneficiaryXrplAddress}, redeemedAmountUBA=${redeemedAmountUBA}`);
      }
      if (parsed?.name === "EscrowResolved") {
        console.log(`EscrowResolved event: outcome=${parsed.args.outcome}`);
      }
    } catch {}
  }

  await savePhase2State({
    releaseTxHash: tx.hash,
    outcome,
    redeemedAmountUBA: redeemedAmountUBA?.toString(),
  });
  console.log("\nSaved to state.phase2.json");

  if (!outcome) {
    console.log("\nCondition did NOT resolve true — no redemption was submitted. Check the threshold/live weather.");
  } else {
    console.log(
      "\nRedemption submitted. The actual XRP payout on XRPL happens when the agent (or Flare's redemption " +
        "executor, mirroring the direct-minting executor bot from Phase 1) fulfils the RedemptionRequested event " +
        "— run 08-monitor-xrpl-payout.mjs to watch for it."
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
