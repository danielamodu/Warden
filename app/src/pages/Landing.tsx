import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import NavBar from '../components/NavBar';
import Footer from '../components/Footer';
import BackgroundGrid from '../components/BackgroundGrid';
import WordReveal from '../components/WordReveal';
import styles from './Landing.module.css';

type TabId = 'trade' | 'weather' | 'ip';

const roadmap = [
  { quarter: 'Q1 2025', title: 'LLM-Assisted Arbitration', body: 'Integration of fine-tuned TEE-safe language models to parse ambiguous contract language in complex business disputes.' },
  { quarter: 'Q2 2025', title: 'Partial Split Verdicts', body: 'Mechanism for graduated payouts allowing dispute outcomes to reflect shared responsibility and partial fulfillment.' },
  { quarter: 'Q3 2025', title: 'Multiple Dispute Categories', body: 'Specialized TEE resolvers for distinct verticals like Freight, Ad-tech, and High-Ticket E-commerce.' },
  { quarter: 'Q4 2025', title: 'Trade Finance Verticals', body: 'Dedicated institutional dashboards with integrated L/C workflows and automated document notarization.' },
];

function RoadmapItem({ quarter, title, body }: { quarter: string; title: string; body: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => entry.isIntersecting && setVisible(true)),
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={`relative pl-20 transition-opacity duration-1000 ${visible ? styles.roadmapItemVisible : styles.roadmapItem}`}>
      <div className="absolute left-[-1px] top-4 w-4 h-4 bg-[#3d7068] rounded-full border-4 border-[#f7f6f2]"></div>
      <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-[#3d7068] mb-2">{quarter}</div>
      <h3 className="font-mono text-xl uppercase mb-4">{title}</h3>
      <p className="font-sans opacity-70 max-w-xl">{body}</p>
    </div>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>('trade');

  return (
    <div className="min-h-screen relative">
      <BackgroundGrid />
      <NavBar activeItem="about" />

      <main className="pt-48">
        {/* HERO */}
        <section className="max-w-7xl mx-auto px-6 text-center">
          <div className="inline-flex items-center mb-8">
            <span className={styles.pulseDot}></span>
            <span className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60">System Status: Live</span>
          </div>

          <h1 className="font-serif text-[9vw] leading-[0.9] uppercase font-light tracking-tighter mb-8">
            Autonomous<br />
            Editorial <span className="italic opacity-50">Trust</span>
          </h1>

          <p className="max-w-2xl mx-auto text-xl md:text-2xl font-sans font-light leading-relaxed mb-12">
            Sophisticated escrow protocols featuring <span className="italic text-[#B4B4B4]">verified infrastructure</span>, FAssets-backed liquidity, and confidential <span className="italic text-[#B4B4B4]">dispute resolution</span> for the digital era.
          </p>

          <button
            id="hero-cta"
            onClick={() => navigate('/connect')}
            className="cta-button px-10 py-5 text-white font-mono text-[10px] tracking-[0.25em] uppercase rounded-[2px] mb-24 inline-flex items-center gap-3"
          >
            Create Escrow
            <iconify-icon icon="lucide:arrow-right"></iconify-icon>
          </button>
          <Link to="/dashboard" className="block mt-6 font-mono text-[10px] tracking-[0.2em] uppercase opacity-40 hover:opacity-100 transition-opacity">
            View Dashboard
          </Link>
        </section>

        {/* TRUST MARKERS */}
        <section className="max-w-7xl mx-auto border-y border-[#e5e4de]">
          <div className="px-6 pt-20 pb-12 text-center">
            <WordReveal className="font-serif text-4xl uppercase font-light tracking-tight mb-4">
              Built on Verified Infrastructure
            </WordReveal>
          </div>
          <div className="grid md:grid-cols-3 divide-x divide-[#e5e4de]">
            {[
              { icon: 'lucide:shield-check', protocol: 'Protocol 01', title: 'FDC Verification', body: 'On-chain attestation for external data, ensuring conditions are met with mathematical certainty.' },
              { icon: 'lucide:coins', protocol: 'Protocol 02', title: 'FAssets-Backed', body: 'Deep liquidity and collateral management powered by trustless asset bridging and redemption flows.' },
              { icon: 'lucide:lock', protocol: 'Protocol 03', title: 'Confidential Res', body: 'Multi-party computation and TEE-based processing for disputes that require total data privacy.' },
            ].map((card) => (
              <div key={card.title} className="p-12 editorial-transition group card-editorial">
                <div className="w-12 h-12 border border-[#e5e4de] flex items-center justify-center mb-8 rounded-[2px] group-hover:border-[#3d7068] transition-colors">
                  <iconify-icon icon={card.icon} class="text-2xl text-[#3d7068]"></iconify-icon>
                </div>
                <span className="font-mono text-[10px] tracking-[0.3em] uppercase block mb-4">{card.protocol}</span>
                <h3 className="font-serif text-2xl uppercase mb-4">{card.title}</h3>
                <p className="font-sans text-sm leading-relaxed opacity-70 text-left">{card.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* STATISTICS */}
        <section className="max-w-7xl mx-auto grid md:grid-cols-3 divide-x divide-[#e5e4de] border-b border-[#e5e4de]">
          {[
            { icon: 'lucide:activity', value: '$500M+', label: 'Total Value Secured' },
            { icon: 'lucide:users', value: '12K+', label: 'Active Trust Nodes' },
            { icon: 'lucide:check-circle', value: '100%', label: 'Successful Payouts' },
          ].map((stat) => (
            <div key={stat.label} className="p-10 editorial-transition card-editorial">
              <div className="w-10 h-10 border border-[#e5e4de] flex items-center justify-center mb-6 rounded-[2px]">
                <iconify-icon icon={stat.icon} class="text-xl opacity-40"></iconify-icon>
              </div>
              <div className="font-serif text-5xl mb-2">{stat.value}</div>
              <div className="font-mono text-[10px] tracking-[0.2em] uppercase opacity-60">{stat.label}</div>
            </div>
          ))}
        </section>

        {/* HOW IT WORKS */}
        <section className="max-w-7xl mx-auto px-6 py-32 border-b border-[#e5e4de]">
          <div className="grid md:grid-cols-2 gap-20">
            <div>
              <WordReveal className="font-serif text-4xl uppercase font-light tracking-tight mb-12">How it works</WordReveal>
              <div className="space-y-0">
                {[
                  { n: '01', title: 'Fund Escrow', body: 'Initialize your secure vault using XRPL, Xaman, or Ledger via the FAssets bridge.' },
                  { n: '02', title: 'Set Conditions', body: 'Define weather thresholds, delivery confirmation, or custom API oracle triggers.' },
                  { n: '03', title: 'Monitor Live', body: 'Real-time dashboards pull from open-meteo and on-chain FDC attestations.' },
                  { n: '04', title: 'Resolve with Proof', body: 'Automatic release upon condition match or TEE-verified dispute resolution.' },
                ].map((step) => (
                  <div key={step.n} className={`${styles.stepItem} pl-8 py-8 border-b border-[#e5e4de]`}>
                    <div className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-40 mb-2">{step.n}</div>
                    <h4 className="font-serif text-2xl uppercase mb-3">{step.title}</h4>
                    <p className="font-sans text-base opacity-70">{step.body}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="hidden md:flex items-center justify-center">
              <div className="w-full aspect-square border border-[#e5e4de] relative overflow-hidden group">
                <div className="absolute inset-0 bg-[#3d7068] opacity-5 group-hover:opacity-10 transition-opacity"></div>
                <div className="absolute inset-10 border border-[#e5e4de] flex flex-col items-center justify-center text-center p-12">
                  <iconify-icon icon="lucide:fingerprint" class="text-8xl opacity-10 mb-8"></iconify-icon>
                  <span className="font-mono text-[10px] tracking-[0.4em] uppercase opacity-40">Verified Mechanism</span>
                  <div className="h-px w-24 bg-[#1c1c1c] my-6 opacity-20"></div>
                  <p className="font-serif italic text-xl">Trust is the new<br />encryption.</p>
                </div>
                <div className={styles.scanLine}></div>
              </div>
            </div>
          </div>
        </section>

        {/* USE CASES */}
        <section className="max-w-7xl mx-auto py-32 border-b border-[#e5e4de]">
          <div className="px-6 text-center mb-16">
            <WordReveal className="font-serif text-4xl uppercase font-light tracking-tight mb-8">Proven Across Industries</WordReveal>
            <div className="flex flex-wrap justify-center gap-4">
              {(['trade', 'weather', 'ip'] as TabId[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-6 py-2 rounded-full font-mono text-[10px] tracking-[0.2em] uppercase transition-all editorial-transition ${
                    activeTab === tab ? 'bg-[#3d7068] text-white' : 'border border-[#e5e4de] opacity-60 hover:opacity-100'
                  }`}
                >
                  {tab === 'trade' ? 'Trade Finance' : tab === 'weather' ? 'Weather Derivatives' : 'IP Licensing'}
                </button>
              ))}
            </div>
          </div>
          <div className="max-w-5xl mx-auto px-6">
            {activeTab === 'trade' && (
              <div className={`${styles.tabContent} ${styles.tabContentActive} p-12 border border-[#e5e4de] bg-[#f7f6f2]/50`}>
                <h3 className="font-serif text-3xl uppercase mb-6">Global Supply Chain Escrow</h3>
                <p className="font-sans text-lg opacity-70 mb-8 leading-relaxed">Secure high-value international trade using automated document verification and IoT delivery tracking.</p>
                <ul className="grid md:grid-cols-2 gap-4">
                  {['Automatic Bill of Lading verification', 'Real-time currency hedging via FAssets', 'Zero-party dispute privacy', 'Multi-signatory approval flows'].map((li) => (
                    <li key={li} className="flex items-center gap-3 font-mono text-xs opacity-60"><iconify-icon icon="lucide:check" class="text-[#3d7068]"></iconify-icon> {li}</li>
                  ))}
                </ul>
              </div>
            )}
            {activeTab === 'weather' && (
              <div className={`${styles.tabContent} ${styles.tabContentActive} p-12 border border-[#e5e4de] bg-[#f7f6f2]/50`}>
                <h3 className="font-serif text-3xl uppercase mb-6">Parametric Climate Protection</h3>
                <p className="font-sans text-lg opacity-70 mb-8 leading-relaxed">Instant payouts based on verifiable climate data points sourced from open oracles and satellite feeds.</p>
                <ul className="grid md:grid-cols-2 gap-4">
                  {['Open-Meteo API integration', 'Immediate threshold triggers', 'Transparent voting rounds', 'Low-latency FDC attestations'].map((li) => (
                    <li key={li} className="flex items-center gap-3 font-mono text-xs opacity-60"><iconify-icon icon="lucide:check" class="text-[#3d7068]"></iconify-icon> {li}</li>
                  ))}
                </ul>
              </div>
            )}
            {activeTab === 'ip' && (
              <div className={`${styles.tabContent} ${styles.tabContentActive} p-12 border border-[#e5e4de] bg-[#f7f6f2]/50`}>
                <h3 className="font-serif text-3xl uppercase mb-6">Digital Rights &amp; Licensing</h3>
                <p className="font-sans text-lg opacity-70 mb-8 leading-relaxed">Streamline complex IP payouts and royalty distributions with cryptographic proof of use.</p>
                <ul className="grid md:grid-cols-2 gap-4">
                  {['Hash-based asset verification', 'Fractional royalty distribution', 'Automated licensing renewals', 'On-chain provenance tracking'].map((li) => (
                    <li key={li} className="flex items-center gap-3 font-mono text-xs opacity-60"><iconify-icon icon="lucide:check" class="text-[#3d7068]"></iconify-icon> {li}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>

        {/* TESTIMONIALS */}
        <section className="max-w-7xl mx-auto py-32 border-b border-[#e5e4de]">
          <div className="px-6 text-center mb-16">
            <WordReveal className="font-serif text-4xl uppercase font-light tracking-tight">Trusted by Protocol Builders</WordReveal>
          </div>
          <div className="grid md:grid-cols-3 divide-x divide-[#e5e4de]">
            {[
              { quote: '"Automated conditions eliminated manual oversight, allowing our trade finance desks to scale 4x in a single quarter."', name: 'Alexander V.', role: 'CTO, Nexus Trade' },
              { quote: '"FDC verification gave us the confidence to go live with our insurance vertical on Coston2 without a central oracle."', name: 'Sarah Chen', role: 'Lead Dev, FlareInsure' },
              { quote: '"Dispute resolution that actually respects confidentiality. The TEE-based arbitration is a game changer for institutional users."', name: 'Marcus Thorne', role: 'Protocol Head, Arc Escrow' },
            ].map((t) => (
              <div key={t.name} className="p-12 editorial-transition card-editorial">
                <p className="font-sans italic text-lg leading-relaxed mb-8 opacity-80">{t.quote}</p>
                <div>
                  <div className="font-mono text-[10px] tracking-[0.2em] uppercase mb-1">{t.name}</div>
                  <div className="font-mono text-[10px] tracking-[0.2em] uppercase opacity-40">{t.role}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* TECHNICAL FOUNDATIONS */}
        <section className="max-w-7xl mx-auto py-32 border-b border-[#e5e4de]">
          <div className="px-6 text-center mb-24">
            <WordReveal className="font-serif text-4xl uppercase font-light tracking-tight">Technical Foundations</WordReveal>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-y-32 relative">
            <div className="md:col-span-5 md:col-start-1 px-6">
              <div className="w-12 h-12 border border-[#e5e4de] flex items-center justify-center mb-8">
                <iconify-icon icon="lucide:cpu" class="text-2xl text-[#3d7068]"></iconify-icon>
              </div>
              <h3 className="font-serif text-3xl uppercase mb-6">Automated Conditions</h3>
              <p className="font-sans opacity-70 leading-relaxed">Using the Flare Data Connector, escrow release can be pegged to real-world events like weather anomalies, shipping milestones, or market triggers with zero human intervention.</p>
            </div>
            <div className="md:col-span-5 md:col-start-8 px-6">
              <div className="w-12 h-12 border border-[#e5e4de] flex items-center justify-center mb-8">
                <iconify-icon icon="lucide:layers" class="text-2xl text-[#3d7068]"></iconify-icon>
              </div>
              <h3 className="font-serif text-3xl uppercase mb-6">Multi-Party Computation</h3>
              <p className="font-sans opacity-70 leading-relaxed">Our MPC framework ensures that no single entity—not even the protocol operators—can access private evidence provided during dispute phases.</p>
            </div>
            <div className="hidden md:block absolute top-1/2 left-1/2 -translate-x-1/2 w-px h-full bg-[#e5e4de] opacity-30"></div>
            <div className="md:col-span-5 md:col-start-1 px-6">
              <div className="w-12 h-12 border border-[#e5e4de] flex items-center justify-center mb-8">
                <iconify-icon icon="lucide:shield-check" class="text-2xl text-[#3d7068]"></iconify-icon>
              </div>
              <h3 className="font-serif text-3xl uppercase mb-6">TEE Verification</h3>
              <p className="font-sans opacity-70 leading-relaxed">Dispute logic executes inside Trusted Execution Environments (TEEs), providing hardware-level assurance that code hasn't been tampered with.</p>
            </div>
            <div className="md:col-span-5 md:col-start-8 px-6">
              <div className="w-12 h-12 border border-[#e5e4de] flex items-center justify-center mb-8">
                <iconify-icon icon="lucide:droplets" class="text-2xl text-[#3d7068]"></iconify-icon>
              </div>
              <h3 className="font-serif text-3xl uppercase mb-6">FAssets Liquidity</h3>
              <p className="font-sans opacity-70 leading-relaxed">Lock non-smart contract assets like XRP, BTC, and DOGE directly into escrows via the trustless FAssets bridging layer.</p>
            </div>
          </div>
        </section>

        {/* ROADMAP */}
        <section className="max-w-7xl mx-auto py-32 border-b border-[#e5e4de]">
          <div className="px-6 mb-24">
            <WordReveal className="font-serif text-4xl uppercase font-light tracking-tight">Built for the Future</WordReveal>
          </div>
          <div className="max-w-4xl mx-auto px-6 relative">
            <div className="absolute left-[30px] md:left-[35px] top-0 bottom-0 w-[2px] bg-[#3d7068] opacity-20"></div>
            <div className="space-y-24">
              {roadmap.map((item) => (
                <RoadmapItem key={item.quarter} {...item} />
              ))}
            </div>
          </div>
        </section>

        {/* PROOF & TRANSPARENCY */}
        <section className="max-w-7xl mx-auto py-32 border-b border-[#e5e4de]">
          <div className="px-6 text-center mb-16">
            <WordReveal className="font-serif text-4xl uppercase font-light tracking-tight">Verifiable by Design</WordReveal>
          </div>
          <div className="grid md:grid-cols-3 divide-x divide-[#e5e4de]">
            <Link to="/proof" id="proof-contracts" className="p-12 text-center editorial-transition card-editorial group">
              <div className="w-16 h-16 border border-[#e5e4de] mx-auto flex items-center justify-center mb-8">
                <iconify-icon icon="lucide:file-code" class="text-3xl opacity-40 group-hover:text-[#3d7068] group-hover:opacity-100 transition-all"></iconify-icon>
              </div>
              <h3 className="font-serif text-xl uppercase mb-4">Smart Contracts</h3>
              <div className="font-mono text-[10px] tracking-[0.2em] uppercase opacity-60 group-hover:opacity-100 flex items-center justify-center gap-2">
                View Source <iconify-icon icon="lucide:external-link"></iconify-icon>
              </div>
            </Link>
            <Link to="/proof" id="proof-blockchain" className="p-12 text-center editorial-transition card-editorial group">
              <div className="w-16 h-16 border border-[#e5e4de] mx-auto flex items-center justify-center mb-8">
                <iconify-icon icon="lucide:database" class="text-3xl opacity-40 group-hover:text-[#3d7068] group-hover:opacity-100 transition-all"></iconify-icon>
              </div>
              <h3 className="font-serif text-xl uppercase mb-4">Blockchain Proof</h3>
              <div className="font-mono text-[10px] tracking-[0.2em] uppercase opacity-60 group-hover:opacity-100 flex items-center justify-center gap-2">
                Coston2 Explorer <iconify-icon icon="lucide:external-link"></iconify-icon>
              </div>
            </Link>
            <Link to="/proof" id="proof-tee" className="p-12 text-center editorial-transition card-editorial group">
              <div className="w-16 h-16 border border-[#e5e4de] mx-auto flex items-center justify-center mb-8">
                <iconify-icon icon="lucide:box" class="text-3xl opacity-40 group-hover:text-[#3d7068] group-hover:opacity-100 transition-all"></iconify-icon>
              </div>
              <h3 className="font-serif text-xl uppercase mb-4">TEE Verification</h3>
              <div className="font-mono text-[10px] tracking-[0.2em] uppercase opacity-60 group-hover:opacity-100 flex items-center justify-center gap-2">
                FlareTeeManager <iconify-icon icon="lucide:external-link"></iconify-icon>
              </div>
            </Link>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="max-w-7xl mx-auto py-48 text-center">
          <div className="max-w-4xl mx-auto px-6">
            <WordReveal className="font-serif text-[6vw] leading-[1] uppercase font-light tracking-tighter mb-8">
              Ready to Build Trustless Escrow?
            </WordReveal>
            <p className="font-sans text-xl opacity-70 mb-16 max-w-2xl mx-auto">Join hundreds of developers securing high-value transactions with the world's first editorial-grade autonomous escrow protocol.</p>
            <Link to="/connect" id="final-cta" className="cta-button px-16 py-8 text-white font-mono text-xs tracking-[0.3em] uppercase rounded-[2px] inline-flex items-center gap-4 group">
              Get Started Now
              <iconify-icon icon="lucide:chevron-right" class="group-hover:translate-x-1 transition-transform"></iconify-icon>
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
