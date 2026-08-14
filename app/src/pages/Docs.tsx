import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, ExternalLink, ShieldAlert } from 'lucide-react';
import NavBar from '../components/NavBar';
import Footer from '../components/Footer';
import BackgroundGrid from '../components/BackgroundGrid';
import { COSTON2_CHAIN_ID, COSTON2_EXPLORER, COSTON2_RPC_URL, CONTRACT_REGISTRY_ADDRESS, PHASE2, PHASE3, XRPL_TESTNET_JSON_RPC } from '../chain/config';

/**
 * Deepened per explicit user request: every address, endpoint, and
 * technical claim below is pulled directly from app/src/chain/config.ts,
 * app/src/chain/abis.ts, app/src/chain/ecies.ts, app/src/chain/teeProxy.ts,
 * and app/src/services/RealEscrowService.ts — the same source-of-truth
 * files the rest of this app reads its live data from. Nothing here is an
 * invented example address, hash, or endpoint.
 */

const explorerAddr = (addr: string) => `${COSTON2_EXPLORER}/address/${addr}`;

const contracts = [
  {
    label: 'WardenEscrow — Phase 2 (Weather)',
    address: PHASE2.escrowAddress,
    body: "Core escrow vault for the weather-triggered path. Holds FXRP locked via fund(conditionId, beneficiaryXrplAddress, amount); releases automatically once WardenWeatherResolver confirms an FDC-verified condition.",
  },
  {
    label: 'WardenWeatherResolver',
    address: PHASE2.resolverAddress,
    body: 'Reads the on-chain weather condition (thresholdTemperatureCx100, triggerIfAbove) and, once the Flare Data Connector attests the matching Web2Json proof, releases the Phase 2 escrow.',
  },
  {
    label: 'FDC Web2Json Verifier',
    address: PHASE2.fdcVerificationAddress,
    body: 'The attestation verifier this app checks to confirm a given weather condition proof was actually accepted by the Flare Data Connector, not merely claimed.',
  },
  {
    label: 'WardenEscrow — Phase 3 (Dispute)',
    address: PHASE3.escrowAddress,
    body: "Core escrow vault for the TEE-arbitrated dispute path. Every new escrow created through this app's Create Escrow flow is funded here, not on the Phase 2 contract.",
  },
  {
    label: 'WardenDisputeResolver',
    address: PHASE3.resolverAddress,
    body: "Reconstructs the TEE's signing hash from a submitted verdict and verifies it on-chain with ecrecover against the TEE's registered public key before releasing funds — see the dispute flow below.",
  },
  {
    label: 'FlareTeeManager',
    address: PHASE3.teeManagerAddress,
    body: `Diamond contract exposing the MachineManager facet (getTeeMachine, getTeeMachineStatus, getPublicKey) and the Verification facet (emits TeeInstructionsSent). Extension ID ${PHASE3.extensionId}.`,
  },
  {
    label: 'InstructionSender',
    address: PHASE3.instructionSenderAddress,
    body: 'Receives the payable sendRuleOnEvidence(bytes) call carrying ECIES-encrypted evidence, routes it to the TEE via FlareTeeManager, and is where the 1,000,000 wei per-instruction fee is paid.',
  },
  {
    label: 'ContractRegistry',
    address: CONTRACT_REGISTRY_ADDRESS,
    body: "Flare's on-chain registry, used only to look up the live AssetManagerFXRP address (getContractAddressByName) when funding an escrow — so the FXRP asset-manager address never needs to be hardcoded.",
  },
];

const lifecycle = [
  {
    n: '01',
    title: 'Funded',
    body: "CreateEscrow approves FXRP (if the current allowance is insufficient) then calls WardenEscrow.fund(conditionId, beneficiaryXrplAddress, amount), which emits EscrowFunded. On-chain status is 0 at this point — this app treats status 0 as \"funded, not yet released.\"",
  },
  {
    n: '02a',
    title: 'Monitoring — weather path',
    body: 'For weather escrows, WardenWeatherResolver\'s configured threshold is checked against a live Open-Meteo reading. No dispute step happens on this path.',
  },
  {
    n: '02b',
    title: 'Disputed — evidence path',
    body: "For the dispute path, SubmitEvidence calls InstructionSender.sendRuleOnEvidence() with ECIES-encrypted evidence. Important nuance: WardenEscrow exposes no \"dispute in progress\" getter on-chain — this app's \"disputed\" status is a session-level UI state, derived from whether this browser tab has a live pending/resolved dispute instruction recorded (see the Privacy Policy's Local Browser Storage section), not an on-chain value.",
  },
  {
    n: '03',
    title: 'Attested / Ruling',
    body: "Weather path: once FDC attests the Web2Json proof, WardenWeatherResolver releases automatically. Dispute path: RulingInProgress polls the TEE extension proxy for a signed verdict, then submits it via WardenDisputeResolver.submitVerdict() — see the dispute flow below for the full chain.",
  },
  {
    n: '04',
    title: 'Released',
    body: "On-chain status becomes 1 (\"released\") once the resolver's conditions are satisfied and EscrowReleased fires with the redeemed amount. PayoutSuccess then live-polls the XRPL testnet for the resulting XRP payment to the beneficiary address, delivered via the FAssets redemption path.",
  },
];

