# Warden — Phase 1: Escrow Core

Status: **working, verified end to end on Coston2, real FAssets mint + real escrow fund/hold.**

## What this proves

1. A buyer sends real XRP on XRPL testnet to Flare's FAssets Core Vault, with a memo tagging
   the mint recipient.
2. Flare's FDC validates that payment (`XRPPayment` attestation type) and produces a proof.
3. `AssetManagerFXRP.executeDirectMinting(proof)` mints real FXRP (FAssets' 1:1 XRP
   representation) to the buyer's Coston2 address — no per-agent vault dependency.
4. `WardenEscrow.fund(conditionId, beneficiary, amount)` pulls that FXRP in and records it
   against a **generic, opaque condition reference** — the contract has no idea what the
   condition means, only that it's unresolved until some later phase says otherwise.
5. Verified two independent ways: the contract's own escrow record (`getEscrow`) and its
   real on-chain FXRP balance (`heldBalance()`, cross-checked against the buyer's balance
   actually dropping by the same amount).

This is fund + hold only, on purpose — no release or dispute logic exists yet. That's Phase 2
(happy path) and Phase 3 (dispute path), built on top of this core without needing to touch it.

## The generic condition design

```solidity
struct Escrow {
    bytes32 conditionId;   // opaque — a hash, an off-chain reference, or eventually a
                            // pointer to a specific FDC attestation. This contract never
                            // interprets it.
    address buyer;
    address beneficiary;   // recorded for a future release phase; unused so far
    uint256 amount;        // FXRP held, in UBA (6 decimals, same as XRP drops)
    ConditionStatus status;// Unresolved | Resolved
    uint64 fundedAt;
}
```

Nothing insurance-specific, nothing trade-finance-specific. A later resolver contract
interprets `conditionId` however that vertical needs to (an FDC attestation, an oracle,
a multisig decision) — `WardenEscrow` itself stays generic.

## Live artifacts from the run

**FAssets direct mint (buyer funding XRP → FXRP):**
- XRPL payment to Core Vault (`rDhpmiPq4BVBDWMVdSrmkgt8thKyRzGV1p`), 12 net XRP:
  `2D8BD902793E1902E1559587BF06850CDA901A600433DE21D6A0C3A7E0E9AC06`
  https://testnet.xrpl.org/transactions/2D8BD902793E1902E1559587BF06850CDA901A600433DE21D6A0C3A7E0E9AC06
- FDC `XRPPayment` attestation request (Coston2):
  https://coston2-explorer.flare.network/tx/0x0adc012b31bc75bc24f41279a3aa9820ec1c2a6afce811a5a17e16ff9fbbc297
- Voting round: `1413797` — finalized.
- Mint execution: `0xb306e6c59a27cbf5d76256d21dee6c4ab56d7f69051cdca4cefb02863b5b886c`
  https://coston2-explorer.flare.network/tx/0xb306e6c59a27cbf5d76256d21dee6c4ab56d7f69051cdca4cefb02863b5b886c
  (executed by Flare's own executor bot, which won the race against our own
  `executeDirectMinting` call — see gotchas below)
- Result: 12 FXRP minted to the buyer, balance 10.0 → 22.0 FXRP.

**WardenEscrow (fund + hold):**
- Contract: `0x178A8f2D53C53194F81153E7Ce018CbB58D54045`
  https://coston2-explorer.flare.network/address/0x178A8f2D53C53194F81153E7Ce018CbB58D54045
  (constructor arg `fxrp` resolved live from `AssetManagerFXRP.fAsset()` via the
  `ContractRegistry` — never hardcoded)
- Approve tx: https://coston2-explorer.flare.network/tx/0x0f1eeb7ec2d5e4bb7b8699d8c2bfe24e18dd9c4c0b931fede73324da7a39f37e
- Fund tx (block 33887720):
  https://coston2-explorer.flare.network/tx/0x489b239a6ef3c60fef5b0ea258de7af6d333e856e3cff7f23e49b1b62c17d6fe
- `EscrowFunded` event: `escrowId=0`, `conditionId=0xee22e9e6f93ce509fe33801ff42201386052bee853f992fe1a449d95f38390a0`
  (a demo hash standing in for "whatever condition a later phase attaches"), `beneficiary=0xa90a9A711Bd8bbeeef2B25c2299681462F5fc27d`, `amount=8.0 FXRP`
