# Warden

A smart escrow on Flare that locks XRP-derived value (via FAssets/FXRP) and auto-releases on a
verified real-world condition using Flare's Data Connector (FDC), with a confidential-compute
(FCE/TEE) fallback arbitrator for disputes. Built and verified end to end on Coston2 testnet.

## Live deployments

| Component | Address / tx | Explorer |
|---|---|---|
| `WardenPaymentAttestor` (Task 1) | `0xb93d06F70dD0C75ddF12F2361193C972a0baa3e2` | [contract](https://coston2-explorer.flare.network/address/0xb93d06F70dD0C75ddF12F2361193C972a0baa3e2) |
| `WardenEscrow` v1 (Phase 1) | `0x178A8f2D53C53194F81153E7Ce018CbB58D54045` | [contract](https://coston2-explorer.flare.network/address/0x178A8f2D53C53194F81153E7Ce018CbB58D54045) |
| `WardenEscrow` v2 (Phase 2, + release hook) | `0xBDDD1E23604cA932c823Ef3397D96697aBB1c53D` | [contract](https://coston2-explorer.flare.network/address/0xBDDD1E23604cA932c823Ef3397D96697aBB1c53D) |
| `WardenWeatherResolver` (Phase 2) | `0x0a7b57FC9d907a55f72E7920E6645A6d40B972CF` | [contract](https://coston2-explorer.flare.network/address/0x0a7b57FC9d907a55f72E7920E6645A6d40B972CF) |
| Phase 2 auto-release tx | `0xb15a31cd33a27bae8e6c5f91758722610651a388666c75313031d956b0ae16ce` | [tx](https://coston2-explorer.flare.network/tx/0xb15a31cd33a27bae8e6c5f91758722610651a388666c75313031d956b0ae16ce) |
| Phase 2 real XRPL payout | `0B903CE2F06F37947DC052333D1754CF08BC3CDCBB0AB36145CFF7E79C468B92` | [tx](https://testnet.xrpl.org/transactions/0B903CE2F06F37947DC052333D1754CF08BC3CDCBB0AB36145CFF7E79C468B92) |
| `InstructionSender` (Task 2 / FCE) | `0xc594F0BE29aD3b30388e712683661138CC7c3A3C` | [contract](https://coston2-explorer.flare.network/address/0xc594F0BE29aD3b30388e712683661138CC7c3A3C) |
| Task 2 live TEE `CHECK_GREATER_THAN_10` tx | `0xd6f41bbaac989d6ffdeb3ddf9ddbe470d915dbafb223403fd4b83293c2fc9e85` | [tx](https://coston2-explorer.flare.network/tx/0xd6f41bbaac989d6ffdeb3ddf9ddbe470d915dbafb223403fd4b83293c2fc9e85) |

## What's built, in order

1. **[Task 1](#task-1-fdc-payment-attestation-round-trip)** — proves the FDC Payment attestation mechanism Warden's release logic depends on.
2. **[Phase 1](PHASE1.md)** — `WardenEscrow` fund + hold, with a genuinely generic (not vertical-specific) condition struct.
3. **[Task 2](TASK2.md)** — the FCE/TEE dispute-arbitration fallback, `CHECK_GREATER_THAN_10`, now live on Coston2.
4. **[Phase 2](PHASE2.md)** — the full happy path: real weather data → FDC `Web2Json` attestation → generic release hook → real XRP paid out on XRPL, zero manual steps.

---

# Task 1: FDC Payment Attestation Round-Trip

Status: **working, verified end to end on 2026-08-02.**

## What this proves

1. Sent a real payment on XRPL testnet.
2. Flare's FDC verifier validated it and produced an `abiEncodedRequest`.
3. Submitted that request on-chain to `FdcHub` on Coston2, paying the FDC fee.
4. Waited for the FDC voting round to finalize (Flare's attestation-provider consensus).
5. Retrieved the Merkle proof + signed response from Flare's Data Availability Layer.
6. Deployed a minimal contract (`WardenPaymentAttestor`) that calls Flare's on-chain
   `FdcVerification.verifyPayment(proof)` and, only if that returns `true`, records the
   payment. The recorded transaction is on Coston2 — a real, independently-checkable
   on-chain confirmation that the XRPL payment happened.

This is the exact mechanism Warden's escrow uses to release funds on a verified real-world
condition.

## Live artifacts from the run

- XRPL payment: `48BB79412FB51C06391FBB670E13D83DC00EA5E9315CE741BA821C59FE18C15A`
  https://testnet.xrpl.org/transactions/48BB79412FB51C06391FBB670E13D83DC00EA5E9315CE741BA821C59FE18C15A
- FDC attestation request tx (Coston2):
  https://coston2-explorer.flare.network/tx/0x99d7cc82fb8c7e67450392e648013199faacbb591d2977fef45f7877e38eac1b
- Voting round: `1413757` — finalized.
- `WardenPaymentAttestor` contract: https://coston2-explorer.flare.network/address/0xb93d06F70dD0C75ddF12F2361193C972a0baa3e2
- On-chain confirmation tx:
  https://coston2-explorer.flare.network/tx/0x6f222167b851f65f0aa9a15997a8d6f9d77380eae7ae869b7356d465fd79c888
  (calls `confirmPayment`, which calls `FdcVerification.verifyPayment`, which returned `true`)

## How to reproduce

```bash
npm install
node scripts/01-generate-accounts.mjs   # generates fresh XRPL + Coston2 dev wallets, funds XRPL via faucet
# fund the printed Coston2 address at https://faucet.flare.network/ (Request C2FLR), then:
node scripts/run-all.mjs                # sends payment -> attests -> waits -> proves -> confirms on-chain
```

Each step also runs standalone (`node scripts/0N-*.mjs`) and persists progress to
`state.json`, so you can re-run a failed step without redoing earlier ones.

## What it took / gotchas worth knowing before Phase 1

- **XRPL testnet is fully self-serve.** `POST https://faucet.altnet.rippletest.net/accounts`
  (wrapped by `xrpl.js`'s `client.fundWallet()`) needs no captcha/login — good for CI.
- **Coston2 faucet is UI-only**, no documented public API — just an address field + button
  at faucet.flare.network, no captcha encountered. Fine for a spike, but Phase 1 automation
  (CI, demo resets) will need either a funded persistent dev wallet or to ask Flare for
  faucet API access.
- **Flare's docs are split across three places** (dev.flare.network prose, a Foundry guide,
  and a Hardhat/TypeScript guide) and the AI-rendered doc pages sometimes summarize/garble
  contract addresses. The **raw markdown in `github.com/flare-foundation/developer-hub`** and
  the **raw Solidity in `github.com/flare-foundation/flare-solidity-periphery-package-mirror`**
  are the actual source of truth — worth bookmarking those two repos directly rather than
  trusting the rendered site for anything address- or ABI-sensitive.
- **Don't hardcode contract addresses.** `IFlareContractRegistry` at
  `0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019` (same address on every Flare network) resolves
  `FdcHub`, `FdcRequestFeeConfigurations`, `FdcVerification`, `Relay` by name — this is what
  the script uses, and it's what Flare's own examples use too.
- **The `Payment` attestation type is generic across BTC/DOGE/XRP** — same
  `attestationType`/struct, only `sourceId` changes (`testXRP` here). No XRP-specific struct
  needed despite some XRP-specific verification interfaces existing in the periphery package.
- **Timing:** attestation request fee was negligible (~10⁻¹⁵ C2FLR). Round finalization + DA
  Layer proof availability took a few minutes total, well within Flare's documented
  90–180 second voting-round window plus proof-generation lag.
- **The `/api/v1/fdc/proof-by-request-round-raw` DA Layer endpoint** (vs. the non-`-raw`
  one) is the one to use from code — it returns the response pre-ABI-encoded
  (`response_hex`), so you can `AbiCoder.decode` it directly instead of reconstructing a
  nested JSON struct by hand.
- **ethers v6 gotcha:** a decoded `Result` (from `AbiCoder.decode`) is read-only/frozen and
  can't be passed straight back into a contract call as a nested struct argument — call
  `.toObject(true)` on it first to get a plain object ethers can re-encode.

---

## Task 2 (FCE) — see [TASK2.md](TASK2.md)

**Working, verified live on Coston2.** `CHECK_GREATER_THAN_10` runs on a real registered TEE
that reached on-chain PRODUCTION status; a real instruction was sent with its input ECIES-encrypted
client-side (only a 125-byte ciphertext ever touches the chain), and the TEE returned
`{result: true, checkedAt: 1}` — the leak-detector guarantee from the unit suite, now proven
live, not just in tests. Full writeup, live artifacts (tx hashes, teeId, instruction IDs), and
every gotcha hit along the way (including two real bugs in the scaffold's re-registration flow)
in [TASK2.md](TASK2.md).

## Phase 1 (Escrow Core) — see [PHASE1.md](PHASE1.md)

`WardenEscrow` fund + hold, verified on Coston2 via real FAssets Direct Minting. Generic
condition struct confirmed genuinely vertical-agnostic.

## Phase 2 (Happy Path) — see [PHASE2.md](PHASE2.md)

Full live round trip, no mocked steps: a real weather API confirms a condition via FDC's
`Web2Json` attestation type, which triggers `WardenEscrow`'s one generic release hook, which
redeems FXRP for real XRP paid out automatically on XRPL — zero manual intervention after the
pipeline starts. Also settles the PMW question raised in the brief (not developer-available
yet, same pattern as Task 2's FCC) in favor of plain FAssets `redeem()`.
