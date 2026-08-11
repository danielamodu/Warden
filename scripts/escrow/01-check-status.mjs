// Sanity-checks everything Phase 1 needs before spending any real testnet
// funds: resolves AssetManagerFXRP + the FXRP token address via the Flare
// Contract Registry (never hardcoded, per Flare's own guidance and the
// lesson from Task 1), reads the Core Vault XRPL payment address and the
// direct-minting fee/limit settings, and prints current balances for the
// ESCROW_DEPLOYER (Coston2) and XRPL_SENDER (XRPL) wallets.
import { ethers } from "ethers";
import { Client, dropsToXrp } from "xrpl";
import {
  env,
  CONTRACT_REGISTRY_ADDRESS,
  CONTRACT_REGISTRY_ABI,
  ASSET_MANAGER_ABI,
  saveEscrowState,
} from "./config.mjs";

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

const XRPL_TESTNET_WS = "wss://s.altnet.rippletest.net:51233";

async function main() {
  const { COSTON2_RPC_URL, ESCROW_DEPLOYER_ADDRESS, XRPL_SENDER_ADDRESS } = env;
  if (!ESCROW_DEPLOYER_ADDRESS) {
    throw new Error("Missing ESCROW_DEPLOYER_ADDRESS in .env");
  }

  const provider = new ethers.JsonRpcProvider(COSTON2_RPC_URL);
  const registry = new ethers.Contract(CONTRACT_REGISTRY_ADDRESS, CONTRACT_REGISTRY_ABI, provider);

  console.log("Resolving AssetManagerFXRP via Flare Contract Registry...");
  const assetManagerAddress = await registry.getContractAddressByName("AssetManagerFXRP");
  console.log(`AssetManagerFXRP: ${assetManagerAddress}`);
  if (assetManagerAddress === ethers.ZeroAddress) {
    throw new Error("AssetManagerFXRP resolved to the zero address — FAssets may not be deployed on this network.");
  }

  const assetManager = new ethers.Contract(assetManagerAddress, ASSET_MANAGER_ABI, provider);

  const [fxrpAddress, coreVaultXrplAddress] = await Promise.all([
    assetManager.fAsset(),
    assetManager.directMintingPaymentAddress(),
  ]);
  console.log(`FXRP token address: ${fxrpAddress}`);
  console.log(`Core Vault XRPL payment address: ${coreVaultXrplAddress}`);

  const [executorFeeUBA, feeBIPS, minimumFeeUBA, hourlyLimitUBA, dailyLimitUBA, unblockUntil, largeThresholdUBA] =
    await Promise.all([
      assetManager.getDirectMintingExecutorFeeUBA(),
      assetManager.getDirectMintingFeeBIPS(),
      assetManager.getDirectMintingMinimumFeeUBA(),
      assetManager.getDirectMintingHourlyLimitUBA(),
      assetManager.getDirectMintingDailyLimitUBA(),
      assetManager.getDirectMintingsUnblockUntilTimestamp(),
      assetManager.getDirectMintingLargeMintingThresholdUBA(),
    ]);

  console.log("\nDirect minting settings:");
  console.log(`  executorFeeUBA:      ${executorFeeUBA} (${dropsToXrp(executorFeeUBA.toString())} XRP)`);
  console.log(`  feeBIPS:             ${feeBIPS}`);
  console.log(`  minimumFeeUBA:       ${minimumFeeUBA} (${dropsToXrp(minimumFeeUBA.toString())} XRP)`);
  console.log(`  hourlyLimitUBA:      ${hourlyLimitUBA} (${dropsToXrp(hourlyLimitUBA.toString())} XRP)`);
  console.log(`  dailyLimitUBA:       ${dailyLimitUBA} (${dropsToXrp(dailyLimitUBA.toString())} XRP)`);
  console.log(`  largeThresholdUBA:   ${largeThresholdUBA} (${dropsToXrp(largeThresholdUBA.toString())} XRP)`);
  console.log(`  unblockUntilTs:      ${unblockUntil}`);

  const fxrp = new ethers.Contract(fxrpAddress, ERC20_ABI, provider);
  const [fxrpSymbol, fxrpDecimals, c2flrBalance, fxrpBalance] = await Promise.all([
    fxrp.symbol(),
    fxrp.decimals(),
    provider.getBalance(ESCROW_DEPLOYER_ADDRESS),
    fxrp.balanceOf(ESCROW_DEPLOYER_ADDRESS),
  ]);

  console.log(`\nESCROW_DEPLOYER (${ESCROW_DEPLOYER_ADDRESS}):`);
  console.log(`  C2FLR balance: ${ethers.formatEther(c2flrBalance)}`);
  console.log(`  ${fxrpSymbol} balance: ${ethers.formatUnits(fxrpBalance, fxrpDecimals)} (decimals=${fxrpDecimals})`);

  if (XRPL_SENDER_ADDRESS) {
    const client = new Client(XRPL_TESTNET_WS);
    await client.connect();
    try {
      const info = await client.request({ command: "account_info", account: XRPL_SENDER_ADDRESS });
      const xrpBalance = dropsToXrp(info.result.account_data.Balance);
      console.log(`\nXRPL_SENDER (${XRPL_SENDER_ADDRESS}):`);
      console.log(`  XRP balance: ${xrpBalance}`);
    } catch (err) {
      console.log(`\nXRPL_SENDER (${XRPL_SENDER_ADDRESS}): could not fetch balance (${err.message})`);
    } finally {
      await client.disconnect();
    }
  }

  await saveEscrowState({
    assetManagerAddress,
    fxrpAddress,
    fxrpDecimals: Number(fxrpDecimals),
    coreVaultXrplAddress,
  });
  console.log("\nSaved assetManagerAddress / fxrpAddress / coreVaultXrplAddress to state.escrow.json");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
