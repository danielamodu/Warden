// Runs the full Task 1 round-trip end to end (steps 02-06). Run 01 separately
// first (once) since it generates accounts that need manual Coston2 faucet funding.
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const steps = [
  "02-send-xrp-payment.mjs",
  "03-prepare-attestation.mjs",
  "04-submit-attestation.mjs",
  "05-retrieve-proof.mjs",
  "06-confirm-onchain.mjs",
];

function run(script) {
  return new Promise((resolve, reject) => {
    console.log(`\n=== Running ${script} ===`);
    const child = spawn(process.execPath, [path.join(__dirname, script)], { stdio: "inherit" });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${script} exited with code ${code}`))));
  });
}

for (const step of steps) {
  await run(step);
}

console.log("\n=== Full FDC round-trip complete ===");
