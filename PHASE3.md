# Warden — Phase 3: Dispute Path Integration

Status: **working, verified end to end on live Coston2 — two conflicting evidence sets, a live TEE verdict, trustless on-chain signature verification, and a real XRPL payout.**

## What this proves

Task 2 proved the FCE/TEE mechanism works live on Coston2: `CHECK_GREATER_THAN_10`
reached on-chain PRODUCTION status and returned a real, signed verdict with the
input never touching the chain. Phase 3 wires that same live TEE into Warden's
dispute-arbitration path, following Phase 2's exact pattern: a vertical-specific
resolver contract (`WardenDisputeResolver`) calls `WardenEscrow.resolveAndRelease()`
— the same single generic entry point `WardenWeatherResolver` uses — so
**`WardenEscrow.sol` needed zero changes** to support disputes.

1. Both parties submit conflicting evidence (claimed timestamps), ECIES-encrypted
   client-side to the live TEE's public key — same encryption pattern Task 2
   established, so neither party's claim is ever plaintext on-chain.
2. The TEE runs a deterministic rules-engine: whichever claim falls inside an
   independently-established window wins; anything ambiguous defaults to *no
   release*, matching `WardenEscrow`'s existing "false means funds stay put"
   semantics.
3. `WardenDisputeResolver.submitVerdict()` reconstructs the TEE's own internal
   signing scheme on-chain and `ecrecover`s the verdict against the TEE's
   registered public key — the contract itself proves the verdict came from
   the real, live, registered TEE, not just whoever happened to submit it.

## Trust model: on-chain TEE signature verification

Phase 2's `WardenWeatherResolver` verifies an FDC proof trustlessly on-chain —
Flare's own protocol gives every Web2Json attestation a Merkle proof any
contract can check itself. TEE action results don't have an equivalent
built-in on-chain verifier anywhere in the `fce-extension-scaffold` — even
Task 2's own reference test tool (`tools/cmd/run-test`) just trusts the HTTP
response from the extension proxy.

Rather than adopt that same "trust the relayer" shortcut, `WardenDisputeResolver`
reconstructs tee-node's actual internal signing scheme, traced from its own
source (`tee-node/internal/router/utils.go`, `go-flare-common/pkg/signing/hash.go`):

```
ActionResult.Hash()      = keccak256(keccak256(data) || id || keccak256(submissionTag) || status)
signing.Payload.Hash()   = keccak256(abi.encode(bytes32("TEE_ACTION_RESULT"), chainId, ActionResult.Hash()))
signed hash               = keccak256("\x19Ethereum Signed Message:\n32" || signing.Payload.Hash())
```

