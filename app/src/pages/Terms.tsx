import type { ReactNode } from 'react';
import NavBar from '../components/NavBar';
import Footer from '../components/Footer';
import BackgroundGrid from '../components/BackgroundGrid';

/**
 * Real Terms of Service, not a placeholder blurb. Every technical/protocol
 * claim here is grounded in what this codebase actually does (verified
 * against app/src/chain/*, app/src/services/RealEscrowService.ts, and the
 * live contract behavior exercised elsewhere in this app) — non-custodial
 * design, Coston2 testnet status, FDC-verified conditions, TEE-arbitrated
 * disputes with on-chain ecrecover verification.
 *
 * What is deliberately NOT here: a named operating company, a governing
 * jurisdiction, a dispute-resolution venue, or a contact address. Nothing in
 * this codebase establishes any of those facts, so Section 12 uses explicit
 * "[... — TBD]" placeholders instead of inventing them. Fill those in (or
 * remove the section if no operating entity exists) before treating this as
 * a real, enforceable legal document — as ported, it's accurate about the
 * protocol but incomplete as a legal instrument.
 */

function Section({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="border-t border-white/10 py-10 first:border-t-0 first:pt-0">
      <h2 className="display text-2xl text-white">
        <span className="mono mr-3 text-[#b4f56b]">{String(n).padStart(2, '0')}</span>
        {title}
      </h2>
      <div className="mt-4 space-y-4 text-sm leading-relaxed text-zinc-400">{children}</div>
    </section>
  );
}

