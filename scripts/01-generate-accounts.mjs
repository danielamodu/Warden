// Generates two throwaway XRPL testnet accounts (sender, receiver) funded via
// Ripple's public testnet faucet, and one throwaway Coston2 (EVM) dev account.
// Nothing here holds real value — testnet only.
import { Client, Wallet } from "xrpl";
import { ethers } from "ethers";
import fs from "node:fs/promises";

const XRPL_TESTNET_WS = "wss://s.altnet.rippletest.net:51233";

async function fundXrplWallet(client, label) {
  console.log(`Requesting XRPL testnet faucet funding for ${label}...`);
  const { wallet, balance } = await client.fundWallet();
  console.log(`  ${label}: ${wallet.address} funded with ${balance} XRP`);
  return wallet;
}

async function main() {
  const client = new Client(XRPL_TESTNET_WS);
  await client.connect();

  const sender = await fundXrplWallet(client, "sender");
  const receiver = await fundXrplWallet(client, "receiver");

  await client.disconnect();

  const evmWallet = ethers.Wallet.createRandom();
  console.log(`\nGenerated Coston2 dev wallet: ${evmWallet.address}`);
  console.log("This wallet is NOT funded yet — fund it at https://faucet.flare.network/ (Request C2FLR).");

  const envPath = new URL("../.env", import.meta.url);
  let envContent = "";
  try {
    envContent = await fs.readFile(envPath, "utf8");
  } catch {
    envContent = await fs.readFile(new URL("../.env.example", import.meta.url), "utf8");
  }

  const setVar = (content, key, value) => {
    const re = new RegExp(`^${key}=.*$`, "m");
    if (re.test(content)) return content.replace(re, `${key}=${value}`);
    return content + `\n${key}=${value}`;
  };

  envContent = setVar(envContent, "XRPL_SENDER_SEED", sender.seed);
  envContent = setVar(envContent, "XRPL_SENDER_ADDRESS", sender.address);
  envContent = setVar(envContent, "XRPL_RECEIVER_SEED", receiver.seed);
  envContent = setVar(envContent, "XRPL_RECEIVER_ADDRESS", receiver.address);
  envContent = setVar(envContent, "COSTON2_PRIVATE_KEY", evmWallet.privateKey);
  envContent = setVar(envContent, "COSTON2_ADDRESS", evmWallet.address);

  await fs.writeFile(envPath, envContent);
  console.log("\nWrote credentials to .env");
  console.log(`\nNEXT STEP: fund ${evmWallet.address} with C2FLR at https://faucet.flare.network/ before running 04-submit-attestation.mjs`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
