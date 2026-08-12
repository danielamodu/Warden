import { useContext } from 'react';
import { WalletContext } from '../contexts/WalletContext';
export type { WalletId, WalletConnectionStatus } from '../contexts/WalletContext';
export { LEGACY_WALLET_ID } from '../contexts/WalletContext';

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used within a WalletProvider');
  return ctx;
}
