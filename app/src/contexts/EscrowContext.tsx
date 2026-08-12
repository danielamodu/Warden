import React, { createContext, useCallback, useMemo, useState } from 'react';

export interface EscrowDraft {
  amount: string;
  conditionType: 'weather' | 'delivery' | 'market' | 'oracle';
  beneficiaryXrplAddress: string;
  location: string;
  thresholdC: string;
}

// Defaults to a real, working XRPL testnet address (the same one this
// project's own live Phase 2/3 escrows have paid out to) rather than an
// obviously-fake XXXXX placeholder — this value is used as the literal
// on-chain beneficiary for a real fund() transaction, so it must resolve to
// a real account, not a decorative placeholder. Still fully editable.
const initialDraft: EscrowDraft = {
  amount: '10',
  conditionType: 'weather',
  beneficiaryXrplAddress: 'rQhiVPjkhTQE9FXriKJhX9LZL9Jy9b4xnP',
  location: 'Dubai',
  thresholdC: '29.9',
};

interface EscrowContextValue {
  draft: EscrowDraft;
  updateDraft: (patch: Partial<EscrowDraft>) => void;
  resetDraft: () => void;
}

export const EscrowContext = createContext<EscrowContextValue | undefined>(undefined);

export function EscrowProvider({ children }: { children: React.ReactNode }) {
  const [draft, setDraft] = useState<EscrowDraft>(initialDraft);

  const updateDraft = useCallback((patch: Partial<EscrowDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  }, []);

  const resetDraft = useCallback(() => setDraft(initialDraft), []);

  const value = useMemo(() => ({ draft, updateDraft, resetDraft }), [draft, updateDraft, resetDraft]);

  return <EscrowContext.Provider value={value}>{children}</EscrowContext.Provider>;
}
