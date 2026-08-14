# Warden

**Escrow for XRP that settles itself — and arbitrates disputes without either side
publishing their evidence.**

🔗 **Live app: [trywarden.vercel.app](https://trywarden.vercel.app/)** · Coston2 testnet + XRPL testnet

Submitted to **both** Flare Summer Signal bounties:
**Bounty 1 — Interoperable Asset Products** (FAssets/FXRP escrow, real XRPL settlement) and
**Bounty 2 — Confidential Compute Apps** (FCE/TEE dispute arbitration).

## The problem

On-chain escrow can already release funds when a public fact is verifiable. What it cannot do
is settle an argument. Every on-chain arbitration system in production — Kleros, Aragon Court,
any multisig-arbiter escrow — requires you to **publish your evidence** so jurors can read it.

That is exactly why serious commercial disputes never go on-chain. The evidence *is* the
confidential part: rates, counterparty identity, delivery terms, contract addenda. Publishing
it to win an argument costs more than the argument is worth.

## What Warden does differently

Warden is an escrow where **the evidence is never disclosed to anyone** — not to the
counterparty, not to a juror pool, not on-chain — and the contract *still* proves the verdict
is authentic.

Both parties encrypt their evidence client-side (ECIES, secp256k1) to a Flare Confidential
Compute enclave's public key. Only ciphertext ever enters calldata. The enclave runs a
deterministic rules engine and signs its ruling. Then
[`WardenDisputeResolver`](contracts/WardenDisputeResolver.sol) reconstructs the enclave's own
internal signing scheme on-chain and `ecrecover`s the verdict against the TEE's
**on-chain-registered public key** — so the contract itself proves the ruling came from the
real, attested enclave, not from whoever relayed it.

Anyone may submit a verdict. Only signatures that recover to the registered TEE are ever acted
on. That check is the entire access control, and [it is unit-tested from both
sides](test/WardenDisputeResolver.t.sol).

> **Why this is not the usual shortcut:** TEE action results have no built-in on-chain verifier
> anywhere in Flare's `fce-extension-scaffold` — even its own reference test tool just trusts
> the HTTP response from the extension proxy. Warden traces the signing scheme through
> `tee-node`'s source and rebuilds it in Solidity instead. Full derivation in [PHASE3.md](PHASE3.md).

## Who it is for

Cross-border commercial counterparties who want XRP-denominated escrow with a dispute path they
cannot take to a public arbitrator. Freelance and contract work first — smallest contracts,
shortest sales cycle, and the parties already hold XRP.

## Status: what is actually live

| | State |
|---|---|
| Escrow fund + hold, FXRP via FAssets Direct Minting | ✅ live on Coston2 |
| Automatic release on a verified real-world fact (weather, via FDC `Web2Json`) | ✅ live, real XRPL payout |
| Confidential dispute arbitration in a TEE, verified on-chain | ✅ live, real XRPL payout |
| Web app | ✅ [trywarden.vercel.app](https://trywarden.vercel.app/) |
| Contract test suite | ✅ 39 tests, `forge test` |
| Other resolver types (logistics, trade finance, IP licensing) | ⛔ not built — roadmap |
| Partial / split verdicts | ⛔ not built — roadmap |
| Mainnet or Songbird | ⛔ Coston2 testnet only |

The dispute rules engine today is one deterministic comparison (which of two claimed timestamps
falls inside an independently-established window). The **mechanism** — encrypted evidence,
attested enclave, on-chain signature verification — is what is proven; the rules engine is
deliberately the simplest thing that exercises it end to end.

## Tests

```bash
forge test
```

39 tests across [`WardenEscrow`](test/WardenEscrow.t.sol) (custody, resolver access control,
one-shot resolution, lot-size rounding, value-conservation fuzz) and
[`WardenDisputeResolver`](test/WardenDisputeResolver.t.sol) (forged signatures, tampered
verdicts, retargeted escrow ids, replay, foreign-extension TEEs, and a fuzz run proving no key
other than the registered enclave's can move funds).

Requires `git submodule update --init --recursive` for `forge-std`.

## Roadmap

1. **Now — live on Coston2.** XRP bridging, FDC-verified release, confidential dispute rulings.
2. **Partial split verdicts.** Graduated payouts for disputes that are not all-or-nothing.
3. **More resolver types.** Logistics, freight and digital-commerce milestones on the same
   generic `resolveAndRelease` hook — no escrow contract changes needed.
4. **Institutional workflows.** Trade-finance approvals and notarised documents.
5. **Multi-chain settlement.** Additional FAssets-supported underlying chains.

## Architecture

`WardenEscrow` custodies FXRP and knows nothing about *why* funds release. It exposes exactly
one generic hook, `resolveAndRelease(escrowId, outcome)`, callable only by a designated
resolver contract. All vertical-specific logic lives in swappable resolvers:

- [`WardenWeatherResolver`](contracts/WardenWeatherResolver.sol) verifies an FDC `Web2Json`
  Merkle proof on-chain, then calls the hook.
- [`WardenDisputeResolver`](contracts/WardenDisputeResolver.sol) verifies a TEE signature
  on-chain, then calls the same hook.

Adding the entire dispute path in Phase 3 required **zero changes to `WardenEscrow.sol`** —
the clearest evidence the generic condition design holds.

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

Every line of this was written during the hackathon — the repo starts at an empty scaffold
(commit `238685a`) and each stage below has its own writeup with live tx hashes and the
gotchas hit along the way.

1. **[Task 1](#task-1-fdc-payment-attestation-round-trip)** — proves the FDC Payment attestation mechanism Warden's release logic depends on.
2. **[Phase 1](PHASE1.md)** — `WardenEscrow` fund + hold, with a genuinely generic (not vertical-specific) condition struct.
3. **[Task 2](TASK2.md)** — the FCE/TEE dispute-arbitration fallback, `CHECK_GREATER_THAN_10`, live on Coston2.
4. **[Phase 2](PHASE2.md)** — the full happy path: real weather data → FDC `Web2Json` attestation → generic release hook → real XRP paid out on XRPL, zero manual steps.
5. **[Phase 3](PHASE3.md)** — the dispute path: two parties' encrypted evidence → live TEE ruling → **on-chain `ecrecover` against the TEE's registered key** → real XRP paid out. `WardenEscrow.sol` needed zero changes.
6. **[Web app](app/)** — React + Vite frontend wired to live Coston2 and XRPL, deployed at [trywarden.vercel.app](https://trywarden.vercel.app/).

## Running it locally

```bash
# Contracts
forge test                      # 39 tests, no network needed

# Web app
cd app && npm install && npm run dev
```

The app reads live Coston2 and XRPL state through public endpoints — no keys needed to browse.
Creating an escrow needs a Coston2 wallet with C2FLR and FXRP. Reproducing the full pipeline
from scratch (minting, attestation, TEE ruling, payout) is documented step by step in each
phase doc below.

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
