// EIP-6963 "Multi Injected Provider Discovery" — lets a page discover every
// installed EVM wallet extension (MetaMask, Zerion, Rabby, Coinbase Wallet,
// etc.) as distinct, real options, each with its own real name/icon/provider
// instance, with zero SDK/API key. No wallet is assumed or hardcoded; this
// only ever reflects whatever the user's browser actually announces.
// Spec: https://eips.ethereum.org/EIPS/eip-6963

export interface EIP6963ProviderInfo {
  uuid: string;
  name: string;
  icon: string; // data: URI
  rdns: string;
}

export interface EIP6963ProviderDetail {
  info: EIP6963ProviderInfo;
  provider: any; // EIP-1193 provider
}

interface EIP6963AnnounceProviderEvent extends CustomEvent {
  detail: EIP6963ProviderDetail;
}

/**
 * Listens for EIP-6963 provider announcements for `timeoutMs`, dispatching
 * the required `eip6963:requestProvider` event to prompt every installed
 * wallet extension to announce itself. Resolves with whatever announced in
 * that window (often near-instant, since extensions listen from page load).
 */
export function discoverInjectedProviders(timeoutMs = 400): Promise<EIP6963ProviderDetail[]> {
  return new Promise((resolve) => {
    const found = new Map<string, EIP6963ProviderDetail>();

    function onAnnounce(event: Event) {
      const detail = (event as EIP6963AnnounceProviderEvent).detail;
      if (detail?.info?.uuid) {
        found.set(detail.info.uuid, detail);
      }
    }

    window.addEventListener('eip6963:announceProvider', onAnnounce as EventListener);
    window.dispatchEvent(new Event('eip6963:requestProvider'));

    setTimeout(() => {
      window.removeEventListener('eip6963:announceProvider', onAnnounce as EventListener);
      resolve(Array.from(found.values()));
    }, timeoutMs);
  });
}

/** Legacy fallback for wallets that don't yet implement EIP-6963. */
export function getLegacyInjectedProvider(): any {
  return (window as any).ethereum ?? null;
}
