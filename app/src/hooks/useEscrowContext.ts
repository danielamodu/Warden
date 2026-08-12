import { useContext } from 'react';
import { EscrowContext } from '../contexts/EscrowContext';

export function useEscrowContext() {
  const ctx = useContext(EscrowContext);
  if (!ctx) throw new Error('useEscrowContext must be used within an EscrowProvider');
  return ctx;
}
