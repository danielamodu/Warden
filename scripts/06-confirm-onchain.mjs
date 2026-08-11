// Compiles WardenPaymentAttestor.sol, deploys it to Coston2, decodes the DA
// Layer's abi-encoded IPayment.Response, and calls confirmPayment(proof) —
// which itself calls Flare's on-chain FdcVerification.verifyPayment(). A
// successful tx + emitted event is the "yes, this payment happened" on-chain
// confirmation.
import { ethers } from "ethers";
import solc from "solc";
import fs from "node:fs/promises";
import {
  env,
  PAYMENT_RESPONSE_TUPLE,
  loadState,
  saveState,
} from "./config.mjs";

async function compileContract() {
  const contractPath = new URL("../contracts/WardenPaymentAttestor.sol", import.meta.url);
  const source = await fs.readFile(contractPath, "utf8");

  const input = {
    language: "Solidity",
    sources: {
      "WardenPaymentAttestor.sol": { content: source },
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

  const contract = output.contracts["WardenPaymentAttestor.sol"]["WardenPaymentAttestor"];
  return { abi: contract.abi, bytecode: "0x" + contract.evm.bytecode.object };
}

async function main() {
  const state = await loadState();
  if (!state.proof) {
    throw new Error("Missing proof in state.json — run 05-retrieve-proof.mjs first.");
  }

  const { COSTON2_RPC_URL, COSTON2_PRIVATE_KEY } = env;
  const provider = new ethers.JsonRpcProvider(COSTON2_RPC_URL);
  const wallet = new ethers.Wallet(COSTON2_PRIVATE_KEY, provider);

  console.log("Compiling WardenPaymentAttestor.sol...");
  const { abi, bytecode } = await compileContract();

  let attestorAddress = state.attestorAddress;
  let attestor;
  if (attestorAddress) {
    console.log(`Reusing previously deployed contract at ${attestorAddress}`);
    attestor = new ethers.Contract(attestorAddress, abi, wallet);
  } else {
    console.log("Deploying WardenPaymentAttestor to Coston2...");
    const factory = new ethers.ContractFactory(abi, bytecode, wallet);
    attestor = await factory.deploy();
    await attestor.waitForDeployment();
    attestorAddress = await attestor.getAddress();
    console.log(`Deployed at: ${attestorAddress}`);
    console.log(`Explorer: https://coston2-explorer.flare.network/address/${attestorAddress}`);
    await saveState({ attestorAddress });
  }

  console.log("\nDecoding DA Layer response_hex as IPayment.Response...");
  const coder = ethers.AbiCoder.defaultAbiCoder();
  const [decodedResponse] = coder.decode([PAYMENT_RESPONSE_TUPLE], state.proof.response_hex);

  const proofArg = {
    merkleProof: state.proof.proof,
    data: decodedResponse.toObject(true),
  };

  console.log("Calling confirmPayment(proof) on-chain...");
  const tx = await attestor.confirmPayment(proofArg);
  console.log(`Tx: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`Confirmed in block ${receipt.blockNumber}, status: ${receipt.status === 1 ? "SUCCESS" : "FAILED"}`);
  console.log(`Explorer: https://coston2-explorer.flare.network/tx/${tx.hash}`);

  const count = await attestor.paymentCount();
  const last = await attestor.confirmedPayments(count - 1n);
  console.log("\nOn-chain confirmed payment record:");
  console.log(`  blockTimestamp: ${last.blockTimestamp}`);
  console.log(`  sourceAddressHash: ${last.sourceAddressHash}`);
  console.log(`  receivingAddressHash: ${last.receivingAddressHash}`);
  console.log(`  receivedAmount (drops): ${last.receivedAmount}`);
  console.log(`  standardPaymentReference: ${last.standardPaymentReference}`);

  console.log("\n✅ YES — this XRPL payment happened, and Flare's FDC + FdcVerification confirmed it on-chain on Coston2.");

  await saveState({ confirmTxHash: tx.hash });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
