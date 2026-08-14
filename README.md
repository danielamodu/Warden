# Warden

**Escrow for XRP that settles itself — and arbitrates disputes without either side publishing
their evidence.**

**[▶ Live app — trywarden.vercel.app](https://trywarden.vercel.app/)** · Coston2 testnet + XRPL testnet

Submitted to **both** Flare Summer Signal bounties — **Bounty 1 (Interoperable Asset Products)**
for the FAssets/FXRP escrow with real XRPL settlement, and **Bounty 2 (Confidential Compute
Apps)** for the TEE dispute arbitration.

---

## The problem

On-chain escrow can already release funds when a public fact is verifiable. What it cannot do
is settle an argument.

Every on-chain arbitration system in production — Kleros, Aragon Court, any multisig-arbiter
escrow — requires you to **publish your evidence** so jurors can read it. That is precisely why
serious commercial disputes never go on-chain. The evidence *is* the confidential part: rates,
counterparty identity, delivery terms, contract addenda. Publishing it to win an argument costs
more than the argument is worth.

So escrow on-chain today is either trustless *or* private. Not both.

## What Warden does about it

Warden is an escrow where **the evidence is never disclosed to anyone** — not to the
counterparty, not to a juror pool, not on-chain — and the contract *still* proves the verdict is
authentic.

1. **Lock.** The buyer funds an escrow in FXRP (XRP bridged onto Flare via FAssets) against an
   opaque condition reference. The escrow contract never learns what the condition *means*.
2. **Settle automatically.** When the condition is a publicly verifiable fact, Flare's Data
   Connector attests it and a resolver contract verifies the Merkle proof on-chain. Funds redeem
   through FAssets and land as **real XRP on XRPL** with no manual step.
3. **Dispute privately.** When the parties disagree, each encrypts their evidence client-side
   (ECIES, secp256k1) to a Flare Confidential Compute enclave's public key. Only ciphertext ever
   enters calldata. The enclave rules and signs.
4. **Prove the ruling.** [`WardenDisputeResolver`](contracts/WardenDisputeResolver.sol)
   reconstructs the enclave's own internal signing scheme on-chain and `ecrecover`s the verdict
   against the TEE's **on-chain-registered public key**.

Anyone may relay a verdict. Only signatures that recover to the registered enclave are ever acted
on — that check is the entire access control, and it is
[tested from both sides](test/WardenDisputeResolver.t.sol).

> **This is not the usual shortcut.** TEE action results have no built-in on-chain verifier
> anywhere in Flare's `fce-extension-scaffold` — even its own reference test tool simply trusts
> the HTTP response from the extension proxy. Warden traces the signing scheme through
> `tee-node`'s source and rebuilds it in Solidity instead, so the chain itself is the arbiter of
> authenticity. Derivation in [PHASE3.md](PHASE3.md).

## Who it is for

Cross-border commercial counterparties who want XRP-denominated escrow with a dispute path they
cannot take to a public arbitrator. Freelance and contract work first — smallest contract sizes,
shortest sales cycle, and the parties already hold XRP.

## Architecture

`WardenEscrow` custodies FXRP and knows nothing about *why* funds release. It exposes exactly one
generic hook — `resolveAndRelease(escrowId, outcome)` — callable only by a designated resolver.
All vertical-specific logic lives in swappable resolver contracts:

```
                      ┌────────────────────────┐
   real-world fact ──▶│ WardenWeatherResolver  │──┐   verifies an FDC
                      │  (FDC Merkle proof)    │  │   Web2Json proof on-chain
                      └────────────────────────┘  │
                                                  ├──▶ WardenEscrow
                      ┌────────────────────────┐  │    .resolveAndRelease()
  encrypted evidence ▶│ WardenDisputeResolver  │──┘         │
                      │  (TEE sig + ecrecover) │            ▼
                      └────────────────────────┘   FAssets redeem → real XRP on XRPL
```

Adding the entire dispute path in Phase 3 required **zero changes to `WardenEscrow.sol`** — the
clearest evidence the generic condition design actually holds.

## What is live today

| | Status |
|---|---|
| Escrow fund + hold, FXRP via FAssets Direct Minting | ✅ live on Coston2 |
| Automatic release on an FDC-verified real-world fact | ✅ live, real XRPL payout |
| Confidential dispute arbitration in a TEE, verified on-chain | ✅ live, real XRPL payout |
| Web app | ✅ [trywarden.vercel.app](https://trywarden.vercel.app/) |
| Contract test suite | ✅ 39 tests, `forge test` |
| Other resolver types (logistics, trade finance, IP licensing) | ⛔ not built — roadmap |
| Partial / split verdicts | ⛔ not built — roadmap |
| Mainnet or Songbird | ⛔ Coston2 testnet only |

The dispute rules engine today is one deterministic comparison — which of two claimed timestamps
falls inside an independently-established window. The **mechanism** is what is proven: encrypted
evidence, attested enclave, on-chain signature verification. The rules engine is deliberately the
simplest thing that exercises it end to end.

## Try it yourself

**No wallet, no funds, nothing installed** — everything below is live and read-only:

| | |
|---|---|
| [The settled escrow](https://trywarden.vercel.app/) | Live Dubai temperature against the threshold read from `WardenWeatherResolver` on-chain, and the XRPL payout it triggered |
| [Transparency portal](https://trywarden.vercel.app/proof) | The FDC voting round, the Web2Json verifier, the live enclave, and every contract address |
| [Vaults](https://trywarden.vercel.app/dashboard) | Escrow state read straight from Coston2 |
| `forge test` | 39 tests, offline, no testnet funds — including the forged-signature and replay cases |

**With a wallet holding FXRP**, the entire confidential dispute path is self-serve in the
browser — fund a real escrow, submit ECIES-encrypted evidence, get a signed ruling from the live
enclave, and watch `submitVerdict` verify it on-chain. `fund()` is permissionless; nothing about
that flow is gated to us.

**Getting testnet FXRP** is the one step that needs a terminal, because FAssets minting is an
XRPL round trip:

```bash
npm install
node scripts/01-generate-accounts.mjs        # fresh XRPL + Coston2 dev wallets, XRPL funded via faucet
# fund the printed Coston2 address at https://faucet.flare.network/ (Request C2FLR), then:
node scripts/phase3/01-mint-fxrp.mjs         # XRP -> FDC attestation -> executeDirectMinting -> FXRP
node scripts/phase3/check-balance.mjs        # want "lots available: 1" or more
```

One redemption lot is 10 FXRP — below that, release reverts with `amount below one lot`.

The **weather path** (`setCondition` + an FDC `Web2Json` attestation round) is driven from
[`scripts/phase2/`](scripts/phase2/) rather than the UI; the transparency portal shows the proof
artefacts from the live run.

## Contracts on Coston2

Every Warden contract below is **source-verified on the Coston2 explorer** — read the code, call
the read methods, and check the constructor arguments yourself.

| Contract | Address | |
|---|---|---|
| `WardenEscrow` | [`0x12FeF54Aa967Cc921D8A42528B7ff23218911e14`](https://coston2-explorer.flare.network/address/0x12FeF54Aa967Cc921D8A42528B7ff23218911e14?tab=contract) | ✅ verified |
| `WardenDisputeResolver` | [`0x662144FE2c59f58b3612Ee5bf252D06Ff1d2d91A`](https://coston2-explorer.flare.network/address/0x662144FE2c59f58b3612Ee5bf252D06Ff1d2d91A?tab=contract) | ✅ verified |
| `WardenWeatherResolver` | [`0x0a7b57FC9d907a55f72E7920E6645A6d40B972CF`](https://coston2-explorer.flare.network/address/0x0a7b57FC9d907a55f72E7920E6645A6d40B972CF?tab=contract) | ✅ verified |
| `WardenEscrow` (Phase 2 instance) | [`0xBDDD1E23604cA932c823Ef3397D96697aBB1c53D`](https://coston2-explorer.flare.network/address/0xBDDD1E23604cA932c823Ef3397D96697aBB1c53D?tab=contract) | ✅ verified |
| `InstructionSender` (TEE extension `66120`) | [`0x01269cc5498679ac790Af12cd803a1108a0aA235`](https://coston2-explorer.flare.network/address/0x01269cc5498679ac790Af12cd803a1108a0aA235) | from Flare's FCE scaffold |

Reproduce the verification yourself — the exact solc settings each phase deployed with are
recorded as profiles in [`foundry.toml`](foundry.toml):

```bash
FOUNDRY_PROFILE=verify-phase3 forge verify-contract <address> <contract> \
  --verifier blockscout --verifier-url https://coston2-explorer.flare.network/api
```

### Proof it ran, end to end

| | Transaction |
|---|---|
| Weather condition → automatic release | [Coston2](https://coston2-explorer.flare.network/tx/0xb15a31cd33a27bae8e6c5f91758722610651a388666c75313031d956b0ae16ce) |
| → real XRP paid out on XRPL | [XRPL](https://testnet.xrpl.org/transactions/0B903CE2F06F37947DC052333D1754CF08BC3CDCBB0AB36145CFF7E79C468B92) |
| Encrypted evidence submitted to the TEE | [Coston2](https://coston2-explorer.flare.network/tx/0x6590511a717abd03d3933c113155f5a3740e6e9d361e4f1600dd6621a1bc259b) |
| TEE verdict verified on-chain by `ecrecover` | [Coston2](https://coston2-explorer.flare.network/tx/0xe15336e9d5e9b5f75f8fa1bcc0bafa8631ad5262fd7d73df0556b354abc722e1) |
| → real XRP paid out on XRPL | [XRPL](https://testnet.xrpl.org/transactions/D588BAF9C7BDEC8585A4E2E3D89057CF5B32376195667C417A274237577658B0) |

## Tests

```bash
forge test
```

39 tests, no network or testnet funds required — mocks stand in for FXRP, the FAssets
AssetManager and FlareTeeManager.

- **[`WardenEscrow.t.sol`](test/WardenEscrow.t.sol)** (22) — custody on fund, resolver-only
  release, one-shot resolution (including after a false verdict, so a second ruling cannot
  release what the first declined), lot-size rounding, the sub-lot revert Phase 3 hit on-chain, a
  `transferFrom` that returns false rather than reverting, and a value-conservation fuzz run.
- **[`WardenDisputeResolver.t.sol`](test/WardenDisputeResolver.t.sol)** (17) — the trust claim
  from both directions. A genuine verdict releases and may be relayed by anyone; forged
  signatures, verdicts whose outcome was flipped after signing, verdicts retargeted at another
  escrow id, tampered instruction ids and submission tags, replays, and correctly signed verdicts
  from a TEE registered under a different extension are all rejected. A fuzz run asserts no
  private key other than the registered enclave's can move funds.

First run needs `git submodule update --init --recursive` for `forge-std`.

## Roadmap

1. **Now — live on Coston2.** XRP bridging, FDC-verified release, confidential dispute rulings.
2. **Partial split verdicts.** Graduated payouts for disputes that are not all-or-nothing.
3. **More resolver types.** Logistics, freight and digital-commerce milestones on the same
   generic hook — no escrow contract changes needed.
4. **Institutional workflows.** Trade-finance approvals and notarised documents.
5. **Multi-chain settlement.** Additional FAssets-supported underlying chains.

## Run it locally

```bash
forge test                              # contracts — offline
cd app && npm install && npm run dev    # web app
```

The app reads live Coston2 and XRPL state through public endpoints, so browsing needs no keys.
Creating an escrow needs a Coston2 wallet with C2FLR and FXRP.

## Engineering log

Warden was built from an empty repo during the hackathon. Each stage has its own writeup with
live transaction hashes and the problems hit along the way — including two real bugs found in
Flare's own FCE scaffold.

| | |
|---|---|
| [TASK1.md](TASK1.md) | FDC `Payment` attestation round-trip — the mechanism release is built on |
| [PHASE1.md](PHASE1.md) | `WardenEscrow` fund + hold, FXRP via real FAssets Direct Minting |
| [TASK2.md](TASK2.md) | First live TEE extension on Coston2, reaching PRODUCTION status |
| [PHASE2.md](PHASE2.md) | The happy path: real weather → FDC → automatic XRPL payout |
| [PHASE3.md](PHASE3.md) | The dispute path, and the on-chain TEE signature verification |

## License

MIT — see [LICENSE](LICENSE).
