// Sends the single XRPL payment that triggers FAssets FXRP direct minting:
// a payment to the Core Vault XRPL address carrying a 32-byte memo that
// encodes the Flare recipient (ESCROW_DEPLOYER_ADDRESS, a plain EOA — the
// docs explicitly support "plain mints to an EOA or contract address" with
// this memo format, no Flare Smart Account needed).
//
// Gross payment amount = net mint amount + minting fee (proportional, with a
// floor) + flat executor fee, per Flare's computeDirectMintingPaymentAmountXrp
// formula (flare-viem-starter src/utils/fassets.ts).
import { ethers } from "ethers";
import { Client, Wallet, xrpToDrops, dropsToXrp } from "xrpl";
import {
  env,
  CONTRACT_REGISTRY_ADDRESS,
  CONTRACT_REGISTRY_ABI,
  ASSET_MANAGER_ABI,
  buildDirectMintingMemo,
  loadEscrowState,
  saveEscrowState,
} from "./config.mjs";

const XRPL_TESTNET_WS = "wss://s.altnet.rippletest.net:51233";

// Net FXRP amount we want minted, in XRP. Kept modest — this is a Phase 1
// demonstration, not a production mint.
const NET_MINT_AMOUNT_XRP = 12;

async function main() {
  const state = await loadEscrowState();
  const { COSTON2_RPC_URL, ESCROW_DEPLOYER_ADDRESS, XRPL_SENDER_SEED } = env;
  if (!ESCROW_DEPLOYER_ADDRESS || !XRPL_SENDER_SEED) {
    throw new Error("Missing ESCROW_DEPLOYER_ADDRESS or XRPL_SENDER_SEED in .env");
  }

  let { assetManagerAddress, coreVaultXrplAddress } = state;
  const provider = new ethers.JsonRpcProvider(COSTON2_RPC_URL);

  if (!assetManagerAddress || !coreVaultXrplAddress) {
    const registry = new ethers.Contract(CONTRACT_REGISTRY_ADDRESS, CONTRACT_REGISTRY_ABI, provider);
    assetManagerAddress = await registry.getContractAddressByName("AssetManagerFXRP");
  }

  const assetManager = new ethers.Contract(assetManagerAddress, ASSET_MANAGER_ABI, provider);
  if (!coreVaultXrplAddress) {
    coreVaultXrplAddress = await assetManager.directMintingPaymentAddress();
  }

  const [executorFeeUBA, feeBIPS, minimumFeeUBA] = await Promise.all([
    assetManager.getDirectMintingExecutorFeeUBA(),
    assetManager.getDirectMintingFeeBIPS(),
    assetManager.getDirectMintingMinimumFeeUBA(),
  ]);

  const netMintUBA = BigInt(xrpToDrops(NET_MINT_AMOUNT_XRP.toString()));
  const proportionalFeeUBA = (netMintUBA * feeBIPS) / 10000n;
  const mintingFeeUBA = proportionalFeeUBA > minimumFeeUBA ? proportionalFeeUBA : minimumFeeUBA;
  const totalUBA = netMintUBA + mintingFeeUBA + executorFeeUBA;
  const paymentAmountXrp = dropsToXrp(totalUBA.toString());

  console.log(`Net mint amount:     ${NET_MINT_AMOUNT_XRP} XRP`);
  console.log(`Minting fee:         ${dropsToXrp(mintingFeeUBA.toString())} XRP`);
  console.log(`Executor fee:        ${dropsToXrp(executorFeeUBA.toString())} XRP`);
  console.log(`Gross payment:       ${paymentAmountXrp} XRP`);
  console.log(`Core Vault address:  ${coreVaultXrplAddress}`);
  console.log(`Recipient (Flare):   ${ESCROW_DEPLOYER_ADDRESS}`);

  const memoData = buildDirectMintingMemo(ESCROW_DEPLOYER_ADDRESS);
  console.log(`Direct-minting memo (32 bytes): ${memoData}`);

  const client = new Client(XRPL_TESTNET_WS);
  await client.connect();
  const sender = Wallet.fromSeed(XRPL_SENDER_SEED);

  const prepared = await client.autofill({
    TransactionType: "Payment",
    Account: sender.address,
    // Use the drops amount computed above directly (totalUBA IS drops for
    // XRP) rather than round-tripping through XRP, to avoid floating-point
    // rounding drift between dropsToXrp/xrpToDrops.
    Amount: totalUBA.toString(),
    Destination: coreVaultXrplAddress,
    Memos: [{ Memo: { MemoData: memoData } }],
  });

  const signed = sender.sign(prepared);
  console.log(`\nSubmitting direct-mint payment: ${sender.address} -> ${coreVaultXrplAddress}`);
  const result = await client.submitAndWait(signed.tx_blob);

  const txHash = result.result.hash;
  const engineResult = result.result.meta.TransactionResult;
  console.log(`Transaction hash: ${txHash}`);
  console.log(`Engine result: ${engineResult}`);
  console.log(`Explorer: https://testnet.xrpl.org/transactions/${txHash}`);

  await client.disconnect();

  if (engineResult !== "tesSUCCESS") {
    throw new Error(`Payment did not succeed: ${engineResult}`);
  }

  await saveEscrowState({
    assetManagerAddress,
    coreVaultXrplAddress,
    mintXrplTxHash: txHash,
    mintXrplTxHashUpper: txHash.toUpperCase(),
    netMintAmountXrp: NET_MINT_AMOUNT_XRP,
    mintRecipient: ESCROW_DEPLOYER_ADDRESS,
  });
  console.log("\nSaved mintXrplTxHash to state.escrow.json");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
