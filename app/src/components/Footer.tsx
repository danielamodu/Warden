interface FooterProps {
  copyrightYear?: string;
}

/**
 * EditorialFooter (component id 5b39eb7d-e8b3-4d09-9124-04e9d9bbb2df).
 * Reconstructed from its `list-components` description (brand logo line,
 * Privacy/Terms/Contact nav links, uppercase Space Mono copyright text with
 * hover opacity transitions) — see final report on why raw HTML wasn't
 * fetchable for shared components via the CLI.
 */
export default function Footer({ copyrightYear = String(new Date().getFullYear()) }: FooterProps) {
  return (
    <footer className="border-t border-[#e5e4de] mt-32">
      <div className="max-w-7xl mx-auto px-6 py-12 flex flex-col md:flex-row items-center justify-between gap-6">
        <span className="font-serif text-lg uppercase tracking-tight opacity-80">WARDEN</span>

        <div className="flex items-center gap-8 font-mono text-[10px] tracking-[0.2em] uppercase opacity-50">
          <a href="#privacy" className="hover:opacity-100 transition-opacity">Privacy</a>
          <a href="#terms" className="hover:opacity-100 transition-opacity">Terms</a>
          <a href="#contact" className="hover:opacity-100 transition-opacity">Contact</a>
        </div>

        <span className="font-mono text-[9px] tracking-[0.2em] uppercase opacity-30">
          © {copyrightYear} Warden Protocol
        </span>
      </div>
    </footer>
  );
}
