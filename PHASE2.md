# Warden — Phase 2: Happy Path

Status: **working, verified end to end on Coston2 + XRPL testnet — real auto-release, real automatic XRP payout, zero manual intervention after the pipeline started.**

## What this proves

1. A live weather condition (current temperature at a real location) is queried directly from a free, keyless public API.
2. That fact is turned into a verifiable on-chain attestation via FDC's `Web2Json` type.
3. `WardenWeatherResolver` verifies the attestation and, if the condition is met, calls `WardenEscrow`'s one generic release entry point — `resolveAndRelease(escrowId, outcome)`.
4. `WardenEscrow` redeems its held FXRP via FAssets, which pays out **real XRP on XRPL automatically** — no agent action, no manual step, no human in the loop after the scripts were kicked off.

This is the full gate from the brief: fund → real API confirms condition → attestation → auto-release → payout on XRPL, with real testnet artifacts at every step.

## Architecture: why two contracts, not one

`WardenEscrow` still knows nothing about weather. It has exactly one release hook — `resolveAndRelease(escrowId, outcome)` — callable only by a designated `resolver` address, set once. `WardenWeatherResolver` is where every weather-specific thing lives: the threshold, the Web2Json proof verification, the temperature decode. A trade-finance or different-insurance resolver would look completely different internally but call that exact same escrow entry point — this is what makes "generalizes to other verticals for free" a real, checkable claim rather than a slogan. (This mirrors Flare's own official weather-insurance example almost exactly, which independently validated the design — see gotchas below.)

## Decisions made and why

- **Weather over flight status.** Every flight-status API researched (AviationStack, OpenSky, etc.) needs a signup/API key and has a restrictive free tier. **Open-Meteo** needs no key, no signup, no auth headers — a plain HTTPS GET returning JSON. Confirmed against the actual constraint: FDC's `Web2Json` type doesn't even require testnet URL whitelisting ("on testnets whitelisting is not required, any endpoint can be used by selecting the `PublicWeb2` source" — straight from Flare's own spec), so the low-friction API mattered more than the vertical.
- **`redeem()` over PMW.** The brief named PMW ("Protocol Managed Wallets") for the XRPL payout. Confirmed PMW is real but isn't documented anywhere in Flare's actual developer docs — only in their news/marketing posts, describing it as a Songbird-only canary rollout with a governance vote scheduled for July 2026, no Coston2 availability, no public SDK. Used FAssets' plain `redeem()` instead (the same mechanism Phase 1 proved works for minting's mirror image) — fully documented, achievable today, genuinely automatic.

## Live artifacts from the run

**Weather condition (checked live before submitting, so the happy path would actually resolve true):**
- Location: Dubai (25.2048, 55.2708) — reliably hot, good for a "heat wave" demo.
- Live reading at request time: **33.9°C**. Condition set: release if temperature > 29.9°C.

**Contracts deployed to Coston2:**
- `WardenEscrow` (v2 — fund + hold + generic release):
  https://coston2-explorer.flare.network/address/0xBDDD1E23604cA932c823Ef3397D96697aBB1c53D
- `WardenWeatherResolver`:
  https://coston2-explorer.flare.network/address/0x0a7b57FC9d907a55f72E7920E6645A6d40B972CF
- `setResolver` wiring tx: `0xe6bd4e62c1f6525df1fe801aa6b539de01f7b51e64fc51fd8620be5aced5a527`

**Funding:**
- Approve tx: `0x06db7fc9e62bb1e5017bd477af69e42fdeded5ae2f71568a48566423f4bf7cc7`
- Fund tx (10.0 FXRP, exactly 1 redemption lot):
  https://coston2-explorer.flare.network/tx/0xb0209e2ce25f8cab417f0e0078e854ab7cc53a5dd4f05a7b093d8944850a6f1b
- `escrowId=0`, `conditionId=0x19cb272e97e060e54dd03f84a8a608498fcfac70e48ea6f125d7b9c26b898c8d`
  (a real hash of `(resolverAddress, threshold, triggerIfAbove)` this time — not a demo placeholder)
- `beneficiaryXrplAddress = rQhiVPjkhTQE9FXriKJhX9LZL9Jy9b4xnP`

**Web2Json attestation (weather fact → on-chain proof):**
- Attestation request tx (Coston2):
  https://coston2-explorer.flare.network/tx/0xc52b4592853a42f0cb18c0bc48ed285f13d70c567c7d98bf3703d8e072059858
- Voting round `1421888` — finalized.
- Attested value in the returned proof: `0xd3e` = **3390** (33.90°C x100) — matches the live reading exactly.

**Automatic release (the actual gate):**
- `checkAndRelease` tx: https://coston2-explorer.flare.network/tx/0xb15a31cd33a27bae8e6c5f91758722610651a388666c75313031d956b0ae16ce
- `ConditionChecked` event: `attestedTemperatureCx100=3390, outcome=true`
- `EscrowResolved` event: `outcome=true`
- `EscrowReleased` event: `redeemedAmountUBA=10000000` (10.0 FXRP submitted for redemption)

**Real automatic XRP payout on XRPL (no manual step):**
- XRPL tx: https://testnet.xrpl.org/transactions/0B903CE2F06F37947DC052333D1754CF08BC3CDCBB0AB36145CFF7E79C468B92
- From: `rDYeqGVc8M3Se9wowvRDbURGYGZ5i5VF6r` (the FAssets agent's underlying XRPL address)
- To: `rQhiVPjkhTQE9FXriKJhX9LZL9Jy9b4xnP` (the escrow's `beneficiaryXrplAddress`)
- Delivered: **9.95 XRP** (10 XRP minus the redemption fee — matches `redeem()`'s own NatSpec: "redeemer will get paid... value - fee")
- Memo payload `4642505266410002...` — same `FBPR` FAssets memo family observed in Phase 1's direct-minting memo, this time the redemption variant.
- Beneficiary balance: 105.0 → 114.95 XRP, confirmed independently via `getXrpBalance`, not just by trusting the tx.
- This landed **fully automatically** — Flare's redemption executor bot fulfilled the agent's payment obligation without any agent or human action on my part, the same pattern Phase 1 observed for direct minting.

## How to reproduce

```bash
npm install
node scripts/phase2/01-check-weather.mjs       # live Open-Meteo read, picks a threshold that's currently true
node scripts/phase2/02-deploy-contracts.mjs    # deploys WardenEscrow v2 + WardenWeatherResolver, wires them
node scripts/phase2/03-fund-escrow.mjs         # funds the escrow, sets the weather condition
node scripts/phase2/04-prepare-attestation.mjs # Web2Json prepareRequest against the verifier
node scripts/phase2/05-submit-attestation.mjs  # submits to FdcHub
node scripts/phase2/06-retrieve-proof.mjs      # waits for finalization, polls DA layer
node scripts/phase2/07-trigger-release.mjs     # verifies proof, calls checkAndRelease -> auto-redeems
node scripts/phase2/08-monitor-xrpl-payout.mjs # watches XRPL for the real incoming payment
```

Each step persists to its own `state.phase2.json`, separate from Task 1's and Phase 1's state files.

## What it took / gotchas worth knowing before Phase 3

- **The FDC's allowed `jq` subset is more restricted than Flare's own official example uses.** Their `06-weather-insurance.mdx` guide uses `| floor` in its `postProcessJq`; both `floor` and `round` were rejected outright by the live testnet verifier as `INVALID JQ FILTER`. Neither is in the documented allow-list either — the doc and the guide seem to disagree with each other, and the doc turned out to be right. Worked around it with pure string manipulation (`tostring | split(".") | .[0] + .[1] + "0" | tonumber`), using only builtins that are unambiguously on the allow-list (`tostring`, `split`, `tonumber`, string `+`). This is also closer to what Flare's own Foundry example does for lat/lon (parses the API's string response in Solidity via `stringToScaledInt` rather than doing math inside `jq` at all) — doing arithmetic inside the sandboxed `jq` filter is apparently the less battle-tested path.
- **Web2Json has its own dedicated verifier path, not nested under a per-chain source like Task 1's XRP attestations.** The correct path is `/verifier/web2/Web2Json/prepareRequest` (lowercase `web2`) — not `/verifier/PublicWeb2/...` or `/verifier/web/...`, both of which 404. This isn't spelled out in the rendered docs; found it only by reading the raw `flare-foundation/flare-foundry-starter` repo's actual working script. `sourceId` in the request body is still the literal string `PublicWeb2`, hex-encoded the same way as every other attestation type.
- **PMW isn't real for developers yet, same pattern as Task 2's FCC.** Checked Flare's full doc sitemap before committing — zero references outside marketing posts. Worth remembering as a standing signal: when a Flare feature only shows up in `flare.network/news` and X posts, not `dev.flare.network`, treat it as roadmap, not buildable.
- **Redemption is genuinely asynchronous, and that's fine.** `redeem()` only submits a `RedemptionRequested` obligation on Coston2 — the actual XRP movement happens when the agent (or, as observed here, Flare's own redemption executor bot) fulfills it on XRPL, on its own schedule. In this run it happened within roughly a minute of the release tx, unprompted. Design future phases assuming release and payout-observed are two separate confirmable events, not one atomic step — which is exactly why `08-monitor-xrpl-payout.mjs` is a separate script from `07-trigger-release.mjs`.
- **The FAssets memo scheme extends cleanly.** The redemption payout's memo (`4642505266410002...`) shares the same `FBPR` prefix family Phase 1 saw on direct-minting memos (`...0018...`), just a different embedded op code. Worth documenting this family properly if Warden ever needs to parse FAssets-related XRPL memos generically.
- **Same raw-GitHub-over-rendered-docs discipline as every prior phase, and it mattered again.** The exact `IWeb2Json`/`IWeb2JsonVerification` struct shapes and the `redeem()` signature (specifically that it takes `_redeemerUnderlyingAddressString`, not an EVM address) came from `flare-solidity-periphery-package-mirror/coston2/{IWeb2Json,IWeb2JsonVerification,IAssetManager}.sol` directly.
- **ethers v6 `Result` is frozen — the same gotcha, a third time now.** `.toObject(true)` before re-encoding a decoded struct into a contract call, still necessary, still easy to forget.
