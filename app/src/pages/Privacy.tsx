import type { ReactNode } from 'react';
import NavBar from '../components/NavBar';
import Footer from '../components/Footer';
import BackgroundGrid from '../components/BackgroundGrid';

/**
 * Real Privacy Policy, not a placeholder blurb. Every claim here is
 * verified against the actual codebase rather than assumed:
 * - No backend/database: app/package.json has no server framework, no ORM,
 *   no auth — this is a pure Vite/React frontend (contrast with the Manus
 *   scaffold's server/ + drizzle-orm + mysql2, none of which was carried
 *   over — see app/src/services/RealEscrowService.ts, which reads
 *   everything live from Coston2/XRPL RPC + the Open-Meteo API).
 * - No accounts/login: no auth context anywhere in app/src.
 * - Local storage use: app/src/chain/pendingDispute.ts writes to
 *   sessionStorage only, purely to hand off live tx/verdict data between
 *   routed pages within one browser tab — verified by reading that file.
 * - No analytics/tracking dependency anywhere in package.json.
 *
 * What is NOT here: a named operating company or a contact address — this
 * codebase doesn't establish either, so Section 9 uses an explicit
 * placeholder instead of inventing one.
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

export default function Privacy() {
  return (
    <div className="flex min-h-screen flex-col relative bg-[#0b0d10] text-zinc-100">
      <BackgroundGrid />
      <NavBar />

      <main className="relative z-10 flex-1 px-5 py-12 lg:px-10 lg:py-20">
        <div className="mx-auto max-w-4xl">
          <div className="label text-[#b4f56b]">PRIVACY</div>
          <h1 className="display mt-4 text-5xl text-white">Privacy Policy.</h1>
          <p className="mt-6 text-sm leading-relaxed text-zinc-400">
            This page explains what data this interface does and does not handle when you use it to interact with
            the Warden smart contracts on Flare Coston2 and the XRPL testnet.
          </p>
          <p className="mt-4 text-xs uppercase tracking-[0.15em] text-zinc-600">Last updated: August 13, 2026</p>

          <div className="mt-12">
            <Section n={1} title="Overview: No Backend, No Accounts">
              <p>
                This interface is a static web application — there is no backend server, no database, and no user
                account or login system behind it. There is nothing for us to store on our own infrastructure,
                because there isn't any: every screen reads data live from Coston2's public JSON-RPC endpoint, the
                XRPL testnet's public JSON-RPC endpoint, and the Open-Meteo weather API, at the moment you view it.
              </p>
            </Section>

            <Section n={2} title="Data We Collect Directly">
              <p>
                We do not collect your name, email address, physical address, or any other personally identifying
                information, because this interface never asks you for any. There is no sign-up form and no profile.
              </p>
            </Section>

            <Section n={3} title="On-Chain Data (Public by Design)">
              <p>
                Blockchains are public ledgers. When you fund an escrow, submit evidence, or receive a payout, the
                following becomes permanently visible to anyone on the relevant public explorer (Coston2 Explorer for
                Flare transactions, the XRPL testnet explorer for XRP payouts) — not just to us:
              </p>
              <ul className="list-disc space-y-2 pl-5">
                <li>Your wallet address (EVM address on Coston2, XRPL address for payouts);</li>
                <li>Escrow amounts, condition parameters, and contract interactions;</li>
                <li>Transaction hashes, timestamps, and the resulting on-chain state;</li>
                <li>The ciphertext of any evidence you submit during a dispute (encrypted — see Section 5 — but its existence and size are visible on-chain, like any transaction data).</li>
              </ul>
              <p>
                This is inherent to how public blockchains work, not a choice this interface makes on your behalf.
                Nothing about it is unique to Warden.
              </p>
            </Section>

            <Section n={4} title="Wallet Connections">
              <p>
                Connecting a wallet uses <strong className="text-zinc-300">EIP-6963</strong>, which lets this
                interface discover whichever EVM wallet extensions you actually have installed (MetaMask, Rabby,
                Coinbase Wallet, etc.) so you can pick one — no wallet is bundled, assumed, or contacted without your
                action. When you connect, we read the public address(es) your wallet exposes; we never request,
                receive, or store your private key or seed phrase, and this interface has no way to move funds
                without you actively signing each transaction in your own wallet.
              </p>
            </Section>

            <Section n={5} title="Evidence Encryption During Disputes">
              <p>
                If you submit evidence during a dispute, it is encrypted client-side (ECIES) in your browser to the
                arbitrating TEE's public key before it is ever sent anywhere. We do not see, store, or have the
                ability to decrypt plaintext evidence — only the TEE, using its own private key inside its hardware
                enclave, can decrypt it during arbitration.
              </p>
            </Section>

            <Section n={6} title="Local Browser Storage">
              <p>
                This interface writes a small amount of data to your browser's{' '}
                <code className="mono text-zinc-300">sessionStorage</code> — specifically, the instruction/verdict
                identifiers produced by a real dispute transaction, so that the multi-step dispute flow (submit
                evidence → poll for a verdict → display the verdict) can carry that state between page navigations
                within the same browser tab. This data stays on your device, is never transmitted to us, and is
                cleared automatically when you close the tab.
              </p>
            </Section>

            <Section n={7} title="Third-Party Data Sources">
              <p>
                To function, this interface makes direct requests from your browser to a small number of third-party
                services, each of which may independently see standard web request metadata (such as your IP
                address) according to their own practices, which we do not control:
              </p>
              <ul className="list-disc space-y-2 pl-5">
                <li><strong className="text-zinc-300">Coston2 RPC endpoint</strong> — to read and write on-chain state;</li>
                <li><strong className="text-zinc-300">XRPL testnet RPC endpoint</strong> — to read balances and payout transactions;</li>
                <li><strong className="text-zinc-300">Open-Meteo API</strong> — to read live weather data for condition verification;</li>
                <li><strong className="text-zinc-300">The TEE extension proxy</strong> — to submit encrypted evidence and poll for signed verdicts.</li>
              </ul>
            </Section>

            <Section n={8} title="No Cookies, Analytics, or Tracking">
              <p>
                This interface does not use cookies, does not run any analytics or advertising SDK, and does not
                track you across sites or sessions. It is not built to be directed at children, and we do not
                knowingly collect data about children.
              </p>
            </Section>

            <Section n={9} title="Changes to This Policy &amp; Contact">
              <p>
                This policy may be updated as the interface changes; the "Last updated" date above reflects the most
                recent revision.
              </p>
              <p>
                <span className="rounded-md border border-dashed border-white/20 bg-white/[.03] px-2 py-1 text-xs text-zinc-500">
                  [Operating entity and contact address for privacy inquiries — not yet specified. This codebase does
                  not establish a company or legal entity, so none is claimed here.]
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
