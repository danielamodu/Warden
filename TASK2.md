# Warden — Task 2: Minimal FCE Ingest → Attestation Loop

Status: **working, verified end to end on live Coston2 — real TEE, real PRODUCTION status, real attestation, input never touched the chain.**

## Final result (2026-08-11)

The full chain the original spike asked for, live:

1. `CHECK_GREATER_THAN_10` availability check reached **PRODUCTION** status on-chain — `getTeeMachineStatus(teeId)` returns `2`.
2. Sent a real instruction through the live TEE with the input (`42`) ECIES-encrypted client-side. Only a 125-byte ciphertext appears in the transaction's calldata.
3. Response: `{Result: true, CheckedAt: 1}` — exactly the two fields the extension is coded to return, nothing else.
4. Leak-detector and wrong-key-fails-decryption tests (from the original unit suite) still pass — the live run adds a real, on-chain-verifiable version of the same guarantee.

**Live artifacts:**
- `teeId`: `0x43D847e15C46A93587a3f90E8C32c035Bec4f9cE`
- `extensionId`: `66120` (`0x...010248`), `InstructionSender`: `0xc594F0BE29aD3b30388e712683661138CC7c3A3C`
- Availability-check transaction and the `updateTeeMachineSettings` fix (see gotchas): on Coston2, deployer `0x43819337A798C9CC0c6E2165980c7F77Ac395ff9`
- `CHECK_GREATER_THAN_10` instruction: tx `0xd6f41bbaac989d6ffdeb3ddf9ddbe470d915dbafb223403fd4b83293c2fc9e85`, instructionId `0x707f27c6d1268b95215e3ce4755b9df762c3e5376d1062666f8539fbb7e550b4` — https://coston2-explorer.flare.network/tx/0xd6f41bbaac989d6ffdeb3ddf9ddbe470d915dbafb223403fd4b83293c2fc9e85 — calldata contains only the ciphertext, never `42`.
- Extension proxy tunnel (ephemeral quick tunnel, will rotate on restart — not meant to be durable): `https://knitting-idaho-harmony-follows.trycloudflare.com`

> **Infra update (2026-08-13):** the identifiers above are historical — accurate for this specific test run, but the teeId, InstructionSender, and tunnel have all since moved. The TEE now runs on a dedicated AWS instance behind a stable HTTPS endpoint instead of a local Docker stack + rotating quick tunnel. Current live values are in [PHASE3.md](PHASE3.md)'s infra-update note; this file is left as a historical record of Task 2's original completion.

## What it took to get here (see full narrative below for the earlier walls)

Beyond the Docker Desktop saga and the indexer DB credentials (both resolved — see "Docker Desktop root-caused and fixed" and the indexer DB section below), two more genuine bugs surfaced only once the stack was actually healthy enough to reach them:

- **The on-chain-registered proxy URL doesn't update on re-registration.** `register()` (called only from `PreRegistration`) bakes `EXT_PROXY_URL` into the TEE machine's on-chain record permanently. Re-running `post-build.sh` against an already-registered `teeId` skips straight to requesting a fresh attestation challenge — it never re-registers, so a rotated tunnel URL never gets updated on-chain, and every availability check 404s against the stale address forever. `docs/cloudflared.md`'s guidance ("Tunnel rotated? Update EXT_PROXY_URL, re-run post-build.sh") is incomplete for a machine that's already past first registration. The actual fix: call `updateTeeMachineSettings(teeId, teeProxyId, newUrl)` directly on the `FlareTeeManager` diamond (selector `0x06ed5da4`, found in the `go-flare-common` Go bindings — `IMachineManagerTeeMachineRegistry`'s minimal interface in this repo doesn't expose it). Only an option if the caller is the machine's registered owner.
- **Restarting `extension-tee` alone desyncs it from `ext-proxy`.** They pair up on startup; restarting only one side leaves the other holding a stale session, and every proxy→node call fails with `'forbidden': invalid teeID` — including the proxy's own periodic `/info` refresh, so `/info` kept returning a cached, stale response that looked identical to before the restart (this is what made it briefly look like `SIMULATED_TEE` used a deterministic keypair — it doesn't; the proxy just wasn't asking the new process). Fix: `docker compose up -d --force-recreate ext-proxy extension-tee` — both together, every time either one needs a fresh identity.