- Verification:
  - `getEscrow(0)` — matches the event exactly, `status: Unresolved`.
  - `heldBalance()` — `8.0 FXRP`, independently confirming the contract actually holds it.
  - Buyer balance: `22.0 → 14.0 FXRP`, a drop of exactly `8.0 FXRP`.

## How to reproduce

```bash
npm install
node scripts/escrow/01-check-status.mjs      # resolves AssetManagerFXRP + FXRP addresses, prints direct-minting params
node scripts/escrow/02-send-mint-payment.mjs # sends the XRPL payment to the Core Vault with the mint memo
node scripts/escrow/03-prepare-attestation.mjs
node scripts/escrow/04-submit-attestation.mjs
node scripts/escrow/05-retrieve-proof.mjs
node scripts/escrow/06-execute-minting.mjs   # mints FXRP (or detects the relayer already did)
node scripts/escrow/07-deploy-escrow.mjs     # deploys WardenEscrow wired to the real FXRP address
node scripts/escrow/08-fund-escrow.mjs       # approves + funds, then verifies two independent ways
```

Each step persists to its own `state.escrow.json`, separate from Task 1's `state.json`, so
the two workstreams never collide — see the wallet/state discipline note below.

## What it took / gotchas worth knowing before Phase 2

- **The textbook FAssets minting flow (reserve collateral from an agent → pay their
  underlying address → executeMinting) is effectively archived on current Coston2.** The
  live path is **Direct Minting**: one XRPL payment straight to a shared Core Vault address,
  tagged with a recipient memo, then `executeDirectMinting(proof)`. This is actually better
  for a spike (and for Phase 2+) — it removes the "is some specific agent vault online with
  free collateral right now" flakiness that the original brief flagged as a real risk.
- **Direct minting uses a different FDC attestation type than Task 1.** Task 1 used the
  generic `Payment` type (id `0x01`). Direct minting requires `XRPPayment` (id `0x08`), which
  has a materially different response struct — adds `sourceAddress`, memo fields
  (`hasMemoData`/`firstMemoData`), and destination-tag fields that `Payment` doesn't carry.
  Don't assume the Task 1 attestation plumbing is a drop-in reuse; the request/response
  shapes genuinely differ.
- **Flare's own executor bot may race your own mint call.** After the FDC proof was ready,
  our `executeDirectMinting` call reverted with `PaymentAlreadyConfirmed()` — Flare runs an
  automated executor that watches for finalized direct-minting proofs and executes them
  itself for a fee. The mint still happens (see the tx above), just not from the transaction
  you sent. Treat that revert as success, not failure, and look up the relayer's tx instead
  of assuming your own call is the mint event.
- **Same raw-GitHub-over-rendered-docs discipline as Task 1, and it mattered again here.**
  The exact `executeDirectMinting`/`IXRPPayment` struct field order and the direct-minting
  memo format (`4642505266410018` prefix + 4-byte zero padding + 20-byte recipient address)
  were verified against `flare-solidity-periphery-package-mirror/coston2/{IAssetManager,IDirectMinting,IDirectMintingSettings,IXRPPayment}.sol`
  and `developer-hub`'s raw minting doc, not the rendered site.
- **ethers v6 `Result` is frozen — same gotcha as Task 1.** Decoded structs from
  `AbiCoder.decode` need `.toObject(true)` before being passed back into a contract call.
- **Wallet/state isolation mattered in practice, not just in theory.** This work ran
  concurrently with other activity in the same repo, using a dedicated
  `ESCROW_DEPLOYER_PRIVATE_KEY` (never `COSTON2_PRIVATE_KEY`) and its own `state.escrow.json`
  (never the shared `state.json`) — avoided nonce collisions and state clobbering between
  the two without needing to serialize the work.
- **The FXRP token address is never hardcoded.** `WardenEscrow`'s constructor takes it as an
  argument, resolved live via `ContractRegistry.getContractAddressByName("AssetManagerFXRP")`
  → `AssetManager.fAsset()` — same "resolve by name, don't hardcode" discipline as Task 1's
  `FdcHub`/`FdcVerification` lookups.