const disputeSteps = [
  {
    n: '01',
    title: 'Client-side ECIES encryption',
    body: "Evidence is encrypted in your browser to the TEE's live public key (fetched fresh from the extension proxy's /info) using secp256k1 + a NIST SP 800-56 Concatenation KDF (single SHA-256 round) + AES-128-CTR with a random 16-byte IV + an HMAC-SHA256 tag keyed by SHA-256 of the second half of the KDF output. Output layout: ephemeral public key (65B uncompressed) || iv (16B) || ciphertext || tag (32B) — byte-for-byte matching go-ethereum's crypto/ecies package with ECIES_AES128_SHA256 params, verified against the real Go reference implementation rather than an off-the-shelf JS ECIES library's (different) defaults.",
  },
  {
    n: '02',
    title: 'On-chain submission',
    body: 'The ciphertext is sent via InstructionSender.sendRuleOnEvidence(bytes), payable with a 1,000,000 wei instruction fee. FlareTeeManager\'s Verification facet — not InstructionSender itself — emits TeeInstructionsSent(instructionId, ..., teeMachines, ...), which is how this app learns the assigned instructionId and teeId.',
  },
  {
    n: '03',
    title: 'TEE processing',
    body: 'The assigned TEE machine evaluates the encrypted request inside its hardware-isolated enclave and produces a result plus a signature over that result.',
  },
  {
    n: '04',
    title: 'Verdict polling',
    body: 'This app polls the TEE extension proxy\'s GET /action/result/:instructionId every 6 seconds. status: 2 = pending (keep polling), 0 = failed, 1 = success — with ABI-encoded data (uint256 escrowId, bool outcome, uint64 rulingNumber) and a separate signature field.',
  },
  {
    n: '05',
    title: 'On-chain verification',
    body: 'WardenDisputeResolver.submitVerdict(teeId, instructionId, submissionTag, status, data, signature) reconstructs the TEE\'s signing hash and verifies it with ecrecover against the TEE\'s registered public key (from MachineManager.getPublicKey) before trusting anything — only then does it emit VerdictSubmitted and release funds accordingly. No party, including whoever operates the TEE, can substitute their own judgment for the enclave\'s signed, on-chain-verified output.',
  },
];