## Original diagnosis and narrative (2026-08-10 → 2026-08-11)

Status at the time of the original pass below: **mechanism implemented and verified at the code level; full live-TEE round-trip blocked by infrastructure outside this session's control.** Flagging per the spike's own stop-condition rather than continuing to grind. (Superseded by the live result above — kept for the full record of what was tried.)

## Update (2026-08-11): redeploy diagnosed, toolchain rebuilt, Docker Desktop is the wall

Flare's team posted that Coston2's `FlareTeeManager` diamond was redeployed (old address dead since 2026-07-22, live address `0x1a9C4A0f9D76c0b1D91d22E24E573a9b377618aE`). Revisited this session to check whether that broke our registration and to try again now that the toolchain issue could be re-attempted.

**Diagnosis — our registration was never affected.** Queried the live manager directly (`cast call` / ethers, both agree):
- `nextPublicExtensionId()` → `66125`
- `getTeeExtensionInstructionsSender(66120)` → `0xc594F0BE29aD3b30388e712683661138CC7c3A3C`

That's our `InstructionSender`, still correctly registered — extension ID `66120` (`0x...010248`) was registered *after* the redeploy already happened, against the current live manager. `config/coston2/deployed-addresses.json` in the scaffold also already pointed at the live address. Nothing to fix here.

**Toolchain rebuild.** Go and Foundry (`cast`/`forge`) had disappeared from this machine entirely since the first Task 2 pass (not just off PATH — absent from disk). Reinstalled both natively on Windows (Go 1.26.5 to `%USERPROFILE%\sdk\go`, Foundry via `foundryup` to `%USERPROFILE%\.foundry`), both verified working.

**Docker Desktop — the actual, now-well-diagnosed wall.** With Go/Foundry back, got as far as building both Docker images for real:
- `tee-proxy` built successfully from Flare's pinned source (`v0.0.18`).
- `extension-tee` got through `go mod download`, `go mod verify`, and most of its build before Docker itself broke underneath it.

Along the way, hit **five distinct Docker Desktop failure modes** in one session, all traceable to the same underlying instability rather than anything in our config:

