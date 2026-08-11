// Full FAssets Direct Minting round trip in one script (mint payment ->
// XRPPayment attestation -> proof -> executeDirectMinting), consolidated
// from Phase 1's five separate scripts/escrow/02-06 steps since Phase 3
// only needs this once, to top up FXRP for a fresh disputed escrow —
// leftover FXRP from Phase 1/2 (4.0 FXRP) is below one redemption lot
// (10.0 FXRP), so resolveAndRelease would revert with "amount below one
// lot" without this. Same real XRPL testnet payment, same real FDC
// attestation, same real on-chain mint as every prior phase.
import { ethers } from "ethers";
import { Client, Wallet, xrpToDrops, dropsToXrp } from "xrpl";
import {
  env,
  CONTRACT_REGISTRY_ADDRESS,
  CONTRACT_REGISTRY_ABI,
  DIRECT_MINTING_ASSET_MANAGER_ABI as ASSET_MANAGER_ABI,
  FDC_HUB_ABI,
  FDC_REQUEST_FEE_CONFIGURATIONS_ABI,
  FDC_VERIFICATION_XRP_ABI,
  RELAY_ABI,
  XRP_PAYMENT_ATTESTATION_TYPE,
  XRP_SOURCE_ID,
  VERIFIER_URL_TYPE,
  XRP_PAYMENT_RESPONSE_TUPLE,
  FIRST_VOTING_ROUND_START_TS,
  VOTING_EPOCH_DURATION_SECONDS,
  toUtf8HexString,
  buildDirectMintingMemo,
  sleep,
  loadPhase3State,
  savePhase3State,
} from "./config.mjs";

const XRPL_TESTNET_WS = "wss://s.altnet.rippletest.net:51233";
const NET_MINT_AMOUNT_XRP = 12; // > one lot (10.0 FXRP), same amount Phase 1 used
const ERC20_ABI = ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"];
const PAYMENT_ALREADY_CONFIRMED_SIGNATURE = "0x18dce79f";

