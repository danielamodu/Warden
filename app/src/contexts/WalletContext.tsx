import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { ethers } from 'ethers';
import { COSTON2_CHAIN_ID, COSTON2_CHAIN_ID_HEX, COSTON2_CHAIN_PARAMS } from '../chain/config';
import {
  discoverInjectedProviders,
  getLegacyInjectedProvider,
  type EIP6963ProviderDetail,
} from '../chain/eip6963';

// The Connect Wallet screen now shows real, EIP-6963-discovered EVM wallets
// (MetaMask, Zerion, Rabby, Coinbase Wallet, whatever the user actually has
// installed) instead of XRPL wallet names — per an explicit correction to
// this one screen's visible content. `walletId` here is either a discovered
// provider's uuid, or the sentinel below for a legacy (pre-EIP-6963)
// window.ethereum with no announcements.
export const LEGACY_WALLET_ID = 'injected-legacy';
export type WalletId = string;
export type WalletConnectionStatus = 'disconnected' | 'connecting' | 'connected';

interface WalletState {
  walletId: WalletId | null;
  address: string | null;
  status: WalletConnectionStatus;
  chainId: number | null;
  error: string | null;
  availableWallets: EIP6963ProviderDetail[];
  legacyAvailable: boolean;
}

interface WalletContextValue extends WalletState {
  connect: (walletId: WalletId) => Promise<void>;
  disconnect: () => void;
  getSigner: () => Promise<ethers.Signer>;
}

export const WalletContext = createContext<WalletContextValue | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<WalletState>({
    walletId: null,
    address: null,
    status: 'disconnected',
    chainId: null,
    error: null,
    availableWallets: [],
    legacyAvailable: false,
  });
  const [connectedRawProvider, setConnectedRawProvider] = useState<any>(null);

  // Discover installed wallet extensions once on mount (EIP-6963), plus
  // whether a legacy (pre-EIP-6963) window.ethereum is present as a fallback.
  useEffect(() => {
    let cancelled = false;
    discoverInjectedProviders().then((wallets) => {
      if (cancelled) return;
      setState((prev) => ({
        ...prev,
        availableWallets: wallets,
        legacyAvailable: wallets.length === 0 && Boolean(getLegacyInjectedProvider()),
      }));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const resolveProvider = useCallback(
    (walletId: WalletId): any => {
      if (walletId === LEGACY_WALLET_ID) return getLegacyInjectedProvider();
      return state.availableWallets.find((w) => w.info.uuid === walletId)?.provider ?? null;
    },
    [state.availableWallets]
  );

  const ensureCoston2Network = useCallback(async (injected: any) => {
    const currentChainIdHex: string = await injected.request({ method: 'eth_chainId' });
    if (currentChainIdHex?.toLowerCase() === COSTON2_CHAIN_ID_HEX.toLowerCase()) return;

    try {
      await injected.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: COSTON2_CHAIN_ID_HEX }],
      });
    } catch (switchErr: any) {
      // 4902 = chain not added to the wallet yet
      if (switchErr?.code === 4902) {
        await injected.request({
          method: 'wallet_addEthereumChain',
          params: [COSTON2_CHAIN_PARAMS],
        });
      } else {
        throw switchErr;
      }
    }
  }, []);

  const connect = useCallback(
    async (walletId: WalletId) => {
      setState((prev) => ({ ...prev, walletId, address: null, status: 'connecting', chainId: null, error: null }));

      const injected = resolveProvider(walletId);
      if (!injected) {
        setState((prev) => ({
          ...prev,
          walletId,
          address: null,
          status: 'disconnected',
          chainId: null,
          error: 'No injected EVM wallet found for this option. Install MetaMask (or another EVM wallet extension) and reload.',
        }));
        return;
      }

      try {
        const accounts: string[] = await injected.request({ method: 'eth_requestAccounts' });
        if (!accounts || accounts.length === 0) {
          throw new Error('Wallet returned no accounts — connection was likely rejected.');
        }

        await ensureCoston2Network(injected);

        const provider = new ethers.BrowserProvider(injected);
        const network = await provider.getNetwork();

        setConnectedRawProvider(injected);
        setState((prev) => ({
          ...prev,
          walletId,
          address: ethers.getAddress(accounts[0]),
          status: 'connected',
          chainId: Number(network.chainId),
          error: null,
        }));
      } catch (err: any) {
        setState((prev) => ({
          ...prev,
          walletId,
          address: null,
          status: 'disconnected',
          chainId: null,
          error: err?.message || 'Failed to connect wallet.',
        }));
      }
    },
    [resolveProvider, ensureCoston2Network]
  );

  const disconnect = useCallback(() => {
    setConnectedRawProvider(null);
    setState((prev) => ({ ...prev, walletId: null, address: null, status: 'disconnected', chainId: null, error: null }));
  }, []);

  const getSigner = useCallback(async (): Promise<ethers.Signer> => {
    const injected = connectedRawProvider ?? getLegacyInjectedProvider();
    if (!injected) throw new Error('No connected wallet — connect one on the Connect Wallet page first.');
    const provider = new ethers.BrowserProvider(injected);
    return provider.getSigner();
  }, [connectedRawProvider]);

  // Keep state in sync with wallet-initiated account/network changes.
  useEffect(() => {
    const injected = connectedRawProvider;
    if (!injected?.on) return;

    const onAccountsChanged = (accounts: string[]) => {
      if (!accounts || accounts.length === 0) {
        setState((prev) => ({ ...prev, address: null, status: 'disconnected' }));
      } else {
        setState((prev) => ({ ...prev, address: ethers.getAddress(accounts[0]) }));
      }
    };
    const onChainChanged = (chainIdHex: string) => {
      setState((prev) => ({ ...prev, chainId: parseInt(chainIdHex, 16) }));
    };

    injected.on('accountsChanged', onAccountsChanged);
    injected.on('chainChanged', onChainChanged);
    return () => {
      injected.removeListener?.('accountsChanged', onAccountsChanged);
      injected.removeListener?.('chainChanged', onChainChanged);
    };
  }, [connectedRawProvider]);

  const value = useMemo(
    () => ({ ...state, connect, disconnect, getSigner }),
    [state, connect, disconnect, getSigner]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export const WRONG_NETWORK_WARNING = (chainId: number | null) =>
  chainId != null && chainId !== COSTON2_CHAIN_ID ? `Connected to chain ${chainId}, expected Coston2 (${COSTON2_CHAIN_ID}).` : null;
