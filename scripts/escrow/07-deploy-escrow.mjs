// Compiles WardenEscrow.sol with solc (same pattern as ../06-confirm-onchain.mjs)
// and deploys it to Coston2, wired to the real AssetManagerFXRP-resolved FXRP
// token address (never hardcoded).
import { ethers } from "ethers";
import solc from "solc";
import fs from "node:fs/promises";
import {
  env,
  CONTRACT_REGISTRY_ADDRESS,
  CONTRACT_REGISTRY_ABI,
  loadEscrowState,
  saveEscrowState,
} from "./config.mjs";

async function compileContract() {
  const contractPath = new URL("../../contracts/WardenEscrow.sol", import.meta.url);
  const source = await fs.readFile(contractPath, "utf8");

  const input = {
    language: "Solidity",
    sources: {
      "WardenEscrow.sol": { content: source },
    },
    settings: {
      outputSelection: {
        "*": { "*": ["abi", "evm.bytecode.object"] },
      },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));

  const errors = (output.errors || []).filter((e) => e.severity === "error");
  if (errors.length > 0) {
    for (const e of errors) console.error(e.formattedMessage);
    throw new Error("Solidity compilation failed.");
  }

  const contract = output.contracts["WardenEscrow.sol"]["WardenEscrow"];
  return { abi: contract.abi, bytecode: "0x" + contract.evm.bytecode.object };
}

async function main() {
  const state = await loadEscrowState();
  const { COSTON2_RPC_URL, ESCROW_DEPLOYER_PRIVATE_KEY } = env;
  const provider = new ethers.JsonRpcProvider(COSTON2_RPC_URL);
  const wallet = new ethers.Wallet(ESCROW_DEPLOYER_PRIVATE_KEY, provider);

  let fxrpAddress = state.fxrpAddress;
  if (!fxrpAddress) {
    const registry = new ethers.Contract(CONTRACT_REGISTRY_ADDRESS, CONTRACT_REGISTRY_ABI, provider);
    const assetManagerAddress = await registry.getContractAddressByName("AssetManagerFXRP");
    const assetManager = new ethers.Contract(assetManagerAddress, ["function fAsset() view returns (address)"], provider);
    fxrpAddress = await assetManager.fAsset();
  }
  console.log(`FXRP token address (constructor arg): ${fxrpAddress}`);

  console.log("Compiling WardenEscrow.sol...");
  const { abi, bytecode } = await compileContract();

  let escrowAddress = state.escrowAddress;
  let escrow;
  if (escrowAddress) {
    console.log(`Reusing previously deployed contract at ${escrowAddress}`);
    escrow = new ethers.Contract(escrowAddress, abi, wallet);
  } else {
    console.log("Deploying WardenEscrow to Coston2...");
    const factory = new ethers.ContractFactory(abi, bytecode, wallet);
    escrow = await factory.deploy(fxrpAddress);
    await escrow.waitForDeployment();
    escrowAddress = await escrow.getAddress();
    console.log(`Deployed at: ${escrowAddress}`);
    console.log(`Explorer: https://coston2-explorer.flare.network/address/${escrowAddress}`);
    await saveEscrowState({ escrowAddress, fxrpAddress, escrowAbi: abi });
  }

  const deployedFxrp = await escrow.fxrp();
  console.log(`Contract's configured fxrp(): ${deployedFxrp}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