export default function Docs() {
  return (
    <div className="flex min-h-screen flex-col relative bg-[#0b0d10] text-zinc-100">
      <BackgroundGrid />
      <NavBar activeItem="docs" />

      <main className="relative z-10 flex-1 px-5 pt-16 pb-12 lg:px-10 lg:pt-24 lg:pb-20">
        <div className="mx-auto max-w-5xl">
          <div className="label text-[#b4f56b]">DOCUMENTATION</div>
          <h1 className="display mt-4 text-5xl text-white">Protocol architecture &amp; integration guides.</h1>
          <p className="mt-6 text-base leading-relaxed text-zinc-400">
            Warden combines the Flare Data Connector (FDC), Trusted Execution Environments (TEEs), and FAssets to
            provide autonomous trustless escrow on Flare Coston2 (Chain ID {COSTON2_CHAIN_ID}). Everything below is
            pulled from this app's own source — the deployed contract addresses, the real dispute-flow chain of
            calls, and the network endpoints it actually talks to.
          </p>

          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-[#111518] p-6">
              <BookOpen size={20} className="text-[#b4f56b]" />
              <h3 className="display mt-4 text-xl text-white">Smart Escrow Spec</h3>
              <p className="mt-2 text-xs text-zinc-500">
                WardenEscrow.fund() locks FXRP against an opaque conditionId. Weather escrows resolve automatically
                once WardenWeatherResolver reads an FDC-verified Web2Json attestation; dispute escrows resolve once
                WardenDisputeResolver ecrecover-verifies a signed TEE verdict.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#111518] p-6">
              <ShieldAlert size={20} className="text-[#72d7ff]" />
              <h3 className="display mt-4 text-xl text-white">Dispute &amp; TEE Enclaves</h3>
              <p className="mt-2 text-xs text-zinc-500">
                Evidence is ECIES-encrypted client-side to the live TEE public key and submitted via
                sendRuleOnEvidence(). The FlareTeeManager signs a verdict, which this app polls for and submits
                on-chain with submitVerdict().
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#111518] p-6">
              <h3 className="display text-xl text-white">Wallet connection</h3>
              <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                Warden discovers every installed EVM wallet extension live via EIP-6963 — no wallet is hardcoded.
                Connecting switches (or adds) the Coston2 network automatically.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#111518] p-6">
              <h3 className="display text-xl text-white">Settlement</h3>
              <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                Payouts settle as native XRP on XRPL testnet via the FAssets redemption path — this app live-polls
                XRPL for the delivered payment rather than assuming success.
              </p>
            </div>
          </div>

          {/* CONTRACT REFERENCE */}
          <section className="mt-20 border-t border-white/10 pt-12">
            <div className="label text-[#b4f56b]">CONTRACT REFERENCE</div>
            <h2 className="display mt-3 text-3xl text-white">Deployed contracts, address by address.</h2>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-zinc-500">
              Every contract this interface actually calls, with what each one does. All addresses live on Flare
              Coston2 and are verifiable on the explorer link on each card.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {contracts.map((c) => (
                <div key={c.address} className="rounded-2xl border border-white/10 bg-[#111518] p-5">
                  <div className="text-sm text-white">{c.label}</div>
                  <p className="mt-2 text-xs leading-relaxed text-zinc-500">{c.body}</p>
                  <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-[#0d1013] p-3">
                    <code className="mono truncate text-[10px] text-zinc-400">{c.address}</code>
                    <a href={explorerAddr(c.address)} target="_blank" rel="noreferrer" className="shrink-0 text-zinc-600 hover:text-[#b4f56b]">
                      <ExternalLink size={13} />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ESCROW LIFECYCLE */}
          <section className="mt-20 border-t border-white/10 pt-12">
            <div className="label text-[#b4f56b]">ESCROW LIFECYCLE</div>
            <h2 className="display mt-3 text-3xl text-white">The real state machine.</h2>
            <div className="mt-8 space-y-6">
              {lifecycle.map((step) => (
                <div key={step.n} className="flex gap-5 rounded-2xl border border-white/10 bg-[#111518] p-5">
                  <span className="mono shrink-0 text-xs text-[#b4f56b]">{step.n}</span>
                  <div>
                    <div className="text-sm text-white">{step.title}</div>
                    <p className="mt-2 text-xs leading-relaxed text-zinc-500">{step.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* DISPUTE FLOW */}
          <section className="mt-20 border-t border-white/10 pt-12">
            <div className="label text-[#b4f56b]">THE DISPUTE FLOW, STEP BY STEP</div>
            <h2 className="display mt-3 text-3xl text-white">Encrypted evidence to an on-chain-verified verdict.</h2>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-zinc-500">
              This is the most technically distinctive part of the protocol — the exact chain of calls from
              submitting evidence to a verdict being trustlessly actionable on-chain.
            </p>
            <div className="mt-8 space-y-6">
              {disputeSteps.map((step) => (
                <div key={step.n} className="flex gap-5 rounded-2xl border border-white/10 bg-[#111518] p-5">
                  <span className="mono shrink-0 text-xs text-[#d5a5ff]">{step.n}</span>
                  <div>
                    <div className="text-sm text-white">{step.title}</div>
                    <p className="mt-2 text-xs leading-relaxed text-zinc-500">{step.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* NETWORK & RPC REFERENCE */}
          <section className="mt-20 border-t border-white/10 pt-12">
            <div className="label text-[#b4f56b]">NETWORK &amp; RPC REFERENCE</div>
            <h2 className="display mt-3 text-3xl text-white">What this app actually connects to.</h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-[#111518] p-5">
                <div className="label">FLARE NETWORK</div>
                <dl className="mt-4 space-y-3 text-xs">
                  <div className="flex justify-between gap-4"><dt className="text-zinc-600">Name</dt><dd className="text-zinc-300">Flare Testnet Coston2</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-zinc-600">Chain ID</dt><dd className="mono text-zinc-300">{COSTON2_CHAIN_ID}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-zinc-600">Native currency</dt><dd className="text-zinc-300">C2FLR (18 decimals)</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-zinc-600">RPC endpoint</dt><dd className="mono truncate text-right text-zinc-300">{COSTON2_RPC_URL}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-zinc-600">Explorer</dt><dd className="mono truncate text-right text-zinc-300">{COSTON2_EXPLORER}</dd></div>
                </dl>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#111518] p-5">
                <div className="label">SETTLEMENT NETWORK</div>
                <dl className="mt-4 space-y-3 text-xs">
                  <div className="flex justify-between gap-4"><dt className="text-zinc-600">Name</dt><dd className="text-zinc-300">XRP Ledger (XRPL) testnet</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-zinc-600">RPC endpoint</dt><dd className="mono truncate text-right text-zinc-300">{XRPL_TESTNET_JSON_RPC}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-zinc-600">Bridge</dt><dd className="text-right text-zinc-300">FAssets (XRP ↔ FXRP, 1:1)</dd></div>
                </dl>
                <p className="mt-4 text-[11px] leading-relaxed text-zinc-600">
                  The TEE extension proxy (used for the dispute flow's /info and /action/result/:id calls) is reached
                  through an ephemeral Cloudflare tunnel URL, overridable via VITE_TEE_EXTENSION_PROXY_URL — since
                  that tunnel can rotate between sessions, no fixed address is documented here.
                </p>
              </div>
            </div>
          </section>

          <div className="mt-16 border-t border-white/10 pt-12">
            <Link to="/dashboard" className="inline-flex items-center gap-2 rounded-full bg-[#b4f56b] px-6 py-3 text-sm font-semibold text-[#0b0d10]">
              Enter the app <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
