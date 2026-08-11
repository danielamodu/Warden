# Warden — Task 2: Minimal FCE Ingest → Attestation Loop

Status: **mechanism implemented and verified at the code level; full live-TEE round-trip blocked by infrastructure outside this session's control.** Flagging per the spike's own stop-condition rather than continuing to grind.

## What this proves (and what it doesn't, yet)

Built on Flare's own `fce-extension-scaffold` (the reference "Hello World" TEE extension repo), a new operation — `CHECK_GREATER_THAN_10` — that:

1. Takes one input value.
2. The **caller encrypts it client-side** (ECIES, secp256k1) to the deployed TEE machine's public key, fetched from the extension proxy's `/info` endpoint. Only the ciphertext ever goes into the on-chain transaction's calldata.
3. Inside the enclave, the extension decrypts via the TEE node's **local** `/decrypt` endpoint (never reachable from outside the container) and checks `value > 10`.
4. Returns **only** `{result: bool, checkedAt: int}` — never the input, encrypted or otherwise.

This is genuinely proven at the code level — real ECIES crypto, real wire format matching Flare's normative spec, a real deployed-and-registered contract on live Coston2. What's **not** proven is a live, running enclave actually processing a real instruction end-to-end, because standing up the TEE infrastructure hit two separate walls (below), neither of which is a bug in the extension code.

## Live artifacts from the run

- `InstructionSender` (with the new `sendCheckGreaterThan10` entry point) deployed to Coston2:
  https://coston2-explorer.flare.network/address/0xc594F0BE29aD3b30388e712683661138CC7c3A3C
- Extension registered on Flare's live `TeeExtensionRegistry` (part of the `FlareTeeManager` diamond at `0x1a9C4A0f9D76c0b1D91d22E24E573a9b377618aE`): extension ID `0x0000000000000000000000000000000000000000000000000000000000010248`.
- Full Go unit test suite passing (`go test ./... -v` in `fce-spike/fce-extension-scaffold/go`), including three tests written specifically to verify the privacy property, not just the arithmetic:
  - `TestProcessCheckGreaterThan10_ValueOver10_ReturnsTrue` / `_ValueUnder10_ReturnsFalse` / `_BoundaryValue10_ReturnsFalse` — correctness of the `>10` check itself, using a mock sign-port doing **real** ECIES decryption (a real secp256k1 keypair, not a stub).
  - `TestProcessCheckGreaterThan10_WrongKey_FailsDecryption` — ciphertext encrypted to a *different* key fails to decrypt, proving only the holder of the matching private key (the real TEE, in production) can ever recover the plaintext.
  - Every one of the above asserts on `ActionResult.Data` directly: the response JSON must contain **exactly** `{result, checkedAt}` and must not contain the input value's own decimal representation anywhere in that payload — the actual leak check, not just "did I get the right boolean."

## The two walls

### Wall 1 — Docker Desktop instability on this machine

Docker Desktop hadn't been run since January (per its own logs) and crashed twice on the same bug: its "Docker AI"/Inference Manager subsystem fails to recreate a Unix-socket-style file (`AppData\Local\Docker\run\dockerInference`) on startup —

```
starting services: initializing Inference manager: listening on
unix://C:/Users/USER/AppData/Local/Docker/run/dockerInference: remove
C:/Users/USER/AppData/Local/Docker/run/dockerInference: The file cannot
be accessed by the system. (listener: The filename, directory name, or
volume label syntax is incorrect.)
```

Worked around once by renaming the stale `run` directory so Docker recreates it fresh, which got the engine up long enough to do the real Coston2 deploy/registration above. It recurred on a later restart. This is a known class of Windows-reparse-point/Docker-Desktop-Model-Runner bug, unrelated to anything in Flare's stack — nothing here is specific to FCC/FCE.

### Wall 2 — Indexer DB credentials aren't self-serve

Independent of Docker's stability, `fce-extension-scaffold`'s own README is explicit that a Coston2 deployment's extension proxy needs **Flare-provided indexer database credentials** ("ask the Flare team for credentials") to fetch signing policies — the example config ships only placeholder values (`<indexer-db-host>`, etc.). This affects `start-services.sh --chain coston2` regardless of `SIMULATED_TEE`, since it's the proxy's operational dependency, not the TEE attestation mode. I confirmed this is a real, current requirement (not stale docs) by reading the live `docker-compose.coston2.yaml` and `extension_proxy.coston2.docker.toml.example` in the current repo.

A separate "local dev" fallback (Hardhat devnet with its own bundled indexer-db container, no Flare credentials needed) exists in principle, but depends on a sibling `e2e/` repository that the scaffold's docs reference but that does not appear to be public in the `flare-foundation` GitHub org — so that fallback isn't self-serve either.

Net: **the actual "get data into a real enclave" step needs either Flare-issued indexer DB credentials or Docker staying up long enough to reach that step at all**, and I could get neither reliably in this session.

## What's known and would carry over to whoever picks this up

- Reference repos: `flare-foundation/fce-extension-scaffold` (this one — Hello World scaffold, Go/Python/TS, has a `.claude/skills/create-extension` skill that's genuinely accurate and worth using directly), `flare-foundation/fce-sign` (TEE key-signing example — this is where the ECIES-encrypt-to-TEE-pubkey pattern used here came from; its own README is worth reading, since it candidly notes ciphertext-on-chain is not the same guarantee as true off-chain secret delivery for production use).
- `SIMULATED_TEE=true` against real Coston2 contracts is the realistic path for a spike (no real Confidential Space VM needed) — but it still needs the full Docker Compose stack (redis, ext-proxy, extension-tee) up, which still needs the indexer DB.
- Cloudflare Tunnel (`docker-compose.cloudflared.yaml`) is a better default than ngrok for the public proxy callback — no account needed, driven automatically by `start-services.sh`/`stop-services.sh`.
- Known failure modes documented by Flare, none of which I actually hit (didn't get far enough): `Verification.TeeNotFound`, `Verification.ChallengeExpired`, `InvalidGovernanceHash`, code-hash mismatches between `SIMULATED_TEE` and `MODE`.
- The code changes themselves (Solidity op, Go handler, crypto helper, test-tool wiring, unit tests) are complete and would work as-is the moment either wall clears — nothing about them is provisional.

## How to reproduce what did work

```bash
cd fce-spike/fce-extension-scaffold
./scripts/generate-bindings.sh   # compiles the contract, regenerates Go bindings
cd go && go build ./... && go test ./... -v   # full unit suite, including the privacy-property tests
cd ../tools && go build ./...
```

Deploy + register on real Coston2 (needs a funded Coston2 wallet, does **not** need indexer DB credentials):

```bash
bash ./scripts/use-chain.sh coston2
bash ./scripts/pre-build.sh
```

Both ran for real in this session — see the live artifacts above.