`submitVerdict()` rebuilds this exact chain from the caller-supplied
`(teeId, instructionId, submissionTag, status, data, signature)`, `ecrecover`s
the signer, and compares it against the TEE's on-chain-registered public key
(`IMachineManager.getPublicKey(teeId)`, converted to an address the same way
any secp256k1 key is). A caller can submit any bytes they like — only ones
that recover to the real, live-registered TEE are ever accepted. This also
guards against replaying a signature from some other extension's TEE
(`getExtensionId(teeId)` is checked against Warden's own extension ID) or the
same verdict twice (`consumedInstructionIds`).

## New TEE operation: `DISPUTE` / `RULE_ON_EVIDENCE`

Added to `fce-extension-scaffold` following the exact pattern `CHECK_GREATER_THAN_10`
established (Solidity op + Go handler), with one deliberate deviation: the
response is **ABI-encoded, not JSON** — `abi.encode(uint256 escrowId, bool
outcome, uint64 rulingNumber)` — so `WardenDisputeResolver` can decode it
cheaply on-chain after verifying its signature, unlike every prior JSON-encoded
response in this scaffold (which only ever got parsed off-chain).

The request is one ECIES-encrypted JSON blob — both parties' claimed
timestamps plus the comparison window — so calldata is 100% ciphertext, same
guarantee `CHECK_GREATER_THAN_10` gives: an on-chain observer sees only bytes,
never either party's claim.

## Live artifacts

**Contracts (Coston2):**
- `WardenEscrow`: `0x12FeF54Aa967Cc921D8A42528B7ff23218911e14`
- `WardenDisputeResolver`: `0x662144FE2c59f58b3612Ee5bf252D06Ff1d2d91A` (constructor: escrow address, `FlareTeeManager=0x1a9C4A0f9D76c0b1D91d22E24E573a9b377618aE`, `expectedExtensionId=66120`)
- Resolver wired into escrow: tx `0x542b6128177ff06dcff60bb17222713a09961224bcd48195bde59594b9d7cbec`
- `InstructionSender` (redeployed mid-phase to add `sendRuleOnEvidence`, extension 66120 repointed at it — see gotchas): `0x01269cc5498679ac790Af12cd803a1108a0aA235`

**The disputed escrow:**
- `escrowId`: `0`, funded with 10.0 FXRP (one redemption lot)
- Fund tx: `0x5efdb353e9f2f961e58f30f17165ac20bf60e372263ccc150d991cb4cfb3343f`
- `beneficiaryXrplAddress`: `rQhiVPjkhTQE9FXriKJhX9LZL9Jy9b4xnP`

**The dispute round trip:**
- Live `teeId` at test time: `0x33c2f5f41Bf1199A7Dc68F32D74ED097F07e33C0` (PRODUCTION status)
- Evidence A (claimed timestamp inside the window) vs. evidence B (2 hours outside it) — ECIES-encrypted, 279-byte ciphertext, never plaintext on-chain
- `RULE_ON_EVIDENCE` instruction tx: `0x6590511a717abd03d3933c113155f5a3740e6e9d361e4f1600dd6621a1bc259b`, instructionId `0x29faf1cb88695bcc40a704beb31a2e167371988d7764c5e2e759625c0d4c4fc7` — https://coston2-explorer.flare.network/tx/0x6590511a717abd03d3933c113155f5a3740e6e9d361e4f1600dd6621a1bc259b
- TEE verdict: `escrowId=0, outcome=true, rulingNumber=1` — correctly picked evidence A (the claim actually inside the window)
- `submitVerdict()` on-chain — resolver reconstructs the TEE's signing hash and `ecrecover`s it against the registered public key, live, for the first time: tx `0xe15336e9d5e9b5f75f8fa1bcc0bafa8631ad5262fd7d73df0556b354abc722e1` — https://coston2-explorer.flare.network/tx/0xe15336e9d5e9b5f75f8fa1bcc0bafa8631ad5262fd7d73df0556b354abc722e1 — `VerdictSubmitted{escrowId: 0, outcome: true}`
- Real XRPL payout: tx `D588BAF9C7BDEC8585A4E2E3D89057CF5B32376195667C417A274237577658B0`, 9.95 XRP to `rQhiVPjkhTQE9FXriKJhX9LZL9Jy9b4xnP` — https://testnet.xrpl.org/transactions/D588BAF9C7BDEC8585A4E2E3D89057CF5B32376195667C417A274237577658B0

## Infra update (2026-08-13): TEE migrated off the local machine to AWS

The TEE stack (`extension-tee` + `ext-proxy` + `redis`) no longer runs on a local
Docker Desktop instance behind a rotating `trycloudflare.com` quick tunnel — both
real recurring failure points this session (a dead tunnel that needed manual
restart + re-registration, twice). It now runs on a dedicated AWS EC2 instance
(`t3.small`, resized up from `t3.micro` for headroom) behind a permanent Elastic
IP with automatic HTTPS via Caddy + Let's Encrypt — no Cloudflare account or
custom domain needed, using [sslip.io](https://sslip.io)'s free wildcard DNS
(`<ip>.sslip.io` resolves to that literal IP) as the hostname Let's Encrypt
validates against.

- **New live `teeId`**: `0xCCbc7fef9A0710ED0FB1238acD3D505aF964E09b` — PRODUCTION status
- **Stable endpoint**: `https://100-63-86-147.sslip.io`
- **Old local `teeId`** (`0x33c2f5f41Bf1199A7Dc68F32D74ED097F07e33C0`, used for the dispute round trip documented above) has been **paused on-chain** — tx `0x7aaaf444107c1248b223260bef0fc49d364f1a692f544861ccc19da48ae3ef30` — and is no longer eligible for instruction routing.
- **Parity confirmed**: re-ran the same evidence-submission flow against the AWS-hosted TEE post-migration — real encrypted instruction tx `0xe1e99fa923365a83093cb821e5d1d4749d41e57af4efbaba4c870fc64c114aba`, real signed verdict (`outcome=true, rulingNumber=1`), identical behavior to the original run above. Not resubmitted on-chain since `escrowId=0` was already resolved by the original run — the point was proving the TEE round trip itself, which it did.

Docker no longer needs to run locally at all for the dispute path to work.

## What it took / gotchas

- **Leftover FXRP from Phase 1/2 (4.0) was below one redemption lot (10.0)** —
  `resolveAndRelease()` would have reverted with "amount below one lot" on any
  successful verdict. Needed a fresh Direct Minting round (12 more XRP,
  consolidated into a single script rather than Phase 1's five separate
  steps, since Phase 3 only needed it once). Hit the same relayer-races-us
  pattern every prior phase saw: Flare's own executor bot minted the FXRP
  before our own `executeDirectMinting` call landed.
- **The verifier's indexer lags XRPL finality by a few seconds** — going
  straight from a confirmed payment into `prepareRequest` hit
  `INVALID: TRANSACTION DOES NOT EXIST` on the first attempt (a false
  negative, not a real problem) since Task 1/Phase 1's original scripts run
  as separate manually-invoked steps with natural delay between them, but
  Phase 3's consolidated single-script mint raced straight into it. Fixed
  with a bounded retry-with-delay around that specific error.
- **`dispute-demo`'s `-escrowId` flag rejected `0` as "required".** Warden's escrow IDs are 0-indexed, so the funded escrow used throughout this phase genuinely is `escrowId=0` — the CLI's `if *escrowID == 0 { die }` guard was left over from copying `run-test`'s pattern and treated a legitimate value as "flag not passed." Removed the check; `0` is just as valid as any other escrow ID.
- **`WardenDisputeResolver.submitVerdict()` hit "Stack too deep"** compiling
  with the legacy Solidity codegen — reconstructing the TEE's multi-step
  signing scheme needs enough local variables to exceed the 16-slot stack.
  Fixed with `viaIR: true` in the deploy script's solc settings (a compiler
  setting, not a functional change).
- **The cloudflared quick tunnel died mid-phase** (`control stream encountered a failure while serving`, looping every ~15-30s) — unrelated to the code changes, just a quick tunnel that dropped its connection to Cloudflare's edge. Restarting it mints a new hostname, which cascaded into two more fixes: (1) the already-registered TEE machine's on-chain URL doesn't auto-update (same `updateTeeMachineSettings` fix from Task 2), and (2) rebuilding `extension-tee` to pick up the new `RULE_ON_EVIDENCE` handler minted a **brand-new `teeId`**, since Confidential Space keys are memory-only and every relaunch mints a fresh one (documented in `docs/deployment-steps.md`'s "Platform traps" — the old `teeId` never re-registers itself, it's just dead). Fixed with a fresh full `register-tee -command rRap` run for the new `teeId`; confirmed the old one no longer appears in `getActiveTeeMachines` so it can't be routed to.
- **The already-deployed `InstructionSender` predates `sendRuleOnEvidence`.** Editing `InstructionSender.sol` to add the new op doesn't retroactively add the function to the contract already live on-chain — calling it just hits the implicit revert of an unmatched selector. Deploying a *whole new* `InstructionSender` would normally also mint a *new* extension ID (`setExtensionId()` self-discovers whatever ID the registry already points at it — it doesn't let you pick one), which would have cascaded into redeploying `WardenDisputeResolver` (its `expectedExtensionId` is immutable) and `WardenEscrow` (its resolver is one-time-set), losing the already-funded escrow and needing another FXRP mint. Avoided all of that with `ExtensionManagerFacet.setExtensionContracts(extensionId, stateVerifier, newInstructionSender)` — repoints the *existing* extension ID (`66120`) at the new contract directly, then `setExtensionId()` on the new contract self-discovers that same ID. Everything downstream (TEE registration, resolver, funded escrow) stayed valid.
- **Scope decision: the comparison window is a plain parameter, not a second
  on-chain-verified fact.** Phase 2's condition (temperature) was itself
  independently verified on-chain via a Web2Json proof. Phase 3 could have
  layered the same mechanism on top of the window bounds here, but that would
  mean the resolver verifying *two* independent proofs (an FDC Web2Json proof
  *and* a TEE signature) for one verdict — real complexity for a dimension
  the brief didn't ask for. The window is anchored to the real current time,
  queried live at test-run time (not hardcoded), so the demo still runs on
  a genuine external fact — it just isn't re-verified a second time on-chain
  the way Phase 2's weather threshold was. Worth revisiting if a future phase
  needs the window itself to be adversarially disputable.

## How to reproduce

```bash
# 1. Top up FXRP if needed (only if leftover balance is below one lot)
node scripts/phase3/01-mint-fxrp.mjs

# 2. Deploy WardenEscrow (fresh instance) + WardenDisputeResolver, wire them
node scripts/phase3/02-deploy-contracts.mjs

# 3. Fund a fresh disputed escrow
node scripts/phase3/03-fund-escrow.mjs

# 4. Regenerate Go bindings for the new sendRuleOnEvidence, then run the
#    dispute through the live TEE (writes dispute-verdict.json)
cd fce-spike/fce-extension-scaffold
./scripts/generate-bindings.sh
ESCROW_ID=0 bash ./scripts/run-dispute-demo.sh
cd ../..

# 5. Submit the TEE-signed verdict on-chain — this is the transaction where
#    WardenDisputeResolver itself verifies the signature
node scripts/phase3/05-submit-verdict.mjs

# 6. Watch for the real XRPL payout (only if the verdict was outcome=true)
node scripts/phase3/06-monitor-xrpl-payout.mjs
```
