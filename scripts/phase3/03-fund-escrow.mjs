// Approves WardenEscrow to pull FXRP and funds a fresh disputed escrow.
// Unlike Phase 2's WardenWeatherResolver, WardenDisputeResolver has no
// setCondition() call — there's no per-escrow condition stored on-chain
// ahead of time, because the window and both parties' evidence all travel
// through the encrypted TEE instruction itself (04-trigger-dispute.mjs),
// verified only once the signed verdict comes back.
import { ethers } from "ethers";
import { env, ASSET_MANAGER_ABI, loadPhase3State, savePhase3State } from "./config.mjs";

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
];

async function main() {
  const state = await loadPhase3State();
  const { COSTON2_RPC_URL, ESCROW_DEPLOYER_PRIVATE_KEY, ESCROW_DEPLOYER_ADDRESS, XRPL_RECEIVER_ADDRESS } = env;

  if (!state.escrowAddress || !state.escrowAbi) {
    throw new Error("Missing deployed WardenEscrow in state.phase3.json — run 02-deploy-contracts.mjs first.");
  }
  if (!XRPL_RECEIVER_ADDRESS) {
    throw new Error("Missing XRPL_RECEIVER_ADDRESS in .env — this is the beneficiary that receives the XRPL payout.");
  }

  const provider = new ethers.JsonRpcProvider(COSTON2_RPC_URL);
  const wallet = new ethers.Wallet(ESCROW_DEPLOYER_PRIVATE_KEY, provider);

  const fxrp = new ethers.Contract(state.fxrpAddress, ERC20_ABI, wallet);
  const assetManager = new ethers.Contract(state.assetManagerAddress, ASSET_MANAGER_ABI, provider);
  const escrow = new ethers.Contract(state.escrowAddress, state.escrowAbi, wallet);

  const decimals = await fxrp.decimals();
  const lotSizeUBA = await assetManager.lotSize();
  console.log(`FXRP decimals: ${decimals}, lot size: ${ethers.formatUnits(lotSizeUBA, decimals)} FXRP (${lotSizeUBA} UBA)`);

  const buyerBalance = await fxrp.balanceOf(ESCROW_DEPLOYER_ADDRESS);
  console.log(`Buyer FXRP balance: ${ethers.formatUnits(buyerBalance, decimals)}`);

  const fundAmountUBA = lotSizeUBA; // exactly one lot — enough for a clean redemption if the dispute resolves to release
  if (fundAmountUBA > buyerBalance) {
    throw new Error(
      `Buyer balance ${ethers.formatUnits(buyerBalance, decimals)} FXRP is below one lot (${ethers.formatUnits(lotSizeUBA, decimals)} FXRP) — run 01-mint-fxrp.mjs first.`
    );
  }
  console.log(`Funding amount: ${ethers.formatUnits(fundAmountUBA, decimals)} FXRP (1 lot)`);

  // conditionId here is just an opaque marker of which dispute this escrow is
  // under — WardenEscrow never interprets it (same generic-field design as
  // every prior phase), and unlike Phase 2's Web2Json condition it isn't
  // independently checked against anything on-chain by the resolver either;
  // the resolver's entire job is verifying the TEE's signature on the
  // verdict, not re-deriving what the dispute was about.
  const conditionId = ethers.solidityPackedKeccak256(
    ["string", "address", "uint256"],
    ["WARDEN_DISPUTE", state.resolverAddress, BigInt(Date.now())]
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

  const heldBalance = await escrow.heldBalance();
  console.log(`\nContract's real FXRP balance (heldBalance()): ${ethers.formatUnits(heldBalance, decimals)}`);

  await savePhase3State({
    approveTxHash: approveTx.hash,
    fundTxHash: fundTx.hash,
    escrowId: escrowId?.toString(),
    conditionId,
    fundAmountUBA: fundAmountUBA.toString(),
    beneficiaryXrplAddress: XRPL_RECEIVER_ADDRESS,
  });
  console.log("\nSaved to state.phase3.json");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
