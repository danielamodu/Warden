// Decodes the DA Layer's abi-encoded IXRPPayment.Response and calls
// AssetManagerFXRP.executeDirectMinting(proof) — which verifies the proof
// against FdcVerification internally and, if valid, mints FXRP to the
// recipient encoded in the XRPL payment's memo (ESCROW_DEPLOYER_ADDRESS).
//
// Note (same ethers v6 gotcha as Task 1): a decoded `Result` from
// AbiCoder.decode is read-only and can't be passed straight back into a
// contract call as a nested struct — call `.toObject(true)` on it first.
import { ethers } from "ethers";
import {
  env,
  CONTRACT_REGISTRY_ADDRESS,
  CONTRACT_REGISTRY_ABI,
  ASSET_MANAGER_ABI,
  XRP_PAYMENT_RESPONSE_TUPLE,
  loadEscrowState,
  saveEscrowState,
} from "./config.mjs";

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
];

// FAssets' PaymentConfirmations.PaymentAlreadyConfirmed() custom error
// selector. Flare runs its own executor bots that watch the Core Vault
// address and auto-execute plain 32-byte-memo direct mints (no reservation,
// anyone-can-execute) — often within a couple of minutes, i.e. before our own
// script gets to call executeDirectMinting. That is a *success* case, not a
// failure: the payment already finalized and FXRP was already minted. When
// this happens we look up the DirectMintingExecuted event that a relayer
// produced instead of treating the revert as an error.
const PAYMENT_ALREADY_CONFIRMED_SIGNATURE = "0x18dce79f";
const COSTON2_MAX_LOG_BLOCK_RANGE = 29;

async function findExistingMintEvent({ provider, assetManagerAddress, transactionId, maxBlocksToSearch = 6000 }) {
  const iface = new ethers.Interface(ASSET_MANAGER_ABI);
  const topic = iface.getEvent("DirectMintingExecuted").topicHash;
  const target = transactionId.toLowerCase();
  const latest = Number(await provider.getBlockNumber());
  const earliest = Math.max(0, latest - maxBlocksToSearch);

  for (let to = latest; to > earliest; to -= COSTON2_MAX_LOG_BLOCK_RANGE) {
    const from = Math.max(to - COSTON2_MAX_LOG_BLOCK_RANGE, earliest);
    const logs = await provider.getLogs({ address: assetManagerAddress, topics: [topic], fromBlock: from, toBlock: to });
    for (const log of logs) {
      const parsed = iface.parseLog(log);
      if (parsed.args.transactionId.toLowerCase() === target) {
        return { txHash: log.transactionHash, blockNumber: log.blockNumber, args: parsed.args };
      }
    }
  }
  return null;
}

