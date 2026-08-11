// Submits the abiEncodedRequest to Flare's FdcHub contract on Coston2, paying
// the required fee, and computes the FDC voting round ID from the tx timestamp.
import { ethers } from "ethers";
import {
  env,
  CONTRACT_REGISTRY_ADDRESS,
  CONTRACT_REGISTRY_ABI,
  FDC_HUB_ABI,
  FDC_REQUEST_FEE_CONFIGURATIONS_ABI,
  FIRST_VOTING_ROUND_START_TS,
  VOTING_EPOCH_DURATION_SECONDS,
  loadPhase2State,
  savePhase2State,
} from "./config.mjs";

async function main() {
  const state = await loadPhase2State();
  if (!state.abiEncodedRequest) {
    throw new Error("Missing abiEncodedRequest in state.phase2.json — run 04-prepare-attestation.mjs first.");
  }

  const { COSTON2_RPC_URL, ESCROW_DEPLOYER_PRIVATE_KEY } = env;
  const provider = new ethers.JsonRpcProvider(COSTON2_RPC_URL);
  const wallet = new ethers.Wallet(ESCROW_DEPLOYER_PRIVATE_KEY, provider);

  const balance = await provider.getBalance(wallet.address);
  console.log(`Coston2 wallet ${wallet.address} balance: ${ethers.formatEther(balance)} C2FLR`);
  if (balance === 0n) {
    throw new Error(`Wallet has 0 balance. Fund it at https://faucet.flare.network/ first.`);
  }

  const registry = new ethers.Contract(CONTRACT_REGISTRY_ADDRESS, CONTRACT_REGISTRY_ABI, provider);
  const fdcHubAddress = await registry.getContractAddressByName("FdcHub");
  const feeConfigAddress = await registry.getContractAddressByName("FdcRequestFeeConfigurations");
  console.log(`Resolved FdcHub: ${fdcHubAddress}`);
  console.log(`Resolved FdcRequestFeeConfigurations: ${feeConfigAddress}`);

  const feeConfig = new ethers.Contract(feeConfigAddress, FDC_REQUEST_FEE_CONFIGURATIONS_ABI, provider);
  const fee = await feeConfig.getRequestFee(state.abiEncodedRequest);
  console.log(`Request fee: ${ethers.formatEther(fee)} C2FLR`);

  const fdcHub = new ethers.Contract(fdcHubAddress, FDC_HUB_ABI, wallet);
  const tx = await fdcHub.requestAttestation(state.abiEncodedRequest, { value: fee });
  console.log(`Submitted requestAttestation tx: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`Confirmed in block ${receipt.blockNumber}`);

  const block = await provider.getBlock(receipt.blockNumber);
  const roundId = Math.floor((block.timestamp - FIRST_VOTING_ROUND_START_TS) / VOTING_EPOCH_DURATION_SECONDS);
  console.log(`Block timestamp: ${block.timestamp}`);
  console.log(`Calculated voting round ID: ${roundId}`);
  console.log(`Track progress: https://coston2-systems-explorer.flare.rocks/voting-round/${roundId}?tab=fdc`);
  console.log(`Tx on explorer: https://coston2-explorer.flare.network/tx/${tx.hash}`);

  await savePhase2State({ fdcRequestTxHash: tx.hash, votingRoundId: roundId });
  console.log("\nSaved fdcRequestTxHash and votingRoundId to state.phase2.json");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