export default function Terms() {
  return (
    <div className="flex min-h-screen flex-col relative bg-[#0b0d10] text-zinc-100">
      <BackgroundGrid />
      <NavBar />

      <main className="relative z-10 flex-1 px-5 py-12 lg:px-10 lg:py-20">
        <div className="mx-auto max-w-4xl">
          <div className="label text-[#b4f56b]">LEGAL</div>
          <h1 className="display mt-4 text-5xl text-white">Terms of Service.</h1>
          <p className="mt-6 text-sm leading-relaxed text-zinc-400">
            These Terms govern your use of the Warden protocol — the WardenEscrow, WardenWeatherResolver,
            WardenDisputeResolver, and related smart contracts deployed on Flare Coston2 (Chain ID 114), together
            with this web interface. By connecting a wallet or submitting a transaction through this interface, you
            agree to the terms below.
          </p>
          <p className="mt-4 text-xs uppercase tracking-[0.15em] text-zinc-600">Last updated: August 13, 2026</p>

          <div className="mt-12">
            <Section n={1} title="Acceptance of Terms">
              <p>
                By connecting a wallet, funding an escrow, submitting evidence, or otherwise interacting with the
                Warden smart contracts through this interface, you accept these Terms in full. If you do not agree,
                do not use the protocol.
              </p>
            </Section>

            <Section n={2} title="Nature of the Protocol">
              <p>
                Warden is a set of autonomous smart contracts, not a company providing you a managed service. There
                is no account to create, no login, and no customer-facing operator that approves, holds, or moves
                your funds on your behalf. Every action — funding an escrow, verifying a condition, resolving a
                dispute, releasing a payout — executes as code on Flare Coston2 and, for payouts, on the XRP Ledger
                (XRPL) testnet.
              </p>
            </Section>

            <Section n={3} title="Non-Custodial Design">
              <p>
                Funds locked into an escrow are held by the <code className="mono text-zinc-300">WardenEscrow</code>{' '}
                smart contract itself, at its on-chain address, under the contract's own code — not by any operator,
                company, or individual. No one holds a private key that can unilaterally move funds out of an active
                escrow. Release only happens when the contract's own logic determines a condition has been met
                (weather threshold, via Flare Data Connector attestation) or a dispute verdict has been submitted and
                verified on-chain (see Section 5).
              </p>
              <p>
                This also means Warden cannot reverse a transaction, recover funds sent to the wrong address, or
                override a contract's outcome. You are responsible for verifying contract addresses, transaction
                parameters, and recipient addresses before submitting a transaction.
              </p>
            </Section>

            <Section n={4} title="Testnet & Experimental Software">
              <p>
                Warden currently runs on Flare's <strong className="text-zinc-300">Coston2 testnet</strong> (Chain ID
                114) and settles payouts as native XRP on the <strong className="text-zinc-300">XRPL testnet</strong>.
                This is experimental, unaudited software. Testnets can be reset, experience downtime, or behave
                unpredictably, and smart contracts — however carefully written — can contain bugs. Do not treat any
                value held in this protocol as equivalent to funds on a production/mainnet deployment, and do not
                rely on this software for anything beyond testing and evaluation.
              </p>
            </Section>

            <Section n={5} title="How Escrow Conditions Are Verified">
              <p>
                Weather-triggered escrows are resolved automatically once the{' '}
                <strong className="text-zinc-300">Flare Data Connector (FDC)</strong> attests to a Web2Json proof of
                the relevant condition (e.g. a temperature threshold sourced from the Open-Meteo API) and{' '}
                <code className="mono text-zinc-300">WardenWeatherResolver</code> verifies that attestation on-chain.
                No human reviews or approves this release — it is triggered purely by the verified data.
              </p>
              <p>
                Dispute-path escrows are resolved by a{' '}
                <strong className="text-zinc-300">Trusted Execution Environment (TEE)</strong>. Evidence you submit is
                encrypted in your browser (ECIES) to the TEE's live public key before it ever leaves your device, and
                sent on-chain via a signed transaction. The TEE evaluates the evidence inside a hardware-isolated
                enclave and returns a cryptographically signed verdict. That verdict is only acted on after{' '}
                <code className="mono text-zinc-300">WardenDisputeResolver</code> reconstructs the TEE's signing hash
                and verifies it on-chain with <code className="mono text-zinc-300">ecrecover</code> against the TEE's
                registered public key — no party, including whoever operates the TEE, can substitute their own
                judgment for the enclave's signed output. There is no appeals process built into the protocol beyond
                this verification.
              </p>
            </Section>

            <Section n={6} title="Risks">
              <p>By using Warden, you acknowledge and accept the following risks, without limitation:</p>
              <ul className="list-disc space-y-2 pl-5">
                <li><strong className="text-zinc-300">Smart contract risk.</strong> Bugs, edge cases, or unforeseen interactions in the escrow, resolver, or dispute contracts could cause funds to be locked, released incorrectly, or otherwise lost.</li>
                <li><strong className="text-zinc-300">Oracle/data-source risk.</strong> Weather conditions depend on a third-party API (Open-Meteo) and FDC's attestation of it; incorrect, delayed, or unavailable source data can affect the outcome.</li>
                <li><strong className="text-zinc-300">TEE risk.</strong> Dispute outcomes depend on the correctness and availability of a specific TEE implementation and its key management; hardware or implementation flaws are a real (if unlikely) category of risk.</li>
                <li><strong className="text-zinc-300">Bridging risk.</strong> Payouts settle via a FAssets XRP ↔ FXRP redemption path; delays or failures in that bridging mechanism can affect when or whether a payout is delivered.</li>
                <li><strong className="text-zinc-300">Wallet security.</strong> You are solely responsible for the security of your wallet and private keys. Warden never asks for your seed phrase and cannot recover funds lost to a compromised wallet.</li>
                <li><strong className="text-zinc-300">Testnet instability.</strong> Coston2 and XRPL testnet can be reset, forked, or made unavailable at any time, independent of anything Warden does.</li>
              </ul>
            </Section>

            <Section n={7} title="No Warranty">
              <p>
                The protocol and this interface are provided "as is" and "as available," without warranty of any
                kind, express or implied, including without limitation warranties of merchantability, fitness for a
                particular purpose, or non-infringement. No one associated with this codebase warrants that the
                software will be uninterrupted, error-free, or secure.
              </p>
            </Section>

            <Section n={8} title="Limitation of Liability">
              <p>
                To the maximum extent permitted, in no event will anyone associated with developing or operating this
                interface or the underlying smart contracts be liable for any indirect, incidental, special,
                consequential, or punitive damages, or any loss of funds, data, or goodwill, arising from your use of
                (or inability to use) the protocol — including losses caused by smart contract bugs, oracle failures,
                TEE unavailability, network/testnet instability, or your own error.
              </p>
            </Section>

            <Section n={9} title="Prohibited Use">
              <p>You agree not to use Warden to:</p>
              <ul className="list-disc space-y-2 pl-5">
                <li>Attempt to exploit, disable, or interfere with the smart contracts, TEE, or this interface;</li>
                <li>Submit evidence or instructions you know to be false with intent to defraud a counterparty;</li>
                <li>Use the protocol in violation of any law applicable to you; or</li>
                <li>Misrepresent this experimental testnet deployment as a production financial product.</li>
              </ul>
            </Section>

            <Section n={10} title="Changes to the Protocol or These Terms">
              <p>
                Because Warden is open, autonomous smart-contract code, "changing the protocol" in practice means
                deploying new contract versions — existing deployed contracts do not update themselves. This
                interface and these Terms may be revised at any time; continued use after a revision constitutes
                acceptance of the updated Terms.
              </p>
            </Section>

            <Section n={11} title="Severability">
              <p>
                If any provision of these Terms is found unenforceable, the remaining provisions will remain in full
                effect.
              </p>
            </Section>

            <Section n={12} title="Governing Law &amp; Contact">
              <p>
                <span className="rounded-md border border-dashed border-white/20 bg-white/[.03] px-2 py-1 text-xs text-zinc-500">
                  [Operating entity, governing jurisdiction, dispute-resolution venue, and contact address — not yet
                  specified. This codebase does not establish a company, legal entity, or jurisdiction, so none is
                  claimed here. Fill in before relying on this document as a complete legal instrument.]
                </span>
              </p>
            </Section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
