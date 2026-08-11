// Reads the TEE-signed verdict written by the Go dispute-demo tool
// (fce-spike/fce-extension-scaffold/tools/cmd/dispute-demo) and submits it
// to WardenDisputeResolver.submitVerdict() on-chain. This is the one
// transaction in the whole Phase 3 flow where the on-chain contract itself
// verifies the TEE's cryptographic signature — everything up to this point
// (evidence encryption, the TEE's ruling) happened off-chain or inside the
// enclave; this call is where that verdict becomes trustlessly actionable.
import { ethers } from "ethers";
import fs from "node:fs/promises";
import { env, loadPhase3State, savePhase3State } from "./config.mjs";

const DEFAULT_VERDICT_PATH = new URL(
  "../../fce-spike/fce-extension-scaffold/dispute-verdict.json",
  import.meta.url
);

async function main() {
  const state = await loadPhase3State();
  if (!state.resolverAddress || !state.resolverAbi) {
    throw new Error("Missing deployed WardenDisputeResolver in state.phase3.json — run 02-deploy-contracts.mjs first.");
  }

  const verdictPath = process.argv[2] ? new URL(process.argv[2], `file://${process.cwd()}/`) : DEFAULT_VERDICT_PATH;
  console.log(`Reading verdict from ${verdictPath}...`);
  const verdict = JSON.parse(await fs.readFile(verdictPath, "utf8"));
  console.log("Verdict:", JSON.stringify(verdict, null, 2));

  if (String(verdict.decodedEscrowId) !== String(state.escrowId)) {
    throw new Error(
      `Verdict is for escrowId=${verdict.decodedEscrowId}, but state.phase3.json's funded escrow is escrowId=${state.escrowId}. ` +
        `Re-run the Go dispute-demo tool with -escrowId=${state.escrowId}.`
    );
  }

  const { COSTON2_RPC_URL, ESCROW_DEPLOYER_PRIVATE_KEY } = env;
  const provider = new ethers.JsonRpcProvider(COSTON2_RPC_URL);
  const wallet = new ethers.Wallet(ESCROW_DEPLOYER_PRIVATE_KEY, provider);
  const resolver = new ethers.Contract(state.resolverAddress, state.resolverAbi, wallet);

  console.log(`\nCalling submitVerdict(teeId=${verdict.teeId}, instructionId=${verdict.instructionId}, ...)...`);
  console.log(`  This is where the resolver itself reconstructs the TEE's signed hash and ecrecover()s ${verdict.signatureHex.slice(0, 12)}... against the registered TEE public key.`);

  const tx = await resolver.submitVerdict(
    verdict.teeId,
    verdict.instructionId,
    verdict.submissionTag,
    verdict.status,
    verdict.dataHex,
    verdict.signatureHex
  );
  console.log(`Tx: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`Confirmed in block ${receipt.blockNumber}, status: ${receipt.status === 1 ? "SUCCESS" : "FAILED"}`);
  console.log(`Explorer: https://coston2-explorer.flare.network/tx/${tx.hash}`);

  const iface = new ethers.Interface(state.resolverAbi);
  let outcome;
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed?.name === "VerdictSubmitted") {
        outcome = parsed.args.outcome;
        console.log("\nVerdictSubmitted event:");
        console.log(`  escrowId:      ${parsed.args.escrowId}`);
        console.log(`  outcome:       ${parsed.args.outcome}`);
        console.log(`  teeId:         ${parsed.args.teeId}`);
        console.log(`  instructionId: ${parsed.args.instructionId}`);
      }
    } catch {
      // not a resolver event (likely one of WardenEscrow's own events, also in this receipt)
    }
  }

  await savePhase3State({
    verdictTxHash: tx.hash,
    outcome,
    instructionId: verdict.instructionId,
    teeId: verdict.teeId,
  });
  console.log("\nSaved to state.phase3.json — if outcome=true, the escrow's FXRP has already been submitted for redemption.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