async function main() {
  const state = await loadEscrowState();
  if (!state.proof) {
    throw new Error("Missing proof in state.escrow.json — run 05-retrieve-proof.mjs first.");
  }

  const { COSTON2_RPC_URL, ESCROW_DEPLOYER_PRIVATE_KEY, ESCROW_DEPLOYER_ADDRESS } = env;
  const provider = new ethers.JsonRpcProvider(COSTON2_RPC_URL);
  const wallet = new ethers.Wallet(ESCROW_DEPLOYER_PRIVATE_KEY, provider);

  let assetManagerAddress = state.assetManagerAddress;
  if (!assetManagerAddress) {
    const registry = new ethers.Contract(CONTRACT_REGISTRY_ADDRESS, CONTRACT_REGISTRY_ABI, provider);
    assetManagerAddress = await registry.getContractAddressByName("AssetManagerFXRP");
  }
  const assetManager = new ethers.Contract(assetManagerAddress, ASSET_MANAGER_ABI, wallet);

  const fxrpAddress = state.fxrpAddress || (await assetManager.fAsset());
  const fxrp = new ethers.Contract(fxrpAddress, ERC20_ABI, provider);
  const decimals = state.fxrpDecimals ?? (await fxrp.decimals());

  const balanceBefore = await fxrp.balanceOf(ESCROW_DEPLOYER_ADDRESS);
  console.log(`FXRP balance before: ${ethers.formatUnits(balanceBefore, decimals)}`);

  console.log("\nDecoding DA Layer response_hex as IXRPPayment.Response...");
  const coder = ethers.AbiCoder.defaultAbiCoder();
  const [decodedResponse] = coder.decode([XRP_PAYMENT_RESPONSE_TUPLE], state.proof.response_hex);

  const proofArg = {
    merkleProof: state.proof.proof,
    data: decodedResponse.toObject(true),
  };

  console.log("Calling executeDirectMinting(proof) on AssetManagerFXRP...");
  let receipt;
  let reusedExistingMint = false;
  try {
    const tx = await assetManager.executeDirectMinting(proofArg);
    console.log(`Tx: ${tx.hash}`);
    receipt = await tx.wait();
    console.log(`Confirmed in block ${receipt.blockNumber}, status: ${receipt.status === 1 ? "SUCCESS" : "FAILED"}`);
    console.log(`Explorer: https://coston2-explorer.flare.network/tx/${tx.hash}`);
  } catch (err) {
    const errorData = err?.info?.error?.data || err?.data;
    if (errorData === PAYMENT_ALREADY_CONFIRMED_SIGNATURE) {
      console.log(
        "\nexecuteDirectMinting reverted with PaymentAlreadyConfirmed() — Flare's own executor bot already " +
          "finalized this mint (it watches the Core Vault and auto-executes plain 32-byte-memo mints, often " +
          "within a couple of minutes). This is a success case: looking up the DirectMintingExecuted event " +
          "that the relayer produced instead."
      );
      const transactionId = state.mintXrplTxHashUpper
        ? "0x" + state.mintXrplTxHashUpper.toLowerCase()
        : "0x" + state.mintXrplTxHash.toLowerCase();
      const existing = await findExistingMintEvent({ provider, assetManagerAddress, transactionId });
      if (!existing) {
        throw new Error(
          "PaymentAlreadyConfirmed but no matching DirectMintingExecuted event found in the last 6000 blocks."
        );
      }
      console.log(`Found existing mint tx: ${existing.txHash} (block ${existing.blockNumber})`);
      console.log(`Explorer: https://coston2-explorer.flare.network/tx/${existing.txHash}`);
      receipt = { hash: existing.txHash, blockNumber: existing.blockNumber, logs: [] };
      reusedExistingMint = true;
      console.log("\nDirectMintingExecuted event (from relayer's tx):");
      console.log(`  targetAddress:   ${existing.args.targetAddress}`);
      console.log(`  executor:        ${existing.args.executor}`);
      console.log(`  mintedAmountUBA: ${existing.args.mintedAmountUBA}`);
      console.log(`  mintingFeeUBA:   ${existing.args.mintingFeeUBA}`);
      console.log(`  executorFeeUBA:  ${existing.args.executorFeeUBA}`);
    } else {
      console.error("executeDirectMinting reverted:", err.shortMessage || err.message);
      throw err;
    }
  }

  // Parse DirectMintingExecuted / DirectMintingDelayed from the receipt logs
  // (skipped when we already pulled the event from a relayer's earlier tx).
  let executedEvent = reusedExistingMint ? undefined : undefined;
  let delayedEvent;
  if (reusedExistingMint) {
    // args were already logged above; nothing further to parse.
  } else {
    const iface = new ethers.Interface(ASSET_MANAGER_ABI);
    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog(log);
        if (parsed?.name === "DirectMintingExecuted") executedEvent = parsed.args;
        if (parsed?.name === "DirectMintingDelayed" || parsed?.name === "LargeDirectMintingDelayed") {
          delayedEvent = parsed.args;
        }
      } catch {
        // not an AssetManager event, ignore
      }
    }
  }

  if (delayedEvent && !executedEvent) {
    console.log("\nMinting was DELAYED by a rate limit:");
    console.log(`  executionAllowedAt: ${delayedEvent.executionAllowedAt}`);
    console.log("Re-run this script after that timestamp with the same proof to finalize.");
    await saveEscrowState({ mintDelayedUntil: delayedEvent.executionAllowedAt.toString() });
    return;
  }

  if (executedEvent) {
    console.log("\nDirectMintingExecuted event:");
    console.log(`  targetAddress:   ${executedEvent.targetAddress}`);
    console.log(`  mintedAmountUBA: ${executedEvent.mintedAmountUBA}`);
    console.log(`  mintingFeeUBA:   ${executedEvent.mintingFeeUBA}`);
    console.log(`  executorFeeUBA:  ${executedEvent.executorFeeUBA}`);
  }

  const balanceAfter = await fxrp.balanceOf(ESCROW_DEPLOYER_ADDRESS);
  console.log(`\nFXRP balance after: ${ethers.formatUnits(balanceAfter, decimals)}`);
  console.log(`FXRP minted (delta): ${ethers.formatUnits(balanceAfter - balanceBefore, decimals)}`);

  await saveEscrowState({
    mintTxHash: receipt.hash,
    mintTxReusedFromRelayer: reusedExistingMint,
    fxrpBalanceAfterMint: balanceAfter.toString(),
  });
  console.log("\nSaved mintTxHash to state.escrow.json");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
