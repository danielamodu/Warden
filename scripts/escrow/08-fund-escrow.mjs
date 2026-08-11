// Approves WardenEscrow to pull FXRP from ESCROW_DEPLOYER, then calls
// fund(conditionId, beneficiary, amount) to actually fund + hold it against
// a generic condition reference. Verifies the result two independent ways:
// the contract's internal escrow record, and its real on-chain FXRP balance.
import { ethers } from "ethers";
import { env, loadEscrowState, saveEscrowState } from "./config.mjs";

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
];

// Phase 1 has no release/dispute logic, so the condition and beneficiary are
// deliberately generic demo values — a hash standing in for "whatever
// condition a later phase attaches" and a placeholder beneficiary address.
// Nothing here is insurance/trade-finance/etc.-specific.
const DEMO_CONDITION_ID = ethers.id("warden-phase1-demo-condition");

async function main() {
  const state = await loadEscrowState();
  const { COSTON2_RPC_URL, ESCROW_DEPLOYER_PRIVATE_KEY, ESCROW_DEPLOYER_ADDRESS } = env;

  if (!state.escrowAddress || !state.escrowAbi) {
    throw new Error("Missing escrowAddress/escrowAbi in state.escrow.json — run 07-deploy-escrow.mjs first.");
  }
  if (!state.fxrpAddress) {
    throw new Error("Missing fxrpAddress in state.escrow.json — run 01-check-status.mjs first.");
  }

  const provider = new ethers.JsonRpcProvider(COSTON2_RPC_URL);
  const wallet = new ethers.Wallet(ESCROW_DEPLOYER_PRIVATE_KEY, provider);

  const fxrp = new ethers.Contract(state.fxrpAddress, ERC20_ABI, wallet);
  const escrow = new ethers.Contract(state.escrowAddress, state.escrowAbi, wallet);
  const decimals = await fxrp.decimals();

  // Deterministic demo beneficiary (e.g. a "seller"/counterparty address).
  // No funds ever move to it in this phase — there is no release logic yet —
  // it's recorded purely so Phase 2 has the data it needs.
  let beneficiary = state.demoBeneficiary;
  if (!beneficiary) {
    beneficiary = ethers.Wallet.createRandom().address;
    await saveEscrowState({ demoBeneficiary: beneficiary });
  }

  const fundAmountXrp = "8"; // FXRP amount to actually fund into escrow (out of the 12 minted)
  const fundAmountUBA = ethers.parseUnits(fundAmountXrp, decimals);

  const buyerBalanceBefore = await fxrp.balanceOf(ESCROW_DEPLOYER_ADDRESS);
  console.log(`Buyer FXRP balance before funding: ${ethers.formatUnits(buyerBalanceBefore, decimals)}`);
  if (buyerBalanceBefore < fundAmountUBA) {
    throw new Error(
      `Buyer only has ${ethers.formatUnits(buyerBalanceBefore, decimals)} FXRP, need ${fundAmountXrp}. ` +
        "Run the direct-minting steps (02-06) first, or lower fundAmountXrp."
    );
  }

  console.log(`\nApproving WardenEscrow (${state.escrowAddress}) to pull ${fundAmountXrp} FXRP...`);
  const approveTx = await fxrp.approve(state.escrowAddress, fundAmountUBA);
  await approveTx.wait();
  console.log(`Approve tx: ${approveTx.hash}`);

  console.log(`\nCalling fund(conditionId=${DEMO_CONDITION_ID}, beneficiary=${beneficiary}, amount=${fundAmountUBA})...`);
  const fundTx = await escrow.fund(DEMO_CONDITION_ID, beneficiary, fundAmountUBA);
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
        console.log(`  escrowId:     ${parsed.args.escrowId}`);
        console.log(`  conditionId:  ${parsed.args.conditionId}`);
        console.log(`  buyer:        ${parsed.args.buyer}`);
        console.log(`  beneficiary:  ${parsed.args.beneficiary}`);
        console.log(`  amount:       ${ethers.formatUnits(parsed.args.amount, decimals)} FXRP`);
      }
    } catch {
      // not an escrow event
    }
  }

  console.log("\n--- Verification ---");
  const record = await escrow.getEscrow(escrowId);
  console.log("On-chain escrow record (getEscrow):");
  console.log(`  conditionId: ${record.conditionId}`);
  console.log(`  buyer:       ${record.buyer}`);
  console.log(`  beneficiary: ${record.beneficiary}`);
  console.log(`  amount:      ${ethers.formatUnits(record.amount, decimals)} FXRP`);
  console.log(`  status:      ${record.status === 0n ? "Unresolved" : "Resolved"}`);
  console.log(`  fundedAt:    ${record.fundedAt}`);

  const heldBalance = await escrow.heldBalance();
  const buyerBalanceAfter = await fxrp.balanceOf(ESCROW_DEPLOYER_ADDRESS);
  console.log(`\nContract's real FXRP balance (heldBalance()): ${ethers.formatUnits(heldBalance, decimals)}`);
  console.log(`Buyer FXRP balance after funding: ${ethers.formatUnits(buyerBalanceAfter, decimals)}`);
  console.log(
    `Buyer balance decreased by: ${ethers.formatUnits(buyerBalanceBefore - buyerBalanceAfter, decimals)} FXRP`
  );

  await saveEscrowState({
    approveTxHash: approveTx.hash,
    fundTxHash: fundTx.hash,
    escrowId: escrowId?.toString(),
    demoConditionId: DEMO_CONDITION_ID,
    fundAmountXrp,
  });
  console.log("\nSaved approveTxHash/fundTxHash/escrowId to state.escrow.json");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