1. **Stale `dockerInference` reparse-point socket** (the original bug from the first pass) — `%LOCALAPPDATA%\Docker\run\dockerInference` becomes unremovable on relaunch: `remove ...\dockerInference: The file cannot be accessed by the system.` Recurred **three separate times** across this session, including after explicitly disabling the feature.
2. **`EnableDockerAI: false` in `settings-store.json` does not prevent the crash.** Set it, confirmed it stuck (didn't get silently reverted), relaunched — the Inference Manager still tried to bind the same socket and crashed the same way. The toggle doesn't gate the subsystem's startup socket bind, only its usability.
3. **Same bug on a second subsystem**: `%LOCALAPPDATA%\docker-secrets-engine\engine.sock` hit the identical "file cannot be accessed by the system" error — confirming this is a general Windows-reparse-point handling bug in Docker Desktop 4.84.0, not specific to any one feature.
4. **Read-only VM filesystem**: `write /var/lib/docker/buildkit/containerd-overlayfs/metadata_v2.db: read-only file system`, mid-build. Plausibly collateral damage from the forceful process kills used to clear the stale sockets above — killing Docker Desktop mid-operation can leave its WSL2 VM disk in a dirty state that remounts read-only.
5. **vpnkit-bridge / VHD-attachment crash loop**: after a restart, `com.docker.backend` looped every 1–3 seconds through `engine linux/wsl: starting → stopping → stopped → starting` for about 40 seconds, then separately hit `WSL_E_USER_VHD_ALREADY_ATTACHED` on `docker_data.vhdx`. `wsl --shutdown` cleared the immediate loop, but the next relaunch crashed again on failure mode #1.

None of these are configuration issues on our side — they're Docker Desktop's own startup-sequence races on this specific Windows machine, confirmed by direct log inspection (`com.docker.backend.exe.log`, `init.log`) each time, not guessed at. A stale-file rename clears any individual instance temporarily; none of the fixes tried (rename, disable-AI-toggle, `wsl --shutdown`, repeated clean restarts) made it durable across relaunches.

**Net:** if a machine with a stable Docker Desktop install picks this up, the path is very short from here — `scripts/pre-build.sh` doesn't need to be re-run (registration is live and correct), the images are already built, and `scripts/start-services.sh --chain coston2` should proceed straight to the indexer DB step (still gated separately — see Wall 2 below, VPN access to `35.241.249.150:3306` plus a database name were still not in hand as of this pass).

### Docker Desktop root-caused and fixed

The fifth failure mode (`WSL_E_USER_VHD_ALREADY_ATTACHED` / `vpnkit-bridge` crash loop) turned out to be the one worth chasing: it pointed at real corruption in the `docker-desktop` WSL2 distro itself, not just a transient stale-file race. Fix that actually stuck, unlike every file-rename attempt before it:

```powershell
wsl --shutdown
wsl --unregister docker-desktop
# "docker-desktop-data" doesn't exist on this Docker Desktop version (4.84.0
# uses a single distro + a separate data-disk VHDX, not two distros) —
# "no distribution with the supplied name" here is expected, not an error.
```
Then fully kill any lingering `Docker Desktop`/`com.docker.backend`/`docker` processes (a stale instance from before the reset will otherwise block the relaunch from showing anything) and relaunch. Docker Desktop rebuilds the `docker-desktop` distro from scratch on next launch — slower first boot, but the images/containers/volumes on the separate data disk survive intact (confirmed: an unrelated image from another project on this machine was still there afterward), and so did the buildx cache — the rebuild of both `tee-proxy` and `extension-tee` came back almost entirely `CACHED`.

**One more Windows-specific snag after that**: `docker compose up` failed binding Redis's port — `listen tcp4 127.0.0.1:6382: bind: An attempt was made to access a socket in a way forbidden by its access permissions`. Not a real port conflict — `netsh interface ipv4 show excludedportrange protocol=tcp` showed `6382` falls inside a Windows dynamic port-exclusion range (`6330–6429`, likely reserved by Hyper-V/WSL's NAT). Worked around by overriding `REDIS_BIND=127.0.0.1:16382` in `.env.coston2` (the compose file already parameterizes this: `"${REDIS_BIND:-127.0.0.1:6382}:6379"`). Worth checking `netsh interface ipv4 show excludedportrange protocol=tcp` before assuming any Windows Docker port-bind failure is a real conflict — it usually isn't.

With both of those fixed, `redis`, `ext-proxy`, and `extension-tee` all started cleanly. **Wall 2 (indexer DB) is now the only thing standing between this and a live TEE**, confirmed directly from the container's own crash:

```
connecting to database: opening mysql connection to <indexer-db-host>:3306/<indexer-db-name>
  as <indexer-db-user>: dial tcp: lookup <indexer-db-host>: no such host
```

`config/proxy/extension_proxy.coston2.docker.toml` still has the literal placeholder strings — the hackathon-shared username (`hackathon_user_57`) is filled in now, but the host, database name, and password were never provided. `docs/deployment-steps.md` documents the host as `35.241.249.150`, gated behind VPN access this session never had. The moment those three values (VPN access, database name, password) are in hand, `bash ./scripts/start-services.sh --chain coston2` should bring the whole stack up — nothing else in the pipeline is expected to need further debugging.

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
