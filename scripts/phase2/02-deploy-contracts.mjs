// Compiles WardenEscrow.sol (Phase 2 version, with release logic) and
// WardenWeatherResolver.sol with solc, deploys both to Coston2, and wires
// them together via the one-time setResolver() call.
import { ethers } from "ethers";
import solc from "solc";
import fs from "node:fs/promises";
import {
  env,
  CONTRACT_REGISTRY_ADDRESS,
  CONTRACT_REGISTRY_ABI,
  ASSET_MANAGER_ABI,
  loadPhase2State,
  savePhase2State,
} from "./config.mjs";

async function compileContract(fileName, contractName) {
  const contractPath = new URL(`../../contracts/${fileName}`, import.meta.url);
  const source = await fs.readFile(contractPath, "utf8");

  const input = {
    language: "Solidity",
    sources: { [fileName]: { content: source } },
    settings: {
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = (output.errors || []).filter((e) => e.severity === "error");
  if (errors.length > 0) {
    for (const e of errors) console.error(e.formattedMessage);
    throw new Error(`Solidity compilation failed for ${fileName}.`);
  }

  const contract = output.contracts[fileName][contractName];
  return { abi: contract.abi, bytecode: "0x" + contract.evm.bytecode.object };
}

async function main() {
  const state = await loadPhase2State();
  const { COSTON2_RPC_URL, ESCROW_DEPLOYER_PRIVATE_KEY } = env;
  const provider = new ethers.JsonRpcProvider(COSTON2_RPC_URL);
  const wallet = new ethers.Wallet(ESCROW_DEPLOYER_PRIVATE_KEY, provider);

  let fxrpAddress = state.fxrpAddress;
  let assetManagerAddress = state.assetManagerAddress;
  if (!fxrpAddress || !assetManagerAddress) {
    const registry = new ethers.Contract(CONTRACT_REGISTRY_ADDRESS, CONTRACT_REGISTRY_ABI, provider);
    assetManagerAddress = await registry.getContractAddressByName("AssetManagerFXRP");
    const assetManager = new ethers.Contract(assetManagerAddress, ASSET_MANAGER_ABI, provider);
    fxrpAddress = await assetManager.fAsset();
    await savePhase2State({ fxrpAddress, assetManagerAddress });
  }
  console.log(`FXRP token address: ${fxrpAddress}`);
  console.log(`AssetManagerFXRP address: ${assetManagerAddress}`);

  console.log("\nCompiling WardenEscrow.sol...");
  const escrowArtifact = await compileContract("WardenEscrow.sol", "WardenEscrow");
  console.log("Compiling WardenWeatherResolver.sol...");
  const resolverArtifact = await compileContract("WardenWeatherResolver.sol", "WardenWeatherResolver");

  let escrowAddress = state.escrowAddress;
  let escrow;
  if (escrowAddress) {
    console.log(`\nReusing previously deployed WardenEscrow at ${escrowAddress}`);
    escrow = new ethers.Contract(escrowAddress, escrowArtifact.abi, wallet);
  } else {
    console.log("\nDeploying WardenEscrow to Coston2...");
    const factory = new ethers.ContractFactory(escrowArtifact.abi, escrowArtifact.bytecode, wallet);
    escrow = await factory.deploy(fxrpAddress, assetManagerAddress);
    await escrow.waitForDeployment();
    escrowAddress = await escrow.getAddress();
    console.log(`Deployed at: ${escrowAddress}`);
    console.log(`Explorer: https://coston2-explorer.flare.network/address/${escrowAddress}`);
    await savePhase2State({ escrowAddress, escrowAbi: escrowArtifact.abi });
  }

  let resolverAddress = state.resolverAddress;
  let resolver;
  if (resolverAddress) {
    console.log(`Reusing previously deployed WardenWeatherResolver at ${resolverAddress}`);
    resolver = new ethers.Contract(resolverAddress, resolverArtifact.abi, wallet);
  } else {
    console.log("\nDeploying WardenWeatherResolver to Coston2...");
    const factory = new ethers.ContractFactory(resolverArtifact.abi, resolverArtifact.bytecode, wallet);
    resolver = await factory.deploy(escrowAddress);
    await resolver.waitForDeployment();
    resolverAddress = await resolver.getAddress();
    console.log(`Deployed at: ${resolverAddress}`);
    console.log(`Explorer: https://coston2-explorer.flare.network/address/${resolverAddress}`);
    await savePhase2State({ resolverAddress, resolverAbi: resolverArtifact.abi });
  }

  const currentResolver = await escrow.resolver();
  if (currentResolver === ethers.ZeroAddress) {
    console.log(`\nWiring resolver into WardenEscrow (one-time setResolver call)...`);
    const tx = await escrow.setResolver(resolverAddress);
    console.log(`Tx: ${tx.hash}`);
    await tx.wait();
    console.log("Resolver set.");
  } else {
    console.log(`\nResolver already set on escrow: ${currentResolver}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
