// Approves WardenEscrow to pull FXRP, funds it against the weather condition
// checked in 01-check-weather.mjs, and sets that condition on the resolver.
// Reuses the FXRP left over from Phase 1's direct mint (no need to mint again).
import { ethers } from "ethers";
import { env, ASSET_MANAGER_ABI, loadPhase2State, savePhase2State } from "./config.mjs";

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
];

async function main() {
  const state = await loadPhase2State();
  const { COSTON2_RPC_URL, ESCROW_DEPLOYER_PRIVATE_KEY, ESCROW_DEPLOYER_ADDRESS, XRPL_RECEIVER_ADDRESS } = env;

  if (!state.escrowAddress || !state.escrowAbi || !state.resolverAddress || !state.resolverAbi) {
    throw new Error("Missing deployed contract addresses in state.phase2.json — run 02-deploy-contracts.mjs first.");
  }
  if (state.thresholdTemperatureCx100 === undefined) {
    throw new Error("Missing weather condition in state.phase2.json — run 01-check-weather.mjs first.");
  }
  if (!XRPL_RECEIVER_ADDRESS) {
    throw new Error("Missing XRPL_RECEIVER_ADDRESS in .env — this is the beneficiary that receives the XRPL payout.");
  }

  const provider = new ethers.JsonRpcProvider(COSTON2_RPC_URL);
  const wallet = new ethers.Wallet(ESCROW_DEPLOYER_PRIVATE_KEY, provider);

  const fxrp = new ethers.Contract(state.fxrpAddress, ERC20_ABI, wallet);
  const assetManager = new ethers.Contract(state.assetManagerAddress, ASSET_MANAGER_ABI, provider);
  const escrow = new ethers.Contract(state.escrowAddress, state.escrowAbi, wallet);
  const resolver = new ethers.Contract(state.resolverAddress, state.resolverAbi, wallet);

  const decimals = await fxrp.decimals();
  const lotSizeUBA = await assetManager.lotSize();
  console.log(`FXRP decimals: ${decimals}, lot size: ${ethers.formatUnits(lotSizeUBA, decimals)} FXRP (${lotSizeUBA} UBA)`);

  const buyerBalance = await fxrp.balanceOf(ESCROW_DEPLOYER_ADDRESS);
  console.log(`Buyer FXRP balance: ${ethers.formatUnits(buyerBalance, decimals)}`);

  // Fund with 2 lots if affordable, otherwise 1 — must be an exact multiple
  // of lotSizeUBA so resolveAndRelease's redeem() call has no remainder.
  let fundAmountUBA = lotSizeUBA * 2n;
  if (fundAmountUBA > buyerBalance) {
    fundAmountUBA = lotSizeUBA;
  }
  if (fundAmountUBA > buyerBalance) {
    throw new Error(
      `Buyer balance ${ethers.formatUnits(buyerBalance, decimals)} FXRP is below one lot (${ethers.formatUnits(lotSizeUBA, decimals)} FXRP).`
    );
  }
  console.log(`Funding amount: ${ethers.formatUnits(fundAmountUBA, decimals)} FXRP (${fundAmountUBA / lotSizeUBA} lots)`);

  // A real, meaningful condition reference — not a demo placeholder this
  // time — a hash of the actual weather-resolver + threshold this escrow is
  // governed by, so it's independently checkable on-chain what conditionId
  // actually commits to.
  const conditionId = ethers.solidityPackedKeccak256(
    ["address", "int256", "bool"],
    [state.resolverAddress, state.thresholdTemperatureCx100, state.triggerIfAbove]
  );

  console.log(`\nApproving WardenEscrow (${state.escrowAddress}) to pull ${ethers.formatUnits(fundAmountUBA, decimals)} FXRP...`);
  const approveTx = await fxrp.approve(state.escrowAddress, fundAmountUBA);
  await approveTx.wait();
  console.log(`Approve tx: ${approveTx.hash}`);

  console.log(
    `\nCalling fund(conditionId=${conditionId}, beneficiaryXrplAddress=${XRPL_RECEIVER_ADDRESS}, amount=${fundAmountUBA})...`
  );
  const fundTx = await escrow.fund(conditionId, XRPL_RECEIVER_ADDRESS, fundAmountUBA);
  console.log(`Fund tx: ${fundTx.hash}`);
  const receipt = await fundTx.wait();
  console.log(`Confirmed in block ${receipt.blockNumber}, status: ${receipt.status === 1 ? "SUCCESS" : "FAILED"}`);
  console.log(`Explorer: https://coston2-explorer.flare.network/tx/${fundTx.hash}`);

  const iface = new ethers.Interface(state.escrowAbi);
  let escrowId;
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed?.name === "EscrowFunded") {
        escrowId = parsed.args.escrowId;
        console.log("\nEscrowFunded event:");
        console.log(`  escrowId:               ${parsed.args.escrowId}`);
        console.log(`  conditionId:            ${parsed.args.conditionId}`);
        console.log(`  buyer:                  ${parsed.args.buyer}`);
        console.log(`  beneficiaryXrplAddress: ${parsed.args.beneficiaryXrplAddress}`);
        console.log(`  amount:                 ${ethers.formatUnits(parsed.args.amount, decimals)} FXRP`);
      }
    } catch {
      // not an escrow event
    }
  }

  console.log(
    `\nSetting weather condition on resolver: escrowId=${escrowId}, threshold=${state.thresholdTemperatureCx100} (x100 C), triggerIfAbove=${state.triggerIfAbove}...`
  );
  const setConditionTx = await resolver.setCondition(escrowId, state.thresholdTemperatureCx100, state.triggerIfAbove);
  console.log(`Tx: ${setConditionTx.hash}`);
  await setConditionTx.wait();
  console.log("Condition set.");

  const heldBalance = await escrow.heldBalance();
  console.log(`\nContract's real FXRP balance (heldBalance()): ${ethers.formatUnits(heldBalance, decimals)}`);

  await savePhase2State({
    approveTxHash: approveTx.hash,
    fundTxHash: fundTx.hash,
    escrowId: escrowId?.toString(),
    conditionId,
    fundAmountUBA: fundAmountUBA.toString(),
    beneficiaryXrplAddress: XRPL_RECEIVER_ADDRESS,
  });
  console.log("\nSaved to state.phase2.json");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