async function main() {
  const state = await loadPhase3State();
  const {
    COSTON2_RPC_URL,
    ESCROW_DEPLOYER_PRIVATE_KEY,
    ESCROW_DEPLOYER_ADDRESS,
    XRPL_SENDER_SEED,
    VERIFIER_URL_TESTNET,
    VERIFIER_API_KEY_TESTNET,
    COSTON2_DA_LAYER_URL,
  } = env;

  const provider = new ethers.JsonRpcProvider(COSTON2_RPC_URL);
  const wallet = new ethers.Wallet(ESCROW_DEPLOYER_PRIVATE_KEY, provider);
  const registry = new ethers.Contract(CONTRACT_REGISTRY_ADDRESS, CONTRACT_REGISTRY_ABI, provider);

  let assetManagerAddress = state.assetManagerAddress;
  if (!assetManagerAddress) {
    assetManagerAddress = await registry.getContractAddressByName("AssetManagerFXRP");
  }
  const assetManagerRead = new ethers.Contract(assetManagerAddress, ASSET_MANAGER_ABI, provider);
  const coreVaultXrplAddress = state.coreVaultXrplAddress || (await assetManagerRead.directMintingPaymentAddress());

  // --- Step 1: XRPL payment (skip if already sent) ---
  let mintXrplTxHash = state.mintXrplTxHash;
  if (!mintXrplTxHash) {
    const [executorFeeUBA, feeBIPS, minimumFeeUBA] = await Promise.all([
      assetManagerRead.getDirectMintingExecutorFeeUBA(),
      assetManagerRead.getDirectMintingFeeBIPS(),
      assetManagerRead.getDirectMintingMinimumFeeUBA(),
    ]);
    const netMintUBA = BigInt(xrpToDrops(NET_MINT_AMOUNT_XRP.toString()));
    const proportionalFeeUBA = (netMintUBA * feeBIPS) / 10000n;
    const mintingFeeUBA = proportionalFeeUBA > minimumFeeUBA ? proportionalFeeUBA : minimumFeeUBA;
    const totalUBA = netMintUBA + mintingFeeUBA + executorFeeUBA;

    console.log(`Net mint amount: ${NET_MINT_AMOUNT_XRP} XRP, gross payment: ${dropsToXrp(totalUBA.toString())} XRP`);
    console.log(`Core Vault: ${coreVaultXrplAddress}, recipient: ${ESCROW_DEPLOYER_ADDRESS}`);

    const memoData = buildDirectMintingMemo(ESCROW_DEPLOYER_ADDRESS);
    const client = new Client(XRPL_TESTNET_WS);
    await client.connect();
    const sender = Wallet.fromSeed(XRPL_SENDER_SEED);
    const prepared = await client.autofill({
      TransactionType: "Payment",
      Account: sender.address,
      Amount: totalUBA.toString(),
      Destination: coreVaultXrplAddress,
      Memos: [{ Memo: { MemoData: memoData } }],
    });
    const signed = sender.sign(prepared);
    console.log(`Submitting direct-mint payment: ${sender.address} -> ${coreVaultXrplAddress}`);
    const result = await client.submitAndWait(signed.tx_blob);
    mintXrplTxHash = result.result.hash;
    const engineResult = result.result.meta.TransactionResult;
    console.log(`Tx: ${mintXrplTxHash} (${engineResult})`);
    console.log(`Explorer: https://testnet.xrpl.org/transactions/${mintXrplTxHash}`);
    await client.disconnect();
    if (engineResult !== "tesSUCCESS") throw new Error(`Payment did not succeed: ${engineResult}`);

    await savePhase3State({
      assetManagerAddress,
      coreVaultXrplAddress,
      mintXrplTxHash,
      mintXrplTxHashUpper: mintXrplTxHash.toUpperCase(),
      netMintAmountXrp: NET_MINT_AMOUNT_XRP,
    });
  } else {
    console.log(`Reusing previous mint payment: ${mintXrplTxHash}`);
  }

  // --- Step 2: prepare XRPPayment attestation request ---
  let abiEncodedRequest = state.abiEncodedRequest;
  if (!abiEncodedRequest) {
    const url = `${VERIFIER_URL_TESTNET}/verifier/${VERIFIER_URL_TYPE}/${XRP_PAYMENT_ATTESTATION_TYPE}/prepareRequest`;
    const requestBody = { transactionId: mintXrplTxHash.toUpperCase(), proofOwner: ESCROW_DEPLOYER_ADDRESS };
    const request = {
      attestationType: toUtf8HexString(XRP_PAYMENT_ATTESTATION_TYPE),
      sourceId: toUtf8HexString(XRP_SOURCE_ID),
      requestBody,
    };
    console.log("\nPreparing XRPPayment attestation (the verifier's own indexer can lag a few seconds behind XRPL finality, so this retries on TRANSACTION DOES NOT EXIST)...");
    let data;
    for (let attempt = 0; attempt < 12; attempt++) {
      const response = await fetch(url, {
        method: "POST",
        headers: { "X-API-KEY": VERIFIER_API_KEY_TESTNET, "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      if (response.status !== 200) throw new Error(`Verifier returned ${response.status}: ${await response.text()}`);
      data = await response.json();
      if (data.status === "VALID") break;
      if (String(data.status).includes("TRANSACTION DOES NOT EXIST")) {
        process.stdout.write(".");
        await sleep(10000);
        continue;
      }
      throw new Error(`Verifier status was not VALID: ${data.status}`);
    }
    if (!data || data.status !== "VALID") {
      throw new Error(`Verifier status was not VALID after retries: ${data?.status}`);
    }
    console.log("");
    abiEncodedRequest = data.abiEncodedRequest;
    await savePhase3State({ abiEncodedRequest });
  }

  // --- Step 3: submit attestation request to FdcHub ---
  let votingRoundId = state.votingRoundId;
  if (votingRoundId === undefined) {
    const fdcHubAddress = await registry.getContractAddressByName("FdcHub");
    const feeConfigAddress = await registry.getContractAddressByName("FdcRequestFeeConfigurations");
    const feeConfig = new ethers.Contract(feeConfigAddress, FDC_REQUEST_FEE_CONFIGURATIONS_ABI, provider);
    const fee = await feeConfig.getRequestFee(abiEncodedRequest);
    const fdcHub = new ethers.Contract(fdcHubAddress, FDC_HUB_ABI, wallet);
    console.log("\nSubmitting attestation request to FdcHub...");
    const tx = await fdcHub.requestAttestation(abiEncodedRequest, { value: fee });
    const receipt = await tx.wait();
    const block = await provider.getBlock(receipt.blockNumber);
    votingRoundId = Math.floor((block.timestamp - FIRST_VOTING_ROUND_START_TS) / VOTING_EPOCH_DURATION_SECONDS);
    console.log(`Tx: ${tx.hash}, voting round: ${votingRoundId}`);
    await savePhase3State({ fdcRequestTxHash: tx.hash, votingRoundId });
  } else {
    console.log(`\nReusing previous attestation request, voting round ${votingRoundId}`);
  }

  // --- Step 4: wait for finalization, retrieve DA Layer proof ---
  let proof = state.proof;
  if (!proof) {
    const fdcVerificationAddress = await registry.getContractAddressByName("FdcVerification");
    const relayAddress = await registry.getContractAddressByName("Relay");
    const fdcVerification = new ethers.Contract(fdcVerificationAddress, FDC_VERIFICATION_XRP_ABI, provider);
    const relay = new ethers.Contract(relayAddress, RELAY_ABI, provider);
    const protocolId = await fdcVerification.fdcProtocolId();

    console.log(`\nWaiting for voting round ${votingRoundId} to finalize...`);
    let finalized = false;
    while (!finalized) {
      try {
        finalized = await relay.isFinalized(protocolId, votingRoundId);
      } catch {
        process.stdout.write("x");
        await sleep(5000);
        continue;
      }
      if (!finalized) {
        process.stdout.write(".");
        await sleep(10000);
      }
    }
    console.log("\nRound finalized! Requesting proof from DA Layer...");

    const url = `${COSTON2_DA_LAYER_URL}/api/v1/fdc/proof-by-request-round-raw`;
    for (let attempt = 0; attempt < 40 && !proof; attempt++) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "X-API-KEY": VERIFIER_API_KEY_TESTNET, "Content-Type": "application/json" },
          body: JSON.stringify({ votingRoundId, requestBytes: abiEncodedRequest }),
        });
        if (response.status === 200) {
          const data = await response.json();
          if (data.response_hex) proof = data;
        }
      } catch {
        // transient, keep polling
      }
      if (!proof) {
        process.stdout.write(".");
        await sleep(5000);
      }
    }
    if (!proof) throw new Error("Timed out waiting for DA Layer proof.");
    console.log("\nProof received.");
    await savePhase3State({ proof });
  } else {
    console.log("\nReusing previously retrieved proof.");
  }

  // --- Step 5: executeDirectMinting ---
  if (state.mintTxHash) {
    console.log(`\nMint already executed: ${state.mintTxHash}`);
    return;
  }

  const assetManager = new ethers.Contract(assetManagerAddress, ASSET_MANAGER_ABI, wallet);
  const fxrpAddress = state.fxrpAddress || (await assetManager.fAsset());
  const fxrp = new ethers.Contract(fxrpAddress, ERC20_ABI, provider);
  const decimals = await fxrp.decimals();
  const balanceBefore = await fxrp.balanceOf(ESCROW_DEPLOYER_ADDRESS);
  console.log(`\nFXRP balance before: ${ethers.formatUnits(balanceBefore, decimals)}`);

  const coder = ethers.AbiCoder.defaultAbiCoder();
  const [decodedResponse] = coder.decode([XRP_PAYMENT_RESPONSE_TUPLE], proof.response_hex);
  const proofArg = { merkleProof: proof.proof, data: decodedResponse.toObject(true) };

  console.log("Calling executeDirectMinting(proof)...");
  let mintTxHash;
  try {
    const tx = await assetManager.executeDirectMinting(proofArg);
    const receipt = await tx.wait();
    mintTxHash = tx.hash;
    console.log(`Tx: ${tx.hash} (block ${receipt.blockNumber})`);
    console.log(`Explorer: https://coston2-explorer.flare.network/tx/${tx.hash}`);
  } catch (err) {
    const errorData = err?.info?.error?.data || err?.data;
    if (errorData === PAYMENT_ALREADY_CONFIRMED_SIGNATURE) {
      console.log("\nAlready confirmed by Flare's own executor bot — this is a success case, not an error.");
      mintTxHash = "already-confirmed-by-relayer";
    } else {
      console.error("executeDirectMinting reverted:", err.shortMessage || err.message);
      throw err;
    }
  }

  const balanceAfter = await fxrp.balanceOf(ESCROW_DEPLOYER_ADDRESS);
  console.log(`FXRP balance after: ${ethers.formatUnits(balanceAfter, decimals)}`);
  console.log(`FXRP minted (delta): ${ethers.formatUnits(balanceAfter - balanceBefore, decimals)}`);

  await savePhase3State({
    fxrpAddress,
    mintTxHash,
    fxrpBalanceAfterMint: balanceAfter.toString(),
  });
  console.log("\nSaved mintTxHash to state.phase3.json");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
